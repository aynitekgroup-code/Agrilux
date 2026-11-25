// Clasificación orientativa de la última posición, no del trabajo efectivo.
export function estadoHunter(f, ahora) {
  const edad = ahora - Date.parse(f.fecha);
  if (!Number.isFinite(edad) || edad < -300000 || edad > 30 * 60000) return 'Sin reporte reciente';
  if (f.ignicion === false) return 'Apagado';
  if (f.ignicion !== true || f.velocidad_kmh == null || String(f.velocidad_kmh).trim() === '') return 'Desconocido';
  const velocidad = Number(f.velocidad_kmh);
  if (!Number.isFinite(velocidad) || velocidad < 0) return 'Desconocido';
  if (velocidad === 0) return 'Encendido / detenido';
  if (velocidad <= 5) return 'Encendido / movimiento lento';
  return 'En movimiento';
}
