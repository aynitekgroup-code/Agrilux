/**
 * src/lib/briefingFlota.js
 * Contexto del BRIEFING DIARIO de flota (FASE: IA en Gestión).
 *
 * Puro, sin fetch ni DOM: recibe lo que la consola YA tiene en memoria
 * (KPIs del panel, alertas, órdenes de corte) y devuelve un texto compacto
 * para mandarlo a la IA. Nunca se envían filas crudas de posiciones.
 */

/** Tope de caracteres del contexto (el servidor recorta en 7000). */
export const LIMITE_BRIEFING = 6500;
const LIMITE_ALERTAS = 8;
const LIMITE_UNIDADES = 12;

const num = (valor, decimales = 1) => {
  const n = Number(valor);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10 ** decimales) / 10 ** decimales;
};

const listaO = (valores, vacio = 'ninguna') => {
  const limpia = valores.filter(Boolean);
  return limpia.length ? limpia.join(', ') : vacio;
};

/**
 * Arma el texto del briefing.
 * @param {{
 *   empresa?: string,
 *   periodo?: {desde?: string, hasta?: string, unidades?: number, registros?: number}|null,
 *   unidades?: Array, alertas?: Array, cortesPendientes?: number, cortesAplicados?: number
 * }} params
 * @returns {string}
 */
export function armarContextoBriefing({
  empresa = '',
  periodo = null,
  unidades = [],
  alertas = [],
  cortesPendientes = 0,
  cortesAplicados = 0,
} = {}) {
  const totalUnidades = unidades.length;

  // Estados por conteo genérico: no dependemos de un vocabulario concreto.
  const porEstado = {};
  unidades.forEach((u) => {
    const estado = String(u?.estado || 'sin estado').trim() || 'sin estado';
    porEstado[estado] = (porEstado[estado] || 0) + 1;
  });

  const totales = unidades.reduce(
    (acc, u) => ({
      km: acc.km + Number(u?.km_recorridos || 0),
      alertas: acc.alertas + Number(u?.eventos_alta_velocidad || 0),
      sinConexion: acc.sinConexion + (/sin conexi|offline/i.test(String(u?.estado || '')) ? 1 : 0),
    }),
    { km: 0, alertas: 0, sinConexion: 0 },
  );

  const porKm = [...unidades]
    .sort((a, b) => Number(b?.km_recorridos || 0) - Number(a?.km_recorridos || 0))
    .slice(0, 5);
  const sinEncendido = unidades
    .filter((u) => Number(u?.km_recorridos || 0) <= 0)
    .map((u) => u?.placa || u?.id)
    .slice(0, 8);

  const porSeveridad = {};
  alertas.forEach((a) => {
    const sev = String(a?.severidad || 'info');
    porSeveridad[sev] = (porSeveridad[sev] || 0) + 1;
  });

  const alertasRecientes = [...alertas]
    .sort((a, b) => String(b?.fecha_iso || b?.fecha || '').localeCompare(String(a?.fecha_iso || a?.fecha || '')))
    .slice(0, LIMITE_ALERTAS)
    .map((a) => `${a?.fecha || 's/f'} · ${a?.severidad || 'info'} · ${a?.vehiculo_id || a?.placa || '?'} · ${a?.tipo || ''} (${a?.mensaje || ''})`);

  const rango = periodo?.desde
    ? `${periodo.desde} → ${periodo.hasta || 'hoy'}`
    : 'sin periodo cargado';

  const cabecera = `BRIEFING DE FLOTA
Empresa: ${empresa || 'no indicada'}
Periodo cargado: ${rango}${periodo?.unidades != null ? ` · ${periodo.unidades} unidades · ${periodo.registros || 0} posiciones` : ''}

TOTALES
Unidades: ${totalUnidades} · Recorrido acumulado: ${num(totales.km)} km · Sin conexión: ${totales.sinConexion}
Estados: ${Object.entries(porEstado).map(([estado, n]) => `${estado}: ${n}`).join(' · ') || 'sin datos'}
Alertas del periodo: ${alertas.length}${Object.keys(porSeveridad).length ? ` (${Object.entries(porSeveridad).map(([sev, n]) => `${sev}: ${n}`).join(', ')})` : ''}
Órdenes de corte: ${cortesAplicados} aplicadas · ${cortesPendientes} pendientes

DESTACADOS
Mayores recorridos: ${listaO(porKm.map((u) => `${u?.placa || u?.id} ${num(u?.km_recorridos)} km`))}
Unidades sin recorrido en el periodo: ${listaO(sinEncendido)}

ÚLTIMAS ALERTAS${alertasRecientes.length ? `\n${alertasRecientes.join('\n')}` : '\nninguna'}`;

  const detalle = `\n\nUNIDADES (placa estado km vel_max alertas)
${[...unidades]
  .slice(0, LIMITE_UNIDADES)
  .map((u) => `${u?.placa || u?.id} ${u?.estado || '?'} ${num(u?.km_recorridos)} ${num(u?.velocidad_kmh, 0)} ${Number(u?.eventos_alta_velocidad || 0)}`)
  .join('\n')}`;

  const texto = cabecera + (totalUnidades ? detalle : '');
  return texto.length > LIMITE_BRIEFING ? cabecera.slice(0, LIMITE_BRIEFING) : texto;
}

export default armarContextoBriefing;
