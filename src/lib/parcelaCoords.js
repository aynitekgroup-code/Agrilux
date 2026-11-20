/**
 * Utilidades de coordenadas de parcela.
 * Prioridad: polígono mapeado → GPS numérico → coords del usuario.
 */

/** Centroide simple de un polígono [[lng, lat], ...] */
export function calcularCentroide(coordenadas) {
  if (!Array.isArray(coordenadas) || coordenadas.length < 1) return null;
  const n = coordenadas.length;
  const lat = coordenadas.reduce((s, c) => s + (c[1] || 0), 0) / n;
  const lon = coordenadas.reduce((s, c) => s + (c[0] || 0), 0) / n;
  if (isNaN(lat) || isNaN(lon)) return null;
  return { lat, lon };
}

/** Bounding box del polígono */
export function calcularBBox(coordenadas) {
  if (!Array.isArray(coordenadas) || coordenadas.length < 3) return null;
  const lats = coordenadas.map(c => c[1]);
  const lons = coordenadas.map(c => c[0]);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
  };
}

/** Parsea "lat, lon" o "-6.77, -79.84" */
export function parsearGps(gps) {
  if (!gps || typeof gps !== 'string') return null;
  const parts = gps.split(',').map(s => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { lat: parts[0], lon: parts[1] };
  }
  return null;
}

/** Punto dentro de polígono (ray casting) */
export function puntoEnPoligono(lng, lat, coordenadas) {
  let inside = false;
  for (let i = 0, j = coordenadas.length - 1; i < coordenadas.length; j = i++) {
    const xi = coordenadas[i][0], yi = coordenadas[i][1];
    const xj = coordenadas[j][0], yj = coordenadas[j][1];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Obtiene las mejores coordenadas disponibles para una parcela */
export function obtenerCoordsParcela(parcela, userCoords = null) {
  const centroide = calcularCentroide(parcela?.coordenadas);
  if (centroide) return { ...centroide, fuente: 'poligono' };

  const gps = parsearGps(parcela?.gps);
  if (gps) return { ...gps, fuente: 'gps' };

  if (userCoords?.lat && userCoords?.lon) {
    return { lat: userCoords.lat, lon: userCoords.lon, fuente: 'usuario' };
  }
  return { lat: -12.05, lon: -77.04, fuente: 'default' };
}
