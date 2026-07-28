/**
 * src/lib/importKmz.js
 * Importa archivos KMZ/KML y extrae coordenadas de polígonos
 */
import JSZip from 'jszip';

export async function importarKmzKml(file) {
  const ext = file.name.toLowerCase().split('.').pop();

  if (ext === 'kmz') {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);

    // Buscar archivos KML dentro del ZIP
    const kmlFiles = Object.keys(zip.files).filter(f => f.endsWith('.kml'));
    if (!kmlFiles.length) throw new Error('No se encontró archivo .kml dentro del KMZ');

    const kmlContent = await zip.files[kmlFiles[0]].async('text');
    return parsearKml(kmlContent);
  }

  if (ext === 'kml') {
    const content = await file.text();
    return parsearKml(content);
  }

  throw new Error('Formato no soportado. Usa archivos .kmz o .kml');
}

function parsearKml(kmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(kmlText, 'text/xml');

  const coords = [];
  const placemarks = doc.querySelectorAll('Placemark');

  for (const pm of placemarks) {
    // Polygon
    const polygon = pm.querySelector('Polygon');
    if (polygon) {
      const ring = polygon.querySelector('outerBoundaryIs LinearRing coordinates') ||
                   polygon.querySelector('coordinates');
      if (ring) {
        const rawCoords = ring.textContent.trim().split(/\s+/);
        const points = rawCoords
          .map(c => {
            const parts = c.split(',');
            const lon = parseFloat(parts[0]);
            const lat = parseFloat(parts[1]);
            if (isNaN(lon) || isNaN(lat)) return null;
            return [lon, lat];
          })
          .filter(Boolean);
        if (points.length >= 3) coords.push(points);
      }
    }

    // LineString (fallback — tratar como polígono abierto)
    const lineString = pm.querySelector('LineString');
    if (lineString && !polygon) {
      const ring = lineString.querySelector('coordinates');
      if (ring) {
        const rawCoords = ring.textContent.trim().split(/\s+/);
        const points = rawCoords
          .map(c => {
            const parts = c.split(',');
            const lon = parseFloat(parts[0]);
            const lat = parseFloat(parts[1]);
            if (isNaN(lon) || isNaN(lat)) return null;
            return [lon, lat];
          })
          .filter(Boolean);
        if (points.length >= 3) coords.push(points);
      }
    }
  }

  if (!coords.length) throw new Error('No se encontraron polígonos en el archivo');

  // Usar el polígono más grande (más puntos)
  const poligono = coords.reduce((a, b) => a.length > b.length ? a : b);

  // Calcular área
  const area = calcularAreaHectareas(poligono);
  const nombre = doc.querySelector('name')?.textContent || '';

  return { coordenadas: poligono, area, nombre };
}

function calcularAreaHectareas(coordenadas) {
  if (coordenadas.length < 3) return 0;
  let area = 0;
  const n = coordenadas.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += coordenadas[i][0] * coordenadas[j][1];
    area -= coordenadas[j][0] * coordenadas[i][0];
  }
  area = Math.abs(area) / 2;
  const latMedia = coordenadas.reduce((s, c) => s + c[1], 0) / n;
  const metrosPorGradoLat = 111320;
  const metrosPorGradoLon = 111320 * Math.cos(latMedia * Math.PI / 180);
  const areaM2 = area * metrosPorGradoLat * metrosPorGradoLon;
  return Math.round((areaM2 / 10000) * 100) / 100;
}
