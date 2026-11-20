// src/lib/geofenceCleaner.js
// Normaliza geocercas para plataformas tipo Zonar:
//  - Rellena huecos (solo se conserva el anillo exterior)
//  - Elimina vértices duplicados/muy cercanos y simplifica (Douglas-Peucker)
//  - Limita el máximo de vértices
//  - Divide polígonos no continuos (MultiPolygon) en partes independientes
// Sin dependencias. Coordenadas GeoJSON [lon, lat] en WGS84.

export const DEFAULTS = {
  minDistM: 2,        // puntos más cercanos que esto se fusionan
  toleranceM: 1.5,    // tolerancia inicial de simplificación
  maxVertices: 200,   // AJUSTAR al límite real de Zonar
  minAreaM2: 25,      // partes más pequeñas se descartan (ruido)
};

const R = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;

function project(ring, lat0) {
  const kx = R * Math.cos(rad(lat0)) * (Math.PI / 180);
  const ky = R * (Math.PI / 180);
  return ring.map(([lon, lat]) => [lon * kx, lat * ky]);
}

function areaM2(ring) {
  const lat0 = ring[0][1];
  const p = project(ring, lat0);
  let a = 0;
  for (let i = 0; i < p.length - 1; i++) a += p[i][0] * p[i + 1][1] - p[i + 1][0] * p[i][1];
  return Math.abs(a) / 2;
}

const open = (r) => {
  const c = r.slice();
  const f = c[0], l = c[c.length - 1];
  if (f[0] === l[0] && f[1] === l[1]) c.pop();
  return c;
};
const close = (r) => (r.length ? [...r, r[0]] : r);

function distPtSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

// Douglas-Peucker iterativo sobre una cadena abierta (metros)
function dpChain(pts, tol) {
  if (pts.length < 3) return pts.map((_, i) => i);
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let max = 0, idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = distPtSeg(pts[i], pts[s], pts[e]);
      if (d > max) { max = d; idx = i; }
    }
    if (max > tol && idx > -1) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  const out = [];
  keep.forEach((k, i) => k && out.push(i));
  return out;
}

function simplifyRing(ring, tolM, minDistM) {
  let pts = open(ring);
  if (pts.length < 3) return null;
  const lat0 = pts[0][1];
  let m = project(pts, lat0);

  // 1) fusionar puntos muy cercanos
  const idx0 = [0];
  for (let i = 1; i < m.length; i++) {
    const j = idx0[idx0.length - 1];
    if (Math.hypot(m[i][0] - m[j][0], m[i][1] - m[j][1]) >= minDistM) idx0.push(i);
  }
  pts = idx0.map((i) => pts[i]);
  m = idx0.map((i) => m[i]);
  if (pts.length < 3) return null;

  // 2) DP sobre un anillo: partir en el punto más lejano al primero
  let far = 0, fd = -1;
  for (let i = 1; i < m.length; i++) {
    const d = Math.hypot(m[i][0] - m[0][0], m[i][1] - m[0][1]);
    if (d > fd) { fd = d; far = i; }
  }
  const a = m.slice(0, far + 1);
  const b = [...m.slice(far), m[0]];
  const ia = dpChain(a, tolM);
  const ib = dpChain(b, tolM).map((i) => i + far);
  const idx = [...new Set([...ia, ...ib])].filter((i) => i < pts.length).sort((x, y) => x - y);
  const res = idx.map((i) => pts[i]);
  return res.length >= 3 ? close(res) : null;
}

function segInter(p1, p2, p3, p4) {
  const d = (a, b, c) => (c[1] - a[1]) * (b[0] - a[0]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

export function selfIntersects(ring) {
  const n = ring.length - 1;
  for (let i = 0; i < n; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segInter(ring[i], ring[i + 1], ring[j], ring[j + 1])) return true;
    }
  return false;
}

function polygonsOf(geom) {
  if (!geom) return [];
  if (geom.type === 'Feature') return polygonsOf(geom.geometry);
  if (geom.type === 'Polygon') return [geom.coordinates];
  if (geom.type === 'MultiPolygon') return geom.coordinates;
  if (geom.type === 'GeometryCollection') return geom.geometries.flatMap(polygonsOf);
  return [];
}

/**
 * Devuelve { parts: [GeoJSON Polygon], report }
 * Cada parte es un polígono simple, continuo y sin huecos.
 */
export function cleanGeofence(geom, options = {}) {
  const o = { ...DEFAULTS, ...options };
  const polys = polygonsOf(geom);
  const report = {
    partesOriginales: polys.length, huecosRellenados: 0,
    verticesAntes: 0, verticesDespues: 0, partesDescartadas: 0,
    autointersecciones: 0, advertencias: [],
  };
  const parts = [];

  for (const rings of polys) {
    if (!rings?.length || rings[0].length < 4) { report.partesDescartadas++; continue; }
    report.huecosRellenados += rings.length - 1;       // anillos interiores ignorados
    report.verticesAntes += rings[0].length - 1;

    let tol = o.toleranceM;
    let ring = simplifyRing(rings[0], tol, o.minDistM);
    while (ring && ring.length - 1 > o.maxVertices && tol < 500) {
      tol *= 1.5;                                       // subir tolerancia hasta caber
      ring = simplifyRing(rings[0], tol, o.minDistM);
    }
    if (!ring || areaM2(ring) < o.minAreaM2) { report.partesDescartadas++; continue; }
    if (selfIntersects(ring)) {
      report.autointersecciones++;
      report.advertencias.push('Polígono con autointersección: revisar manualmente.');
    }
    report.verticesDespues += ring.length - 1;
    parts.push({ type: 'Polygon', coordinates: [ring] });
  }
  return { parts, report };
}

/** Para exportar: una fila por parte, con nombre "X (1/3)" si hay varias. */
export function splitForExport(nombre, geom, options) {
  const { parts, report } = cleanGeofence(geom, options);
  const n = parts.length;
  return {
    report,
    items: parts.map((g, i) => ({
      nombre: n > 1 ? `${nombre} (${i + 1}/${n})` : nombre,
      grupo: nombre,
      geometry: g,
    })),
  };
}