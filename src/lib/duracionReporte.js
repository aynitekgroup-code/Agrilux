/** Formatea duraciones redondeadas sin mostrar minutos iguales a 60. */
export function formatearDuracion(segundos) {
  if (segundos == null || segundos === '' || !Number.isFinite(Number(segundos))) return '—';
  const s = Math.max(0, Math.round(Number(segundos)));
  if (s < 60) return `${s} s`;
  const minutosTotales = Math.round(s / 60);
  const horas = Math.floor(minutosTotales / 60);
  const minutos = minutosTotales % 60;
  if (!horas) return `${minutos} min`;
  return `${horas} h ${String(minutos).padStart(2, '0')} min`;
}
