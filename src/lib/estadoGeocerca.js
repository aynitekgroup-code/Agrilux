/**
 * src/lib/estadoGeocerca.js
 * Clasificación de la última posición de una unidad en los 3 estados que
 * pidió el Ing. Carlos Perez para el reporte por geocerca:
 *
 *   apagado      -> motor apagado / estacionado
 *   ralenti      -> encendido y detenido (0 a 5 km/h)
 *   conduciendo  -> más de 5 km/h
 *
 * Las unidades cuya última posición es vieja (más de 30 min) o inválida no se
 * inventan como "apagado": van a `sin_dato`, igual que "Sin reporte reciente"
 * de la referencia de Hunter. Es una clasificación orientativa de la última
 * posición, no del trabajo efectivo de la máquina.
 */

/** Minutos sin posición nueva a partir de los cuales no se clasifica. */
export const UMBRAL_SIN_DATO_MINUTOS = 30;

export const ETIQUETAS_ESTADO_GEO = {
  apagado: 'Apagado',
  ralenti: 'Encendido lento (ralentí)',
  conduciendo: 'Conduciendo',
  sin_dato: 'Sin dato',
};

export const ORDEN_ESTADOS_GEO = ['conduciendo', 'ralenti', 'apagado', 'sin_dato'];

function aMilisegundos(valor) {
  if (valor instanceof Date) {
    const t = valor.getTime();
    return Number.isFinite(t) ? t : null;
  }
  const t = Date.parse(valor || '');
  return Number.isFinite(t) ? t : null;
}

/**
 * Estado de 3 niveles de una fila de estado (misma forma que
 * agrotrack_estado_unidades_flota / agrotrack_estado_vivo_flota).
 * @param {Object} fila
 * @param {Date|string} ahora  instante contra el que se mide la antigüedad
 * @returns {'apagado'|'ralenti'|'conduciendo'|'sin_dato'}
 */
export function clasificarEstadoGeocerca(fila, ahora = new Date()) {
  if (!fila || fila.sin_telemetria) return 'sin_dato';

  const t = aMilisegundos(fila.ultima_fecha);
  const ahoraMs = aMilisegundos(ahora);
  if (t == null || ahoraMs == null) return 'sin_dato';

  const edadMin = (ahoraMs - t) / 60000;
  // Reloj adelantado por más de 5 min: fecha no confiable.
  if (edadMin > UMBRAL_SIN_DATO_MINUTOS || edadMin < -5) return 'sin_dato';

  const evento = String(fila.ultimo_evento || '').toLowerCase();
  const estado = String(fila.estado_vivo || '').toLowerCase();
  const velocidad = Number(fila.ultima_velocidad || 0);

  if (/sin reporte|sin dato/.test(estado)) return 'sin_dato';
  if (/apagad|estacionad/.test(evento) || /apagad|estacionad/.test(estado)) return 'apagado';
  if (velocidad > 5 || /en ruta|en_ruta|movimiento|conduciendo/.test(estado)) return 'conduciendo';
  return 'ralenti';
}

/**
 * Agrupa las filas de estado por geocerca actual y cuenta los 3 estados.
 * Las unidades fuera de toda geocerca se agrupan como "Sin geocerca".
 * @param {Array} filas
 * @param {Date|string} ahora
 * @returns {Array<{clave:string, geocerca:string, apagado:number, ralenti:number,
 *   conduciendo:number, sinDato:number, total:number, unidades:Array}>}
 */
export function agruparPorGeocerca(filas = [], ahora = new Date()) {
  const mapa = new Map();

  (filas || []).forEach((fila) => {
    const nombre = String(fila?.geocerca || '').trim();
    const clave = nombre || '__sin_geocerca__';
    let grupo = mapa.get(clave);
    if (!grupo) {
      grupo = {
        clave,
        geocerca: nombre || 'Sin geocerca',
        apagado: 0,
        ralenti: 0,
        conduciendo: 0,
        sinDato: 0,
        total: 0,
        unidades: [],
      };
      mapa.set(clave, grupo);
    }

    const estado = clasificarEstadoGeocerca(fila, ahora);
    if (estado === 'sin_dato') grupo.sinDato += 1;
    else grupo[estado] += 1;
    grupo.total += 1;
    grupo.unidades.push({ ...fila, estado });
  });

  const grupos = [...mapa.values()];
  grupos.forEach((grupo) => {
    grupo.unidades.sort((a, b) => String(a?.placa || '').localeCompare(String(b?.placa || ''), 'es'));
  });
  grupos.sort((a, b) => {
    if (a.clave === '__sin_geocerca__') return 1;
    if (b.clave === '__sin_geocerca__') return -1;
    if (b.total !== a.total) return b.total - a.total;
    return a.geocerca.localeCompare(b.geocerca, 'es');
  });
  return grupos;
}

/** Suma de los grupos para las fichas de la cabecera. */
export function totalesPorEstado(grupos = []) {
  return (grupos || []).reduce(
    (acc, grupo) => ({
      apagado: acc.apagado + (grupo.apagado || 0),
      ralenti: acc.ralenti + (grupo.ralenti || 0),
      conduciendo: acc.conduciendo + (grupo.conduciendo || 0),
      sinDato: acc.sinDato + (grupo.sinDato || 0),
      total: acc.total + (grupo.total || 0),
    }),
    { apagado: 0, ralenti: 0, conduciendo: 0, sinDato: 0, total: 0 },
  );
}
