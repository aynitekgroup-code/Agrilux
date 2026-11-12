/**
 * src/lib/agrotrackIa.js
 * Cliente de la IA de la sección Gestión (AgroTrack).
 *
 * Todos los casos de uso nuevos pasan por /api/voice-assistant con un `modo`
 * propio (briefing | alertas | reporte | geocerca | corte). NO se crean
 * funciones serverless nuevas: el plan Hobby de Vercel admite máximo 12 por
 * despliegue y el proyecto ya usa las 12 (mismo motivo que el modo 'mapa').
 *
 * El cliente manda SIEMPRE datos ya agregados (KPIs, grupos de alertas,
 * filas de un reporte, estado de UNA unidad): nunca filas crudas.
 * La IA solo interpreta/proponen; guardar o ejecutar lo confirma siempre
 * una persona en la UI.
 */

/** Límite de contexto que acepta el servidor (más se recorta). */
export const LIMITE_CONTEXTO_IA = 7000;

/**
 * Llama a un modo de gestión de /api/voice-assistant.
 * @param {{modo: 'briefing'|'alertas'|'reporte'|'geocerca'|'corte', contexto: string|object}} params
 * @returns {Promise<{modo: string, texto: string, datos: object|null, provider: string|null}>}
 * @throws {Error} con mensaje en español (HTTP, sin proveedores o error del servidor).
 */
export async function llamarIaGestion({ modo, contexto }) {
  const textoContexto = typeof contexto === 'string' ? contexto : JSON.stringify(contexto ?? {});
  if (!textoContexto.trim()) throw new Error('No hay datos que mandar a la IA.');

  const res = await fetch('/api/voice-assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      modo,
      contexto: textoContexto.slice(0, LIMITE_CONTEXTO_IA),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
  if (data.error) throw new Error(data.error);
  if (data.datos === null && !data.texto) {
    throw new Error('La IA no devolvió una respuesta utilizable. Inténtalo otra vez.');
  }
  return data;
}

export default llamarIaGestion;
