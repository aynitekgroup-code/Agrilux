/**
 * src/lib/vigiaFlota.js
 * Agente "Vigía de flota" (FASE 3.4).
 *
 * Reglas deterministas sobre las filas que YA devuelve la RPC
 * agrotrack_actividad_flota (agrupar 'unidad'). Nada de 103 mil posiciones.
 *
 * IMPORTANTE: los umbrales se definen UNA sola vez aquí. El criterio de
 * viaje/ralentí/encendido vive en scripts/agrotrack-reportes-flota.sql; aquí
 * solo se interpreta lo agregado, nunca se recalcula.
 */

/** % del encendido en ralentí a partir del cual se avisa. */
export const UMBRAL_RALENTI_PCT = 30;
/** Velocidad máxima (km/h) a partir de la cual se avisa de exceso. */
export const UMBRAL_VEL_MAX_KMH = 90;
/** Cantidad de alertas (alta velocidad / pánico) en el periodo para avisar. */
export const UMBRAL_ALERTAS = 3;

const NIVEL_ORDEN = { alto: 0, medio: 1, bajo: 2 };

/**
 * Evalúa las reglas del vigía sobre el reporte agregado.
 * @param {Array} filas filas de agrotrack_actividad_flota (agrupar 'unidad')
 * @param {{rangoTexto?: string}} opciones
 * @returns {Array<{id: string, nivel: 'alto'|'medio'|'bajo', titulo: string, detalle: string, placas: string[]}>}
 */
export function evaluarReglasVigia(filas = [], { rangoTexto = '' } = {}) {
  const rows = filas.filter(Boolean);
  if (!rows.length) return [];

  const rango = rangoTexto ? `en ${rangoTexto}` : 'en el periodo cargado';
  const hallazgos = [];

  const pctRalenti = (f) => {
    const encendido = Number(f.encendido_segundos || 0);
    if (encendido <= 0) return 0;
    return Math.round((Number(f.ralenti_segundos || 0) / encendido) * 1000) / 10;
  };

  // 1) Mucho ralentí: el motor encendido pero el vehículo parado.
  const ralentizadas = rows
    .map((f) => ({ placa: f.placa, pct: pctRalenti(f) }))
    .filter((f) => f.pct >= UMBRAL_RALENTI_PCT)
    .sort((a, b) => b.pct - a.pct);
  if (ralentizadas.length) {
    hallazgos.push({
      id: 'ralenti',
      nivel: ralentizadas.length >= 5 ? 'alto' : 'medio',
      titulo: `${ralentizadas.length} unidad(es) con ralentí elevado`,
      detalle: `Más del ${UMBRAL_RALENTI_PCT} % del encendido estando paradas ${rango}: ${ralentizadas
        .slice(0, 6)
        .map((f) => `${f.placa} ${f.pct} %`)
        .join(', ')}${ralentizadas.length > 6 ? '…' : ''}.`,
      placas: ralentizadas.map((f) => f.placa),
    });
  }

  // 2) Excesos de velocidad (velocidad máxima punta).
  const rapidas = rows
    .filter((f) => Number(f.vel_max_kmh || 0) >= UMBRAL_VEL_MAX_KMH)
    .sort((a, b) => Number(b.vel_max_kmh || 0) - Number(a.vel_max_kmh || 0));
  if (rapidas.length) {
    hallazgos.push({
      id: 'velocidad',
      nivel: 'alto',
      titulo: `${rapidas.length} unidad(es) superaron ${UMBRAL_VEL_MAX_KMH} km/h`,
      detalle: `Velocidad máxima ${rango}: ${rapidas
        .slice(0, 6)
        .map((f) => `${f.placa} ${Number(f.vel_max_kmh)} km/h`)
        .join(', ')}${rapidas.length > 6 ? '…' : ''}.`,
      placas: rapidas.map((f) => f.placa),
    });
  }

  // 3) Acumulado de alertas de alta velocidad / botón de pánico.
  const alertadas = rows
    .filter((f) => Number(f.alertas || 0) >= UMBRAL_ALERTAS)
    .sort((a, b) => Number(b.alertas || 0) - Number(a.alertas || 0));
  if (alertadas.length) {
    hallazgos.push({
      id: 'alertas',
      nivel: 'medio',
      titulo: `${alertadas.length} unidad(es) con ${UMBRAL_ALERTAS} o más alertas`,
      detalle: `Alertas del periodo ${rango}: ${alertadas
        .slice(0, 6)
        .map((f) => `${f.placa} ${Number(f.alertas)}`)
        .join(', ')}${alertadas.length > 6 ? '…' : ''}.`,
      placas: alertadas.map((f) => f.placa),
    });
  }

  // 4) Unidades que no encendieron en todo el rango.
  const inactivas = rows.filter((f) => Number(f.encendido_segundos || 0) <= 0);
  if (inactivas.length) {
    hallazgos.push({
      id: 'inactivas',
      nivel: 'bajo',
      titulo: `${inactivas.length} unidad(es) sin encender`,
      detalle: `Cero horas de encendido ${rango}: ${inactivas
        .slice(0, 8)
        .map((f) => f.placa)
        .join(', ')}${inactivas.length > 8 ? '…' : ''}.`,
      placas: inactivas.map((f) => f.placa),
    });
  }

  // 5) Unidades con recorrido atípico (muy por encima del promedio).
  const kms = rows.map((f) => Number(f.km_recorridos || 0));
  const promedio = kms.reduce((s, k) => s + k, 0) / (kms.length || 1);
  if (promedio > 0) {
    const outliers = rows
      .filter((f) => Number(f.km_recorridos || 0) >= promedio * 3)
      .sort((a, b) => Number(b.km_recorridos || 0) - Number(a.km_recorridos || 0));
    if (outliers.length) {
      hallazgos.push({
        id: 'recorrido',
        nivel: 'bajo',
        titulo: `${outliers.length} unidad(es) con recorrido atípico`,
        detalle: `Por encima de 3× el promedio (${Math.round(promedio * 10) / 10} km) ${rango}: ${outliers
          .slice(0, 5)
          .map((f) => `${f.placa} ${Number(f.km_recorridos)} km`)
          .join(', ')}${outliers.length > 5 ? '…' : ''}.`,
        placas: outliers.map((f) => f.placa),
      });
    }
  }

  return hallazgos.sort((a, b) => NIVEL_ORDEN[a.nivel] - NIVEL_ORDEN[b.nivel]);
}

/** Texto plano para compartir con otros agentes (AgentContext) y para IA. */
export function textoVigia(hallazgos = [], { rangoTexto = '' } = {}) {
  if (!hallazgos.length) return '';
  return `Vigía de flota${rangoTexto ? ` (${rangoTexto})` : ''}: ${hallazgos
    .map((h) => `${h.titulo} — ${h.detalle}`)
    .join(' | ')}`;
}

export default evaluarReglasVigia;
