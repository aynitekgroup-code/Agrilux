import { describirPosicion } from './agrotrackReporteFilas.js';

export function textoUbicacionVoz({ unidad, geocerca, fecha, ahora, evento }) {
  const nombre = unidad || 'Unidad';
  const ms = Date.parse(fecha || '');
  if (!Number.isFinite(ms)) return `${nombre}. No hay una hora de posición válida; no se puede confirmar su ubicación actual.`;
  const hora = new Date(ms).toLocaleString('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' });
  const lugar = geocerca && geocerca !== 'Sin geocerca' ? geocerca : null;
  const reciente = describirPosicion(fecha, ahora).reciente;
  const ubicacion = lugar ? `${reciente ? 'última ubicación informada' : 'última ubicación conocida'}: ${lugar}` : 'sin geocerca identificada';
  return `${nombre}. ${ubicacion}. ${reciente ? 'Última posición' : 'Sin reporte reciente; última posición'}: ${hora}, hora Perú.${evento ? ` Último evento: ${evento}.` : ''}`;
}
