// api/voice-assistant.js
// Asistente de voz agrícola con TODOS los datos: ubicación, clima, SENAMHI, suelo, NASA, estación más cercana
// Cadena: OpenRouter → DeepSeek → GitHub (texto)

// ── Base de datos de estaciones meteorológicas de Perú ──
const ESTACIONES_PERU = [
  // Costa Norte
  { id:'TUM', nombre:'Tumbes', dept:'Tumbes', lat:-3.56, lon:-80.44, alt:25 },
  { id:'PIU', nombre:'Piura', dept:'Piura', lat:-5.17, lon:-80.63, alt:29 },
  { id:'SUL', nombre:'Sullana', dept:'Piura', lat:-4.90, lon:-80.69, alt:62 },
  { id:'CAT', nombre:'Catacaos', dept:'Piura', lat:-5.27, lon:-80.68, alt:15 },
  { id:'CHI', nombre:'Chiclayo', dept:'Lambayeque', lat:-6.77, lon:-79.84, alt:27 },
  { id:'LAM', nombre:'Lambayeque', dept:'Lambayeque', lat:-6.70, lon:-79.91, alt:13 },
  { id:'FER', nombre:'Ferreñafe', dept:'Lambayeque', lat:-6.64, lon:-79.79, alt:43 },
  { id:'MOR', nombre:'Mórrope', dept:'Lambayeque', lat:-6.85, lon:-80.01, alt:12 },
  { id:'POM', nombre:'Pomalca', dept:'Lambayeque', lat:-6.81, lon:-79.77, alt:35 },
  { id:'TUM2', nombre:'Tumán', dept:'Lambayeque', lat:-6.75, lon:-79.82, alt:28 },
  { id:'ZAN', nombre:'Zaña', dept:'Lambayeque', lat:-6.82, lon:-79.62, alt:40 },
  { id:'PIM', nombre:'Pimentel', dept:'Lambayeque', lat:-6.84, lon:-79.93, alt:8 },
  { id:'SJO', nombre:'San José', dept:'Lambayeque', lat:-6.73, lon:-79.88, alt:22 },
  { id:'MOT', nombre:'Motupe', dept:'Lambayeque', lat:-6.16, lon:-79.71, alt:130 },
  { id:'OLM', nombre:'Olmos', dept:'Lambayeque', lat:-5.99, lon:-79.78, alt:200 },
  { id:'ILL', nombre:'Illimo', dept:'Lambayeque', lat:-6.64, lon:-79.86, alt:30 },
  { id:'JAY', nombre:'Jayanca', dept:'Lambayeque', lat:-6.55, lon:-79.83, alt:35 },
  { id:'CHO2', nombre:'Chongoyape', dept:'Lambayeque', lat:-6.64, lon:-79.72, alt:55 },
  { id:'ETEN', nombre:'Eten', dept:'Lambayeque', lat:-6.90, lon:-79.87, alt:5 },
  { id:'SAC', nombre:'Santiago de Cao', dept:'Lambayeque', lat:-6.92, lon:-79.82, alt:10 },
  // Costa Centro
  { id:'TRU', nombre:'Trujillo', dept:'La Libertad', lat:-8.11, lon:-79.03, alt:34 },
  { id:'CHE', nombre:'Chepén', dept:'La Libertad', lat:-7.23, lon:-79.43, alt:55 },
  { id:'PAC', nombre:'Pacasmayo', dept:'La Libertad', lat:-7.40, lon:-79.57, alt:8 },
  { id:'CHI2', nombre:'Chimbote', dept:'Áncash', lat:-9.07, lon:-78.59, alt:4 },
  { id:'CAS', nombre:'Casma', dept:'Áncash', lat:-9.43, lon:-78.27, alt:6 },
  { id:'HUA', nombre:'Huarmey', dept:'Áncash', lat:-10.07, lon:-78.17, alt:9 },
  { id:'SMA', nombre:'Santa María de Nieva', dept:'Áncash', lat:-6.06, lon:-78.07, alt:450 },
  { id:'BAG', nombre:'Bagua Grande', dept:'Amazonas', lat:-5.76, lon:-78.44, alt:450 },
  { id:'CAT2', nombre:'Cajamarca', dept:'Cajamarca', lat:-7.16, lon:-78.52, alt:2618 },
  { id:'CEL', nombre:'Celendín', dept:'Cajamarca', lat:-6.88, lon:-78.15, alt:2630 },
  { id:'CUT', nombre:'Cutervo', dept:'Cajamarca', lat:-6.38, lon:-78.82, alt:2630 },
  { id:'CHO', nombre:'Chota', dept:'Cajamarca', lat:-6.56, lon:-78.65, alt:2370 },
  { id:'BAM', nombre:'Bambamarca', dept:'Cajamarca', lat:-6.68, lon:-78.52, alt:2450 },
  { id:'CON', nombre:'Contumazá', dept:'Cajamarca', lat:-7.37, lon:-78.81, alt:2670 },
  // Costa Sur
  { id:'LIM', nombre:'Lima', dept:'Lima', lat:-12.03, lon:-76.93, alt:182 },
  { id:'HUA2', nombre:'Huaral', dept:'Lima', lat:-11.50, lon:-77.21, alt:410 },
  { id:'CAÑ', nombre:'Cañete', dept:'Lima', lat:-13.07, lon:-76.35, alt:93 },
  { id:'PIS', nombre:'Pisco', dept:'Ica', lat:-13.70, lon:-76.02, alt:13 },
  { id:'ICA', nombre:'Ica', dept:'Ica', lat:-14.07, lon:-75.73, alt:400 },
  { id:'NAZ', nombre:'Nazca', dept:'Ica', lat:-14.83, lon:-74.95, alt:520 },
  { id:'CHI3', nombre:'Chincha', dept:'Ica', lat:-13.41, lon:-76.13, alt:69 },
  // Costa Sur profunda
  { id:'ARE', nombre:'Arequipa', dept:'Arequipa', lat:-16.34, lon:-71.57, alt:2050 },
  { id:'MOL', nombre:'Mollendo', dept:'Arequipa', lat:-17.02, lon:-72.02, alt:60 },
  { id:'CAY', nombre:'Caylloma', dept:'Arequipa', lat:-15.19, lon:-72.05, alt:3400 },
  { id:'ILO', nombre:'Ilo', dept:'Moquegua', lat:-17.64, lon:-71.34, alt:11 },
  { id:'MOQ', nombre:'Moquegua', dept:'Moquegua', lat:-17.20, lon:-70.94, alt:1410 },
  { id:'TAC', nombre:'Tacna', dept:'Tacna', lat:-18.01, lon:-70.25, alt:441 },
  // Sierra
  { id:'CUZ', nombre:'Cusco', dept:'Cusco', lat:-13.53, lon:-71.97, alt:3310 },
  { id:'URC', nombre:'Urubamba', dept:'Cusco', lat:-13.31, lon:-72.11, alt:2870 },
  { id:'PUN', nombre:'Puno', dept:'Puno', lat:-15.84, lon:-70.03, alt:3825 },
  { id:'JUL', nombre:'Juliaca', dept:'Puno', lat:-15.50, lon:-70.13, alt:3825 },
  { id:'HAN', nombre:'Huancayo', dept:'Junín', lat:-12.07, lon:-75.22, alt:3249 },
  { id:'JAU', nombre:'Jauja', dept:'Junín', lat:-11.78, lon:-75.50, alt:3400 },
  { id:'TAR', nombre:'Tarma', dept:'Junín', lat:-11.42, lon:-75.69, alt:3058 },
  { id:'CER', nombre:'Cerro de Pasco', dept:'Pasco', lat:-10.69, lon:-76.26, alt:4380 },
  { id:'OXAP', nombre:'Oxapampa', dept:'Pasco', lat:-10.58, lon:-75.40, alt:1826 },
  { id:'HUA3', nombre:'Huánuco', dept:'Huánuco', lat:-9.93, lon:-76.24, alt:1870 },
  { id:'TIN', nombre:'Tingo María', dept:'Huánuco', lat:-9.30, lon:-76.01, alt:670 },
  { id:'AYA', nombre:'Ayacucho', dept:'Ayacucho', lat:-13.16, lon:-74.22, alt:2761 },
  { id:'HUAN', nombre:'Huancavelica', dept:'Huancavelica', lat:-12.79, lon:-74.97, alt:3680 },
  // Selva
  { id:'TAR2', nombre:'Tarapoto', dept:'San Martín', lat:-6.48, lon:-76.36, alt:345 },
  { id:'MOY', nombre:'Moyobamba', dept:'San Martín', lat:-6.03, lon:-76.97, alt:860 },
  { id:'LAM2', nombre:'Lamas', dept:'San Martín', lat:-6.42, lon:-76.53, alt:790 },
  { id:'UCH', nombre:'Uchiza', dept:'San Martín', lat:-8.11, lon:-76.51, alt:660 },
  { id:'YUR', nombre:'Yurimaguas', dept:'Loreto', lat:-5.90, lon:-76.08, alt:182 },
  { id:'PUC', nombre:'Pucallpa', dept:'Ucayali', lat:-8.38, lon:-74.55, alt:154 },
  { id:'IQU', nombre:'Iquitos', dept:'Loreto', lat:-3.75, lon:-73.25, alt:126 },
  { id:'CRI', nombre:'Cruzeiro do Sul', dept:'Acre (Brasil)', lat:-7.62, lon:-72.67, alt:160 },
  { id:'PUE', nombre:'Puerto Maldonado', dept:'Madre de Dios', lat:-12.60, lon:-69.18, alt:190 },
  { id:'TAM', nombre:'Tambopata', dept:'Madre de Dios', lat:-12.83, lon:-69.50, alt:210 },
];

// ── Algoritmo: estación más cercana ──
function encontrarEstacionCercana(lat, lon) {
  let minDist = Infinity;
  let mejor = ESTACIONES_PERU[0];

  for (const est of ESTACIONES_PERU) {
    // Fórmula de Haversine simplificada
    const dLat = (est.lat - lat) * Math.PI / 180;
    const dLon = (est.lon - lon) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat * Math.PI / 180) * Math.cos(est.lat * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distKm = 6371 * c; // Radio de la Tierra en km

    if (distKm < minDist) {
      minDist = distKm;
      mejor = est;
    }
  }

  return { ...mejor, distanciaKm: Math.round(minDist) };
}

// ── Obtener clima real vía Open-Meteo ──
async function obtenerClimaOpenMeteo(lat, lon) {
  try {
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,weather_code,cloud_cover&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max&timezone=auto&forecast_days=3`
    );
    const data = await r.json();
    if (!data.current) return null;

    const codigos = {
      0: 'despejado', 1: 'mayormente despejado', 2: 'parcial nublado', 3: 'nublado',
      45: 'neblina', 48: 'neblina con escarcha',
      51: 'llovizna leve', 53: 'llovizna moderada', 55: 'llovizna intensa',
      61: 'lluvia leve', 63: 'lluvia moderada', 65: 'lluvia intensa',
      71: 'nevada leve', 73: 'nevada moderada', 75: 'nevada fuerte',
      80: 'aguacero leve', 81: 'aguacero moderado', 82: 'aguacero fuerte',
      95: 'tormenta', 96: 'tormenta con granizo', 99: 'tormenta fuerte',
    };

    return {
      temp: data.current.temperature_2m,
      humedad: data.current.relative_humidity_2m,
      viento: data.current.wind_speed_10m,
      lluvia: data.current.precipitation,
      nubes: data.current.cloud_cover,
      descripcion: codigos[data.current.weather_code] || 'variable',
      pronostico: {
        tempMax: data.daily?.temperature_2m_max?.slice(0, 3) || [],
        tempMin: data.daily?.temperature_2m_min?.slice(0, 3) || [],
        lluvia: data.daily?.precipitation_sum?.slice(0, 3) || [],
        probLluvia: data.daily?.precipitation_probability_max?.slice(0, 3) || [],
      },
    };
  } catch (e) {
    console.warn('Open-Meteo error:', e.message);
    return null;
  }
}

// ── Agente SENAMHI: scraping del pronóstico oficial ──
async function obtenerPronosticoSENAMHI(lat, lon, ubicacionNombre) {
  try {
    const r = await fetch(`https://www.senamhi.gob.pe/?p=pronostico-meteorologico`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!r.ok) return null;
    const html = await r.text();

    // Buscar pronósticos por nombre de ubicación
    const nombreBusqueda = ubicacionNombre?.toUpperCase() || '';

    // Patrón: "NOMBRE - DEPARTAMENTO" seguido de datos
    const regex = /([A-ZÁÉÍÓÚÑ\s]+)\s*-\s*([A-ZÁÉÍÓÚÑ\s]+)[\s\S]*?(?:martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|lunes),\s*\d{1,2}\s+de\s+\w+[\s\S]*?(-?\d{1,2})\s*º\s*C[\s\S]*?(-?\d{1,2})\s*º\s*C[\s\S]*?([^.]+\.\s*[^.]*\.?)/gi;

    let encontrado = null;
    let match;

    while ((match = regex.exec(html)) !== null) {
      const nombreEstacion = match[1].trim();
      // Buscar coincidencia parcial con la ubicación del usuario
      if (nombreBusqueda && (
        nombreEstacion.includes(nombreBusqueda) ||
        nombreBusqueda.includes(nombreEstacion) ||
        nombreEstacion === nombreBusqueda
      )) {
        encontrado = {
          estacion: nombreEstacion,
          departamento: match[2].trim(),
          tempMax: parseInt(match[3]),
          tempMin: parseInt(match[4]),
          descripcion: match[5].trim(),
        };
        break;
      }
    }

    // Si no encontró por nombre, buscar la primera ubicación disponible
    if (!encontrado) {
      const regexGenerico = /([A-ZÁÉÍÓÚÑ\s]+)\s*-\s*([A-ZÁÉÍÓÚÑ\s]+)[\s\S]*?(-?\d{1,2})\s*º\s*C[\s\S]*?(-?\d{1,2})\s*º\s*C[\s\S]*?([^.]+\.\s*[^.]*\.?)/i;
      const matchGenerico = regexGenerico.exec(html);
      if (matchGenerico) {
        encontrado = {
          estacion: matchGenerico[1].trim(),
          departamento: matchGenerico[2].trim(),
          tempMax: parseInt(matchGenerico[3]),
          tempMin: parseInt(matchGenerico[4]),
          descripcion: matchGenerico[5].trim(),
        };
      }
    }

    return encontrado;
  } catch (e) {
    console.warn('SENAMHI scraping error:', e.message);
    return null;
  }
}

// ── Obtener datos de suelo (SoilGrids) ──
async function obtenerSuelo(lat, lon) {
  try {
    const r = await fetch(
      `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon}&lat=${lat}&property=phh2o&property=clay&property=sand&property=occo&depth=0-5cm&value=mean`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!r.ok) return null;
    const data = await r.json();
    const layers = data.properties?.layers || [];
    const ph = layers.find(l => l.name === 'phh2o');
    const clay = layers.find(l => l.name === 'clay');
    const sand = layers.find(l => l.name === 'sand');

    return {
      ph: ph?.depths?.[0]?.values?.mean ? (ph.depths[0].values.mean / 10).toFixed(1) : null,
      arcilla: clay?.depths?.[0]?.values?.mean ? (clay.depths[0].values.mean / 10).toFixed(0) : null,
      arena: sand?.depths?.[0]?.values?.mean ? (sand.depths[0].values.mean / 10).toFixed(0) : null,
    };
  } catch (e) {
    return null;
  }
}

// ── Obtener alertas NASA FIRMS ──
async function obtenerAlertasNASA(lat, lon) {
  try {
    const r = await fetch(
      `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${process.env.NASA_EARTHDATA_KEY || 'OPENKEY'}/VIIRS_SNPP_NRT/${lon - 0.1},${lat - 0.1},${lon + 0.1},${lat + 0.1}/1`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!r.ok) return null;
    const text = await r.text();
    const lineas = text.split('\n').filter(l => l.trim() && !l.startsWith('latitude'));
    return { incendios: lineas.length, riesgo: lineas.length > 5 ? 'alto' : lineas.length > 0 ? 'bajo' : 'ninguno' };
  } catch (e) {
    return null;
  }
}

const SYSTEM_PROMPT_VENTAS = `Eres el agente de ventas de Agrilux. Ayudas a los agricultores a encontrar productos agrícolas en TIENDAS REGISTRADAS EN AGRILUX únicamente.
REGLAS:
- Responde SIEMPRE en español peruano, tono cálido y campesino
- Máximo 4 oraciones por respuesta
- SOLO menciona tiendas y ofertas que aparezcan en "OFERTAS DE TIENDAS REGISTRADAS" del contexto
- NUNCA inventes tiendas, precios ni ofertas que no estén en el contexto
- Cuando recomiendes, menciona: producto, tienda, precio en S/, distancia y WhatsApp si está disponible
- Si no hay ofertas registradas para lo que busca, di que no hay tiendas registradas con ese producto y sugiere registrar una tienda en Agrilux
- Usa emojis moderados para hacer la conversación amigable`;

const SYSTEM_PROMPT_BASE = `Eres PlaguIA, el asistente agrícola inteligente de Agrilux. Hablas como un agrónomo experto peruano, amigable y directo.

REGLAS:
- Responde SIEMPRE en español peruano, tono cálido y campesino
- Máximo 4 oraciones por respuesta (fácil de escuchar por voz)
- Sé práctico: nombre del producto, dosis, y cuándo aplicar
- Si no sabes algo, di "No tengo esa información, consulta con un agrónomo local"
- Si el agricultor menciona un cultivo, ajusta tu respuesta a ese cultivo
- Usa TODOS los datos climáticos y de suelo que tengas para dar recomendaciones precisas
- Si el usuario pregunta por el clima o SENAMHI, usa la información del pronóstico oficial
- Usa emojis moderados para hacer la conversación amigable
- SIEMPRE menciona el precio del producto cuando lo tengas (S/ XX por kg)
- SIEMPRE menciona los enlaces directos cuando los tengas (WhatsApp, Maps, Facebook)
- Cuando busque tiendas, menciona: nombre, distancia, precio y cómo contactarlos

CULTIVOS QUE CONOCES BIEN: papa, maíz, palta, arándano, caña de azúcar, plátano, papaya.

CAPACIDADES ESPECIALES:
- Puedo consultar el clima actual y pronóstico de SENAMHI
- Conozco la estación meteorológica más cercana a tu ubicación
- Tengo datos de suelo (pH, textura) de tu zona
- Monitoreo alertas de incendios de NASA
- Puedo predecir riesgos de plagas y enfermedades ANTES de que aparezcan (diagnóstico preventivo)
- Puedo recomendar productos agrícolas según las condiciones actuales
- PUEDO BUSCAR TIENDAS DE INSUMOS AGRÍCOLAS CERCA con PRECIOS y ENLACES: cuando el agricultor pregunte por tiendas, productos, precios, ofertas, dónde comprar, o mercados, busca automáticamente tiendas cercanas y muestra: nombre, distancia, precio en S/ por kg, y enlaces directos a WhatsApp, Google Maps y Facebook
- Menciono tiendas con su nombre, distancia, precio y enlaces cuando las encuentro

EJEMPLOS DE BUENAS RESPUESTAS:
- "¿Hojas amarillas? Puede ser deficiencia de nitrógeno. Aplica urea a 200 kg/ha. ¿En qué cultura lo tienes?"
- "Las manchas en la papa pueden ser tizón tardío. Aplica clorotalonil cada 15 días."
- "Hoy en tu zona hay 22°C y 80% de humedad. Condiciones favorables para hongos, revisa tus hojas."
- "El pronóstico del SENAMHI indica lluvia para los próximos días. Aplica fungicida preventivo."
- "⚠️ ALERTA PREVENTIVA: Detecté condiciones de alto riesgo para tizón tardío en tu zona. Humedad 85%, temperatura 18°C. Aplica Mancozeb 2kg/ha AHORA antes de que aparezca la enfermedad."`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

  const { mensaje, historial = [], lat, lon, ubicacion, nombre, agentType, ofertasRegistradas = [], productoRecomendado } = req.body;
  if (!mensaje) return res.status(400).json({ error: 'Falta el campo mensaje' });

  // ── Recopilar TODA la información disponible ──
  const contextoParts = [];

  // 1. Ubicación del usuario
  if (ubicacion) {
    contextoParts.push(`UBICACIÓN DEL AGRICULTOR: ${ubicacion}`);
  }
  if (nombre) {
    contextoParts.push(`NOMBRE: ${nombre}`);
  }

  // 2. Estación meteorológica más cercana + altitud
  let estacionCercana = null;
  let altitudUsuario = null;
  if (lat && lon) {
    estacionCercana = encontrarEstacionCercana(lat, lon);
    contextoParts.push(`ESTACIÓN METEREOLÓGICA MÁS CERCANA: ${estacionCercana.nombre} (${estacionCercana.dept}), a ${estacionCercana.distanciaKm}km, altitud ${estacionCercana.alt}m`);
    // Obtener altitud real del terreno
    try {
      const altRes = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`, { signal: AbortSignal.timeout(2000) });
      const altData = await altRes.json();
      altitudUsuario = altData.elevation?.[0] || null;
      if (altitudUsuario) {
        const diffAlt = altitudUsuario - (estacionCercana.alt || 0);
        const ajusteTemp = Math.round((diffAlt / 1000) * -6.5 * 10) / 10;
        contextoParts.push(`ALTITUD DEL LUGAR: ${Math.round(altitudUsuario)}m (estación: ${estacionCercana.alt}m). Ajuste de temperatura: ${ajusteTemp > 0 ? '+' : ''}${ajusteTemp}°C vs estación.`);
      }
    } catch {}
  }

  // 3. Clima en tiempo real (Open-Meteo)
  let clima = null;
  if (lat && lon) {
    clima = await obtenerClimaOpenMeteo(lat, lon);
    if (clima) {
      // Ajustar temperatura por altitud
      if (altitudUsuario && estacionCercana?.alt) {
        const diffAlt = altitudUsuario - estacionCercana.alt;
        const ajuste = Math.round((diffAlt / 1000) * -6.5 * 10) / 10;
        clima.tempAjustada = Math.round((clima.temp + ajuste) * 10) / 10;
      }
      const tempMostrar = clima.tempAjustada || clima.temp;
      contextoParts.push(`CLIMA ACTUAL (${Math.round(altitudUsuario || 0)}m): ${tempMostrar}°C, ${clima.descripcion}, humedad ${clima.humedad}%, viento ${clima.viento} km/h`);
      if (clima.lluvia > 0) contextoParts.push(`LLUVIA ACTIVA: ${clima.lluvia}mm`);
      if (clima.pronostico) {
        const maxHoy = clima.pronostico.tempMax[0];
        const minHoy = clima.pronostico.tempMin[0];
        const lluviaHoy = clima.pronostico.lluvia[0];
        const probLluvia = clima.pronostico.probLluvia[0];
        let pronText = `PRONÓSTICO HOY: ${minHoy}°C - ${maxHoy}°C`;
        if (lluviaHoy > 0) pronText += `, ${lluviaHoy}mm de lluvia esperada`;
        if (probLluvia > 0) pronText += `, probabilidad lluvia ${probLluvia}%`;
        contextoParts.push(pronText);
      }
    }
  }

  // 4. Pronóstico SENAMHI (scraping) — siempre consultar si pregunta por clima
  const mencionaClima = /clima|tiempo|lluvia|temperatura|senamhi|pronóstico|pronostico|calor|frío|frio|hoy|mañana|manana/i.test(mensaje);
  if (lat && lon) {
    const ubicacionNombre = ubicacion?.split(',')[0]?.trim() || '';
    const senamhi = await obtenerPronosticoSENAMHI(lat, lon, ubicacionNombre);
    if (senamhi) {
      contextoParts.push(`PRONÓSTICO OFICIAL SENAMHI (${senamhi.estacion} - ${senamhi.departamento}): Máx ${senamhi.tempMax}°C, Mín ${senamhi.tempMin}°C. ${senamhi.descripcion}`);
    }
  }

  // 5. Datos de suelo
  if (lat && lon) {
    const suelo = await obtenerSuelo(lat, lon);
    if (suelo) {
      let sueloText = 'SUELO DE LA ZONA:';
      if (suelo.ph) sueloText += ` pH ${suelo.ph}`;
      if (suelo.arcilla) sueloText += `, arcilla ${suelo.arcilla}%`;
      if (suelo.arena) sueloText += `, arena ${suelo.arena}%`;
      contextoParts.push(sueloText);
    }
  }

  // 6. Alertas NASA
  if (lat && lon) {
    const nasa = await obtenerAlertasNASA(lat, lon);
    if (nasa && nasa.riesgo !== 'ninguno') {
      contextoParts.push(`ALERTA NASA: ${nasa.incendios} focos de calor detectados, riesgo ${nasa.riesgo}`);
    }
  }

  // 7. Alertas preventivas (diagnóstico predictivo)
  if (lat && lon) {
    try {
      const alertasRes = await fetch(`https://${req.headers.host || 'localhost'}/api/alertas-preventivas?lat=${lat}&lon=${lon}&cultivo=papa&diasDesdeSiembra=30`);
      const alertas = await alertasRes.json();
      if (alertas.alertas?.length > 0) {
        const alertasTexto = alertas.alertas.map(a => `${a.nombre} (${a.gravedad}): ${a.preventivo}`).join('; ');
        contextoParts.push(`ALERTAS PREVENTIVAS ACTIVAS: ${alertasTexto}`);
        contextoParts.push(`NIVEL DE RIESGO GENERAL: ${alertas.riesgo?.nivel || 'desconocido'} (${alertas.riesgo?.puntos || 0} puntos)`);
      }
    } catch (e) { /* silencioso */ }
  }

  // ── Ofertas de tiendas registradas (siempre para agente ventas) ──
  let ofertasActivas = ofertasRegistradas;
  if (agentType === 'ventas' && ofertasActivas.length === 0 && lat && lon) {
    try {
      const host = req.headers.host || 'localhost';
      const ofRes = await fetch(`https://${host}/api/tiendas?type=ofertas&lat=${lat}&lon=${lon}`);
      const ofData = await ofRes.json();
      ofertasActivas = ofData.ofertas || [];
    } catch { /* silencioso */ }
  }

  if (ofertasActivas.length > 0) {
    const lista = ofertasActivas.slice(0, 10).map((o, i) => {
      const dist = o.distanciaKm != null ? `, ${o.distanciaKm}km` : '';
      const precio = o.precio != null ? `S/ ${o.precio}` : 'consultar';
      const wa = o.whatsapp ? `, WhatsApp: 51${String(o.whatsapp).replace(/\D/g, '')}` : '';
      return `${i + 1}. ${o.producto} — ${o.tienda} (${o.region || 'Perú'})${dist} — ${precio}${wa}`;
    }).join('\n');
    contextoParts.push(`OFERTAS DE TIENDAS REGISTRADAS EN AGRILUX (${ofertasActivas.length}):\n${lista}`);
  } else if (agentType === 'ventas') {
    contextoParts.push('OFERTAS DE TIENDAS REGISTRADAS: ninguna disponible en este momento.');
  }

  if (productoRecomendado) {
    contextoParts.push(`PRODUCTO RECOMENDADO POR DIAGNÓSTICO: ${productoRecomendado}`);
  }

  // ── Detectar si el usuario busca tiendas o productos ──
  const buscaTienda = /comprar|tienda|tiendas|dónde|donde|conseguir|adquirir|mercado|oferta|ofertas|descuento|precio|precios|vende|comercio|insumo|producto/i.test(mensaje);
  let tiendasResult = null;

  if (buscaTienda && agentType === 'ventas' && ofertasActivas.length > 0) {
    const termino = mensaje.toLowerCase();
    const coinciden = ofertasActivas.filter(o =>
      termino.includes((o.producto || '').toLowerCase().slice(0, 4)) ||
      (o.producto || '').toLowerCase().split(/\s+/).some(p => p.length > 3 && termino.includes(p))
    );
    if (coinciden.length > 0) {
      tiendasResult = { tiendas: coinciden.map(o => ({
        nombre: o.tienda,
        producto: o.producto,
        precio: o.precio,
        distanciaKm: o.distanciaKm,
        whatsapp: o.whatsapp ? `https://wa.me/51${String(o.whatsapp).replace(/\D/g, '')}` : null,
      })) };
    }
  } else if (buscaTienda && agentType !== 'ventas' && lat && lon) {
    // Extraer nombre del producto del mensaje
    const productoMatch = mensaje.match(/comprar\s+(.+?)(?:\s+en|\s+cerca|\s+de|\s+por|\s+para|\?|$)/i)
      || mensaje.match(/tienda\s+(?:de\s+)?(.+?)(?:\s+en|\s+cerca|\s+de|\s+por|\s+para|\?|$)/i)
      || mensaje.match(/dónde\s+(?:comprar|conseguir|vende)\s+(.+?)(?:\s+en|\s+cerca|\s+de|\s+por|\s+para|\?|$)/i)
      || mensaje.match(/(?:comprar|conseguir|adquirir)\s+(.+?)(?:\s+en|\s+cerca|\s+de|\s+por|\s+para|\?|$)/i)
      || mensaje.match(/(.+?)\s+(?:barato|barata|oferta|descuento|precio)/i);
    let producto = productoMatch?.[1]?.trim() || '';
    
    // Si no extrajo producto, buscar tiendas genéricas
    if (!producto || producto.length < 2) {
      producto = 'insumos agrícolas';
    }
    
    try {
      // Buscar tiendas + precios + Fertisem + redes sociales
      const busquedaRes = await fetch(`https://${req.headers.host || 'localhost'}/api/buscar-insumos?lat=${lat}&lon=${lon}&producto=${encodeURIComponent(producto)}&radio=50&ubicacion=${encodeURIComponent(ubicacion || '')}`);
      tiendasResult = await busquedaRes.json();

      if (tiendasResult.tiendas?.length > 0) {
        const precioRef = tiendasResult?.precioReferencia;
        const promedio = tiendasResult?.promedio;
        
        let precioInfo = '';
        if (precioRef) precioInfo += `Precio de referencia: S/ ${precioRef.precio} (${precioRef.fuente}). `;
        if (promedio) precioInfo += `Promedio del mercado: S/ ${promedio}. `;

        const tiendasInfo = tiendasResult.tiendas.slice(0, 3).map(t => {
          const precioStr = t.precio ? ` - S/ ${t.precio} el kg` : '';
          const links = [];
          if (t.googleMaps) links.push(`Maps: ${t.googleMaps}`);
          if (t.whatsapp) links.push(`WhatsApp: ${t.whatsapp}`);
          return `${t.nombre} (${t.distanciaKm}km)${precioStr}${links.length > 0 ? ' | ' + links.join(', ') : ''}`;
        }).join('\n');
        
        contextoParts.push(`PRECIOS DE "${producto.toUpperCase()}": ${precioInfo}`);
        contextoParts.push(`TIENDAS CERCA:\n${tiendasInfo}`);
      } else {
        contextoParts.push(`NO SE ENCONTRARON TIENDAS de "${producto}" en un radio de 30km. Sugiere buscar en Google Maps o Facebook Marketplace.`);
      }
    } catch (e) { /* silencioso */ }
  }

  // ── Construir system prompt con TODO el contexto ──
  const contextoCompleto = contextoParts.length > 0
    ? `\n\nINFORMACIÓN EN TIEMPO REAL DEL AGRICULTOR:\n${contextoParts.join('\n')}\n\nUsa TODOS estos datos para tus recomendaciones. Si hay lluvia, prioriza fungicidas sistémicos. Si hay humedad alta, alerta sobre hongos. Si está frío, sugiere preventivos. Si el suelo es ácido, ajusta dosis. Menciona el pronóstico SENAMHI si el usuario pregunta por el clima.`
    : '';

  const basePrompt = agentType === 'ventas' ? SYSTEM_PROMPT_VENTAS : SYSTEM_PROMPT_BASE;
  const systemPrompt = basePrompt + contextoCompleto;

  // ── Construir historial de conversación ──
  const messages = [
    { role: 'system', content: systemPrompt },
    ...historial.map(h => ({
      role: h.rol === 'usuario' ? 'user' : 'assistant',
      content: h.texto,
    })),
    { role: 'user', content: mensaje },
  ];

  // ── OpenRouter — Gemini 2.5 Flash ──
  if (OPENROUTER_API_KEY) {
    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://www.vitalfarmbright.store',
          'X-Title': 'Agrilux-Voice',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages,
          max_tokens: 350,
          temperature: 0.7,
        }),
      });
      const data = await r.json();
      if (r.ok && data.choices?.[0]?.message?.content) {
        return res.status(200).json({
          respuesta: data.choices[0].message.content,
          provider: 'openrouter',
          estacion: estacionCercana?.nombre || null,
          ubicacion: ubicacion || null,
          clima: clima ? `${clima.temp}°C, ${clima.descripcion}` : null,
          tiendas: tiendasResult?.tiendas?.slice(0, 5) || [],
          enlaces: tiendasResult?.enlaces || null,
        });
      }
    } catch (e) { console.warn('Voice OpenRouter error:', e.message); }
  }

  // ── DeepSeek — fallback ──
  if (DEEPSEEK_API_KEY) {
    try {
      const r = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages,
          max_tokens: 350,
          temperature: 0.7,
        }),
      });
      const data = await r.json();
      if (r.ok && data.choices?.[0]?.message?.content) {
        return res.status(200).json({
          respuesta: data.choices[0].message.content,
          provider: 'deepseek',
          estacion: estacionCercana?.nombre || null,
          ubicacion: ubicacion || null,
          clima: clima ? `${clima.temp}°C, ${clima.descripcion}` : null,
          tiendas: tiendasResult?.tiendas?.slice(0, 5) || [],
          enlaces: tiendasResult?.enlaces || null,
        });
      }
    } catch (e) { console.warn('Voice DeepSeek error:', e.message); }
  }

  // ── GitHub Phi-4 — último recurso ──
  if (GITHUB_TOKEN) {
    try {
      const r = await fetch('https://models.inference.ai.azure.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
        },
        body: JSON.stringify({
          model: 'Phi-4-multimodal-instruct',
          messages,
          max_tokens: 350,
          temperature: 0.7,
        }),
      });
      const data = await r.json();
      if (r.ok && data.choices?.[0]?.message?.content) {
        return res.status(200).json({
          respuesta: data.choices[0].message.content,
          provider: 'github',
          estacion: estacionCercana?.nombre || null,
          ubicacion: ubicacion || null,
          clima: clima ? `${clima.temp}°C, ${clima.descripcion}` : null,
          tiendas: tiendasResult?.tiendas?.slice(0, 5) || [],
          enlaces: tiendasResult?.enlaces || null,
        });
      }
    } catch (e) { console.warn('Voice GitHub error:', e.message); }
  }

  return res.status(500).json({
    error: 'No hay proveedores de IA disponibles.',
    respuesta: 'Lo siento, no puedo responderte ahora. Intenta de nuevo en un momento.',
  });
}
