// api/voice-assistant.js
// Asistente de voz agrícola con datos climáticos en tiempo real
// Cadena: OpenRouter → DeepSeek → GitHub (texto)

const SYSTEM_PROMPT_BASE = `Eres PlaguIA, el asistente agrícola inteligente de Agrilux. Hablas como un agrónomo experto peruano, amigable y directo.

REGLAS:
- Responde SIEMPRE en español, tono cálido y campesino
- Máximo 3 oraciones por respuesta (fácil de escuchar por voz)
- Sé práctico: nombre del producto, dosis, y cuándo aplicar
- Si no sabes algo, di "No tengo esa información, consulta con un agrónomo local"
- Si el agricultor menciona un cultivo, ajusta tu respuesta a ese cultivo
- Usa datos climáticos REALES cuando los tengas para dar recomendaciones precisas
- Usa emojis moderados para hacer la conversación amigable

CULTIVOS QUE CONOCES BIEN: papa, maíz, palta, arándano, caña de azúcar, plátano, papaya.

EJEMPLOS DE BUENAS RESPUESTAS:
- "¿Hojas amarillas? Puede ser deficiencia de nitrógeno. Aplica urea a 200 kg/ha. ¿En qué cultura lo tienes?"
- "Las manchas en la papa pueden ser tizón tardío. Aplica clorotalonil cada 15 días."
- "Hoy en tu zona hay 22°C y 80% de humedad. Condiciones favorables para hongos, revisa tus hojas."`;

// ── Obtener clima real vía SENAMHI agent (Open-Meteo + estaciones Perú) ──
async function obtenerClima(lat, lon) {
  try {
    // Intentar SENAMHI agent (Vercel internal)
    const protocol = 'https';
    const host = 'www.vitalfarmbright.store';
    const r = await fetch(`${protocol}://${host}/api/senamhi?lat=${lat}&lon=${lon}`);
    const data = await r.json();
    if (!data.climaActual) return null;

    const clima = data.climaActual;
    const estacion = data.estacion;
    let contexto = `CLIMA ACTUAL (${estacion?.nombre || 'zona'}): ${clima.temperatura}°C, ${clima.descripcion}, humedad ${clima.humedad}%, viento ${clima.viento} km/h`;

    if (clima.precipitacion > 0) contexto += `, lluvia activa ${clima.precipitacion}mm`;
    if (data.pronostico?.fechas) {
      const maxHoy = data.pronostico.tempMax?.[0];
      const minHoy = data.pronostico.tempMin?.[0];
      const lluviaHoy = data.pronostico.lluvia?.[0];
      const probLluvia = data.pronostico.probLluvia?.[0];
      contexto += `. HOY: ${minHoy}°C-${maxHoy}°C`;
      if (lluviaHoy > 0) contexto += `, ${lluviaHoy}mm de lluvia esperada`;
      if (probLluvia > 0) contexto += `, probabilidad lluvia ${probLluvia}%`;
    }
    if (data.pronosticoCana?.recomendaciones?.length) {
      contexto += `. RECOMENDACIONES CAÑA: ${data.pronosticoCana.recomendaciones.map(r => r.mensaje).join('; ')}`;
    }

    return contexto;
  } catch (e) {
    // Fallback a Open-Meteo directo
    try {
      const r = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=auto&forecast_days=3`
      );
      const data = await r.json();
      if (!data.current) return null;

      const codigos = {
        0: 'despejado', 1: 'mayormente despejado', 2: 'parcial nublado', 3: 'nublado',
        45: 'neblina', 48: 'neblina con escarcha',
        51: 'llovizna leve', 53: 'llovizna moderada', 55: 'llovizna intensa',
        61: 'lluvia leve', 63: 'lluvia moderada', 65: 'lluvia intensa',
        80: 'aguacero leve', 81: 'aguacero moderado', 82: 'aguacero fuerte',
        95: 'tormenta', 96: 'tormenta con granizo', 99: 'tormenta fuerte con granizo',
      };

      const desc = codigos[data.current.weather_code] || 'variable';
      const temp = data.current.temperature_2m;
      const hum = data.current.relative_humidity_2m;
      const lluvia = data.current.precipitation;
      const viento = data.current.wind_speed_10m;

      let contexto = `CLIMA ACTUAL: ${temp}°C, ${desc}, humedad ${hum}%, viento ${viento} km/h`;
      if (lluvia > 0) contexto += `, lluvia activa ${lluvia}mm`;
      if (data.daily) {
        const maxHoy = data.daily.temperature_2m_max?.[0];
        const minHoy = data.daily.temperature_2m_min?.[0];
        contexto += `. HOY: ${minHoy}°C-${maxHoy}°C`;
      }
      return contexto;
    } catch (e2) {
      console.warn('Error clima fallback:', e2.message);
      return null;
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

  const { mensaje, historial = [], lat, lon } = req.body;
  if (!mensaje) return res.status(400).json({ error: 'Falta el campo mensaje' });

  // Obtener clima si tenemos coordenadas
  let climaContexto = '';
  if (lat && lon) {
    climaContexto = await obtenerClima(lat, lon) || '';
  }

  // Construir system prompt con contexto climático
  const systemPrompt = climaContexto
    ? `${SYSTEM_PROMPT_BASE}\n\nDATOS CLIMÁTICOS EN TIEMPO REAL DEL AGRICULTOR:\n${climaContexto}\n\nUsa estos datos para tus recomendaciones. Si hace frío, sugiere preventivos. Si hay lluvia, prioriza fungicidas. Si hay humedad alta, alerta sobre hongos.`
    : SYSTEM_PROMPT_BASE;

  // Construir historial de conversación
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
          max_tokens: 300,
          temperature: 0.7,
        }),
      });
      const data = await r.json();
      if (r.ok && data.choices?.[0]?.message?.content) {
        return res.status(200).json({
          respuesta: data.choices[0].message.content,
          provider: 'openrouter',
          clima: climaContexto || null,
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
          max_tokens: 300,
          temperature: 0.7,
        }),
      });
      const data = await r.json();
      if (r.ok && data.choices?.[0]?.message?.content) {
        return res.status(200).json({
          respuesta: data.choices[0].message.content,
          provider: 'deepseek',
          clima: climaContexto || null,
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
          max_tokens: 300,
          temperature: 0.7,
        }),
      });
      const data = await r.json();
      if (r.ok && data.choices?.[0]?.message?.content) {
        return res.status(200).json({
          respuesta: data.choices[0].message.content,
          provider: 'github',
          clima: climaContexto || null,
        });
      }
    } catch (e) { console.warn('Voice GitHub error:', e.message); }
  }

  return res.status(500).json({
    error: 'No hay proveedores de IA disponibles.',
    respuesta: 'Lo siento, no puedo responderte ahora. Intenta de nuevo en un momento.',
  });
}
