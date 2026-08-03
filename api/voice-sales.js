// api/voice-sales.js
// Agente de Ventas Agrícola — ofertas, precios, tiendas, productos
// Cadena: OpenRouter → DeepSeek → GitHub

const SYSTEM_PROMPT = `Eres AgriVentas, el asistente de ventas agrícolas de Agrilux. Hablas como un vendedor experto peruano, amigable y confiable.

REGLAS:
- Responde SIEMPRE en español peruano, tono cálido y de confianza
- Máximo 4 oraciones por respuesta (fácil de escuchar por voz)
- Eres especialista en: productos agrícolas, insumos, fertilizantes, plaguicidas, semillas, herramientas
- Siempre menciona precios cuando los tengas (S/ XX por kg, por litro, por saco)
- Siempre menciona tiendas cercanas con nombre, distancia y cómo contactar (WhatsApp, Maps, Facebook)
- Si el agricultor busca un producto, busca tiendas automáticamente y muestra opciones
- Recomienda productos según la temporada, cultivo y zona del agricultor
- Si no sabes el precio, di "No tengo el precio exacto, te recomiendo contactar la tienda más cercana"
- Usa emojis moderados para hacer la conversación amigable
- Sé honesto: no sobreprecios ni recomendaciones innecesarias
- Cuando menciones tiendas, incluye: nombre, distancia, precio si está disponible, y enlace directo

CAPACIDADES:
- Consultar precios de insumos agrícolas (fertilizantes, plaguicidas, semillas, herramientas)
- Buscar tiendas de insumos agrícolas cercanas con precios y contacto
- Recomendar productos según cultivo, temporada y zona
- Comparar precios entre tiendas
- Informar sobre ofertas y descuentos disponibles
- Conectar al agricultor con proveedores por WhatsApp o redes sociales
- Consultar clima para recomendar productos preventivos (fungicidas si hay lluvia, etc.)

EJEMPLOS:
- "¿Cuánto cuesta el fertilizante NPK? Te encuentro las tiendas más cercanas con precio."
- "Para tu cultivo de papa, te recomiendo el fertilizante 15-15-15. Las tiendas cercanas lo tienen desde S/ 120 el saco."
- "¿Dónde comprar fungicida? Encontré 3 tiendas a menos de 10km. La más cercana tiene buen precio."
- "Hoy hay oferta de semillas improved en la tienda del centro. ¿Te interesa?"`;

// ── Base de datos de estaciones meteorológicas de Perú ──
const ESTACIONES_PERU = [
  { id:'TUM', nombre:'Tumbes', dept:'Tumbes', lat:-3.56, lon:-80.44, alt:25 },
  { id:'PIU', nombre:'Piura', dept:'Piura', lat:-5.17, lon:-80.63, alt:29 },
  { id:'CHI', nombre:'Chiclayo', dept:'Lambayeque', lat:-6.77, lon:-79.84, alt:27 },
  { id:'TRU', nombre:'Trujillo', dept:'La Libertad', lat:-8.11, lon:-79.03, alt:34 },
  { id:'LIM', nombre:'Lima', dept:'Lima', lat:-12.03, lon:-76.93, alt:182 },
  { id:'ICA', nombre:'Ica', dept:'Ica', lat:-14.07, lon:-75.73, alt:400 },
  { id:'ARE', nombre:'Arequipa', dept:'Arequipa', lat:-16.34, lon:-71.57, alt:2050 },
  { id:'CUZ', nombre:'Cusco', dept:'Cusco', lat:-13.53, lon:-71.97, alt:3310 },
  { id:'HAN', nombre:'Huancayo', dept:'Junín', lat:-12.07, lon:-75.22, alt:3249 },
  { id:'TAR2', nombre:'Tarapoto', dept:'San Martín', lat:-6.48, lon:-76.36, alt:345 },
  { id:'IQU', nombre:'Iquitos', dept:'Loreto', lat:-3.75, lon:-73.25, alt:126 },
];

function encontrarEstacionCercana(lat, lon) {
  let mejor = ESTACIONES_PERU[0], mejorDist = Infinity;
  for (const e of ESTACIONES_PERU) {
    const d = Math.sqrt(Math.pow((lat - e.lat) * 111, 2) + Math.pow((lon - e.lon) * 111 * Math.cos(lat * Math.PI / 180), 2));
    if (d < mejorDist) { mejorDist = d; mejor = e; }
  }
  return { ...mejor, distanciaKm: Math.round(mejorDist * 10) / 10 };
}

async function obtenerClima(lat, lon) {
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=auto&forecast_days=3`, { signal: AbortSignal.timeout(3000) });
    const d = await r.json();
    const c = d.current;
    const wmo = { 0:'Despejado',1:'Mayormente despejado',2:'Parcial nublado',3:'Nublado',45:'Neblina',48:'Neblina con escarcha',51:'Lluvia ligera',53:'Lluvia moderada',55:'Lluvia intensa',61:'Lluvia',63:'Lluvia moderada',65:'Lluvia fuerte',80:'Chubascos',81:'Chubascos moderados',82:'Chubascos fuertes',95:'Tormenta',96:'Tormenta con granizo' };
    return {
      temp: c.temperature_2m, humedad: c.relative_humidity_2m,
      viento: Math.round(c.wind_speed_10m * 3.6),
      lluvia: c.precipitation || 0,
      descripcion: wmo[c.weather_code] || 'Variable',
      pronostico: d.daily ? {
        tempMax: d.daily.temperature_2m_max, tempMin: d.daily.temperature_2m_min,
        lluvia: d.daily.precipitation_sum, probLluvia: d.daily.precipitation_probability_max,
      } : null,
    };
  } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

  const { mensaje, historial = [], lat, lon, ubicacion, nombre } = req.body;
  if (!mensaje) return res.status(400).json({ error: 'Falta el campo mensaje' });

  const contextoParts = [];

  if (ubicacion) contextoParts.push(`UBICACIÓN: ${ubicacion}`);
  if (nombre) contextoParts.push(`NOMBRE: ${nombre}`);

  let estacionCercana = null;
  if (lat && lon) {
    estacionCercana = encontrarEstacionCercana(lat, lon);
    contextoParts.push(`ESTACIÓN MÁS CERCANA: ${estacionCercana.nombre} (${estacionCercana.dept}), ${estacionCercana.distanciaKm}km`);
  }

  let clima = null;
  if (lat && lon) {
    clima = await obtenerClima(lat, lon);
    if (clima) {
      contextoParts.push(`CLIMA ACTUAL: ${clima.temp}°C, ${clima.descripcion}, humedad ${clima.humedad}%, viento ${clima.viento}km/h`);
      if (clima.lluvia > 0) contextoParts.push(`LLUVIA: ${clima.lluvia}mm`);
      if (clima.pronostico) {
        contextoParts.push(`PRONÓSTICO HOY: ${clima.pronostico.tempMin[0]}°C - ${clima.pronostico.tempMax[0]}°C, prob. lluvia ${clima.pronostico.probLluvia[0]}%`);
      }
    }
  }

  // Buscar tiendas si el mensaje relaciona con compras
  const buscaTienda = /comprar|tienda|dónde|donde|conseguir|adquirir|mercado|insumo|producto|oferta|ofertas|descuento|precio|precios|vende|fertilizante|plaguicida|semilla|herramienta|fungicida|insecticida|herbicida|saco|litro|kg/i.test(mensaje);
  let tiendasResult = null;

  if (buscaTienda && lat && lon) {
    const productoMatch = mensaje.match(/comprar\s+(.+?)(?:\s+en|\s+cerca|\s+de|\s+por|\?|$)/i)
      || mensaje.match(/(.+?)\s+(?:barato|barata|oferta|descuento|precio)/i)
      || mensaje.match(/(?:fertilizante|plaguicida|semilla|fungicida|insecticida)\s+(.+?)(?:\s+en|\?|$)/i);
    let producto = productoMatch?.[1]?.trim() || 'insumos agrícolas';
    if (producto.length < 2) producto = 'insumos agrícolas';

    try {
      const busquedaRes = await fetch(`https://${req.headers.host || 'localhost'}/api/buscar-insumos?lat=${lat}&lon=${lon}&producto=${encodeURIComponent(producto)}&radio=50&ubicacion=${encodeURIComponent(ubicacion || '')}`);
      tiendasResult = await busquedaRes.json();

      if (tiendasResult.tiendas?.length > 0) {
        const tiendasInfo = tiendasResult.tiendas.slice(0, 3).map(t => {
          const precioStr = t.precio ? ` - S/ ${t.precio}` : '';
          return `${t.nombre} (${t.distanciaKm}km)${precioStr}`;
        }).join('\n');
        contextoParts.push(`TIENDAS ENCONTRADAS para "${producto}":\n${tiendasInfo}`);
      }
    } catch {}
  }

  const contextoCompleto = contextoParts.length > 0
    ? `\n\nINFORMACIÓN EN TIEMPO REAL:\n${contextoParts.join('\n')}\n\nUsa estos datos para recomendar productos y tiendas. Si hay lluvia, recomienda fungicidas preventivos. Si hay humedad alta, alerta sobre productos para hongos.`
    : '';

  const systemPrompt = SYSTEM_PROMPT + contextoCompleto;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...historial.map(h => ({ role: h.rol === 'usuario' ? 'user' : 'assistant', content: h.texto })),
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
          'HTTP-Referer': 'https://www.agrilux.app',
          'X-Title': 'Agrilux-Sales',
        },
        body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages, max_tokens: 350, temperature: 0.7 }),
      });
      const data = await r.json();
      if (r.ok && data.choices?.[0]?.message?.content) {
        return res.status(200).json({
          respuesta: data.choices[0].message.content,
          provider: 'openrouter',
          tiendas: tiendasResult?.tiendas?.slice(0, 5) || [],
          enlaces: tiendasResult?.enlaces || null,
        });
      }
    } catch {}
  }

  // ── DeepSeek fallback ──
  if (DEEPSEEK_API_KEY) {
    try {
      const r = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
        body: JSON.stringify({ model: 'deepseek-chat', messages, max_tokens: 350, temperature: 0.7 }),
      });
      const data = await r.json();
      if (r.ok && data.choices?.[0]?.message?.content) {
        return res.status(200).json({
          respuesta: data.choices[0].message.content,
          provider: 'deepseek',
          tiendas: tiendasResult?.tiendas?.slice(0, 5) || [],
          enlaces: tiendasResult?.enlaces || null,
        });
      }
    } catch {}
  }

  // ── GitHub Phi-4 ──
  if (GITHUB_TOKEN) {
    try {
      const r = await fetch('https://models.inference.ai.azure.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GITHUB_TOKEN}` },
        body: JSON.stringify({ model: 'Phi-4', messages, max_tokens: 350, temperature: 0.7 }),
      });
      const data = await r.json();
      if (r.ok && data.choices?.[0]?.message?.content) {
        return res.status(200).json({
          respuesta: data.choices[0].message.content,
          provider: 'github',
          tiendas: tiendasResult?.tiendas?.slice(0, 5) || [],
          enlaces: tiendasResult?.enlaces || null,
        });
      }
    } catch {}
  }

  return res.status(200).json({ respuesta: 'No pude conectar con el asistente. Intenta de nuevo en unos segundos.' });
}
