// src/lib/geocercasGeometria.js
// Edición de geocercas en el navegador (FASE 3.7): mover, insertar y quitar
// vértices, recalcular el bbox y armar polígonos nuevos.
//
// Reglas:
//  * solo GeoJSON Polygon / MultiPolygon en WGS84, coordenadas [lon, lat];
//  * los anillos van CERRADOS (el primer punto se repite al final), como en
//    los datos guardados en agrotrack_geocercas.geometria;
//  * toda función que cambia la geometría devuelve una copia con el bbox
//    RECALCULADO: los reportes leen geometria->'bbox' como prefilter, así que
//    un bbox viejo rompería "Tiempo en lote" y "Geocerca actual";
//  * sin dependencias salvo geofenceCleaner (también puro), para poder
//    probarlo con node.
import { cleanGeofence } from './geofenceCleaner.js';

const esPunto = (c) =>
  Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number'
  && Number.isFinite(c[0]) && Number.isFinite(c[1]);

/* ---------- Anillos ---------- */

/** Quita el punto de cierre repetido (devuelve el anillo "abierto"). */
export function anilloAbierto(ring) {
  if (!Array.isArray(ring) || ring.length === 0) return [];
  const out = ring.filter(esPunto);
  if (out.length > 1) {
    const primero = out[0];
    const ultimo = out[out.length - 1];
    if (primero[0] === ultimo[0] && primero[1] === ultimo[1]) out.pop();
  }
  return out;
}

/** Cierra un anillo repitiendo el primer punto al final. */
export function cerrarAnillo(ring) {
  const abierto = anilloAbierto(ring);
  if (!abierto.length) return [];
  const primero = abierto[0];
  return [...abierto, [primero[0], primero[1]]];
}

/** Cuenta los vértices distintos de un anillo (sin el punto de cierre). */
export function contarVerticesAnillo(ring) {
  return anilloAbierto(ring).length;
}

/* ---------- Partes ---------- */

/** Devuelve las partes de la geometría como listas de anillos (Polygon). */
export function partesDe(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

/** Total de vértices distintos de la geometría (todos los anillos). */
export function contarVertices(geometry) {
  return partesDe(geometry).reduce(
    (total, partes) => total + partes.reduce((suma, ring) => suma + contarVerticesAnillo(ring), 0),
    0,
  );
}

/**
 * Lista los vértices distintos de la geometría para pintarlos en el mapa.
 * Devuelve [{ parte, anillo, indice, punto: [lon, lat] }]; el índice es el
 * que se le pasa a moverVertice / quitarVertice.
 */
export function listarVertices(geometry) {
  const salida = [];
  partesDe(geometry).forEach((parte, iParte) => {
    parte.forEach((ring, iAnillo) => {
      anilloAbierto(ring).forEach((punto, i) => {
        salida.push({ parte: iParte, anillo: iAnillo, indice: i, punto: [punto[0], punto[1]] });
      });
    });
  });
  return salida;
}

/* ---------- bbox ---------- */

/** [lonMin, latMin, lonMax, latMax] de todos los puntos de la geometría. */
export function calcularBbox(geometry) {
  let lonMin = Infinity;
  let latMin = Infinity;
  let lonMax = -Infinity;
  let latMax = -Infinity;

  const visitar = (coords) => {
    if (!Array.isArray(coords)) return;
    if (esPunto(coords)) {
      lonMin = Math.min(lonMin, coords[0]);
      latMin = Math.min(latMin, coords[1]);
      lonMax = Math.max(lonMax, coords[0]);
      latMax = Math.max(latMax, coords[1]);
      return;
    }
    coords.forEach(visitar);
  };

  partesDe(geometry).forEach((parte) => parte.forEach(visitar));
  if (!Number.isFinite(lonMin)) return null;
  return [lonMin, latMin, lonMax, latMax];
}

/** Copia de la geometría con el bbox recalculado (los reportes lo leen). */
export function conBbox(geometry) {
  const bbox = calcularBbox(geometry);
  if (!bbox) return geometry;
  return { ...geometry, bbox };
}

/* ---------- Reconstrucción ---------- */

/**
 * Une polígonos simples en una geometría con bbox: una parte -> Polygon,
 * varias -> MultiPolygon. Cada parte puede venir como lista de anillos (la
 * forma interna de este módulo) o como objeto GeoJSON Polygon (lo que
 * devuelve cleanGeofence).
 */
export function desdePartes(partes) {
  const limpias = (partes || [])
    .map((parte) => (parte?.type === 'Polygon' ? parte.coordinates : parte))
    .filter((rings) => Array.isArray(rings) && rings.length && rings[0]?.length >= 4);
  if (!limpias.length) return null;
  if (limpias.length === 1) return conBbox({ type: 'Polygon', coordinates: limpias[0] });
  return conBbox({ type: 'MultiPolygon', coordinates: limpias });
}

/** Cierra un conjunto de puntos [lon, lat] en un Polygon con bbox. */
export function poligonoDePuntos(puntos) {
  const anillo = cerrarAnillo(puntos);
  if (anillo.length < 4) return null;
  return conBbox({ type: 'Polygon', coordinates: [anillo] });
}

/* ---------- Edición de vértices ---------- */

function copiarPartes(geometry) {
  return partesDe(geometry).map((parte) => parte.map((ring) => ring.map((punto) => [punto[0], punto[1]])));
}

function reconstruir(geometry, partes) {
  const limpias = partes.filter(
    (rings) => Array.isArray(rings) && rings.length && rings[0]?.length >= 4,
  );
  if (!limpias.length) return null;
  // Conserva el tipo original: un MultiPolygon sigue siendo MultiPolygon
  // aunque su edición deje una sola parte.
  if (geometry?.type === 'MultiPolygon') return conBbox({ type: 'MultiPolygon', coordinates: limpias });
  return conBbox({ type: 'Polygon', coordinates: limpias[0] });
}

/** Mueve un vértice a [lon, lat]. Devuelve null si el índice no existe. */
export function moverVertice(geometry, iParte, iAnillo, iVertice, punto) {
  if (!esPunto(punto)) return null;
  const partes = copiarPartes(geometry);
  const anillo = partes[iParte]?.[iAnillo];
  if (!anillo) return null;
  const abierto = anilloAbierto(anillo);
  if (iVertice < 0 || iVertice >= abierto.length) return null;
  abierto[iVertice] = [punto[0], punto[1]];
  partes[iParte][iAnillo] = cerrarAnillo(abierto);
  return reconstruir(geometry, partes);
}

/**
 * Inserta un vértice en el segmento iSegmento (del punto iSegmento al
 * siguiente; el último segmento es el que cierra el anillo).
 */
export function insertarVertice(geometry, iParte, iAnillo, iSegmento, punto) {
  if (!esPunto(punto)) return null;
  const partes = copiarPartes(geometry);
  const anillo = partes[iParte]?.[iAnillo];
  if (!anillo) return null;
  const abierto = anilloAbierto(anillo);
  if (abierto.length < 3 || iSegmento < 0 || iSegmento >= abierto.length) return null;
  const posicion = iSegmento === abierto.length - 1 ? abierto.length : iSegmento + 1;
  abierto.splice(posicion, 0, [punto[0], punto[1]]);
  partes[iParte][iAnillo] = cerrarAnillo(abierto);
  return reconstruir(geometry, partes);
}

/**
 * Quita un vértice. Un anillo necesita al menos 3 puntos distintos para
 * seguir siendo un polígono: si no, devuelve null (la UI avisa).
 */
export function quitarVertice(geometry, iParte, iAnillo, iVertice) {
  const partes = copiarPartes(geometry);
  const anillo = partes[iParte]?.[iAnillo];
  if (!anillo) return null;
  const abierto = anilloAbierto(anillo);
  if (abierto.length <= 3) return null;
  if (iVertice < 0 || iVertice >= abierto.length) return null;
  abierto.splice(iVertice, 1);
  partes[iParte][iAnillo] = cerrarAnillo(abierto);
  return reconstruir(geometry, partes);
}

/**
 * Distancia en metros entre un punto y un segmento, proyectando a un plano
 * local (suficiente para decidir "¿sobre qué borde cae el clic?").
 */
function distanciaPuntoSegmentoMetros(punto, a, b) {
  const lat0 = ((punto[1] + a[1] + b[1]) / 3) * Math.PI / 180;
  const kx = Math.cos(lat0) * Math.PI / 180 * 6371008.8;
  const ky = Math.PI / 180 * 6371008.8;
  const px = punto[0] * kx;
  const py = punto[1] * ky;
  const ax = a[0] * kx;
  const ay = a[1] * ky;
  const bx = b[0] * kx;
  const by = b[1] * ky;
  const dx = bx - ax;
  const dy = by - ay;
  const largo2 = dx * dx + dy * dy;
  let t = largo2 ? ((px - ax) * dx + (py - ay) * dy) / largo2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Busca el segmento más cercano a [lon, lat] en toda la geometría.
 * Devuelve { parte, anillo, segmento, distanciaM } o null si está a más de
 * maxMetros (para no insertar un vértice a cualquier distancia).
 */
export function segmentoMasCercano(geometry, punto, maxMetros = 400) {
  if (!esPunto(punto)) return null;
  let mejor = null;
  partesDe(geometry).forEach((parte, iParte) => {
    parte.forEach((ring, iAnillo) => {
      const abierto = anilloAbierto(ring);
      abierto.forEach((a, i) => {
        const b = abierto[(i + 1) % abierto.length];
        const distanciaM = distanciaPuntoSegmentoMetros(punto, a, b);
        if (distanciaM <= maxMetros && (!mejor || distanciaM < mejor.distanciaM)) {
          mejor = { parte: iParte, anillo: iAnillo, segmento: i, distanciaM };
        }
      });
    });
  });
  return mejor;
}

/** Inserta el vértice en el borde más cercano; null si no hay borde cerca. */
export function insertarVerticeEnBorde(geometry, punto, maxMetros = 400) {
  const cerca = segmentoMasCercano(geometry, punto, maxMetros);
  if (!cerca) return null;
  // No insertar encima de un vértice existente: crearía un segmento de largo 0.
  const abierto = anilloAbierto(partesDe(geometry)[cerca.parte]?.[cerca.anillo]);
  const a = abierto[cerca.segmento];
  const b = abierto[(cerca.segmento + 1) % abierto.length];
  if (a && b) {
    const dA = distanciaPuntoSegmentoMetros(punto, a, a);
    const dB = distanciaPuntoSegmentoMetros(punto, b, b);
    if (Math.min(dA, dB) < 1) return null;
  }
  const nueva = insertarVertice(geometry, cerca.parte, cerca.anillo, cerca.segmento, punto);
  return nueva ? { geometria: nueva, ...cerca } : null;
}

/* ---------- Huecos (Medano) ---------- */

/**
 * Rellena los huecos (anillos interiores) de la geometría con el mismo
 * reparador que usa la exportación a Zonar. También fusiona puntos muy
 * cercanos y simplifica, así que devuelve el reporte para mostrarlo en la
 * UI: { geometria, report } (report de cleanGeofence) o { geometria: null }.
 */
export function rellenarHueco(geometry) {
  const { parts, report } = cleanGeofence(geometry);
  return { geometria: desdePartes(parts), report };
}

/* ---------- Validación ---------- */

/**
 * Comprueba que la geometría sea un GeoJSON válido para guardar.
 * Devuelve { ok, errores }.
 */
export function validarGeometria(geometry) {
  const errores = [];
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) {
    return { ok: false, errores: ['La geometría debe ser un Polygon o un MultiPolygon.'] };
  }
  const partes = partesDe(geometry);
  if (!partes.length) errores.push('La geometría no tiene polígonos.');
  partes.forEach((parte, i) => {
    if (!parte.length) {
      errores.push(`El polígono ${i + 1} no tiene anillos.`);
      return;
    }
    parte.forEach((ring, j) => {
      const abierto = anilloAbierto(ring);
      const etiqueta = parte.length > 1 && j > 0 ? `hueco ${j} del polígono ${i + 1}` : `polígono ${i + 1}`;
      if (abierto.length < 3) errores.push(`${etiqueta}: faltan puntos (mínimo 3).`);
      if (!ring.length || ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
        errores.push(`${etiqueta}: el anillo no está cerrado.`);
      }
      if (abierto.some((p) => Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90)) {
        errores.push(`${etiqueta}: coordenadas fuera de WGS84.`);
      }
    });
  });
  return { ok: errores.length === 0, errores };
}
