/**
 * src/lib/reportesIa.js
 * Contexto para explicar un reporte del catálogo con IA (FASE: IA en Gestión).
 *
 * El reporte ya viene calculado en SQL (RPC) y ya está mapeado a sus columnas
 * visibles; aquí solo se comprime a texto para mandarlo a la IA. Nunca se
 * envían filas crudas de posiciones ni se recalculan cifras.
 *
 * Puro, sin fetch ni DOM: apto para node:test.
 */

/** Tope de caracteres del contexto (el servidor recorta en 7000). */
export const LIMITE_REPORTE = 6500;
/** Filas de detalle que se envían como máximo (el resto se resume). */
export const LIMITE_FILAS_REPORTE = 40;
const LIMITE_CELDA = 60;

const celda = (valor) => {
  const texto = String(valor ?? '').replace(/\s+/g, ' ').trim();
  return texto.length > LIMITE_CELDA ? `${texto.slice(0, LIMITE_CELDA - 1)}…` : (texto || '—');
};

/**
 * Arma el texto del reporte para la IA.
 * @param {{
 *   reporte?: string, grupo?: string, rango?: string,
 *   columnas?: string[], filas?: Array<object>, totalFilas?: number
 * }} params `filas` son las filas VISIBLES ya mapeadas (clave → valor).
 * @returns {string}
 */
export function armarContextoReporte({
  reporte = '',
  grupo = '',
  rango = '',
  columnas = [],
  filas = [],
  totalFilas = null,
} = {}) {
  const claves = columnas.length
    ? columnas
    : Object.keys(filas[0] || {}).slice(0, 10);

  const cabecera = `REPORTE DE FLOTA (AgroTrack)
Nombre: ${reporte || 'sin nombre'}${grupo ? ` · grupo: ${grupo}` : ''}
Rango: ${rango || 'todo el periodo cargado'}
Columnas: ${claves.join(' | ')}
Filas: ${totalFilas ?? filas.length}`;

  if (!filas.length) return `${cabecera}

Sin filas en ese rango: no hay cifras que interpretar.`;

  const cuerpo = filas
    .slice(0, LIMITE_FILAS_REPORTE)
    .map((fila) => claves.map((clave) => celda(fila?.[clave])).join(' | '))
    .join('\n');

  const excedente = filas.length - Math.min(filas.length, LIMITE_FILAS_REPORTE);
  let texto = `${cabecera}

FILAS (plano: columna | columna)
${cuerpo}${excedente > 0 ? `\n… y ${excedente} fila(s) más no enviadas.` : ''}`;

  // Si aún no cabe, se recortan filas hasta dejar solo la cabecera.
  while (texto.length > LIMITE_REPORTE && texto.includes('\n')) {
    const lineas = texto.split('\n');
    const quitar = lineas.length > 6 ? 3 : 1;
    texto = [...lineas.slice(0, lineas.length - quitar)].join('\n');
  }
  return texto.length > LIMITE_REPORTE ? cabecera : texto;
}

export default armarContextoReporte;
