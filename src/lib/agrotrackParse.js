/**
 * src/lib/agrotrackParse.js
 * Lógica PURA para leer reportes de Zonar ("Reporte por placa" / "Ubicaciones
 * históricas"). Sin supabase ni fetch, para poder reutilizarla desde:
 *   - src/lib/agrotrackPosiciones.js (importador web "Cargar reporte de unidades");
 *   - agentes/zonar (agente local que descarga solo los reportes y los ingresa).
 *
 * El agente mantiene su propia copia en agentes/zonar/lib/parse.js para ser
 * autocontenido (se copia a la PC de Carlos sin el repo); la pariedad de esta
 * lógica —sobre todo el source_key, que es lo que evita duplicados— está
 * garantizada por tests/agenteZonarParidad.test.mjs.
 */

export const PERU_OFFSET = '-05:00'; // Zonar exporta la hora local sin zona horaria.

export const MONTHS = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  ene: '01', abr: '04', ago: '08', set: '09', dic: '12',
};

export function normalizeHeader(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

// "Nov 01 2026 12:01 AM" -> "2026-11-01T00:01:00-05:00"
export function parseFechaZonar(value) {
  const match = String(value ?? '')
    .trim()
    .match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*([AaPp])\.?\s*[Mm]\.?$/);
  if (!match) return null;
  const month = MONTHS[match[1].toLowerCase()];
  if (!month) return null;
  let hour = Number(match[4]) % 12;
  if (match[6].toLowerCase() === 'p') hour += 12;
  const day = String(match[2]).padStart(2, '0');
  return `${match[3]}-${month}-${day}T${String(hour).padStart(2, '0')}:${match[5]}:00${PERU_OFFSET}`;
}

// "BPH-767/SEGURIDAD" -> { placa: "BPH-767", descripcion: "SEGURIDAD" }
export function separarUnidad(unidad) {
  const text = String(unidad ?? '').trim();
  const slash = text.indexOf('/');
  const placa = (slash === -1 ? text : text.slice(0, slash)).trim().toUpperCase();
  const descripcion = slash === -1 ? null : text.slice(slash + 1).trim() || null;
  return { placa, descripcion };
}

export function cleanText(value) {
  const text = String(value ?? '').trim();
  return text === '' ? null : text;
}

export function numberOrNull(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Clave de deduplicación de agrotrack_posiciones: la misma que usa el
 * importador web, para que las cargas del agente y las manuales colisionen en
 * el upsert (empresa_id, source_key) y no se dupliquen filas.
 */
export function armarSourceKey(placa, fecha, evento, latitud, longitud) {
  return [placa, fecha, evento, Number(latitud).toFixed(7), Number(longitud).toFixed(7)].join('|');
}
