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
  return punto.velocidad_kmh === 0 ? 'detenido' : punto.velocidad_kmh <= 5 ? 'ralenti' : 'movimiento';
}

// Hipótesis de continuidad, no comprobación de los eventos intermedios.
function distanciaMetros(a, b) {
  if (![a.latitud, a.longitud, b.latitud, b.longitud].every(Number.isFinite)) return Infinity;
  const rad = Math.PI / 180;
  const dLat = (b.latitud - a.latitud) * rad, dLon = (b.longitud - a.longitud) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitud * rad) * Math.cos(b.latitud * rad) * Math.sin(dLon / 2) ** 2;
  return 12742000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function estimarHunterPorGeocerca(puntos, geocercas, maxIntervaloSegundos = 300) {
  const ordenados = [...puntos].sort((a, b) => Date.parse(a.fecha) - Date.parse(b.fecha));
  const asignar = (p) => geocercas.filter((g) => contiene(p, g.geometria));
  const grupos = new Map();
  const hipotesis = [];
  const intervalos = [];
  let incierto = 0;
  for (let i = 1; i < ordenados.length; i++) {
    const a = ordenados[i - 1], b = ordenados[i];
    const segundos = (Date.parse(b.fecha) - Date.parse(a.fecha)) / 1000;
    if (!Number.isFinite(segundos) || segundos <= 0) continue;
    const ga = asignar(a), gb = asignar(b), ea = estado(a), eb = estado(b);
    const mismaGeocerca = ga.length === 1 && gb.length === 1 && ga[0].id === gb[0].id;
    let clasificado = null;
    if (segundos <= maxIntervaloSegundos) {
      if (mismaGeocerca && ea && ea === eb) clasificado = ea;
    }
    if (!clasificado) {
      incierto += segundos;
      if (segundos > maxIntervaloSegundos && segundos <= 5400 && mismaGeocerca
        && a.ignicion === false && (b.ignicion === false || (b.ignicion === true && b.evento === 'Ignición ON'))
        && a.velocidad_kmh === 0 && b.velocidad_kmh === 0 && distanciaMetros(a, b) <= 100) {
        hipotesis.push({ inicio: a.fecha, fin: b.fecha, segundos, geocerca: ga[0].nombre, geocerca_id: ga[0].id });
      }
      continue;
    }
    const g = ga[0];
    const fila = grupos.get(g.id) || { id: g.id, geocerca: g.nombre, apagado: 0, detenido: 0, ralenti: 0, movimiento: 0 };
    fila[clasificado] += segundos;
    grupos.set(g.id, fila);
    intervalos.push({ inicio: a.fecha, fin: b.fecha, segundos, geocerca: g.nombre, geocerca_id: g.id, estado: clasificado, hipotesis: false });
  }
  return { filas: [...grupos.values()], incierto, hipotesisApagado: hipotesis, intervalos };
}

/** Tramos contiguos con igual estado, geocerca y nivel de hipótesis. */
export function intervalosHunter(estimacion, incluirHipotesis = false) {
  const tramos = [...(estimacion?.intervalos || []), ...(incluirHipotesis ? (estimacion?.hipotesisApagado || []).map((h) => ({ ...h, estado: 'apagado', hipotesis: true })) : [])]
    .sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
  return tramos.reduce((resultado, tramo) => {
    const anterior = resultado.at(-1);
    if (anterior && Date.parse(anterior.fin) === Date.parse(tramo.inicio) && anterior.geocerca_id === tramo.geocerca_id && anterior.estado === tramo.estado && anterior.hipotesis === tramo.hipotesis) {
      anterior.fin = tramo.fin;
      anterior.segundos += tramo.segundos;
    } else resultado.push({ ...tramo });
    return resultado;
  }, []);
}

/** Cobertura del periodo solicitado: nunca interpretar huecos como cero medido. */
export function coberturaHunter(puntos, estimacion, desde, hasta, ahora = Date.now()) {
  const inicio = Date.parse(desde);
  const finDia = Date.parse(hasta);
  const fin = Math.max(inicio, Math.min(finDia, ahora));
  if (!Number.isFinite(inicio) || !Number.isFinite(finDia) || !Number.isFinite(ahora) || finDia <= inicio) return null;
  const total = (fin - inicio) / 1000;
  const asignado = (estimacion?.filas || []).reduce((s, f) => s + f.apagado + f.detenido + f.ralenti + f.movimiento, 0);
  const instantes = puntos.map((p) => Date.parse(p.fecha)).filter((t) => Number.isFinite(t) && t >= inicio && t <= fin).sort((a, b) => a - b);
  const entre = instantes.length >= 2 ? Math.max(0, (instantes.at(-1) - instantes[0]) / 1000) : 0;
  if (!Number.isFinite(asignado) || asignado > total || asignado < 0) return null;
  return { total, totalDia: (finDia - inicio) / 1000, pendiente: (finDia - fin) / 1000, corte: fin, asignado, inciertoEntre: estimacion?.incierto ?? 0, sinCoberturaExterna: Math.max(0, total - entre), sinAsignar: total - asignado, porcentaje: total ? 100 * asignado / total : 0 };
}

/** Escenario alternativo: continuidad de apagado suponiendo ausencia de eventos
 * no recibidos. No modifica el balance conservador ni el resumen de Hunter. */
export function escenarioApagadoHunter(estimacion, cobertura) {
  if (!cobertura || !estimacion || !Array.isArray(estimacion.hipotesisApagado)) return null;
  const grupos = new Map();
  let anterior = -Infinity, total = 0;
  for (const h of [...estimacion.hipotesisApagado].sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio))) {
    const inicio = Date.parse(h.inicio), fin = Date.parse(h.fin);
    if (!Number.isFinite(inicio) || !Number.isFinite(fin) || inicio < anterior || fin > cobertura.corte || fin <= inicio || (fin - inicio) / 1000 !== h.segundos || !h.geocerca_id) return null;
    anterior = fin;
    total += h.segundos;
    const fila = grupos.get(h.geocerca_id) || { id: h.geocerca_id, geocerca: h.geocerca, segundos: 0 };
    fila.segundos += h.segundos;
    grupos.set(h.geocerca_id, fila);
  }
  if (total > cobertura.sinAsignar) return null;
  return { filas: [...grupos.values()], estimado: total, resto: cobertura.sinAsignar - total, asignado: cobertura.asignado + total, pendiente: cobertura.pendiente, totalDia: cobertura.totalDia };
}

/** Proyección para la tabla, manteniendo separado cuánto se supuso por huecos. */
export function tablaAproximadaHunter(estimacion, cobertura) {
  const escenario = escenarioApagadoHunter(estimacion, cobertura);
  if (!escenario) return null;
  const filas = new Map((estimacion.filas || []).map((f) => [f.id, { ...f, apagadoHipotesis: 0 }]));
  for (const h of escenario.filas) {
    const fila = filas.get(h.id) || { id: h.id, geocerca: h.geocerca, apagado: 0, detenido: 0, ralenti: 0, movimiento: 0, apagadoHipotesis: 0 };
    fila.apagado += h.segundos;
    fila.apagadoHipotesis += h.segundos;
    filas.set(h.id, fila);
  }
  return { filas: [...filas.values()], escenario };
}
