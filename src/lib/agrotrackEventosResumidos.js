/**
 * src/lib/agrotrackEventosResumidos.js
 * Reporte 15 de Zonar ("Eventos resumidos"): Stop / Idle / Drive por unidad.
 *
 * Los segundos de Drive e Idle salen de la RPC agrotrack_actividad_flota
 * (mismo criterio único que el reporte de actividad: viaje = encendido y
 * velocidad > 5 km/h; ralentí = encendido y <= 5 km/h). Stop es el resto
 * del rango sin motor encendido (total − encendido), de modo que los tres
 * porcentajes suman siempre 100%.
 *
 * El total del rango es la duración del periodo consultado, limitada al
 * periodo realmente cargado (intersección con min/max(fecha) de la empresa),
 * para que un mes o un día a medias no inflen el Stop con tiempo en el que
 * todavía no había datos.
 *
 * OJO: esto es un derivado de filas YA agregadas por SQL (una por unidad),
 * nunca de las +100 mil posiciones crudas: el límite de 1000 filas de
 * PostgREST sigue intacto.
 */

/**
 * Duración en segundos del rango consultado, limitada al periodo cargado.
 * @param {{desde: string|null, hasta: string|null}} consulta
 * @param {{desde: string|null, hasta: string|null}|null} periodo
 * @returns {number|null}
 */
export function segundosDelRango(consulta, periodo) {
  const desde = Date.parse(consulta?.desde || '');
  const hasta = Date.parse(consulta?.hasta || '');
  if (!Number.isFinite(desde) || !Number.isFinite(hasta) || hasta <= desde) return null;
  let inicio = desde;
  let fin = hasta;
  const pDesde = Date.parse(periodo?.desde || '');
  const pHasta = Date.parse(periodo?.hasta || '');
  if (Number.isFinite(pDesde)) inicio = Math.max(inicio, pDesde);
  if (Number.isFinite(pHasta)) fin = Math.min(fin, pHasta);
  if (fin <= inicio) return null;
  return Math.round((fin - inicio) / 1000);
}

/** Segundos -> "HH:MM:SS" (las horas no se limitan a 24: un mes da 720:00:00). */
export function formatearHMS(segundos) {
  const s = Math.max(0, Math.round(Number(segundos || 0)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const g = s % 60;
  const dd = (n) => String(n).padStart(2, '0');
  return `${dd(h)}:${dd(m)}:${dd(g)}`;
}

function porcentaje(valor, total) {
  return Math.round((valor / total) * 1000) / 10;
}

/**
 * Convierte las filas de agrotrack_actividad_flota en las filas del reporte
 * 15: tiempo y porcentaje de Stop / Idle / Drive / Total por unidad.
 * @param {Array} filas        filas de agrotrack_actividad_flota (agrupar 'unidad')
 * @param {number|null} totalSegundos  segundosDelRango(...)
 * @returns {Array} { placa, unidad, stop, idle, drive, total,
 *                    pct_stop, pct_idle, pct_drive }
 */
export function calcularEventosResumidos(filas, totalSegundos) {
  const total = Number(totalSegundos);
  const valido = Number.isFinite(total) && total > 0;
  return (filas || []).map((f) => {
    const drive = Number(f.viaje_segundos || 0);
    const idle = Number(f.ralenti_segundos || 0);
    const encendido = Number(f.encendido_segundos || 0);
    // Por el criterio único encendido = viaje + ralentí, y la suma de los
    // tramos nunca supera la duración del rango: stop queda >= 0.
    const stop = valido ? Math.max(0, total - encendido) : 0;
    // El stop se cierra con la resta para que los tres sumen exacto 100.
    const pctDrive = valido ? porcentaje(drive, total) : null;
    const pctIdle = valido ? porcentaje(idle, total) : null;
    const pctStop = valido ? Math.round((100 - pctDrive - pctIdle) * 10) / 10 : null;
    return {
      placa: f.placa,
      unidad: f.unidad || f.placa,
      stop,
      idle,
      drive,
      total: valido ? total : null,
      pct_stop: pctStop,
      pct_idle: pctIdle,
      pct_drive: pctDrive,
    };
  });
}

/** Totales del pie (la flota completa): sumas y porcentajes sobre la suma. */
export function totalesEventosResumidos(filas) {
  const suma = (campo) => (filas || []).reduce((s, f) => s + Number(f[campo] || 0), 0);
  const stop = suma('stop');
  const idle = suma('idle');
  const drive = suma('drive');
  const total = suma('total');
  const valido = total > 0;
  const pctDrive = valido ? porcentaje(drive, total) : null;
  const pctIdle = valido ? porcentaje(idle, total) : null;
  return {
    stop,
    idle,
    drive,
    total,
    pct_stop: valido ? Math.round((100 - pctDrive - pctIdle) * 10) / 10 : null,
    pct_idle: pctIdle,
    pct_drive: pctDrive,
  };
}
