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
  // 18/11/2026: además del texto en inglés de Zonar se aceptan los formatos
  // que aparecen cuando el reporte sale con la interfaz en español o cuando
  // el archivo se abrió y guardó en Excel (antes esas filas se descartaban
  // como "faltan unidad, fecha o evento"):
  //   "12/11/2026 04:00 p. m." · "12/11/2026 16:00:05" · "2026-11-12 16:00"
  //   "12 nov 2026 04:00 PM"  · número de serie de Excel (46338.6666)
  if (value instanceof Date) return fechaDesdePartes(value.getFullYear(), value.getMonth() + 1, value.getDate(), value.getHours(), value.getMinutes(), value.getSeconds());
  if (typeof value === 'number') return fechaDesdeSerialExcel(value);
  const text = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!text) return null;
  if (/^\d{5}(\.\d+)?$/.test(text)) return fechaDesdeSerialExcel(Number(text));

  const ampm = '(?:\\s*([AaPp])\\.?\\s*[Mm]\\.?)?';
  const hora = `(\\d{1,2}):(\\d{2})(?::(\\d{2}))?${ampm}`;

  // "Nov 01 2026 12:01 AM" (inglés, el de siempre)
  let m = text.match(new RegExp(`^([A-Za-z]{3})[a-z]*\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})\\s+${hora}$`));
  if (m && MONTHS[m[1].toLowerCase()]) {
    return fechaDesdePartes(m[3], MONTHS[m[1].toLowerCase()], m[2], ajustarHora(m[4], m[7]), m[5], m[6]);
  }
  // "12 nov 2026 04:00 PM" / "12-nov-2026 16:00"
  m = text.match(new RegExp(`^(\\d{1,2})[\\s-]([A-Za-z]{3})[a-z]*\\.?[\\s-](\\d{4})\\s+${hora}$`));
  if (m && MONTHS[m[2].toLowerCase()]) {
    return fechaDesdePartes(m[3], MONTHS[m[2].toLowerCase()], m[1], ajustarHora(m[4], m[7]), m[5], m[6]);
  }
  // "2026-11-12 16:00[:05]" (con espacio; el ISO con "T" lo resuelve el
  // agente según su modo de fecha)
  m = text.match(new RegExp(`^(\\d{4})-(\\d{1,2})-(\\d{1,2}) ${hora}$`));
  if (m) return fechaDesdePartes(m[1], m[2], m[3], ajustarHora(m[4], m[7]), m[5], m[6]);
  // "12/11/2026 04:00 p. m." -> en Perú siempre DÍA/MES/AÑO
  m = text.match(new RegExp(`^(\\d{1,2})[/.-](\\d{1,2})[/.-](\\d{4}),?\\s+${hora}$`));
  if (m) return fechaDesdePartes(m[3], m[2], m[1], ajustarHora(m[4], m[7]), m[5], m[6]);
  return null;
}

function ajustarHora(h, ap) {
  let hour = Number(h);
  if (ap) {
    hour %= 12;
    if (ap.toLowerCase() === 'p') hour += 12;
  }
  return hour;
}

function fechaDesdePartes(y, mo, d, h, mi, s) {
  const n = (x) => String(Number(x || 0)).padStart(2, '0');
  const anio = Number(y);
  const mes = Number(mo);
  const dia = Number(d);
  if (!(anio >= 2000 && anio <= 2100) || !(mes >= 1 && mes <= 12) || !(dia >= 1 && dia <= 31)) return null;
  if (!(Number(h) >= 0 && Number(h) <= 23) || !(Number(mi) >= 0 && Number(mi) <= 59) || !(Number(s || 0) >= 0 && Number(s || 0) <= 59)) return null;
  // Zonar exporta con minutos; si no hay segundos el resultado es idéntico al
  // de siempre ("...:00-05:00") y el source_key no cambia.
  return `${anio}-${n(mes)}-${n(dia)}T${n(h)}:${n(mi)}:${n(s)}${PERU_OFFSET}`;
}

// Número de serie de Excel (días desde 1899-12-30), leído como hora de Perú.
function fechaDesdeSerialExcel(serial) {
  if (!Number.isFinite(serial) || serial < 36526 || serial > 73050) return null; // 2000..2099
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const t = new Date(ms);
  return fechaDesdePartes(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate(), t.getUTCHours(), t.getUTCMinutes(), t.getUTCSeconds());
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
