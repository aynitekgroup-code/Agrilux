/**
 * src/lib/agrotrackDivisiones.js
 * Utilidades puras para el reporte de geocercas por división.
 *
 * Regla única (también aplicada en Supabase por
 * scripts/agrotrack-reporte-lotes-permanencias.sql):
 *   division = COALESCE(NULLIF(TRIM(division), ''), nombre)
 *
 * Los alias Pamp / Pom1 / Pom2 / Sal-Sip se homologan antes de agrupar para
 * que no aparezcan columnas duplicadas en la tabla dinámica. Ya no existe el
 * grupo "Sin división": una geocerca sin división toma su propio nombre.
 */

const DIVISIONES_EQUIVALENTES = new Map([
  ['pamp', 'Pampagrande'],
  ['pampagrande', 'Pampagrande'],
  ['pom1', 'Pomalca 1'],
  ['pomalca1', 'Pomalca 1'],
  ['pomalca 1', 'Pomalca 1'],
  ['pom2', 'Pomalca 2'],
  ['pomalca2', 'Pomalca 2'],
  ['pomalca 2', 'Pomalca 2'],
  ['sal-sip', 'Saltur - Sipan'],
  ['saltur-sipan', 'Saltur - Sipan'],
  ['saltur sipan', 'Saltur - Sipan'],
  ['saltur - sipan', 'Saltur - Sipan'],
]);

/** Normaliza division/nombre con la misma regla que el SQL de Supabase. */
export function normalizarDivision(division, nombre = '') {
  const valor = String(division ?? '').trim() || String(nombre ?? '').trim();
  return DIVISIONES_EQUIVALENTES.get(valor.toLowerCase()) || valor;
}

/** División visible de una fila de lote/geocerca; nunca devuelve "Sin división". */
export function nombreDivision(fila) {
  return normalizarDivision(fila?.division, fila?.nombre || fila?.lote);
}

const CAMPOS_SUMA = [
  'unidades',
  'visitas',
  'permanencia_segundos',
  'apagado_segundos',
  'ralenti_segundos',
  'viaje_segundos',
  'km_recorridos',
  'puntos',
];

function sumar(filas) {
  return CAMPOS_SUMA.reduce((acc, campo) => {
    acc[campo] = filas.reduce((s, f) => s + Number(f?.[campo] || 0), 0);
    return acc;
  }, {});
}

/**
 * Agrupa filas por `division`, ordenado por nombre.
 * @param {Array} filas filas de agrotrack_lotes_flota
 * @returns {Array<{division: string, filas: Array, totales: Object}>}
 */
export function agruparPorDivision(filas = []) {
  const mapa = new Map();
  for (const fila of filas || []) {
    // Defensa: una RPC puede devolver huecos/null. Nunca metemos filas
    // inválidas en los grupos, porque el render necesita fila.geocerca_id.
    if (!fila || typeof fila !== 'object') continue;
    const division = nombreDivision(fila);
    if (!mapa.has(division)) mapa.set(division, []);
    mapa.get(division).push(fila);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
    .map(([division, filasGrupo]) => ({
      division,
      filas: filasGrupo,
      totales: sumar(filasGrupo),
    }));
}

/**
 * Convierte los grupos en una lista plana para renderizar/paginar en la tabla:
 * una fila de encabezado por división seguida de sus lotes.
 */
export function aplanarGrupos(grupos = []) {
  return (grupos || []).flatMap((grupo) => [
    { tipo: 'division', division: grupo.division, cantidad: grupo.filas.length, totales: grupo.totales },
    ...grupo.filas.map((fila) => ({ tipo: 'lote', fila })),
  ]);
}
