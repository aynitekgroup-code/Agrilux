/**
 * src/lib/agrotrackVisitasDia.js
 * Visitas a geocercas GUARDADAS por día (scripts/agrotrack-visitas-diarias.sql):
 * el reporte de TODAS las unidades juntas y la tabla dinámica de las 6:30 a. m.
 *
 * Cómo evita los dos límites de Supabase:
 *   - 8 s por consulta: nunca se calcula un día entero desde la web; se piden
 *     los (día, placa) pendientes y se calculan de a UNA placa (cada llamada
 *     tarda menos de 1 s). pg_cron y el agente de Zonar ya calculan casi todo,
 *     así que normalmente no queda nada pendiente.
 *   - 1000 filas por respuesta: la lectura se pagina con p_offset/p_limite.
 *
 * Las funciones puras (partesLima, armarMatriz, duracionTexto) no tocan la red
 * y se prueban con node (tests/visitasDia.test.mjs).
 */

const PAGINA = 1000;
const MAX_PAGINAS = 50; // 50 000 visitas: un mes completo de toda la flota
const AVISO_SQL = 'Falta ejecutar scripts/agrotrack-visitas-diarias.sql en Supabase (SQL Editor).';

async function cliente() {
  const { supabase } = await import('./supabase');
  return supabase;
}

function mensaje(error, contexto) {
  const detalle = String(error?.message || error || 'error desconocido');
  if (error?.code === 'PGRST202' || /could not find the function|schema cache/i.test(detalle)) {
    return AVISO_SQL;
  }
  if (/statement timeout|canceling statement/i.test(detalle)) {
    return `${contexto}: el cálculo tardó más de 8 s. Vuelve a intentarlo (se continúa donde quedó).`;
  }
  return `${contexto}: ${detalle}`;
}

async function rpc(nombre, params, contexto) {
  const supabase = await cliente();
  const { data, error } = await supabase.rpc(nombre, params);
  if (error) {
    const e = new Error(mensaje(error, contexto));
    e.faltaSql = mensaje(error, contexto) === AVISO_SQL;
    throw e;
  }
  return data ?? [];
}

/** (día, placa) que faltan calcular o tienen posiciones nuevas. */
export async function pendientesVisitasDia(empresaId, desdeDia, hastaDia) {
  return rpc(
    'agrotrack_visitas_dia_pendientes',
    { p_empresa_id: empresaId, p_desde_dia: desdeDia, p_hasta_dia: hastaDia },
    'No se pudo revisar qué días faltan calcular',
  );
}

/**
 * Calcula lo pendiente de a una placa por llamada.
 * @param {(hechas:number,total:number,actual:{dia,placa})=>void} onProgreso
 * @returns {Promise<{calculadas:number, errores:string[]}>}
 */
export async function asegurarVisitasCalculadas(empresaId, desdeDia, hastaDia, onProgreso) {
  const pendientes = await pendientesVisitasDia(empresaId, desdeDia, hastaDia);
  const errores = [];
  let hechas = 0;
  for (const p of pendientes) {
    onProgreso?.(hechas, pendientes.length, p);
    try {
      await rpc(
        'agrotrack_calcular_visitas_dia',
        { p_empresa_id: empresaId, p_dia: p.dia, p_placa: p.placa },
        `No se pudo calcular ${p.placa} del ${p.dia}`,
      );
    } catch (e) {
      if (e.faltaSql) throw e;
      errores.push(e.message);
    }
    hechas += 1;
  }
  onProgreso?.(hechas, pendientes.length, null);
  return { calculadas: hechas, errores };
}

async function paginado(nombre, params, contexto) {
  const filas = [];
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina += 1) {
    const lote = await rpc(nombre, { ...params, p_offset: pagina * PAGINA, p_limite: PAGINA }, contexto);
    filas.push(...lote);
    if (lote.length < PAGINA) break;
  }
  return filas;
}

/**
 * Deja solo las visitas que tocan el rango pedido. La tabla guarda visitas
 * completas por día; con un rango "Desde / hasta" con hora hay que descartar
 * las que quedan fuera. Una visita abierta (sin salida) entra si empezó antes
 * del final del rango.
 * @param {Array} filas  visitas de agrotrack_visitas_dia_flota
 * @param {string} desde ISO del inicio del rango (o null)
 * @param {string} hasta ISO del final del rango (o null)
 */
export function filtrarVisitasPorRango(filas, desde, hasta) {
  const t0 = Date.parse(desde || '');
  const t1 = Date.parse(hasta || '');
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) return filas || [];
  return (filas || []).filter((f) => {
    const ini = Date.parse(f?.entrada || '');
    if (!Number.isFinite(ini)) return false;
    const fin = Date.parse(f?.salida || '');
    if (!Number.isFinite(fin)) return ini <= t1; // abierta
    return fin >= t0 && ini <= t1;
  });
}

/** Todas las visitas guardadas del rango (todas las unidades). */
export async function leerVisitasDia(empresaId, { desdeDia, hastaDia, placa = '', geocerca = '' }) {
  return paginado(
    'agrotrack_visitas_dia_flota',
    {
      p_empresa_id: empresaId,
      p_desde_dia: desdeDia,
      p_hasta_dia: hastaDia,
      p_placa: placa || null,
      p_geocerca: geocerca || null,
    },
    'No se pudieron leer las visitas guardadas',
  );
}

/** Horas por placa x geocerca (base de la tabla dinámica). */
export async function leerTablaGeocercasDia(empresaId, { desdeDia, hastaDia, placa = '', geocerca = '' }) {
  return paginado(
    'agrotrack_tabla_geocercas_dia',
    {
      p_empresa_id: empresaId,
      p_desde_dia: desdeDia,
      p_hasta_dia: hastaDia,
      p_placa: placa || null,
      p_geocerca: geocerca || null,
    },
    'No se pudo leer la tabla de geocercas',
  );
}

/* ------------------------------------------------------------------------
 * Funciones puras
 * ---------------------------------------------------------------------- */

/** ISO -> { fecha: 'YYYY-MM-DD', hora: 'HH:mm:ss' } en hora de Perú (UTC-5). */
export function partesLima(iso) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return { fecha: '', hora: '' };
  const d = new Date(t - 5 * 3600 * 1000);
  const dd = (n) => String(n).padStart(2, '0');
  return {
    fecha: `${d.getUTCFullYear()}-${dd(d.getUTCMonth() + 1)}-${dd(d.getUTCDate())}`,
    hora: `${dd(d.getUTCHours())}:${dd(d.getUTCMinutes())}:${dd(d.getUTCSeconds())}`,
  };
}

/** 3770 -> "01h:02m:50s" (el formato de Zonar). */
export function duracionTexto(segundos) {
  if (segundos == null || segundos === '') return '';
  const s = Math.max(0, Math.round(Number(segundos)));
  const dd = (n) => String(n).padStart(2, '0');
  return `${dd(Math.floor(s / 3600))}h:${dd(Math.floor((s % 3600) / 60))}m:${dd(s % 60)}s`;
}

/** Segundos -> horas con 2 decimales. */
export function horasDecimal(segundos) {
  return Math.round((Number(segundos || 0) / 3600) * 100) / 100;
}

/** Texto después de la "/" de la unidad ("T8F-909/APLI.DRON" -> "APLI.DRON"). */
export function codigoArea(unidad, placa = '') {
  const texto = String(unidad || '').trim();
  const i = texto.indexOf('/');
  if (i === -1) return texto && texto !== placa ? texto : '';
  return texto.slice(i + 1).trim();
}

export const METRICAS = [
  { id: 'duracion_segundos', label: 'Total en geocerca' },
  { id: 'apagado_segundos', label: 'Apagado' },
  { id: 'ralenti_segundos', label: 'Ralentí' },
  { id: 'viaje_segundos', label: 'Viajando' },
];

/**
 * Matriz de la tabla dinámica: filas = placa (con su área/grupo),
 * columnas = geocercas, valor = horas de la métrica elegida.
 * @param {Array} tabla        filas de agrotrack_tabla_geocercas_dia
 * @param {Object} infoPlaca   { placa: { area, grupo } }
 * @param {string} metrica     una de METRICAS[].id
 */
export function armarMatriz(tabla, infoPlaca = {}, metrica = 'duracion_segundos') {
  const geocercas = [...new Set((tabla || []).map((f) => f.geocerca))].sort((a, b) => a.localeCompare(b, 'es'));
  const porPlaca = new Map();
  for (const f of tabla || []) {
    const fila = porPlaca.get(f.placa) || {
      placa: f.placa,
      area: infoPlaca[f.placa]?.area || '',
      grupo: infoPlaca[f.placa]?.grupo || '',
      valores: {},
      total: 0,
    };
    const seg = Number(f[metrica] || 0);
    fila.valores[f.geocerca] = (fila.valores[f.geocerca] || 0) + seg;
    fila.total += seg;
    porPlaca.set(f.placa, fila);
  }
  const filas = [...porPlaca.values()].sort((a, b) =>
    (a.grupo || a.area || 'zzz').localeCompare(b.grupo || b.area || 'zzz', 'es')
    || a.placa.localeCompare(b.placa, 'es'));
  const totales = {};
  let totalGeneral = 0;
  for (const g of geocercas) {
    totales[g] = filas.reduce((s, f) => s + (f.valores[g] || 0), 0);
    totalGeneral += totales[g];
  }
  return { geocercas, filas, totales, totalGeneral };
}
