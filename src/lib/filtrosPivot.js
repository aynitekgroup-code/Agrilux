/**
 * Lógica de los filtros tipo Excel de la tabla dinámica.
 *
 * Convención: `null` = sin filtro (se ven todos los valores); un arreglo,
 * incluso vacío, = filtro aplicado. Un arreglo vacío significa "ninguno
 * marcado" y deja la tabla sin filas, igual que Excel.
 *
 * `opciones` es una lista de objetos con forma { valor, etiqueta }.
 */

/** Copia de la selección al abrir el panel; si no hay filtro, marca todo. */
export function crearSeleccion(seleccion, opciones = []) {
  return Array.isArray(seleccion) ? [...seleccion] : opciones.map((o) => o.valor);
}

/** ¿Está marcada la casilla «(Todos)»? */
export function todosMarcados(borrador, opciones = []) {
  return opciones.length === 0 || borrador.length === opciones.length;
}

/** Marca o desmarca un valor (sin duplicados). */
export function alternarValor(borrador, valor) {
  return borrador.includes(valor) ? borrador.filter((v) => v !== valor) : [...borrador, valor];
}

/**
 * Al desmarcar «(Todos)» se desmarcan todos los nombres; al volver a
 * marcarla se marcan todos.
 */
export function alternarTodos(borrador, opciones = []) {
  return todosMarcados(borrador, opciones) ? [] : opciones.map((o) => o.valor);
}

/** Lo que se aplica: todos marcados = sin filtro (null). */
export function seleccionAAplicar(borrador, opciones = []) {
  const lista = [...new Set(borrador)];
  return lista.length === opciones.length ? null : lista;
}

/** ¿El valor pasa el filtro? `null` = sin filtro; `[]` = nada pasa. */
export function pasaFiltro(seleccion, valor) {
  return seleccion == null || seleccion.includes(valor);
}
