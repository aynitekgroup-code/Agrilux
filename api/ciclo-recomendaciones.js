/**
 * api/ciclo-recomendaciones.js
 * Genera recomendaciones agronómicas personalizadas para la etapa actual del cultivo.
 * Combina: etapa del ciclo + clima local + suelo + NDVI + registros anteriores.
 *
 * POST body: { cultivo, etapa, diasDesdeSiembra, variedad, lat, lon, registros }
 * Returns: { recomendaciones: string, modelo_usado: string }
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

  const { cultivo, etapa, diasDesdeSiembra, variedad, lat, lon, clima, suelo, registros } = req.body;

  if (!cultivo || !etapa) {
    return res.status(400).json({ error: 'Faltan campos requeridos: cultivo, etapa' });
  }

  const systemPrompt = `Eres un agrónomo experto de la sierra del Perú. Das recomendaciones prácticas y específicas para aumentar la producción de cultivos.

REGLAS:
- Responde en español, tono cercano y sencillo (para agricultores).
- Máximo 300 palabras.
- Usa viñetas (•) para las recomendaciones.
- Incluye: fertilización, riego, control de plagas, tareas específicas de la etapa.
- Si hay datos de clima, úsalos para ajustar recomendaciones.
- Si hay datos de suelo, úsalos para recomendar enmiendas.
- Sé concreto: "Aplicar 50kg de urea por hectárea" no "aplicar fertilizante".
- Incluye un recordatorio de seguridad: "Si ves [síntoma], busca ayuda técnica".
- NO inventes datos que no se te proporcionen.`;

  let prompt = `CULTIVO: ${cultivo}
ETAPA ACTUAL: ${etapa}
DÍAS DESDE SIEMBRA: ${diasDesdeSiembra}
VARIEDAD: ${ variedad || 'No especificada' }
UBICACIÓN: Lat ${lat || 'N/A'}, Lon ${lon || 'N/A'}`;

  if (clima) {
    prompt += `\n\nCLIMA ACTUAL:
- Temperatura: ${clima.temperature || clima.temp || 'N/A'}°C
- Humedad: ${clima.humidity || 'N/A'}%
- Precipitación hoy: ${clima.precipitation || clima.rain || 'N/A'} mm
- Viento: ${clima.windSpeed || clima.wind || 'N/A'} km/h
- Próximos días: ${clima.forecast || 'No disponible'}`;
  }

  if (suelo) {
    prompt += `\n\nDATOS DE SUELO:
- pH: ${suelo.ph || 'N/A'}
- Materia orgánica: ${suelo.organic_matter || 'N/A'}%
- Textura: ${suelo.texture || 'N/A'}
- Fósforo disponible: ${suelo.phosphorus || 'N/A'} mg/kg`;
  }

  if (registros && registros.length > 0) {
    const ultimo = registros[0];
    prompt += `\n\nÚLTIMO MONITOREO (${ultimo.fecha}):
- Días desde siembra entonces: ${ultimo.diasDesdeSiembra}
- Observación: ${ultimo.recomendacion || 'Sin datos'}`;
  }

  prompt += `\n\nDame recomendaciones concretas para esta etapa del cultivo. Incluye:
1. TAREAS PRIORITARIAS (qué hacer esta semana)
2. FERTILIZACIÓN (qué producto, cuánto, cuándo)
3. RIEGO (frecuencia y cantidad)
4. PLAGAS/ENFERMEDADES (vigilar en esta etapa)
5. PRÓXIMO PASO (qué viene en la siguiente etapa)`;

  // ── Cadena de proveedores (solo texto) ──

  // 1. OpenRouter — Gemini 2.5 Flash
  if (OPENROUTER_API_KEY) {
    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://www.vitalfarmbright.store',
          'X-Title': 'Agrilux Ciclo',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-preview',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          max_tokens: 1000,
          temperature: 0.3,
        }),
      });
      const data = await r.json();
      if (r.ok && data.choices?.[0]?.message?.content) {
        return res.status(200).json({
          recomendaciones: data.choices[0].message.content,
          modelo_usado: 'openrouter-gemini-2.5-flash',
        });
      }
    } catch (e) { console.warn('OpenRouter ciclo error:', e.message); }
  }

  // 2. DeepSeek Chat
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
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          max_tokens: 1000,
          temperature: 0.3,
        }),
      });
      const data = await r.json();
      if (r.ok && data.choices?.[0]?.message?.content) {
        return res.status(200).json({
          recomendaciones: data.choices[0].message.content,
          modelo_usado: 'deepseek-chat',
        });
      }
    } catch (e) { console.warn('DeepSeek ciclo error:', e.message); }
  }

  // 3. GitHub Phi-4
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
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          max_tokens: 1000,
          temperature: 0.3,
        }),
      });
      const data = await r.json();
      if (r.ok && data.choices?.[0]?.message?.content) {
        return res.status(200).json({
          recomendaciones: data.choices[0].message.content,
          modelo_usado: 'github-phi-4',
        });
      }
    } catch (e) { console.warn('GitHub ciclo error:', e.message); }
  }

  return res.status(500).json({
    error: 'No se pudo generar recomendaciones. Verifica tu configuración de IA.',
    modelo_usado: 'ninguno',
  });
}
