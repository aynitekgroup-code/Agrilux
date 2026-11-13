/**
 * agentes/zonar/lib/parse.js
 * Lógica de lectura de reportes de Zonar — copia autocontenida de
 * src/lib/agrotrackParse.js (para poder copiar esta carpeta a la PC de Carlos
 * sin el repo completo). La pariedad con el importador web está garantizada por
 * tests/agenteZonarParidad.test.mjs: si cambia uno, cambian los dos o el test
 * falla.
 *
 * Además agrega la ruta que solo usa el agente: transformar el JSON del
 * endpoint GetUnitsHistory en filas de agrotrack_posiciones con el MISMO
 * source_key que produciría la importación manual del Excel, de modo que las
 * cargas del agente y las manuales colisionen en el upsert y no se dupliquen.
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

/** Misma clave de deduplicación que el importador web (agrotrack_posiciones). */
export function armarSourceKey(placa, fecha, evento, latitud, longitud) {
  return [placa, fecha, evento, Number(latitud).toFixed(7), Number(longitud).toFixed(7)].join('|');
}

/* ── Ruta propia del agente: JSON de GetUnitsHistory -> fila ──────────────── */

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Instante epoch (ms) -> "YYYY-MM-DDTHH:mm:ss-05:00" en hora de Perú. */
function isoPeruDesdeMs(ms) {
  const t = new Date(ms - 5 * 3600 * 1000); // resto 5h y leo como UTC = hora de Perú
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`
    + `T${pad2(t.getUTCHours())}:${pad2(t.getUTCMinutes())}:${pad2(t.getUTCSeconds())}${PERU_OFFSET}`;
}

function normalizarOffset(tz) {
  if (tz === 'Z') return 'Z';
  const m = tz.match(/^([+-])(\d{2}):?(\d{2})$/);
  return m ? `${m[1]}${m[2]}:${m[3]}` : tz;
}

/**
 * Normaliza la fecha que trae cada marcador de GetUnitsHistory al MISMO formato
 * que produce parseFechaZonar desde el Excel ("...-05:00"), para que el
 * source_key coincida con las cargas manuales.
 *
 * Formatos aceptados:
 *   - "Nov 09 2026 11:58 PM"   (texto del Excel; hora de Perú tal cual)
 *   - "/Date(1781234567890)/"  (WCF clásico; instante UTC)
 *   - "2026-11-09T23:58:00"    (ISO sin zona; asumida hora de Perú, o UTC si
 *                               fechaModo === 'utc')
 *   - "2026-11-09T23:58:00Z" / con offset (instante real -> convertido a Perú)
 *   - epoch en segundos o milisegundos
 *
 * @param {*} valor
 * @param {'auto'|'local'|'utc'} [modo] manejo de los ISO sin zona ('auto' = local)
 */
export function fechaDesdeJsonZonar(valor, modo = 'auto') {
  if (valor === null || valor === undefined || valor === '') return null;

  if (typeof valor === 'number' && Number.isFinite(valor)) {
    const ms = Math.abs(valor) > 1e12 ? valor : valor * 1000;
    return isoPeruDesdeMs(ms);
  }

  const texto = String(valor).trim();

  const dotnet = texto.match(/^\/Date\((\d+)(?:[+-]\d{4})?\)\/$/);
  if (dotnet) return isoPeruDesdeMs(Number(dotnet[1]));

  // Texto del reporte de Zonar: la hora que muestra Zonar es la de Perú.
  const excel = parseFechaZonar(texto);
  if (excel) return excel;

  const iso = texto.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$/,
  );
  if (iso) {
    const [, y, mo, d, h, mi, s, tz] = iso;
    if (tz) {
      const instant = Date.parse(`${y}-${mo}-${d}T${h}:${mi}:${s || '00'}${normalizarOffset(tz)}`);
      return Number.isNaN(instant) ? null : isoPeruDesdeMs(instant);
    }
    if (modo === 'utc') return isoPeruDesdeMs(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s || 0)));
    return `${y}-${mo}-${d}T${h}:${mi}:${s || '00'}${PERU_OFFSET}`;
  }

  return null;
}

/**
 * Convierte un marcador de GetUnitsHistory en fila de agrotrack_posiciones
 * (mismos campos, validaciones y source_key que buildRow del importador web).
 * @returns {{row: object}|{error: string}}
 */
export function armarFilaZonar(marcador, empresaId, userId, { fechaModo = 'auto' } = {}) {
  const unidad = String(marcador?.Unit ?? marcador?.MarkerName ?? '').trim();
  const { placa, descripcion } = separarUnidad(unidad);
  const fecha = fechaDesdeJsonZonar(marcador?.LastEventDate ?? marcador?.Date, fechaModo);
  const latitud = numberOrNull(marcador?.Latitude);
  const longitud = numberOrNull(marcador?.Longitude);
  const evento = cleanText(marcador?.Event);

  if (!placa || !fecha || !evento) return { error: 'faltan unidad, fecha o evento' };
  if (latitud === null || longitud === null || Math.abs(latitud) > 90 || Math.abs(longitud) > 180) {
    return { error: 'coordenadas inválidas' };
  }

  return {
    row: {
      empresa_id: empresaId,
      placa,
      unidad,
      descripcion,
      fecha,
      secuencia: numberOrNull(marcador?.Sequence),
      evento,
      pt_referencia: cleanText(marcador?.Landmark),
      direccion: cleanText(marcador?.Address),
      velocidad: numberOrNull(marcador?.Speed),
      latitud,
      longitud,
      source_key: armarSourceKey(placa, fecha, evento, latitud, longitud),
      creado_por: userId || null,
    },
  };
}
