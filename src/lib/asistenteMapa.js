// src/lib/asistenteMapa.js
// Lógica PURA del asistente JARVIS del mapa (FASE 3.8):
//   * resumen compacto de las geocercas para mandarle a la IA;
//   * lectura de la respuesta de la IA (JSON { respuesta, acciones }).
// Sin fetch ni DOM: se prueba con node.
import { contarVertices } from './geocercasGeometria.js';

/** Etiqueta de cada tipo de geocerca para mostrarle a la IA y en la leyenda. */
export const ETIQUETAS_GRUPO = {
  autorizada: 'Linderos',
  oficina: 'Oficinas',
  distrito: 'Distritos',
  poligono: 'Manual',
};

/** Colores del mapa por grupo (coinciden con la leyenda). */
export const COLORES_GRUPO = {
  autorizada: { borde: '#15803D', relleno: '#22C55E' },
  oficina: { borde: '#2563EB', relleno: '#60A5FA' },
  distrito: { borde: '#7C3AED', relleno: '#A78BFA' },
  poligono: { borde: '#0F766E', relleno: '#2DD4BF' },
  seleccion: { borde: '#B45309', relleno: '#F59E0B' },
};

/** Tipos de acción que la IA puede pedirle al mapa. */
export const ACCIONES_VALIDAS = [
  'enfocar',         // { geocerca_id } zoom a la geocerca
  'seleccionar',     // { geocerca_id } seleccionarla (ficha + resalte)
  'filtrar_grupo',   // { grupo } mostrar solo linderos/oficinas/distritos
  'limpiar',         // quitar filtros y selección
  'ajustar_todo',    // encuadrar todas las geocercas visibles
];

/**
 * Resumen compacto de las geocercas para el contexto de la IA.
 * Se manda solo lo necesario (id, nombre, grupo, división, vértices y centro):
 * NUNCA la geometría completa (178 polígonos no caben en un prompt).
 */
export function resumenGeocercasParaIA(geofences) {
  return (geofences || []).map((g) => {
    const bbox = g.geometria?.bbox;
    const centro = Array.isArray(bbox) && bbox.length === 4
      ? {
          lat: Number(((bbox[1] + bbox[3]) / 2).toFixed(5)),
          lon: Number(((bbox[0] + bbox[2]) / 2).toFixed(5)),
        }
      : null;
    return {
      id: g.id,
      nombre: g.nombre || '(sin nombre)',
      grupo: ETIQUETAS_GRUPO[g.tipo] || ETIQUETAS_GRUPO.poligono,
      division: g.division || null,
      vertices: g.geometria ? contarVertices(g.geometria) : 0,
      centro,
    };
  });
}

/** Extrae el primer objeto JSON balanceado de un texto (con o sin markdown). */
export function extraerObjetoJSON(texto) {
  if (!texto) return null;
  const limpio = String(texto).replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const intentar = (cadena) => {
    try {
      const valor = JSON.parse(cadena);
      return valor && typeof valor === 'object' && !Array.isArray(valor) ? valor : null;
    } catch {
      return null;
    }
  };
  const directo = intentar(limpio);
  if (directo) return directo;

  const inicio = limpio.indexOf('{');
  if (inicio < 0) return null;
  let nivel = 0;
  let dentroCadena = false;
  let escapado = false;
  for (let i = inicio; i < limpio.length; i++) {
    const c = limpio[i];
    if (escapado) { escapado = false; continue; }
    if (c === '\\') { escapado = true; continue; }
    if (c === '"') { dentroCadena = !dentroCadena; continue; }
    if (dentroCadena) continue;
    if (c === '{') nivel += 1;
    else if (c === '}') {
      nivel -= 1;
      if (nivel === 0) return intentar(limpio.slice(inicio, i + 1));
    }
  }
  return null;
}

/**
 * Lee la respuesta de la IA y devuelve { respuesta, acciones }.
 * Cualquier cosa que no sea una acción válida se descarta (la IA puede
 * alucinar); si no hay JSON, todo el texto se usa como respuesta y no se
 * ejecuta nada (modo seguro).
 */
export function parseRespuestaAsistente(texto) {
  const obj = extraerObjetoJSON(texto);
  const respuestaLimpia = (valor) =>
    String(valor || '').replace(/\s+/g, ' ').trim().slice(0, 600);

  if (!obj) {
    const respuesta = respuestaLimpia(texto);
    return { respuesta: respuesta || 'No pude interpretar eso, prueba con otra pregunta.', acciones: [] };
  }

  const respuesta = respuestaLimpia(obj.respuesta || obj.texto || obj.mensaje);
  const acciones = (Array.isArray(obj.acciones) ? obj.acciones : [])
    .filter((a) => a && typeof a === 'object' && ACCIONES_VALIDAS.includes(a.tipo))
    .map((a) => {
      if (a.tipo === 'enfocar' || a.tipo === 'seleccionar') {
        return { tipo: a.tipo, geocerca_id: String(a.geocerca_id || a.id || '') };
      }
      if (a.tipo === 'filtrar_grupo') {
        return { tipo: a.tipo, grupo: String(a.grupo || '') };
      }
      return { tipo: a.tipo };
    })
    .filter((a) => a.tipo !== 'enfocar' && a.tipo !== 'seleccionar' ? true : Boolean(a.geocerca_id))
    .filter((a) => a.tipo !== 'filtrar_grupo' || ['autorizada', 'oficina', 'distrito', 'poligono'].includes(a.grupo))
    .slice(0, 4);

  return {
    respuesta: respuesta || 'Listo.',
    acciones,
  };
}
