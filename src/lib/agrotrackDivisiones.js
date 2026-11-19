/**
 * src/lib/agrotrackDivisiones.js
 * Utilidades puras para el reporte de geocercas por división.
 *
 * La columna `division` ya viene en las RPC (agrotrack_lotes_flota,
 * agrotrack_eventos_flota, agrotrack_visitas_dia_flota), así que aquí solo se
 * agrupa en el cliente: no se toca Supabase. Las geocercas sin división
 * (Distrito, Oficinas, Establo, etc.) se dejan en un grupo aparte al final
 * para que NO se superpongan con los campos de Pampagrande / Pomalca / Saltur.
 */

export const SIN_DIVISION = 'Sin división';

/** Normaliza la división de una fila; null/vacío => grupo "Sin división". */
export function nombreDivision(fila) {
  const valor = typeof fila?.division === 'string' ? fila.division.trim() : '';
  return valor || SIN_DIVISION;
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
 * Agrupa filas por `division`, con los campos primero y "Sin división" al final.
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
    .sort(([a], [b]) => {
      if (a === SIN_DIVISION) return 1;
      if (b === SIN_DIVISION) return -1;
      return a.localeCompare(b, 'es', { sensitivity: 'base' });
    })
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
