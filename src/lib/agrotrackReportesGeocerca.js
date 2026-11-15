/**
 * src/lib/agrotrackReportesGeocerca.js
 * Reportes de geocercas (FASE 3.5) y estado de unidades (FASE 3.6) a partir
 * de public.agrotrack_posiciones y public.agrotrack_geocercas.
 *
 * Todo se calcula en SQL (RPC) porque PostgREST devuelve máximo 1000 filas
 * por consulta y el cruce son +100 mil posiciones x 129 polígonos:
 *   1) agrotrack_eventos_geocerca_flota : entradas / salidas por geocerca
 *      (eventos de Zonar), agrupables por geocerca, día o mes.
 *   2) agrotrack_lotes_flota            : tiempo dentro de cada lote
 *      (punto-dentro-de-polígono con PostGIS).
 *   3) agrotrack_estado_unidades_flota  : última posición de cada placa en el
 *      rango + la geocerca actual (polígono PostGIS que la contiene).
 *   4) agrotrack_visitas_geocerca_flota : una fila por visita (entrada y
 *      salida de cada polígono, estilo Zonar) con el desglose apagado /
 *      ralentí / viajando y la marca "abierta" de las que siguen dentro.
 *   5) agrotrack_guardar_respaldo_visitas: guarda en una tabla el respaldo
 *      de las visitas de un rango (auditoría sin volver a calcular).
 *
 * Requiere: ejecutar scripts/agrotrack-geocercas-reportes.sql en Supabase
 * (crea la extensión postGIS en su sección 0).
 */
import { supabase } from './supabase';

/** Tope de filas de cada reporte: PostgREST corta en 1000. */
export const LIMITE_EVENTOS_GEOCERCA = 500;
export const LIMITE_LOTES = 200;
export const LIMITE_ESTADO_UNIDADES = 500;

function mensajeDeError(error, contexto) {
  const detalle = error?.message || String(error);
  if (/failed to fetch|networkerror|network request failed/i.test(detalle)) {
    return `${contexto}: sin conexión con Supabase. Revisa tu red y reintenta.`;
  }
  if (
    error?.code === 'PGRST202' ||
    /could not find the function|function .* does not exist|does not exist/i.test(detalle)
  ) {
    return 'Falta ejecutar scripts/agrotrack-geocercas-reportes.sql en el SQL Editor de Supabase.';
  }
  if (/postgis|st_contains|st_geomfromgeojson/i.test(detalle)) {
    return 'PostGIS no está disponible en la base. Ejecuta scripts/agrotrack-geocercas-reportes.sql '
      + '(su sección 0 crea la extensión con create extension postgis).';
  }
  if (/statement timeout|canceling statement|due to timeout/i.test(detalle)) {
    return 'El cálculo tardó más de los 8 s que Supabase permite. Reduce el rango (por ejemplo a un día).';
  }
  if (error?.code === '42P01' || /schema cache|relation .* does not exist/i.test(detalle)) {
    return 'Falta la tabla agrotrack_geocercas o agrotrack_posiciones en esta base.';
  }
  if (/permission denied|row-level security/i.test(detalle)) {
    return 'Sin permiso sobre agrotrack_geocercas / agrotrack_posiciones para esta empresa activa.';
  }
  return `${contexto}: ${detalle}`;
}

/** Tope por llamada RPC (ms): evita el "Calculando..." eterno. */
const TIMEOUT_RPC_MS = 15000;

async function llamarRpc(nombre, params, contexto) {
  // Sin este tope, si la red o la RPC no responden la tarjeta queda cargando
  // para siempre (cuelgue reportado por el Ing. Carlos Perez).
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

/**
 * Entradas y salidas de geocerca (eventos de Zonar).
 * @param {'geocerca'|'dia'|'mes'} agrupar
 * @param {Array<string>} [placas] filtro opcional por conjunto de placas
 *        (selector "Mostrar: Unidades / Grupos"). Solo se envía cuando trae
 *        placas: si la base no tiene la firma con p_placas, la llamada sin
 *        filtro sigue resolviendo y al filtrar se pide la firma nueva.
 * @returns filas { grupo_tipo, grupo, entradas, salidas, unidades, ultima_entrada }
 */
export async function obtenerEventosGeocerca(
  empresaId,
  { desde = null, hasta = null, agrupar = 'geocerca', limite = LIMITE_EVENTOS_GEOCERCA, placas = null } = {}
) {
  if (!empresaId) return [];
  const params = { p_empresa_id: empresaId, p_desde: desde, p_hasta: hasta, p_agrupar: agrupar, p_limite: limite };
  if (Array.isArray(placas) && placas.length) params.p_placas = placas;
  return llamarRpc(
    'agrotrack_eventos_geocerca_flota',
    params,
    'No se pudo cargar el reporte de entradas y salidas'
  );
}

/**
 * Tiempo dentro de cada lote (punto dentro del polígono, PostGIS).
 * @param {string|null} placa   filtrar una sola unidad ("la máquina")
 * @param {string|null} horaDesde franja horaria del día en hora de Perú
 * @param {string|null} horaHasta   (ej. '06:00'..'18:00', con minutos)
 * @returns filas { geocerca_id, lote, division, anexo, area_ha, unidades, visitas,
 *                  permanencia_segundos, km_recorridos, puntos, vel_max_kmh,
 *                  primera_visita, ultima_visita }
 */
export async function obtenerLotesFlota(
  empresaId,
  { desde = null, hasta = null, placa = '', horaDesde = '', horaHasta = '', limite = LIMITE_LOTES } = {}
) {
  if (!empresaId) return [];
  // Los filtros nuevos se envían SOLO cuando tienen valor: así, mientras en
  // Supabase no se haya ejecutado la versión actualizada del script, la
  // llamada sigue resolviendo contra la firma anterior (4 argumentos) y el
  // reporte no se rompe; al poner un filtro, PostgREST pide la firma nueva.
  const params = { p_empresa_id: empresaId, p_desde: desde, p_hasta: hasta, p_limite: limite };
  if (placa) params.p_placa = placa;
  if (horaDesde) params.p_hora_desde = horaDesde;
  if (horaHasta) params.p_hora_hasta = horaHasta;
  return llamarRpc(
    'agrotrack_lotes_flota',
    params,
    'No se pudo cargar el tiempo en cada lote'
  );
}

/**
 * Estado de unidades (reporte 34 de Zonar): una fila por placa con su
 * posición más reciente del rango y la geocerca actual (PostGIS).
 * Si la última posición está fuera, geocerca_ultima/geocerca_ultima_fecha
 * traen la última geocerca de campo en la que estuvo (evento pt_referencia).
 * @returns filas { placa, unidad, ultima_fecha, ultimo_evento, ultima_velocidad,
 *                  direccion, latitud, longitud, geocerca, geocerca_division,
 *                  geocerca_ultima, geocerca_ultima_fecha }
 */
export async function obtenerEstadoUnidadesFlota(
  empresaId,
  { desde = null, hasta = null, limite = LIMITE_ESTADO_UNIDADES } = {}
) {
  if (!empresaId) return [];
  return llamarRpc(
    'agrotrack_estado_unidades_flota',
    { p_empresa_id: empresaId, p_desde: desde, p_hasta: hasta, p_limite: limite },
    'No se pudo cargar el estado de unidades'
  );
}

/** Tope de filas del reporte de visitas: PostgREST corta en 1000. */
export const LIMITE_VISITAS_GEOCERCA = 1000;

/**
 * Llama una RPC cuyo primer parámetro es la empresa y que todavía puede no
 * estar creada en la base. El nombre primario es `p_empresa_id` (el que
 * usan TODAS las RPC de reportes, incluidas las nuevas del script); si
 * PostgREST no encuentra la función con esa firma (PGRST202), se reintenta
 * UNA vez con `p_empresa` (el nombre del contrato escrito): así, aunque el
 * SQL haya quedado con la firma distinta, la tarjeta no se rompe. Si el
 * script todavía no se ejecutó, el segundo intento falla igual y se muestra
 * el aviso amable de "ejecuta scripts/agrotrack-geocercas-reportes.sql".
 */
async function llamarRpcEmpresa(nombre, params, contexto) {
  try {
    return await llamarRpc(nombre, params, contexto);
  } catch (e) {
    const mensaje = String(e?.message || '');
    const faltaSql = mensaje.includes('Falta ejecutar scripts/agrotrack-geocercas-reportes.sql');
    if (!faltaSql || !('p_empresa_id' in params)) throw e;
    const { p_empresa_id, ...resto } = params;
    return llamarRpc(nombre, { ...resto, p_empresa: p_empresa_id }, contexto);
  }
}

/**
 * Límite de velocidad por geocerca (FASE 4): episodios de exceso del
 * velocidad_max_kmh configurado en cada geocerca, calculados con PostGIS
 * sobre las posiciones y solo en geocercas con ese límite configurado.
 * @param {Array<string>} [placas] filtro opcional por conjunto de placas
 *        (selector "Mostrar: Unidades / Grupos").
 * @returns filas { geocerca_id, geocerca, division, placa, unidad, inicio,
 *                  fin, duracion_segundos, vel_max_kmh, velocidad_max_kmh,
 *                  exceso_kmh, puntos, direccion, evento }
 */
export async function obtenerLimiteVelocidadFlota(
  empresaId,
  { desde = null, hasta = null, placas = null, geocerca = '', limite = LIMITE_ESTADO_UNIDADES } = {}
) {
  if (!empresaId) return [];
  const params = { p_empresa_id: empresaId, p_desde: desde, p_hasta: hasta, p_limite: limite };
  if (Array.isArray(placas) && placas.length) params.p_placas = placas;
  if (geocerca) params.p_geocerca = geocerca;
  return llamarRpcEmpresa(
    'agrotrack_limite_velocidad_flota',
    params,
    'No se pudo cargar el reporte de límite de velocidad'
  );
}

/**
 * Visitas por geocerca (FASE 4): una fila por visita, al estilo de Zonar.
 * Contrato: agrotrack_visitas_geocerca_flota(p_empresa_id, p_desde, p_hasta,
 * p_placa default null, p_geocerca default null). Los filtros opcionales solo
 * se envían cuando tienen valor (misma estrategia que agrotrack_lotes_flota).
 * @returns filas { placa, geocerca, entrada, salida, duracion_segundos,
 *                  apagado_segundos, ralenti_segundos, viaje_segundos, abierta }
 */
export async function obtenerVisitasGeocerca(
  empresaId,
  { desde = null, hasta = null, placa = '', geocerca = '' } = {}
) {
  if (!empresaId) return [];
  const params = { p_empresa_id: empresaId, p_desde: desde, p_hasta: hasta };
  if (placa) params.p_placa = placa;
  if (geocerca) params.p_geocerca = geocerca;
  return llamarRpcEmpresa(
    'agrotrack_visitas_geocerca_flota',
    params,
    'No se pudieron cargar las visitas por geocerca'
  );
}

/** PostgREST devuelve el entero suelto o envuelto; aquí se normaliza a número. */
function aEntero(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
  if (typeof valor === 'string') return Number(valor) || 0;
  if (Array.isArray(valor)) return aEntero(valor[0]);
  if (valor && typeof valor === 'object') {
    const clave = Object.keys(valor)[0];
    return clave ? aEntero(valor[clave]) : 0;
  }
  return 0;
}

/**
 * Guarda el respaldo de las visitas de un rango en la base (auditoría).
 * @param {Array} filas  las filas visibles del rango (array JSON -> jsonb)
 * @returns {Promise<number>} cuántas filas guardó la base
 */
export async function guardarRespaldoVisitas(empresaId, { desde = null, hasta = null, filas = [] } = {}) {
  if (!empresaId) throw new Error('Selecciona una empresa activa para guardar el respaldo.');
  const resultado = await llamarRpcEmpresa(
    'agrotrack_guardar_respaldo_visitas',
    { p_empresa_id: empresaId, p_desde: desde, p_hasta: hasta, p_filas: filas },
    'No se pudo guardar el respaldo de visitas'
  );
  return aEntero(resultado);
}
