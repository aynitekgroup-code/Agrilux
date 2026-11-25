// Perú usa UTC-5. El ajuste por días se hace antes de formatear para evitar
// depender de la zona horaria del teléfono.
export function diaMapaPeru(ahora = Date.now(), diasAtras = 0) {
  return new Date(ahora - (5 + diasAtras * 24) * 60 * 60 * 1000).toISOString().slice(0, 10);
}
