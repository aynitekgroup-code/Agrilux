/** Matriz de distancias medidas: ausencia de fila no significa cero. */
export function matrizKilometros(dias, resultados, padron = []) {
  const unidades = new Map();
  padron.forEach((unidad) => {
    const placa = String(unidad.placa || '').trim();
    if (placa && !unidades.has(placa)) unidades.set(placa, { placa, valores: {} });
  });
  resultados.forEach((filas, i) => filas.forEach((fila) => {
    const placa = String(fila.placa || '').trim();
    if (!placa) return;
    const item = unidades.get(placa) || { placa, valores: {} };
    const valor = fila.km_recorridos;
    item.valores[dias[i]] = valor == null || valor === '' || !Number.isFinite(Number(valor)) ? null : Number(valor);
    unidades.set(placa, item);
  }));
  return [...unidades.values()].sort((a, b) => a.placa.localeCompare(b.placa, 'es', { numeric: true }));
}
