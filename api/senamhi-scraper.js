// api/senamhi-scraper.js
// Scraping del pronóstico de SENAMHI (senamhi.gob.pe)
// Busca la ubicación más cercana y devuelve el pronóstico

const ESTACIONES_SENAMHI = [
  { codigo:'A001', nombre:'Tumbes', dept:'Tumbes', lat:-3.57, lon:-80.45 },
  { codigo:'A002', nombre:'Piura', dept:'Piura', lat:-5.17, lon:-80.63 },
  { codigo:'A004', nombre:'Sullana', dept:'Piura', lat:-4.90, lon:-80.68 },
  { codigo:'A005', nombre:'Chiclayo', dept:'Lambayeque', lat:-6.77, lon:-79.84 },
  { codigo:'A008', nombre:'Trujillo', dept:'La Libertad', lat:-8.11, lon:-79.03 },
  { codigo:'A010', nombre:'Chimbote', dept:'Áncash', lat:-9.07, lon:-78.59 },
  { codigo:'A012', nombre:'Lima', dept:'Lima', lat:-12.03, lon:-76.93 },
  { codigo:'A013', nombre:'Pisco', dept:'Ica', lat:-13.70, lon:-76.02 },
  { codigo:'A014', nombre:'Ica', dept:'Ica', lat:-14.07, lon:-75.73 },
  { codigo:'A016', nombre:'Arequipa', dept:'Arequipa', lat:-16.34, lon:-71.57 },
  { codigo:'A020', nombre:'Tacna', dept:'Tacna', lat:-18.01, lon:-70.25 },
  { codigo:'C001', nombre:'Cajamarca', dept:'Cajamarca', lat:-7.16, lon:-78.52 },
  { codigo:'C002', nombre:'Celendín', dept:'Cajamarca', lat:-6.88, lon:-78.15 },
  { codigo:'H001', nombre:'Huancayo', dept:'Junín', lat:-12.07, lon:-75.22 },
  { codigo:'H002', nombre:'Huánuco', dept:'Huánuco', lat:-9.93, lon:-76.24 },
  { codigo:'J001', nombre:'Jaén', dept:'Cajamarca', lat:-5.71, lon:-78.81 },
  { codigo:'L001', nombre:'Lamas', dept:'San Martín', lat:-6.42, lon:-76.53 },
  { codigo:'M001', nombre:'Moyobamba', dept:'San Martín', lat:-6.03, lon:-76.97 },
  { codigo:'P001', nombre:'Pucallpa', dept:'Ucayali', lat:-8.38, lon:-74.55 },
  { codigo:'T001', nombre:'Tarapoto', dept:'San Martín', lat:-6.48, lon:-76.36 },
  { codigo:'T002', nombre:'Tingo María', dept:'Huánuco', lat:-9.30, lon:-76.01 },
  { codigo:'U001', nombre:'Uchiza', dept:'San Martín', lat:-8.11, lon:-76.51 },
  { codigo:'Y001', nombre:'Yurimaguas', dept:'Loreto', lat:-5.90, lon:-76.08 },
];

function findEstacionCercana(lat, lon) {
  let min = Infinity, best = null;
  for (const e of ESTACIONES_SENAMHI) {
    const d = Math.hypot(lat - e.lat, lon - e.lon);
    if (d < min) { min = d; best = e; }
  }
  return best ? { ...best, distanciaKm: Math.round(min * 111) } : null;
}

function parsearPronosticoSENAMHI(html) {
  const resultados = [];

  // Buscar bloques de ubicación: "NOMBRE - DEPARTAMENTO"
  const ubicacionRegex = /class="[^"]*"[^>]*>\s*([A-ZÁÉÍÓÚÑ\s]+)\s*-\s*([A-ZÁÉÍÓÚÑ\s]+)\s*<\/(?:h\d|div|span|td|p)/gi;
  const ubicaciones = [];
  let match;

  while ((match = ubicacionRegex.exec(html)) !== null) {
    ubicaciones.push({
      nombre: match[1].trim(),
      departamento: match[2].trim(),
      index: match.index,
    });
  }

  // Si no encontramos con el regex anterior, intentar otro patrón
  if (ubicaciones.length === 0) {
    const altRegex = /(?:^|\n)\s*([A-Z][A-ZÁÉÍÓÚÑ\s]{2,30})\s*-\s*([A-Z][A-ZÁÉÍÓÚÑ\s]{2,30})\s*(?:\n|$)/gm;
    while ((match = altRegex.exec(html)) !== null) {
      ubicaciones.push({
        nombre: match[1].trim(),
        departamento: match[2].trim(),
        index: match.index,
      });
    }
  }

  // Para cada ubicación, buscar pronósticos
  for (let i = 0; i < ubicaciones.length; i++) {
    const inicio = ubicaciones[i].index;
    const fin = i + 1 < ubicaciones.length ? ubicaciones[i + 1].index : html.length;
    const bloque = html.substring(inicio, fin);

    const pronosticos = [];

    // Buscar fechas: "lunes, 28 de julio" / "martes, 29 de julio" etc.
    const fechaRegex = /((?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo),\s*\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre))/gi;
    const fechas = [];
    while ((match = fechaRegex.exec(bloque)) !== null) {
      fechas.push({ fecha: match[1].trim(), index: match.index });
    }

    // Para cada fecha, buscar temperaturas y descripción
    for (let j = 0; j < fechas.length; j++) {
      const inicioF = fechas[j].index;
      const finF = j + 1 < fechas.length ? fechas[j + 1].index : bloque.length;
      const bloqueFecha = bloque.substring(inicioF, finF);

      // Buscar temperaturas: "31ºC" / "22ºC"
      const tempRegex = /(-?\d{1,2})\s*º\s*C/gi;
      const temps = [];
      while ((match = tempRegex.exec(bloqueFecha)) !== null) {
        temps.push(parseInt(match[1]));
      }

      // Buscar descripción del clima
      const descRegex = /(?:Cielo|Lluvia|Nublado|Despejado|Llovizna|Tormenta|Niebla|Neblina)[^.]*?\./gi;
      const descs = [];
      while ((match = descRegex.exec(bloqueFecha)) !== null) {
        descs.push(match[0].trim());
      }

      if (temps.length >= 2) {
        pronosticos.push({
          fecha: fechas[j].fecha,
          tempMax: temps[0],
          tempMin: temps[1],
          descripcion: descs[0] || 'No disponible',
        });
      }
    }

    if (pronosticos.length > 0) {
      resultados.push({
        nombre: ubicaciones[i].nombre,
        departamento: ubicaciones[i].departamento,
        pronosticos,
      });
    }
  }

  return resultados;
}

function buscarUbicacion(ubicaciones, lat, lon) {
  if (ubicaciones.length === 0) return null;

  // Mapear nombres de ubicaciones a coordenadas aproximadas
  const coordMap = {};
  for (const e of ESTACIONES_SENAMHI) {
    coordMap[e.nombre.toUpperCase()] = { lat: e.lat, lon: e.lon };
  }

  let mejor = null;
  let mejorDist = Infinity;

  for (const u of ubicaciones) {
    const nombreUpper = u.nombre.trim().toUpperCase();
    // Buscar coincidencia exacta o parcial
    for (const [key, coord] of Object.entries(coordMap)) {
      if (key === nombreUpper || key.includes(nombreUpper) || nombreUpper.includes(key)) {
        const d = Math.hypot(lat - coord.lat, lon - coord.lon);
        if (d < mejorDist) {
          mejorDist = d;
          mejor = u;
        }
      }
    }
  }

  return mejor;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const url = new URL(req.url, 'http://localhost');
  const lat = parseFloat(url.searchParams.get('lat'));
  const lon = parseFloat(url.searchParams.get('lon'));
  const q = url.searchParams.get('q') || '';

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'lat y lon requeridos' });
  }

  try {
    // Buscar estación más cercana
    const estacion = findEstacionCercana(lat, lon);
    if (!estacion) {
      return res.status(404).json({ error: 'No se encontró estación SENAMHI cercana' });
    }

    // Fetch de la página de pronóstico SENAMHI
    const senamhiRes = await fetch('https://www.senamhi.gob.pe/?p=pronostico-meteorologico', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-PE,es;q=0.9',
      },
      timeout: 10000,
    });

    if (!senamhiRes.ok) {
      return res.status(502).json({ error: 'Error al acceder a SENAMHI' });
    }

    const html = await senamhiRes.text();

    // Parsear pronósticos
    const ubicaciones = parsearPronosticoSENAMHI(html);

    // Buscar la ubicación que coincida con la estación
    let ubicacionEncontrada = null;
    for (const u of ubicaciones) {
      if (u.nombre.trim().toUpperCase() === estacion.nombre.toUpperCase() ||
          u.nombre.trim().toUpperCase().includes(estacion.nombre.toUpperCase()) ||
          estacion.nombre.toUpperCase().includes(u.nombre.trim().toUpperCase())) {
        ubicacionEncontrada = u;
        break;
      }
    }

    // Si no encontramos por nombre exacto, buscar por coordenadas
    if (!ubicacionEncontrada) {
      ubicacionEncontrada = buscarUbicacion(ubicaciones, lat, lon);
    }

    return res.status(200).json({
      source: 'SENAMHI',
      estacion: {
        codigo: estacion.codigo,
        nombre: estacion.nombre,
        departamento: estacion.dept,
        distanciaKm: estacion.distanciaKm,
      },
      ubicacionEncontrada: ubicacionEncontrada ? {
        nombre: ubicacionEncontrada.nombre,
        departamento: ubicacionEncontrada.departamento,
      } : null,
      pronosticos: ubicacionEncontrada?.pronosticos || [],
      totalUbicaciones: ubicaciones.length,
      note: ubicacionEncontrada
        ? `Pronóstico oficial SENAMHI para ${ubicacionEncontrada.nombre}`
        : `No se encontró pronóstico exacto. Estación más cercana: ${estacion.nombre} (${estacion.distanciaKm} km)`,
    });
  } catch (error) {
    console.error('SENAMHI scraper error:', error);
    return res.status(500).json({ error: error.message });
  }
}
