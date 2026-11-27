// Estimación conservadora para diagnóstico, no liquidación. Las coordenadas
// GeoJSON van en orden longitud, latitud; se respetan huecos y multipolígonos.
function dentroAnillo(x, y, anillo) {
  if (!Array.isArray(anillo) || anillo.length < 4) return false;
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}
function dentroPoligono(x, y, poligono) {
  return Array.isArray(poligono) && dentroAnillo(x, y, poligono[0]) && !poligono.slice(1).some((anillo) => dentroAnillo(x, y, anillo));
}
function contiene(punto, geometria) {
  if (geometria?.type === 'Polygon') return dentroPoligono(punto.longitud, punto.latitud, geometria.coordinates);
  if (geometria?.type === 'MultiPolygon') return geometria.coordinates.some((poligono) => dentroPoligono(punto.longitud, punto.latitud, poligono));
  return false;
}
function estado(punto) {
  if (punto.ignicion === false) return 'apagado';
  if (punto.ignicion !== true || punto.velocidad_kmh == null || !Number.isFinite(punto.velocidad_kmh) || punto.velocidad_kmh < 0) return null;
  return punto.velocidad_kmh > 5 ? 'movimiento' : 'ralenti';
}

export function estimarHunterPorGeocerca(puntos, geocercas, maxIntervaloSegundos = 300) {
  const ordenados = [...puntos].sort((a, b) => Date.parse(a.fecha) - Date.parse(b.fecha));
  const asignar = (p) => geocercas.filter((g) => contiene(p, g.geometria));
  const grupos = new Map();
  let incierto = 0;
  for (let i = 1; i < ordenados.length; i++) {
    const a = ordenados[i - 1], b = ordenados[i];
    const segundos = (Date.parse(b.fecha) - Date.parse(a.fecha)) / 1000;
    if (!Number.isFinite(segundos) || segundos <= 0) continue;
    const ga = asignar(a), gb = asignar(b), ea = estado(a), eb = estado(b);
    if (segundos > maxIntervaloSegundos || ga.length !== 1 || gb.length !== 1 || ga[0].id !== gb[0].id || !ea || ea !== eb) {
      incierto += segundos;
      continue;
    }
    const g = ga[0];
    const fila = grupos.get(g.id) || { id: g.id, geocerca: g.nombre, apagado: 0, ralenti: 0, movimiento: 0 };
    fila[ea] += segundos;
    grupos.set(g.id, fila);
  }
  return { filas: [...grupos.values()], incierto };
}

/** Cobertura del periodo solicitado: nunca interpretar huecos como cero medido. */
export function coberturaHunter(puntos, estimacion, desde, hasta, ahora = Date.now()) {
  const inicio = Date.parse(desde);
  const fin = Math.min(Date.parse(hasta), ahora);
  if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin <= inicio) return null;
  const total = (fin - inicio) / 1000;
  const asignado = (estimacion?.filas || []).reduce((s, f) => s + f.apagado + f.ralenti + f.movimiento, 0);
  const instantes = puntos.map((p) => Date.parse(p.fecha)).filter((t) => Number.isFinite(t) && t >= inicio && t <= fin).sort((a, b) => a - b);
  const entre = instantes.length >= 2 ? Math.max(0, (instantes.at(-1) - instantes[0]) / 1000) : 0;
  return { total, asignado, inciertoEntre: estimacion?.incierto ?? 0, sinCoberturaExterna: Math.max(0, total - entre), sinAsignar: Math.max(0, total - asignado), porcentaje: Math.min(100, 100 * asignado / total) };
}
