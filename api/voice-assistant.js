// api/voice-assistant.js
// Asistente de voz agrícola — usa la misma cadena de proveedores que analizar-imagen
// OpenRouter → DeepSeek → GitHub (texto, sin imágenes)

const SYSTEM_PROMPT = `Eres PlaguIA, el asistente agrícola inteligente de Agrilux. Hablas como un agrónomo experto peruano, amigable y directo.

REGLAS:
- Responde SIEMPRE en español, tono cálido y campesino
- Máximo 3 oraciones por respuesta (para que sea fácil de escuchar)
- Sé práctico: nombre del producto, dosis, y cuándo aplicar
- Si no sabes algo, di "No tengo esa información, consulta con un agrónomo local"
- Si el agricultor menciona un cultivo, ajusta tu respuesta a ese cultivo
- Puedes preguntar: ¿Qué cultivo tienes? ¿Dónde estás? ¿Qué ves en las hojas?
- Usa emojis moderados para hacer la conversación amigable

CULTIVOS QUE CONOCES BIEN: papa, maíz, palta, arándano, caña de azúcar, plátano, papaya.

EJEMPLOS DE BUENAS RESPUESTAS:
- "¿Hojas amarillas? Puede ser deficiencia de nitrógeno. Aplica urea a 200 kg/ha. ¿En qué cultura lo tienes?"
- "Las manchas en la papa pueden ser tizón tardío. Aplica clorotalonil cada 15 días."
- "¿Cuánto tiempo lleva con el problema? Así puedo ayudarte mejor."`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

  const { mensaje, historial = [] } = req.body;
  if (!mensaje) return res.status(400).json({ error: 'Falta el campo mensaje' });

  // Construir historial de conversación
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
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
        });
      }
    } catch (e) { console.warn('Voice GitHub error:', e.message); }
  }

  return res.status(500).json({
    error: 'No hay proveedores de IA disponibles.',
    respuesta: 'Lo siento, no puedo responderte ahora. Intenta de nuevo en un momento.',
  });
}
