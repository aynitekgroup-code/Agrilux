/**
 * src/lib/agrotrackMapaHistorico.js
 * Paginación del recorrido histórico (observación VII).
 *
 * CRITERIO DE PAGINACIÓN (la RPC no tiene offset):
 * agrotrack_recorrido_flota(p_empresa_id, p_placa, p_desde, p_hasta,
 * p_max_puntos) devuelve los puntos de un RANGO y, si el rango trae más de
 * p_max_puntos, muestrea por paso entero (nunca pasa de 1000 filas, el tope
 * de PostgREST). No acepta offset/limit, así que cada "página" es una
 * VENTANA TEMPORAL contigua del rango pedido:
 *
 *   - ventana objetivo: 16 horas por página. Con el ritmo de Zonar (un punto
 *     GPS cada ~2 minutos) son ~480 puntos: un tamaño de página cercano a
 *     las 500 filas pedido y por debajo del tope de 1000 de PostgREST.
 *   - si el rango no cabe en MAX_PAGINAS_RECORRIDO (20) ventanas de 16 h
 *     (> 13 días), la ventana se amplía a (duración total / 20) para no
 *     pasar de 20 llamadas RPC. Nunca se descarga el histórico completo:
 *     el navegador solo conserva la página cargada (<= 900 filas).
 *   - cada llamada pide p_max_puntos = LIMITE_PUNTOS_RECORRIDO (900).
 *
 * Si una ventana vuelve llena (>= 900 puntos) la RPC la muestreó: se avisa
 * en pantalla para que el usuario reduzca el rango.
 */
import { LIMITE_PUNTOS_RECORRIDO, obtenerRecorridoFlota } from './agrotrackFlota';

/** Máximo de páginas (llamadas RPC) por rango pedido. */
export const MAX_PAGINAS_RECORRIDO = 20;

/** Ventana de página objetivo: 16 h (~480 puntos al ritmo de Zonar ≈ 500 filas). */
export const VENTANA_OBJETIVO_MS = 16 * 60 * 60 * 1000;

/** Etiqueta corta de una ventana en hora de Perú, para la barra de páginas. */
function isoDe(ms) {
  return new Date(ms).toISOString();
}

/**
 * Divide un rango (ISO con offset de Perú) en ventanas/páginas.
 * @returns {{ok: boolean, motivo?: string, totalPaginas?: number,
 *            ventanaMs?: number, desdeMs?: number, hastaMs?: number,
 *            paginas?: Array<{indice:number, desdeMs:number, hastaMs:number,
 *                             desde:string, hasta:string}>}}
 */
export function planearPaginas(desdeIso, hastaIso) {
  const desdeMs = Date.parse(String(desdeIso || ''));
  const hastaMs = Date.parse(String(hastaIso || ''));
  if (!Number.isFinite(desdeMs) || !Number.isFinite(hastaMs)) {
    return { ok: false, motivo: 'Elige fecha y hora de inicio y de fin (hora de Perú).' };
  }
  if (hastaMs <= desdeMs) {
    return { ok: false, motivo: 'La fecha "hasta" debe ser posterior a la de "desde".' };
  }

  const duracion = hastaMs - desdeMs;
  const ventanaMs = duracion <= VENTANA_OBJETIVO_MS
    ? duracion
    : Math.ceil(duracion / MAX_PAGINAS_RECORRIDO);
  const totalPaginas = Math.max(1, Math.ceil(duracion / ventanaMs));

  const paginas = [];
  for (let i = 0; i < totalPaginas; i += 1) {
    const inicio = desdeMs + i * ventanaMs;
    // -1 ms en el "hasta" para que el punto exacto del corte no aparezca en
    // dos páginas seguidas (la RPC filtra fecha >= desde y fecha <= hasta).
    const fin = Math.min(desdeMs + (i + 1) * ventanaMs - 1, hastaMs);
    paginas.push({
      indice: i + 1,
      desdeMs: inicio,
      hastaMs: fin,
      desde: isoDe(inicio),
      hasta: isoDe(fin),
    });
  }

  return { ok: true, totalPaginas, ventanaMs, desdeMs, hastaMs, paginas };
}

/**
 * Carga UNA página (ventana) del recorrido. Nunca trae más de
 * LIMITE_PUNTOS_RECORRIDO (900) filas: la RPC muestrea si hay más.
 * @returns {{puntos: Array, muestreada: boolean}}
 */
export async function cargarPaginaRecorrido(empresaId, { placa, pagina }) {
  if (!empresaId || !placa || !pagina) return { puntos: [], muestreada: false };
  const puntos = await obtenerRecorridoFlota(empresaId, {
    placa,
    desde: pagina.desde,
    hasta: pagina.hasta,
  });
  return {
    puntos: puntos || [],
    muestreada: (puntos || []).length >= LIMITE_PUNTOS_RECORRIDO,
  };
}

/** Texto del rango de una página ("05/11 · 00:00 a 06/11 · 00:00"). */
export function textoVentana(pagina, formatear) {
  if (!pagina) return '';
  const f = formatear || ((iso) => new Date(iso).toLocaleString('es-PE'));
  return `${f(pagina.desde)} a ${f(pagina.hasta)}`;
}
