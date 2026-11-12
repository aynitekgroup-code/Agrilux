/**
 * src/lib/corteIa.js
 * Evaluación PREVIA con IA del corte remoto (FASE: IA en Gestión).
 *
 * GARANTÍA DE SEGURIDAD: la IA NUNCA ejecuta ni autoriza el corte. Solo
 * evalúa el riesgo y deja una justificación auditable; la orden siempre la
 * confirma una persona con su PIN en el flujo del modal (y puede saltarse
 * el "no_apto" como decisión explícita del supervisor).
 *
 * Puro, sin fetch ni DOM: apto para node:test.
 */

export const VEREDICTOS = ['apto', 'precaucion', 'no_apto'];

const limpiar = (valor, max) => String(valor || '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Valida la respuesta de la IA. Ante cualquier sorpresa devuelve
 * "precaucion" (nunca "apto"): el default es el más cauteloso.
 * @param {{veredicto?: string, justificacion?: string, riesgos?: string[]}} datos
 * @returns {{valido: boolean, errores: string[], veredicto: string,
 *   justificacion: string, riesgos: string[]}}
 */
export function validarEvaluacionCorte(datos) {
  const errores = [];
  const justificacion = limpiar(datos?.justificacion, 600);
  const veredicto = VEREDICTOS.includes(datos?.veredicto) ? datos.veredicto : 'precaucion';

  if (!justificacion) errores.push('La IA no devolvió una justificación.');

  const riesgos = (Array.isArray(datos?.riesgos) ? datos.riesgos : [])
    .map((r) => limpiar(r, 200))
    .filter(Boolean)
    .slice(0, 4);

  if (datos?.veredicto && !VEREDICTOS.includes(datos.veredicto)) {
    errores.push(`Veredicto desconocido: ${String(datos.veredicto)}`);
  }

  return {
    valido: errores.length === 0 && Boolean(justificacion),
    errores,
    veredicto,
    justificacion,
    riesgos,
  };
}

/**
 * Contexto para la IA: el estado REAL de la unidad (lo que ya tiene el
 * modal) + el motivo escrito por el supervisor. Nunca se envían datos de
 * otras unidades ni historial crudo.
 * @returns {string}
 */
export function armarContextoCorte({
  vehiculo = null,
  motivo = '',
  responsable = '',
  hora = '',
} = {}) {
  const v = vehiculo || {};
  return `SOLICITUD DE CORTE REMOTO (simulación; el supervisor confirma con PIN)
Unidad: ${v.placa || 's/d'} · ${v.modelo || ''} · conductor ${v.conductor_nombre || 'sin dato'}
Estado GPS: ${v.conectado ? 'conectado' : 'SIN CONEXIÓN'} · velocidad ${Number(v.velocidad_kmh ?? 0)} km/h · ignición ${v.ignicion ? 'encendida' : 'apagada'}
Ubicación: ${v.ultima_ubicacion || 'sin dato'} · odómetro ${Number(v.odometro_km ?? 0)} km
Estado clasificado: ${v.estado || 'sin dato'} · bloqueos previos: ${v.bloqueado ? 'sí' : 'no'}
Motivo escrito por el supervisor: ${limpiar(motivo, 300) || '(sin motivo)'}
Responsable: ${limpiar(responsable, 80) || 'no indicado'} · hora: ${limpiar(hora, 40) || 'no indicada'}

Recuerda: tú solo EVALÚAS el riesgo. El corte lo confirma el supervisor.`;
}

export default validarEvaluacionCorte;
