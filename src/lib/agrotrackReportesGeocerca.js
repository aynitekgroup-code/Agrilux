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
 * @returns filas { grupo_tipo, grupo, entradas, salidas, unidades, ultima_entrada }
 */
export async function obtenerEventosGeocerca(
  empresaId,
  { desde = null, hasta = null, agrupar = 'geocerca', limite = LIMITE_EVENTOS_GEOCERCA } = {}
) {
  if (!empresaId) return [];
  return llamarRpc(
    'agrotrack_eventos_geocerca_flota',
    { p_empresa_id: empresaId, p_desde: desde, p_hasta: hasta, p_agrupar: agrupar, p_limite: limite },
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
