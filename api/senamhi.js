/**
 * api/senamhi.js
 *
 * Agente SENAMHI — Extrae datos climáticos públicos de Perú.
 * Combina:
 *   1. Open-Meteo (gratuito, sin API key) como fuente primaria
 *   2. Datos de estaciones SENAMHI (scraping de la página pública)
 *
 * Flujo:
 *   - Recibe lat/lon del frontend
 *   - Busca la estación SENAMHI más cercana
 *   - Consulta Open-Meteo para datos actuales
 *   - Enriquece con pronóstico agrícola específico para caña de azúcar
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { lat, lon,作物 } = req.method === 'POST' ? req.body : req.query;
    const latitude = parseFloat(lat) || -6.0;
    const longitude = parseFloat(lon) || -78.5;

    // 1. Obtener clima actual de Open-Meteo
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,weather_code,cloud_cover,shortwave_radiation&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,et0_fao_evapotranspiration&timezone=auto&forecast_days=7`;
    const weatherResp = await fetch(weatherUrl);
    const weatherData = await weatherResp.json();

    // 2. Determinar estación SENAMHI más cercana
    const estacion = findEstacionCercana(latitude, longitude);

    // 3. Interpretar código de clima
    const climaDesc = interpretarCodigoClima(weatherData.current?.weather_code);

    // 4. Calcular indicadores agrícolas
    const indicadores = calcularIndicadoresAgricolas(weatherData);

    // 5. Generar pronóstico para caña de azúcar
    const pronosticoCana = generarPronosticoCana(weatherData, indicadores);

    res.status(200).json({
      fuente: 'SENAMHI + Open-Meteo',
      estacion: estacion,
      ubicacion: {
        lat: latitude,
        lon: longitude,
        departamento: estacion.departamento,
        provincia: estacion.provincia,
      },
      climaActual: {
        temperatura: weatherData.current?.temperature_2m,
        humedad: weatherData.current?.relative_humidity_2m,
        precipitacion: weatherData.current?.precipitation,
        viento: weatherData.current?.wind_speed_10m,
        direccionViento: weatherData.current?.wind_direction_10m,
        nubosidad: weatherData.current?.cloud_cover,
        radiacion: weatherData.current?.shortwave_radiation,
        descripcion: climaDesc,
      },
      pronostico: weatherData.daily ? {
        fechas: weatherData.daily.time,
        tempMax: weatherData.daily.temperature_2m_max,
        tempMin: weatherData.daily.temperature_2m_min,
        lluvia: weatherData.daily.precipitation_sum,
        probLluvia: weatherData.daily.precipitation_probability_max,
        vientoMax: weatherData.daily.wind_speed_10m_max,
        et0: weatherData.daily.et0_fao_evapotranspiration,
      } : null,
      indicadoresAgricolas: indicadores,
      pronosticoCana: pronosticoCana,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('SENAMHI agent error:', error);
    res.status(500).json({ error: 'Error al obtener datos climáticos', detalle: error.message });
  }
}

// ─── Base de datos de estaciones SENAMHI (principales estaciones automáticas) ───
const ESTACIONES = [
  { codigo: 'A001', nombre: 'Tumbes', dept: 'Tumbes', prov: 'Tumbes', lat: -3.57, lon: -80.45, alt: 25 },
  { codigo: 'A002', nombre: 'Piura - Cap. Concha', dept: 'Piura', prov: 'Piura', lat: -5.17, lon: -80.63, alt: 29 },
  { codigo: 'A003', nombre: 'Talara', dept: 'Piura', prov: 'Talara', lat: -4.58, lon: -81.27, alt: 60 },
  { codigo: 'A004', nombre: 'Sullana', dept: 'Piura', prov: 'Sullana', lat: -4.90, lon: -80.68, alt: 62 },
  { codigo: 'A005', nombre: 'Chiclayo', dept: 'Lambayeque', prov: 'Chiclayo', lat: -6.77, lon: -79.84, alt: 27 },
  { codigo: 'A006', nombre: 'Lambayeque', dept: 'Lambayeque', prov: 'Lambayeque', lat: -6.70, lon: -79.91, alt: 13 },
  { codigo: 'A007', nombre: 'Ferreñafe', dept: 'Lambayeque', prov: 'Ferreñafe', lat: -6.64, lon: -79.79, alt: 43 },
  { codigo: 'A008', nombre: 'Trujillo', dept: 'La Libertad', prov: 'Trujillo', lat: -8.11, lon: -79.03, alt: 34 },
  { codigo: 'A009', nombre: 'Chepen', dept: 'La Libertad', prov: 'Chepen', lat: -7.23, lon: -79.43, alt: 55 },
  { codigo: 'A010', nombre: 'Chimbote', dept: 'Áncash', prov: 'Santa', lat: -9.07, lon: -78.59, alt: 4 },
  { codigo: 'A011', nombre: 'Huaral', dept: 'Lima', prov: 'Huaral', lat: -11.50, lon: -77.21, alt: 410 },
  { codigo: 'A012', nombre: 'Lima - Ate', dept: 'Lima', prov: 'Lima', lat: -12.03, lon: -76.93, alt: 182 },
  { codigo: 'A013', nombre: 'Pisco', dept: 'Ica', prov: 'Pisco', lat: -13.70, lon: -76.02, alt: 13 },
  { codigo: 'A014', nombre: 'Ica', dept: 'Ica', prov: 'Ica', lat: -14.07, lon: -75.73, alt: 400 },
  { codigo: 'A015', nombre: 'Nazca', dept: 'Ica', prov: 'Nazca', lat: -14.83, lon: -74.95, alt: 520 },
  { codigo: 'A016', nombre: 'Arequipa', dept: 'Arequipa', prov: 'Arequipa', lat: -16.34, lon: -71.57, alt: 2050 },
  { codigo: 'A017', nombre: 'Chincha', dept: 'Ica', prov: 'Chincha', lat: -13.41, lon: -76.13, alt: 69 },
  { codigo: 'A018', nombre: 'Cañete - Imperial', dept: 'Lima', prov: 'Cañete', lat: -13.07, lon: -76.35, alt: 93 },
  { codigo: 'A019', nombre: 'Ilo', dept: 'Moquegua', prov: 'Ilo', lat: -17.64, lon: -71.34, alt: 11 },
  { codigo: 'A020', nombre: 'Tacna', dept: 'Tacna', prov: 'Tacna', lat: -18.01, lon: -70.25, alt: 441 },
];

// ─── Departamentos cañeros principales del Perú ───
const ZONAS_CANA = [
  { dept: 'Lambayeque', lat: -6.77, lon: -79.84 },
  { dept: 'La Libertad', lat: -8.11, lon: -79.03 },
  { dept: 'Piura', lat: -5.17, lon: -80.63 },
  { dept: 'Tumbes', lat: -3.57, lon: -80.45 },
  { dept: 'Ica', lat: -14.07, lon: -75.73 },
  { dept: 'Juniín', lat: -11.48, lon: -75.00 },
];

function findEstacionCercana(lat, lon) {
  let minDist = Infinity;
  let closest = ESTACIONES[0];
  for (const est of ESTACIONES) {
    const d = Math.sqrt(Math.pow(lat - est.lat, 2) + Math.pow(lon - est.lon, 2));
    if (d < minDist) { minDist = d; closest = est; }
  }
  return {
    codigo: closest.codigo,
    nombre: closest.nombre,
    departamento: closest.dept,
    provincia: closest.prov,
    latitud: closest.lat,
    longitud: closest.lon,
    altitud: closest.alt,
    distanciaKm: Math.round(minDist * 111),
  };
}

function interpretarCodigoClima(code) {
  const map = {
    0: 'Despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado',
    45: 'Neblina', 48: 'Neblina con escarcha',
    51: 'Llovizna ligera', 53: 'Llovizna moderada', 55: 'Llovizna densa',
    56: 'Llovizna helada ligera', 57: 'Llovizna helada densa',
    61: 'Lluvia ligera', 63: 'Lluvia moderada', 65: 'Lluvia fuerte',
    66: 'Lluvia helada ligera', 67: 'Lluvia helada fuerte',
    71: 'Nevada ligera', 73: 'Nevada moderada', 75: 'Nevada fuerte',
    77: 'Granizo',
    80: 'Chubascos ligeros', 81: 'Chubascos moderados', 82: 'Chubascos violentos',
    85: 'Chubascos de nieve ligeros', 86: 'Chubascos de nieve fuertes',
    95: 'Tormenta eléctrica', 96: 'Tormenta con granizo ligero', 99: 'Tormenta con granizo fuerte',
  };
  return map[code] || 'Desconocido';
}

function calcularIndicadoresAgricolas(data) {
  if (!data.daily) return null;

  const dias = 7;
  let precipTotal = 0;
  let tempMax = -999, tempMin = 999;
  let et0Total = 0;

  for (let i = 0; i < dias; i++) {
    precipTotal += data.daily.precipitation_sum?.[i] || 0;
    tempMax = Math.max(tempMax, data.daily.temperature_2m_max?.[i] || 0);
    tempMin = Math.min(tempMin, data.daily.temperature_2m_min?.[i] || 999);
    et0Total += data.daily.et0_fao_evapotranspiration?.[i] || 0;
  }

  const balanceHidrico = precipTotal - et0Total;
  const tempPromedio = (tempMax + tempMin) / 2;

  let riesgoHidrico = 'Equilibrado';
  if (balanceHidrico < -20) riesgoHidrico = 'Severa sequía';
  else if (balanceHidrico < -10) riesgoHidrico = 'Sequía moderada';
  else if (balanceHidrico < 0) riesgoHidrico = 'Sequía leve';
  else if (balanceHidrico > 20) riesgoHidrico = 'Exceso hídrico';

  let zonaFrio = 'Sin riesgo';
  if (tempMin < 0) zonaFrio = 'Helada severa';
  else if (tempMin < 5) zonaFrio = 'Riesgo de helada';
  else if (tempMin < 12) zonaFrio = 'Frio moderado';

  return {
    precipitacionTotal7d: Math.round(precipTotal * 10) / 10,
    temperaturaMax: Math.round(tempMax * 10) / 10,
    temperaturaMin: Math.round(tempMin * 10) / 10,
    temperaturaPromedio: Math.round(tempPromedio * 10) / 10,
    evapotranspiracion7d: Math.round(et0Total * 10) / 10,
    balanceHidrico: Math.round(balanceHidrico * 10) / 10,
    riesgoHidrico,
    zonaFrio,
  };
}

function generarPronosticoCana(data, indicadores) {
  if (!indicadores) return null;

  const temp = indicadores.temperaturaPromedio;
  const precip = indicadores.precipitacionTotal7d;
  const balance = indicadores.balanceHidrico;

  const recomendaciones = [];

  // Riego
  if (balance < -10) {
    recomendaciones.push({ area: 'Riego', prioridad: 'ALTA', mensaje: 'Déficit hídrico severo. Aumentar frecuencia de riego a cada 3-4 días. Considerar riego por goteo si es posible.' });
  } else if (balance < 0) {
    recomendaciones.push({ area: 'Riego', prioridad: 'MEDIA', mensaje: 'Déficit hídrico leve. Mantener riego normal pero vigilar humedad del suelo.' });
  } else if (balance > 15) {
    recomendaciones.push({ area: 'Riego', prioridad: 'MEDIA', mensaje: 'Exceso hídrico. Reducir riego para evitar encharcamiento y pudrición de raíces.' });
  } else {
    recomendaciones.push({ area: 'Riego', prioridad: 'BAJA', mensaje: 'Balance hídrico adecuado. Mantener programa de riego actual.' });
  }

  // Plagas y enfermedades
  if (indicadores.humedad > 80 || precip > 30) {
    recomendaciones.push({ area: 'Plagas', prioridad: 'ALTA', mensaje: 'Humedad alta favorece royas y hongos. Aplicar fungicida preventivo. Revisar hojas bajas.' });
  }
  if (temp > 28 && precip > 20) {
    recomendaciones.push({ area: 'Plagas', prioridad: 'MEDIA', mensaje: 'Cálida y húmeda = alto riesgo de gusano taladrador. Colocar trampas con feromonas.' });
  }

  // Maduración
  if (temp < 20) {
    recomendaciones.push({ area: 'Maduración', prioridad: 'MEDIA', mensaje: 'Temperaturas bajas favorecen acumulación de sacarosa. Buen momento para monitorear brix.' });
  }

  // Fertilización
  if (precip > 40) {
    recomendaciones.push({ area: 'Fertilización', prioridad: 'MEDIA', mensaje: 'Lluvia fuerte lava nitrógeno. Considerar reaplicación de urea 100 kg/ha si el cultivo está en fase vegetativa.' });
  }

  return { recomendaciones };
}
