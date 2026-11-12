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
  if (/failed to fetch|networkerror|network request failed/i.test(detalle)) {
    return `${contexto}: sin conexión con Supabase. Revisa tu red y reintenta.`;
  }
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

/** Tope por llamada RPC (ms): evita el "Calculando..." eterno. */
const TIMEOUT_RPC_MS = 15000;

async function llamarRpc(nombre, params, contexto) {
  // Tope por llamada: sin él, si la red o la RPC no responden la tarjeta se
  // queda en "Calculando..." para siempre (el Ing. Carlos Perez reportó ese
  // cuelgue en Eventos resumidos). A los 15 s abortamos y mostramos error.
  const controller = new AbortController();
  const reloj = setTimeout(() => controller.abort(), TIMEOUT_RPC_MS);
  let data = null;
  let error = null;
  try {
    ({ data, error } = await supabase.rpc(nombre, params).abortSignal(controller.signal));
  } catch (e) {
    error = controller.signal.aborted
      ? { message: `sin respuesta en ${TIMEOUT_RPC_MS / 1000} s; revisa tu conexión` }
      : e;
  } finally {
    clearTimeout(reloj);
  }
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

/**
 * Conteo real de eventos por texto de la columna `evento` (agrupación de la
 * tabla entera hecha por SQL): una fila { evento, total } por tipo. Va al
 * reporte "Eventos" del catálogo; PostgREST nunca ve las 100 mil filas.
 */
export async function obtenerConteoEventos(empresaId) {
  if (!empresaId) return [];
  return llamarRpc(
    'agrotrack_conteo_eventos',
    { p_empresa_id: empresaId },
    'No se pudo cargar el conteo de eventos'
  );
}

/** Tope de puntos del recorrido: PostgREST devuelve máximo 1000 filas. */
export const LIMITE_PUNTOS_RECORRIDO = 900;

/**
 * Puntos GPS de una placa para dibujar el recorrido (FASE 2).
 * Cada fila: { id, fecha, latitud, longitud, velocidad, evento, direccion, es_alerta }.
 */
export async function obtenerRecorridoFlota(empresaId, { placa, desde = null, hasta = null } = {}) {
  if (!empresaId || !placa) return [];
  return llamarRpc(
    'agrotrack_recorrido_flota',
    {
      p_empresa_id: empresaId,
      p_placa: placa,
      p_desde: desde,
      p_hasta: hasta,
      p_max_puntos: LIMITE_PUNTOS_RECORRIDO,
    },
    'No se pudo cargar el recorrido'
  );
}

/**
 * Rango de un día calendario en hora de Perú (UTC-5, sin horario de verano):
 * "2026-11-05" -> desde 00:00:00 hasta 23:59:59 de ese día.
 */
export function rangoDiaLima(fechaInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fechaInput || ''))) return { desde: null, hasta: null };
  return {
    desde: `${fechaInput}T00:00:00-05:00`,
    hasta: `${fechaInput}T23:59:59-05:00`,
  };
}

/**
 * Rango libre con fecha Y hora en hora de Perú (UTC-5, sin horario de verano),
 * pedido por el Ing. Carlos Perez ("dos buscadores de fechas con sus
 * respectivas horas"). Entradas tipo datetime-local ("2026-11-05T06:30") ->
 * ISO con offset -05:00 (el "hasta" entra a los 59 segundos, igual que
 * rangoDiaLima). Si falta alguna entrada, desde/hasta quedan en null.
 * @returns {{desde: string|null, hasta: string|null, texto: string}}
 */
export function rangoLibreLima(desdeInput, hastaInput) {
  const armar = (valor, seg) =>
    (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(valor || '')) ? `${valor}:${seg}-05:00` : null);
  const desde = armar(desdeInput, '00');
  const hasta = armar(hastaInput, '59');
  const texto = desde && hasta
    ? `${String(desdeInput).replace('T', ' ')} a ${String(hastaInput).replace('T', ' ')} (hora de Perú)`
    : '';
  return { desde, hasta, texto };
}

/** Último día (en hora de Perú) de un ISO, para precargar el selector de recorrido. */
export function ultimoDiaLima(iso) {
  const value = fecha(iso);
  if (!value) return '';
  try {
    const partes = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: ZONA_PERU,
    }).formatToParts(value);
    const get = (tipo) => partes.find((parte) => parte.type === tipo)?.value || '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    return '';
  }
}

/**
 * Rango de un mes calendario en hora de Perú: "2026-11" -> 00:00:00 del día 1
 * hasta 23:59:59 del último día del mes.
 */
export function rangoMesLima(mesInput) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(mesInput || ''));
  if (!m) return { desde: null, hasta: null };
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  if (!anio || mes < 1 || mes > 12) return { desde: null, hasta: null };
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const dd = (n) => String(n).padStart(2, '0');
  return {
    desde: `${anio}-${dd(mes)}-01T00:00:00-05:00`,
    hasta: `${anio}-${dd(mes)}-${dd(ultimoDia)}T23:59:59-05:00`,
  };
}

/** Segundos -> "8 h 12 min" · "45 min" · "12 s" (para los reportes). */
export function formatearDuracion(segundos) {
  const s = Math.max(0, Math.round(Number(segundos || 0)));
  if (s < 60) return `${s} s`;
  const horas = Math.floor(s / 3600);
  const minutos = Math.round((s % 3600) / 60);
  if (!horas) return `${minutos} min`;
  return `${horas} h ${String(minutos).padStart(2, '0')} min`;
}

/**
 * Etiqueta legible del período de una fila del reporte:
 * '2026-11-05' -> "05 nov" · '2026-11' -> "nov 2026" · null -> "Total".
 * La usa la tabla de la consola y la exportación a Excel (mismo texto).
 */
export function etiquetaPeriodoReporte(fila, modo) {
  if (modo === 'dia') return fila.periodo || '—';
  if (modo === 'mes' && fila.periodo) {
    const [anio, mes] = fila.periodo.split('-');
    const numero = Number(mes);
    return `${MESES_CORTOS[numero - 1] || mes} ${anio}`;
  }
  if (!fila.periodo) return 'Total';
  return fila.periodo;
}

/** Tope de filas del reporte de actividad: PostgREST corta en 1000. */
export const LIMITE_FILAS_ACTIVIDAD = 1000;

/**
 * Reporte de actividad (FASE 3): km, encendido, viaje y ralentí por unidad.
 * Devuelve una fila por unidad y periodo:
 *   agrupar 'dia'   -> periodo '2026-11-05'
 *   agrupar 'mes'   -> periodo '2026-11'
 *   agrupar 'unidad'-> periodo null (totales del rango)
 * Requiere: ejecutar scripts/agrotrack-reportes-flota.sql en Supabase.
 */
export async function obtenerActividadFlota(
  empresaId,
  { desde = null, hasta = null, placa = null, agrupar = 'dia', limite = LIMITE_FILAS_ACTIVIDAD } = {}
) {
  if (!empresaId) return [];
  return llamarRpc(
    'agrotrack_actividad_flota',
    {
      p_empresa_id: empresaId,
      p_desde: desde,
      p_hasta: hasta,
      p_placa: placa,
      p_agrupar: agrupar,
      p_limite: limite,
    },
    'No se pudo cargar el reporte de actividad'
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
