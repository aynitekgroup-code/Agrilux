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
- SOLO menciona tiendas y ofertas que aparezcan en "OFERTAS DE TIENDAS REGISTRADAS" o "TIENDAS REGISTRADAS POR EL USUARIO" del contexto
- NUNCA inventes tiendas, precios ni ofertas que no estén en el contexto
- Cuando recomiendes, menciona: producto, tienda, precio en S/, distancia y WhatsApp si está disponible
- Si el usuario tiene tiendas registradas ("TIENDAS REGISTRADAS POR EL USUARIO"), úsalas como referencia cuando pregunte por sus tiendas o productos
- Si no hay ofertas registradas para lo que busca, di que no hay tiendas registradas con ese producto y sugiere registrar una tienda en Agrilux
- Usa emojis moderados para hacer la conversación amigable`;

const SYSTEM_PROMPT_PARCELA = `Eres el agente de parcela de Agrilux. Eres agrónomo experto en monitoreo de cultivos en Perú, especialmente caña de azúcar y maíz en la costa.

REGLAS:
- Responde SIEMPRE en español peruano, tono cálido y directo
- Máximo 4 oraciones por respuesta (optimizado para voz)
- Conoces la parcela activa: cultivo, días desde siembra, área, riesgos e índices satelitales
- ÍNDICES POR ETAPA (Carlos Pérez): MSAVI2 en poco cultivo y agoste/cosecha; NDVI + NDRE en pleno crecimiento
- Si hay mapa de calor con colores NO uniformes, alerta sobre zonas con problema (manchas rojas/amarillas = estrés, exceso humedad, etc.)
- Identifica zonas_problema del contexto y sugiere inspección en campo en esas áreas específicas
- Si preguntan por comprar productos, sugiere ir a Mercado en Agrilux
- Usa emojis moderados`;

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
  // CORS para APK Capacitor (origen capacitor:// / https://localhost) y web
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

  // ── Modo MAPA (FASE 3.8): asistente JARVIS del mapa de flota ──
  // Vive aquí porque el plan Hobby de Vercel admite máximo 12 funciones
  // serverless por despliegue; `modo: 'mapa'` desvía la petición.
  if (req.body?.modo === 'mapa') {
    return handlerMapa(req, res, { OPENROUTER_API_KEY, DEEPSEEK_API_KEY, GITHUB_TOKEN });
  }

  // ── Modo GESTIÓN: IA de la sección Gestión/AgroTrack ──
  // Mismo motivo que el modo mapa: no se pueden crear funciones nuevas.
  // Modos: briefing | alertas | reporte | geocerca | corte | preguntar.
  if (MODOS_GESTION.has(req.body?.modo)) {
    return handlerGestion(req, res, { OPENROUTER_API_KEY, DEEPSEEK_API_KEY, GITHUB_TOKEN });
  }

  const { mensaje, historial = [], lat, lon, ubicacion, nombre, agentType, parcelaContext, ofertasRegistradas = [], productoRecomendado, misTiendas = [] } = req.body;
  if (!mensaje) return res.status(400).json({ error: 'Falta el campo mensaje' });

  const latFinal = lat ?? parcelaContext?.lat ?? null;
  const lonFinal = lon ?? parcelaContext?.lon ?? null;
  const cultivoParcela = parcelaContext?.cultivo || 'papa';
  const diasParcela = parcelaContext?.diasDesdeSiembra ?? 30;

  // ── Recopilar TODA la información disponible ──
  const contextoParts = [];

  // 0. Contexto de parcela activa (agente parcela)
  if (agentType === 'parcela' && parcelaContext) {
    const p = parcelaContext;
    contextoParts.push(`PARCELA ACTIVA: "${p.nombre || 'Sin nombre'}"`);
    contextoParts.push(`CULTIVO: ${p.cultivoNombre || p.cultivo || 'no especificado'}${p.variedad ? `, variedad ${p.variedad}` : ''}`);
    if (p.diasDesdeSiembra != null) contextoParts.push(`DÍAS DESDE SIEMBRA: ${p.diasDesdeSiembra} días`);
    if (p.area) contextoParts.push(`ÁREA: ${p.area} hectáreas`);
    if (p.fechaSiembra) contextoParts.push(`FECHA SIEMBRA: ${p.fechaSiembra}`);
    if (p.registrosCount != null) contextoParts.push(`MONITOREOS REGISTRADOS: ${p.registrosCount}`);
    if (p.ultimaRecomendacion) contextoParts.push(`ÚLTIMA RECOMENDACIÓN IA: ${p.ultimaRecomendacion.slice(0, 200)}`);
    if (p.riesgo?.nivel) {
      contextoParts.push(`NIVEL DE RIESGO PARCELA: ${p.riesgo.nivel} (${p.riesgo.puntos || 0} puntos)`);
      if (p.riesgo.alertas?.length) {
        contextoParts.push(`ALERTAS PARCELA: ${p.riesgo.alertas.map(a => a.nombre).join(', ')}`);
      }
    }
    if (p.indices) {
      const { ndvi, msavi2, ndre, indice_recomendado, indices_recomendados, nota_etapa, mapa_calor } = p.indices;
      let idxText = 'ÍNDICES SATELITALES:';
      if (ndvi != null) idxText += ` NDVI ${ndvi}`;
      if (msavi2 != null) idxText += `, MSAVI2 ${msavi2}`;
      if (ndre != null) idxText += `, NDRE ${ndre}`;
      if (indice_recomendado) idxText += `. Principal: ${indice_recomendado.toUpperCase()}`;
      if (indices_recomendados?.length > 1) idxText += ` (también: ${indices_recomendados.filter(i => i !== indice_recomendado).join(', ').toUpperCase()})`;
      contextoParts.push(idxText);
      if (nota_etapa) contextoParts.push(`NOTA ETAPA: ${nota_etapa}`);
      if (mapa_calor) {
        contextoParts.push(`MAPA DE CALOR: uniforme=${mapa_calor.uniforme ? 'sí' : 'NO'}. ${mapa_calor.alerta_uniformidad || ''}`);
        if (mapa_calor.zonas_problema?.length) {
          const zonas = mapa_calor.zonas_problema.slice(0, 3).map(z =>
            `Zona ${z.id}: índice ${z.indice} (${z.severidad}) — ${z.causa_probable}`
          ).join('; ');
          contextoParts.push(`ZONAS CON PROBLEMA: ${zonas}`);
        }
      }
    }
  }

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
  if (latFinal && lonFinal) {
    estacionCercana = encontrarEstacionCercana(latFinal, lonFinal);
    contextoParts.push(`ESTACIÓN METEREOLÓGICA MÁS CERCANA: ${estacionCercana.nombre} (${estacionCercana.dept}), a ${estacionCercana.distanciaKm}km, altitud ${estacionCercana.alt}m`);
    // Obtener altitud real del terreno
    try {
      const altRes = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${latFinal}&longitude=${lonFinal}`, { signal: AbortSignal.timeout(2000) });
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
  if (latFinal && lonFinal) {
    clima = await obtenerClimaOpenMeteo(latFinal, lonFinal);
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
  if (latFinal && lonFinal) {
    const ubicacionNombre = ubicacion?.split(',')[0]?.trim() || '';
    const senamhi = await obtenerPronosticoSENAMHI(latFinal, lonFinal, ubicacionNombre);
    if (senamhi) {
      contextoParts.push(`PRONÓSTICO OFICIAL SENAMHI (${senamhi.estacion} - ${senamhi.departamento}): Máx ${senamhi.tempMax}°C, Mín ${senamhi.tempMin}°C. ${senamhi.descripcion}`);
    }
  }

  // 5. Datos de suelo
  if (latFinal && lonFinal) {
    const suelo = await obtenerSuelo(latFinal, lonFinal);
    if (suelo) {
      let sueloText = 'SUELO DE LA ZONA:';
      if (suelo.ph) sueloText += ` pH ${suelo.ph}`;
      if (suelo.arcilla) sueloText += `, arcilla ${suelo.arcilla}%`;
      if (suelo.arena) sueloText += `, arena ${suelo.arena}%`;
      contextoParts.push(sueloText);
    }
  }

  // 6. Alertas NASA
  if (latFinal && lonFinal) {
    const nasa = await obtenerAlertasNASA(latFinal, lonFinal);
    if (nasa && nasa.riesgo !== 'ninguno') {
      contextoParts.push(`ALERTA NASA: ${nasa.incendios} focos de calor detectados, riesgo ${nasa.riesgo}`);
    }
  }

  // 7. Alertas preventivas (diagnóstico predictivo)
  if (latFinal && lonFinal) {
    try {
      const host = req.headers.host || 'localhost';
      const alertasRes = await fetch(`https://${host}/api/alertas-preventivas?lat=${latFinal}&lon=${lonFinal}&cultivo=${cultivoParcela}&diasDesdeSiembra=${diasParcela}`);
      const alertas = await alertasRes.json();
      if (alertas.alertas?.length > 0) {
        const alertasTexto = alertas.alertas.map(a => `${a.nombre} (${a.gravedad}): ${a.preventivo}`).join('; ');
        contextoParts.push(`ALERTAS PREVENTIVAS ACTIVAS: ${alertasTexto}`);
        contextoParts.push(`NIVEL DE RIESGO GENERAL: ${alertas.riesgo?.nivel || 'desconocido'} (${alertas.riesgo?.puntos || 0} puntos)`);
      }
    } catch (e) { /* silencioso */ }
  }

  // 7b. Índices satelitales para agente parcela (si no vienen del cliente)
  if (agentType === 'parcela' && latFinal && lonFinal && !parcelaContext?.indices) {
    try {
      const host = req.headers.host || 'localhost';
      const cultivoIdx = encodeURIComponent(parcelaContext?.cultivo || cultivoParcela);
      const sentRes = await fetch(`https://${host}/api/sentinel?lat=${latFinal}&lon=${lonFinal}&radius=2&cultivo=${cultivoIdx}`);
      const sent = await sentRes.json();
      if (sent.ndvi_promedio != null) {
        contextoParts.push(`ÍNDICES SATELITALES: NDVI ${sent.ndvi_promedio}, MSAVI2 ${sent.msavi2_promedio}, NDRE ${sent.ndre_promedio}. Recomendado: ${(sent.indice_recomendado || 'ndvi').toUpperCase()}. ${sent.nota_etapa || ''}`);
      }
    } catch { /* silencioso */ }
  }

  // ── Ofertas de tiendas registradas (siempre para agente ventas) ──
  let ofertasActivas = ofertasRegistradas;
  if (agentType === 'ventas' && ofertasActivas.length === 0 && latFinal && lonFinal) {
    try {
      const host = req.headers.host || 'localhost';
      const ofRes = await fetch(`https://${host}/api/tiendas?type=ofertas&lat=${latFinal}&lon=${lonFinal}`);
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

  // ── Tiendas del usuario (agente ventas) ──
  if (agentType === 'ventas' && misTiendas.length > 0) {
    const listaTiendas = misTiendas.map((t, i) => {
      const dist = t.distanciaKm != null ? `, ${t.distanciaKm}km` : '';
      const wa = t.whatsapp ? `, WhatsApp: 51${String(t.whatsapp).replace(/\D/g, '')}` : '';
      const fb = t.facebook ? `, Facebook: ${t.facebook}` : '';
      const dir = t.direccion ? `, ${t.direccion}` : '';
      const fotos = t.fotos?.length ? `, ${t.fotos.length} foto(s)` : '';
      return `${i + 1}. ${t.nombre || 'Tienda'} (${t.departamento || 'Perú'})${dir}${dist}${wa}${fb}${fotos} — Estado: ${t.activa !== false ? 'Activa' : 'Inactiva'}`;
    }).join('\n');
    contextoParts.push(`TIENDAS REGISTRADAS POR EL USUARIO EN AGRILUX (${misTiendas.length}):\n${listaTiendas}`);
    contextoParts.push('El usuario es DUEÑO de estas tiendas. Cuando pregunte por sus tiendas, mencionalas con su nombre y datos de contacto. Si dice "mi tienda" o "mis tiendas", refiérete a estas.');
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
  } else if (buscaTienda && agentType !== 'ventas' && latFinal && lonFinal) {
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
      const busquedaRes = await fetch(`https://${req.headers.host || 'localhost'}/api/buscar-insumos?lat=${latFinal}&lon=${lonFinal}&producto=${encodeURIComponent(producto)}&radio=50&ubicacion=${encodeURIComponent(ubicacion || '')}`);
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

  const basePrompt = agentType === 'ventas' ? SYSTEM_PROMPT_VENTAS
    : agentType === 'parcela' ? SYSTEM_PROMPT_PARCELA
    : SYSTEM_PROMPT_BASE;
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

/* ========================================================================== */
/*  MODO MAPA — Asistente JARVIS del mapa de flota (FASE 3.8)                 */
/*                                                                            */
/*  Recibe la pregunta del usuario + un resumen COMPACTO de las geocercas     */
/*  (id, nombre, grupo, centro) y devuelve { respuesta, acciones } donde      */
/*  las acciones las ejecuta el mapa:                                         */
/*    enfocar / seleccionar / filtrar_grupo / limpiar / ajustar_todo          */
/*  (el mapa las valida otra vez antes de ejecutarlas).                       */
/* ========================================================================== */

const ACCIONES_PERMITIDAS = ['enfocar', 'seleccionar', 'filtrar_grupo', 'limpiar', 'ajustar_todo'];
const GRUPOS_PERMITIDOS = ['autorizada', 'oficina', 'distrito', 'poligono'];

const SYSTEM_PROMPT_MAPA = `Eres JARVIS, el asistente inteligente del mapa de flota de Agrilux (AgroTrack).
Trabajas con las GEOCERCAS de la empresa que te paso en el contexto: linderos (campos), oficinas y distritos.
Responde SIEMPRE en español, breve (máximo 3 frases), con tono técnico y cercano.

REGLAS DE ACCIÓN:
- Si el usuario quiere IR a una geocerca, VERLA o LLEVARSE hasta ella: acción {"tipo":"enfocar","geocerca_id":"<id>"}.
- Si quiere seleccionarla (ver su ficha): {"tipo":"seleccionar","geocerca_id":"<id>"}.
- Si quiere ver SOLO un grupo (solo oficinas, solo distritos, solo linderos): {"tipo":"filtrar_grupo","grupo":"oficina"|"distrito"|"autorizada"}.
- Si quiere ver todo de nuevo o quitar filtros: {"tipo":"limpiar"}.
- Si quiere encuadrar todas las geocercas: {"tipo":"ajustar_todo"}.
- Usa el id EXACTO del contexto. Si dudas entre varias, elige la más probable y di cuál elegiste.
- Si la pregunta no necesita acción (conteo, comparación, cuántas hay), responde con "acciones": [].
- NUNCA inventes ids ni nombres: usa solo los del contexto.

RESPUESTA OBLIGATORIA (solo JSON, sin markdown):
{"respuesta":"<texto para el usuario>","acciones":[{"tipo":"..."}]}`;

/** Extrae el primer objeto JSON balanceado de un texto. */
function extraerObjetoJSON(texto) {
  if (!texto) return null;
  const limpio = String(texto).replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const intentar = (c) => {
    try {
      const v = JSON.parse(c);
      return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
    } catch {
      return null;
    }
  };
  const directo = intentar(limpio);
  if (directo) return directo;
  const inicio = limpio.indexOf('{');
  if (inicio < 0) return null;
  let nivel = 0, dentro = false, escape = false;
  for (let i = inicio; i < limpio.length; i++) {
    const c = limpio[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { dentro = !dentro; continue; }
    if (dentro) continue;
    if (c === '{') nivel += 1;
    else if (c === '}') {
      nivel -= 1;
      if (nivel === 0) return intentar(limpio.slice(inicio, i + 1));
    }
  }
  return null;
}

/** Valida y recorta las acciones que la IA pidió (modo seguro). */
function validarAccionesMapa(acciones) {
  if (!Array.isArray(acciones)) return [];
  return acciones
    .filter((a) => a && typeof a === 'object' && ACCIONES_PERMITIDAS.includes(a.tipo))
    .map((a) => {
      if (a.tipo === 'enfocar' || a.tipo === 'seleccionar') {
        return { tipo: a.tipo, geocerca_id: String(a.geocerca_id || a.id || '') };
      }
      if (a.tipo === 'filtrar_grupo') {
        return { tipo: a.tipo, grupo: String(a.grupo || '') };
      }
      return { tipo: a.tipo };
    })
    .filter((a) => (a.tipo === 'enfocar' || a.tipo === 'seleccionar' ? Boolean(a.geocerca_id) : true))
    .filter((a) => (a.tipo === 'filtrar_grupo' ? GRUPOS_PERMITIDOS.includes(a.grupo) : true))
    .slice(0, 4);
}

function armarContextoMapa(geocercas, seleccion) {
  const porGrupo = {};
  for (const g of geocercas) porGrupo[g.grupo] = (porGrupo[g.grupo] || 0) + 1;
  const resumen = Object.entries(porGrupo)
    .map(([grupo, n]) => `${grupo}: ${n}`)
    .join(' · ');

  const lineas = (geocercas || [])
    .slice(0, 220)
    .map((g) => {
      const centro = g.centro ? ` (${g.centro.lat}, ${g.centro.lon})` : '';
      const div = g.division ? ` | división ${g.division}` : '';
      return `${g.id} | ${g.nombre} | ${g.grupo}${div} | ${g.vertices} vértices${centro}`;
    })
    .join('\n');

  const sel = seleccion?.id
    ? `\nGEOCERCA SELECCIONADA AHORA: ${seleccion.nombre} (id ${seleccion.id})`
    : '';

  return `GEOCERCAS DE LA EMPRESA (${geocercas?.length || 0}): ${resumen}\n\nFORMATO id | nombre | grupo | división | vértices | centro\n${lineas}${sel}`;
}

async function llamarProviderMapa(url, apiKey, headersExtra, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, ...headersExtra },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error?.message || `HTTP ${r.status}`);
  const texto = data?.choices?.[0]?.message?.content;
  if (!texto) throw new Error('respuesta vacía');
  return texto;
}

async function handlerMapa(req, res, { OPENROUTER_API_KEY, DEEPSEEK_API_KEY, GITHUB_TOKEN }) {
  const { mensaje, historial = [], geocercas = [], seleccion = null } = req.body || {};
  if (!mensaje || typeof mensaje !== 'string') {
    return res.status(400).json({ error: 'Falta el campo mensaje' });
  }

  const contexto = armarContextoMapa(geocercas, seleccion);
  const messages = [
    { role: 'system', content: `${SYSTEM_PROMPT_MAPA}\n\nCONTEXTO:\n${contexto}` },
    ...historial
      .filter((h) => h?.texto)
      .slice(-6)
      .map((h) => ({ role: h.rol === 'usuario' ? 'user' : 'assistant', content: String(h.texto).slice(0, 400) })),
    { role: 'user', content: mensaje.slice(0, 600) },
  ];

  const intentos = [];
  if (OPENROUTER_API_KEY) {
    intentos.push(['openrouter', () => llamarProviderMapa(
      'https://openrouter.ai/api/v1/chat/completions',
      OPENROUTER_API_KEY,
      { 'HTTP-Referer': 'https://www.vitalfarmbright.store', 'X-Title': 'Agrilux-Map-JARVIS' },
      { model: 'google/gemini-2.5-flash', messages, max_tokens: 700, temperature: 0.4 },
    )]);
  }
  if (DEEPSEEK_API_KEY) {
    intentos.push(['deepseek', () => llamarProviderMapa(
      'https://api.deepseek.com/chat/completions',
      DEEPSEEK_API_KEY,
      {},
      { model: 'deepseek-chat', messages, max_tokens: 700, temperature: 0.4 },
    )]);
  }
  if (GITHUB_TOKEN) {
    intentos.push(['github', () => llamarProviderMapa(
      'https://models.inference.ai.azure.com/chat/completions',
      GITHUB_TOKEN,
      {},
      { model: 'Phi-4-multimodal-instruct', messages, max_tokens: 700, temperature: 0.4 },
    )]);
  }

  for (const [provider, llamada] of intentos) {
    try {
      const texto = await llamada();
      const obj = extraerObjetoJSON(texto);
      if (obj) {
        const respuesta = String(obj.respuesta || obj.texto || '').replace(/\s+/g, ' ').trim().slice(0, 600);
        return res.status(200).json({
          respuesta: respuesta || 'Listo.',
          acciones: validarAccionesMapa(obj.acciones),
          provider,
        });
      }
      // Sin JSON: se usa el texto plano y no se ejecuta ninguna acción.
      return res.status(200).json({
        respuesta: String(texto).replace(/\s+/g, ' ').trim().slice(0, 600),
        acciones: [],
        provider,
      });
    } catch (e) {
      console.warn(`voice-assistant modo mapa (${provider}) falló:`, e.message);
    }
  }

  return res.status(200).json({
    respuesta: 'No pude conectar con la IA en este momento. Intenta de nuevo en unos segundos.',
    acciones: [],
    provider: null,
  });
}

/* ========================================================================== */
/*  MODO GESTIÓN — IA de la sección Gestión (AgroTrack)                       */
/*                                                                            */
/*  Cinco casos de uso, todos con el MISMO contrato:                          */
/*    briefing → texto (briefing del día)                                     */
/*    alertas  → JSON  { resumen, grupos:[{clave, accion}] }                  */
/*    reporte  → texto (interpretación de un reporte ya calculado en SQL)     */
/*    geocerca → JSON  { nombre, puntos:[[lat,lon]], advertencia }            */
/*    corte    → JSON  { veredicto, justificacion, riesgos[] }                */
/*                                                                            */
/*  REGLAS DE SEGURIDAD:                                                      */
/*  - El cliente manda SOLO datos ya agregados (nunca filas crudas).          */
/*  - La IA solo INTERPRETA y PROPONE: nunca guarda geocercas ni ejecuta     */
/*    cortes. Toda acción pasa por confirmación humana en la UI.             */
/*  - La respuesta se valida aquí y otra vez en el cliente antes de verse.   */
/* ========================================================================== */

const MODOS_GESTION = new Set(['briefing', 'alertas', 'reporte', 'geocerca', 'corte', 'preguntar']);
/** Modos que deben responder JSON (si no sale JSON, se responde con error). */
const MODOS_GESTION_JSON = new Set(['alertas', 'geocerca', 'corte']);
/** Tope del contexto que acepta este handler (más de esto se recorta). */
const LIMITE_CONTEXTO_GESTION = 7000;

const PROMPTS_GESTION = {
  briefing: `Eres el analista de flota de Agrilux (AgroTrack), plataforma agrícola peruana.
Recibes el RESUMEN DEL DÍA de una flota (cifras ya agregadas en la base de datos).
Entrega un briefing matutino para el jefe de operaciones.

REGLAS:
- Español, tono directo y profesional. Máximo 220 palabras.
- Usa EXCLUSIVAMENTE las cifras del contexto: no inventes placas, fechas ni números.
- Horas en formato "8 h 15 min"; números con 1 decimal.
- NO repitas la tabla: INTERPRETA.

ESTRUCTURA EXACTA:
1. Una línea de contexto (empresa, rango, unidades activas).
2. "• Lo importante hoy" — 3 a 5 viñetas.
3. "• Riesgos" — 2 a 3 viñetas (o "sin riesgos destacables").
4. "• Hoy conviene" — 3 acciones concretas y medibles.
Si falta algún dato, dilo con "sin datos": no lo deduzcas.`,

  alertas: `Eres el analista de flota de Agrilux (AgroTrack). Recibes ALERTAS AGRUPADAS
del periodo (cada grupo ya trae su clave, tipo, mensaje, severidad y total).
Tu trabajo es PRIORIZAR: decir qué atender primero y qué hacer en una frase.

REGLAS:
- Español, máximo 1 resumen de 200 caracteres y 1 acción por grupo (máximo 15 grupos).
- Usa SOLO las claves exactas del contexto; nunca inventes claves.
- Ordena mentalmente por severidad y por total de alertas.
- La acción debe ser concreta (revisar, llamar, detener, verificar…), no genérica.

RESPUESTA OBLIGATORIA (solo JSON, sin markdown):
{"resumen":"<lo más urgente en una frase>","grupos":[{"clave":"<clave exacta del contexto>","accion":"<qué hacer en una frase>"}]}`,

  reporte: `Eres el analista de flota de Agrilux (AgroTrack). Recibes un REPORTE ya
calculado en SQL (nombre, rango, columnas y filas) y debes interpretarlo.

REGLAS:
- Español, máximo 200 palabras, sin tablas ni JSON.
- Usa SOLO las cifras del contexto.
- Estructura: "Qué dice el reporte" (2-3 frases), "• Hallazgos" (3-4 viñetas),
  "• Lo raro o preocupante" (1-3 viñetas) y "• Qué revisar" (2-3 acciones).
- Si el reporte está vacío o es corto, dilo claramente sin inventar.`,

  preguntar: `Eres "Preguntar a Agrilux", el asistente de texto de la flota de Agrilux
(AgroTrack). Recibes una PREGUNTA del usuario en lenguaje natural y el ESTADO
ACTUAL de las unidades (ya calculado en SQL: placa, geocerca, evento, fecha en
hora de Perú, velocidad y grupo).

REGLAS:
- Español, tono directo, máximo 120 palabras. Responde SOLO a la pregunta.
- Usa EXCLUSIVAMENTE los datos del contexto: no inventes placas, geocercas,
  fechas ni números.
- Si los datos no alcanzan para responder, dilo claro: "con los datos
  actuales no puedo responder eso" y sugiere qué sí puedes responder
  (placa, grupo, geocerca, estado de la flota).
- Sin tablas ni JSON; viñetas cortas si ayudan a leer.`,

  geocerca: `Eres el asistente cartográfico de Agrilux (AgroTrack). Recibes una INSTRUCCIÓN
del usuario para crear una geocerca y un listado de las geocercas existentes
(id, nombre y centro) con las que puedes orientarte.

REGLAS:
- Devuelve un polígono REALISTA cerca de lo pedido: 4 a 12 puntos [lat, lon].
- Coordenadas válidas: latitud entre -90 y 90, longitud entre -180 y 180.
- NO inventes coordenadas lejanas: quédate en la misma zona que las geocercas
  del contexto (usa sus centros como referencia).
- Un nombre corto y descriptivo (máximo 40 caracteres).
- "advertencia": una frase con qué debe revisar una persona antes de guardar.
- NUNCA guardes nada: solo propones. La creación la confirma el usuario.

RESPUESTA OBLIGATORIA (solo JSON, sin markdown):
{"nombre":"<nombre>","puntos":[[lat,lon],[lat,lon],[lat,lon],[lat,lon]],"advertencia":"<qué revisar>"}`,

  corte: `Eres el asistente de seguridad de flota de Agrilux (AgroTrack). Recibes el
estado de una unidad y el MOTIVO de una inmovilización remoto solicitada.
Tu trabajo es evaluar el RIESGO antes de que un supervisor confirme.

REGLAS CRÍTICAS:
- TÚ NUNCA EJECUTAS NI AUTORIZAS el corte: solo evalúas y recomiendas.
  La decisión final es siempre del supervisor (él confirma con su PIN).
- veredicto: "apto" (condiciones seguras), "precaucion" (riesgo manejable) o
  "no_apto" (unidad en movimiento, sin conexión, en carretera o emergencia).
- justificacion: 2 a 3 frases con los datos del contexto (no inventes).
- riesgos: 0 a 4 frases cortas y concretas.
- Si el motivo es ambiguo o falta contexto, marca "precaucion".

RESPUESTA OBLIGATORIA (solo JSON, sin markdown):
{"veredicto":"apto|precaucion|no_apto","justificacion":"<2-3 frases>","riesgos":["<riesgo>"]}`,
};

/** Recorta y limpia el contexto que manda el cliente. */
function prepararContextoGestion(contexto) {
  const texto = typeof contexto === 'string' ? contexto : JSON.stringify(contexto ?? {});
  return String(texto).slice(0, LIMITE_CONTEXTO_GESTION);
}

/** Valida el JSON de los modos estructurados antes de devolverlo. */
function validarDatosGestion(modo, obj) {
  if (!obj || typeof obj !== 'object') return null;
  const texto = (valor, max) => String(valor || '').replace(/\s+/g, ' ').trim().slice(0, max);

  if (modo === 'alertas') {
    const grupos = (Array.isArray(obj.grupos) ? obj.grupos : [])
      .filter((g) => g && typeof g === 'object' && texto(g.clave, 120))
      .map((g) => ({ clave: texto(g.clave, 120), accion: texto(g.accion, 220) }))
      .filter((g) => g.accion)
      .slice(0, 15);
    const resumen = texto(obj.resumen, 300);
    if (!resumen && !grupos.length) return null;
    return { resumen, grupos };
  }

  if (modo === 'geocerca') {
    const puntos = (Array.isArray(obj.puntos) ? obj.puntos : [])
      .map((p) => (Array.isArray(p) && p.length >= 2 ? [Number(p[0]), Number(p[1])] : null))
      .filter((p) => p && Number.isFinite(p[0]) && Number.isFinite(p[1])
        && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180)
      .slice(0, 12);
    if (puntos.length < 3) return null;
    const nombre = texto(obj.nombre, 40);
    if (!nombre) return null;
    return { nombre, puntos, advertencia: texto(obj.advertencia, 300) };
  }

  if (modo === 'corte') {
    const veredicto = ['apto', 'precaucion', 'no_apto'].includes(obj.veredicto)
      ? obj.veredicto
      : 'precaucion';
    const justificacion = texto(obj.justificacion, 600);
    if (!justificacion) return null;
    const riesgos = (Array.isArray(obj.riesgos) ? obj.riesgos : [])
      .map((r) => texto(r, 200))
      .filter(Boolean)
      .slice(0, 4);
    return { veredicto, justificacion, riesgos };
  }

  return null;
}

async function handlerGestion(req, res, { OPENROUTER_API_KEY, DEEPSEEK_API_KEY, GITHUB_TOKEN }) {
  const { modo, contexto } = req.body || {};
  if (!MODOS_GESTION.has(modo)) {
    return res.status(400).json({ error: `Modo de gestión no válido: ${String(modo)}` });
  }
  if (contexto === undefined || contexto === null || contexto === '') {
    return res.status(400).json({ error: 'Falta el campo contexto' });
  }

  const esJSON = MODOS_GESTION_JSON.has(modo);
  const messages = [
    { role: 'system', content: PROMPTS_GESTION[modo] },
    { role: 'user', content: prepararContextoGestion(contexto) },
  ];

  // Cadena de proveedores. El primero es el más barato (gpt-4o-mini): estas
  // llamadas son cortas y frecuentes (briefing, alertas, reportes).
  const intentos = [];
  if (OPENROUTER_API_KEY) {
    intentos.push(['openrouter-mini', () => llamarProviderMapa(
      'https://openrouter.ai/api/v1/chat/completions',
      OPENROUTER_API_KEY,
      { 'HTTP-Referer': 'https://www.vitalfarmbright.store', 'X-Title': 'Agrilux-Gestion' },
      { model: 'openai/gpt-4o-mini', messages, max_tokens: 900, temperature: 0.3 },
    )]);
    intentos.push(['openrouter-flash', () => llamarProviderMapa(
      'https://openrouter.ai/api/v1/chat/completions',
      OPENROUTER_API_KEY,
      { 'HTTP-Referer': 'https://www.vitalfarmbright.store', 'X-Title': 'Agrilux-Gestion' },
      { model: 'google/gemini-2.5-flash', messages, max_tokens: 900, temperature: 0.3 },
    )]);
  }
  if (DEEPSEEK_API_KEY) {
    intentos.push(['deepseek', () => llamarProviderMapa(
      'https://api.deepseek.com/chat/completions',
      DEEPSEEK_API_KEY,
      {},
      { model: 'deepseek-chat', messages, max_tokens: 900, temperature: 0.3 },
    )]);
  }
  if (GITHUB_TOKEN) {
    intentos.push(['github', () => llamarProviderMapa(
      'https://models.inference.ai.azure.com/chat/completions',
      GITHUB_TOKEN,
      {},
      { model: 'Phi-4-multimodal-instruct', messages, max_tokens: 900, temperature: 0.3 },
    )]);
  }

  if (!intentos.length) {
    return res.status(500).json({ error: 'No hay proveedores de IA configurados en el servidor.' });
  }

  let ultimoError = null;
  for (const [provider, llamada] of intentos) {
    try {
      const texto = await llamada();

      if (!esJSON) {
        const limpio = String(texto).replace(/\s+/g, ' ').trim().slice(0, 4000);
        if (!limpio) continue;
        return res.status(200).json({ modo, texto: limpio, datos: null, provider });
      }

      const obj = extraerObjetoJSON(texto);
      const datos = validarDatosGestion(modo, obj);
      if (datos) {
        return res.status(200).json({ modo, texto: '', datos, provider });
      }
      // JSON ilegible o incompleto: se intenta con el siguiente proveedor.
      ultimoError = 'La IA devolvió una respuesta que no se pudo validar.';
      console.warn(`voice-assistant modo ${modo} (${provider}) devolvió JSON inválido`);
    } catch (e) {
      ultimoError = e.message;
      console.warn(`voice-assistant modo ${modo} (${provider}) falló:`, e.message);
    }
  }

  return res.status(200).json({
    modo,
    texto: '',
    datos: null,
    provider: null,
    error: ultimoError || 'No pude conectar con la IA en este momento. Intenta de nuevo en unos segundos.',
  });
}
