/**
 * src/lib/agrotrackFlota.js
 * Panel de flota (FASE 1) a partir de public.agrotrack_posiciones.
 *
 * Todo el agregado se hace en SQL (RPC) porque PostgREST devuelve máximo
 * 1000 filas por consulta y la tabla tiene +100 mil registros.
 * Requiere: ejecutar scripts/agrotrack-posiciones-resumen.sql en Supabase.
 */
import { supabase } from './supabase';

/**
 * ÚNICO LUGAR donde se define cuándo una unidad se considera "sin conexión".
 * Los datos son históricos: la comparación NUNCA es contra la fecha de hoy,
 * sino contra la fecha máxima del periodo cargado (max(fecha) de la empresa).
 */
export const UMBRAL_SIN_CONEXION_MINUTOS = 30;

const EVENTO_EN_MOVIMIENTO = /conducci|en marcha|viaje|alta velocidad|ignici[oó]n encendida|salida de geocerca/i;
const EVENTO_DETENIDO = /estacionad|detenid|ignici[oó]n apagada|apagad/i;
const VELOCIDAD_MINIMA_EN_RUTA = 2; // km/h; por debajo se considera detenida

/**
 * Cuántas alertas trae el panel (la lista más reciente).
 * Con los datos actuales hay 279 (255 alta velocidad + 24 botón de pánico),
 * así que el tope no recorta; si un día lo supera, el pie lo indicará.
 */
export const LIMITE_ALERTAS_PANEL = 500;

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const ZONA_PERU = 'America/Lima';

function fecha(iso) {
  const value = typeof iso === 'string' ? Date.parse(iso) : Number(iso);
  return Number.isFinite(value) ? new Date(value) : null;
}

/** "2026-11-05T14:02:00-05:00" -> "05/11 · 14:02" (hora de Perú) */
export function formatearFechaHora(iso) {
  const value = fecha(iso);
  if (!value) return '—';
  try {
    const partes = new Intl.DateTimeFormat('es-PE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: ZONA_PERU,
    }).formatToParts(value);
    const get = (tipo) => partes.find((parte) => parte.type === tipo)?.value || '';
    return `${get('day')}/${get('month')} · ${get('hour')}:${get('minute')}`;
  } catch {
    return '—';
  }
}

/** "2026-11-05T14:02:00-05:00" -> "5 nov 2026, 14:02" */
export function formatearFechaLarga(iso) {
  const value = fecha(iso);
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('es-PE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: ZONA_PERU,
    }).format(value);
  } catch {
    return '—';
  }
}

/** Rango para el banner: "1 – 5 nov 2026" o "1 nov – 5 dic 2026" */
export function formatearRango(desde, hasta) {
  const d = fecha(desde);
  const h = fecha(hasta);
  if (!d || !h) return '—';
  const dia = (value) => value.getDate();
  const mes = (value) => MESES_CORTOS[value.getMonth()];
  const anio = (value) => value.getFullYear();
  const mismoMes = d.getMonth() === h.getMonth() && d.getFullYear() === h.getFullYear();
  return mismoMes
    ? `${dia(d)} – ${dia(h)} ${mes(h)} ${anio(h)}`
    : `${dia(d)} ${mes(d)} – ${dia(h)} ${mes(h)} ${anio(h)}`;
}

/** Texto obligatorio del criterio de estado, con el periodo cargado. */
export function textoPeriodoCargado(periodo) {
  if (!periodo?.desde || !periodo?.hasta) return 'Último estado del periodo cargado: sin datos';
  return `Último estado del periodo cargado: ${formatearRango(periodo.desde, periodo.hasta)}`;
}

/**
 * Criterio único de estado de una unidad.
 * Compara la última posición contra la fecha máxima del periodo cargado,
 * no contra la fecha actual del navegador.
 * @returns 'en_ruta' | 'detenido' | 'offline'
 */
export function clasificarEstado(unidad, fechaMaxPeriodo) {
  const ultima = fecha(unidad?.ultima_fecha);
  const maximo = fecha(fechaMaxPeriodo);
  if (!ultima || !maximo) return 'offline';
  const desfaseMinutos = (maximo.getTime() - ultima.getTime()) / 60000;
  if (desfaseMinutos > UMBRAL_SIN_CONEXION_MINUTOS) return 'offline';

  const evento = String(unidad.ultimo_evento || '');
  if (EVENTO_EN_MOVIMIENTO.test(evento)) return 'en_ruta';
  if (EVENTO_DETENIDO.test(evento)) return 'detenido';
  return Number(unidad.ultima_velocidad || 0) > VELOCIDAD_MINIMA_EN_RUTA ? 'en_ruta' : 'detenido';
}

/** Severidad para la UI a partir del texto real del evento. */
export function severidadDeEvento(evento) {
  const texto = String(evento || '').toLowerCase();
  if (texto.includes('pánico') || texto.includes('panico')) return 'critica';
  if (texto.includes('alta velocidad')) return 'alta';
  return 'info';
}

function mensajeDeError(error, contexto) {
  const detalle = error?.message || String(error);
  if (
    error?.code === 'PGRST202' ||
    /could not find the function|function .* does not exist|does not exist/i.test(detalle)
  ) {
    return 'Falta ejecutar scripts/agrotrack-posiciones-resumen.sql en el SQL Editor de Supabase.';
  }
  if (error?.code === '42P01' || /schema cache|relation .* does not exist/i.test(detalle)) {
    return 'Falta crear la tabla agrotrack_posiciones. Ejecuta scripts/agrotrack-posiciones.sql en Supabase.';
  }
  if (/permission denied|row-level security/i.test(detalle)) {
    return 'Sin permiso sobre agrotrack_posiciones para esta empresa activa.';
  }
  return `${contexto}: ${detalle}`;
}

async function llamarRpc(nombre, params, contexto) {
  const { data, error } = await supabase.rpc(nombre, params);
  if (error) throw new Error(mensajeDeError(error, contexto));
  return data || [];
}

/** Min/max(fecha), unidades y registros de la empresa activa. */
export async function obtenerPeriodoFlota(empresaId) {
  const filas = await llamarRpc('agrotrack_periodo_flota', { p_empresa_id: empresaId }, 'No se pudo leer el periodo');
  const fila = filas[0] || {};
  return {
    desde: fila.desde || null,
    hasta: fila.hasta || null,
    unidades: Number(fila.unidades || 0),
    registros: Number(fila.registros || 0),
  };
}

/** Una fila por placa con última posición, km y conteo de alta velocidad. */
export async function obtenerResumenFlota(empresaId, { desde = null, hasta = null } = {}) {
  return llamarRpc(
    'agrotrack_resumen_flota',
    { p_empresa_id: empresaId, p_desde: desde, p_hasta: hasta },
    'No se pudo cargar el resumen de flota'
  );
}

/** Eventos de "Alta velocidad" y "Botón de pánico" más recientes. */
export async function obtenerAlertasFlota(empresaId, { desde = null, hasta = null, limite = LIMITE_ALERTAS_PANEL } = {}) {
  return llamarRpc(
    'agrotrack_alertas_flota',
    { p_empresa_id: empresaId, p_desde: desde, p_hasta: hasta, p_limite: limite },
    'No se pudieron cargar las alertas'
  );
}

function aVehiculo(fila, fechaMaxPeriodo) {
  return {
    id: fila.placa,
    placa: fila.placa,
    descripcion: fila.descripcion || fila.unidad || '',
    modelo: fila.descripcion || fila.unidad || '',
    estado: clasificarEstado(fila, fechaMaxPeriodo),
    lat: Number.isFinite(Number(fila.ultima_lat)) ? Number(fila.ultima_lat) : null,
    lng: Number.isFinite(Number(fila.ultima_lon)) ? Number(fila.ultima_lon) : null,
    velocidad_kmh: Number(fila.ultima_velocidad || 0),
    ultima_fecha: fila.ultima_fecha,
    ultimo_evento: fila.ultimo_evento || '',
    km_recorridos: Number(fila.km_recorridos || 0),
    eventos_alta_velocidad: Number(fila.eventos_alta_velocidad || 0),
    fuente: 'real',
  };
}

function aAlerta(fila) {
  const velocidad = fila.velocidad !== null && fila.velocidad !== undefined && fila.velocidad !== ''
    ? `${fila.velocidad} km/h`
    : '';
  const tramo = [velocidad, fila.direccion].filter(Boolean).join(' · ');
  return {
    id: `pos-${fila.id}`,
    vehiculo_id: fila.placa,
    placa: fila.placa,
    unidad: fila.unidad || fila.placa,
    tipo: fila.evento,
    mensaje: tramo || 'Evento registrado en agrotrack_posiciones',
    severidad: severidadDeEvento(fila.evento),
    fecha: formatearFechaHora(fila.fecha),
    fecha_iso: fila.fecha,
    origen: 'Zonar',
    atendida: false,
    fuente: 'real',
  };
}

/**
 * Carga todo el panel de la Fase 1 en una sola llamada.
 * @returns {{
 *   estado: 'real'|'vacio'|'error',
 *   periodo: {desde:string|null, hasta:string|null, unidades:number, registros:number}|null,
 *   unidades: Array, alertas: Array, error: string|null
 * }}
 */
export async function cargarPanelFlota(empresaId) {
  if (!empresaId) {
    return { estado: 'vacio', periodo: null, unidades: [], alertas: [], error: null };
  }
  try {
    const periodo = await obtenerPeriodoFlota(empresaId);
    if (!periodo.registros) {
      return { estado: 'vacio', periodo: null, unidades: [], alertas: [], error: null };
    }
    const [filasResumen, filasAlertas] = await Promise.all([
      obtenerResumenFlota(empresaId),
      obtenerAlertasFlota(empresaId, { limite: LIMITE_ALERTAS_PANEL }),
    ]);
    return {
      estado: filasResumen.length ? 'real' : 'vacio',
      periodo,
      unidades: filasResumen.map((fila) => aVehiculo(fila, periodo.hasta)),
      alertas: filasAlertas.map(aAlerta),
      error: null,
    };
  } catch (error) {
    return {
      estado: 'error',
      periodo: null,
      unidades: [],
      alertas: [],
      error: error?.message || 'No se pudieron cargar los datos de flota.',
    };
  }
}
