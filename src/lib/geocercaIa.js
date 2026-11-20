/**
 * src/lib/geocercaIa.js
 * Geocercas por INSTRUCCIÓN con IA (FASE: IA en Gestión).
 *
 * La IA solo PROPONE un polígono a partir de una instrucción del usuario y
 * de las geocercas existentes como referencia. Aquí se valida la propuesta
 * (coordenadas, cantidad de puntos, zona y área) antes de que llegue al mapa:
 * el polígono entra como BORRADOR y solo se guarda cuando el usuario pulsa
 * "Crear geocerca". La IA nunca escribe en Supabase.
 *
 * Puro, sin fetch ni DOM: apto para node:test.
 */

export const PUNTOS_MIN = 3;
export const PUNTOS_MAX = 12;
/** Área mínima del polígono en grados² (~11 m²): evita polígonos degenerados. */
const AREA_MIN_GRADOS2 = 1e-7;
/** Margen alrededor de los centros existentes para aceptar la propuesta. */
const MARGEN_ZONA_GRADOS = 0.4;

const num = (valor) => Number(valor);

/**
 * Bounding box de los centros de las geocercas existentes (con margen).
 * @returns {null|{latMin:number, latMax:number, lonMin:number, lonMax:number}}
 */
export function bboxDeCentros(centros = []) {
  const válidos = (Array.isArray(centros) ? centros : [])
    .map((c) => ({ lat: num(c?.lat), lon: num(c?.lon) }))
    .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon));
  if (!válidos.length) return null;
  const lats = válidos.map((c) => c.lat);
  const lons = válidos.map((c) => c.lon);
  return {
    latMin: Math.min(...lats) - MARGEN_ZONA_GRADOS,
    latMax: Math.max(...lats) + MARGEN_ZONA_GRADOS,
    lonMin: Math.min(...lons) - MARGEN_ZONA_GRADOS,
    lonMax: Math.max(...lons) + MARGEN_ZONA_GRADOS,
  };
}

/** Área absoluta del polígono (fórmula del zapatero) en grados². */
export function areaPoligono(puntos) {
  let suma = 0;
  for (let i = 0; i < puntos.length; i += 1) {
    const [x1, y1] = puntos[i];
    const [x2, y2] = puntos[(i + 1) % puntos.length];
    suma += x1 * y2 - x2 * y1;
  }
  return Math.abs(suma) / 2;
}

/**
 * Valida una propuesta de la IA.
 * @param {{nombre?: string, puntos?: Array<[number, number]>, advertencia?: string}} datos
 * @param {{bbox?: ReturnType<typeof bboxDeCentros>|null}} [opciones]
 * @returns {{valido: boolean, errores: string[], nombre: string,
 *   puntos: Array<[number, number]>, advertencia: string}}
 */
export function validarPropuestaGeocerca(datos, { bbox = null } = {}) {
  const errores = [];
  const nombre = String(datos?.nombre || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const advertencia = String(datos?.advertencia || '').replace(/\s+/g, ' ').trim().slice(0, 300);

  if (!nombre) errores.push('La IA no devolvió un nombre para la geocerca.');

  const puntos = (Array.isArray(datos?.puntos) ? datos.puntos : [])
    .map((p) => (Array.isArray(p) && p.length >= 2 ? [num(p[0]), num(p[1])] : null))
    .filter((p) => p && Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .slice(0, PUNTOS_MAX);

  if (puntos.length < PUNTOS_MIN) {
    errores.push(`La IA propuso ${puntos.length} punto(s): un polígono necesita al menos ${PUNTOS_MIN}.`);
  }
  if (puntos.length > PUNTOS_MAX) {
    errores.push(`La IA propuso ${puntos.length} puntos: el máximo es ${PUNTOS_MAX}.`);
  }

  const fueraDeRango = puntos.filter(([lat, lon]) => Math.abs(lat) > 90 || Math.abs(lon) > 180);
  if (fueraDeRango.length) {
    errores.push('La propuesta tiene coordenadas fuera de rango (lat ±90, lon ±180).');
  }

  // Sin duplicados consecutivos (un punto repetido rompe el área).
  const sinDuplicados = puntos.filter((p, i) => i === 0 || p[0] !== puntos[i - 1][0] || p[1] !== puntos[i - 1][1]);

  if (sinDuplicados.length >= PUNTOS_MIN) {
    const area = areaPoligono(sinDuplicados);
    if (area < AREA_MIN_GRADOS2) {
      errores.push('El polígono propuesto es demasiado pequeño o está todo en un punto.');
    }
  }

  if (bbox && sinDuplicados.length) {
    const fuera = sinDuplicados.filter(
      ([lat, lon]) => lat < bbox.latMin || lat > bbox.latMax || lon < bbox.lonMin || lon > bbox.lonMax,
    );
    if (fuera.length) {
      errores.push(
        `La propuesta se sale de la zona de la empresa (${fuera.length} de ${sinDuplicados.length} puntos fuera del área de las geocercas existentes).`,
      );
    }
  }

  return {
    valido: errores.length === 0 && sinDuplicados.length >= PUNTOS_MIN,
    errores,
    nombre,
    puntos: sinDuplicados,
    advertencia,
  };
}

/**
 * Contexto para la IA: la instrucción + las geocercas existentes (solo
 * id/nombre/centro: NUNCA la geometría completa).
 * @returns {string}
 */
export function armarContextoGeocerca({ instruccion = '', geocercas = [] } = {}) {
  const lista = (Array.isArray(geocercas) ? geocercas : []).slice(0, 60);
  const lineas = lista
    .map((g) => {
      const centro = g?.centro ? `centro ${g.centro.lat}, ${g.centro.lon}` : 'sin centro';
      return `- ${g?.nombre || '(sin nombre)'} (${g?.grupo || 'sin grupo'}, ${g?.vertices || 0} vértices, ${centro})`;
    })
    .join('\n');

  return `INSTRUCCIÓN DEL USUARIO
${String(instruccion || '').slice(0, 400)}

GEOCERCAS EXISTENTES (${lista.length}) — úsalas como referencia de zona:
${lineas || 'ninguna: pide coordenadas aproximadas en la instrucción'}

FORMATO DE SALIDA: {"nombre":"...","puntos":[[lat,lon],...],"advertencia":"..."}`;
}

export default validarPropuestaGeocerca;
