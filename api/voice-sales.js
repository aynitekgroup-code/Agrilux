// api/voice-sales.js
// Asistente de ventas agrícolas — proxy a voice-assistant con prompt de ventas

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mensaje, historial = [], lat, lon, ubicacion, nombre } = req.body;
  if (!mensaje) return res.status(400).json({ error: 'Falta el campo mensaje' });

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

  const SYSTEM_PROMPT = `Eres el asistente de ventas de Agrilux. Ayudas a los agricultores a encontrar productos agrícolas, comparar precios y tiendas cercanas.
REGLAS:
- Responde SIEMPRE en español peruano, tono cálido
- Máximo 4 oraciones por respuesta
- Cuando busque tiendas, menciona: nombre, distancia, precio y cómo contactarlos
- Si no sabes algo, di "No tengo esa información, consulta con una tienda local"
- Usa emojis moderados`;

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...historial.map(h => ({ role: h.rol === 'usuario' ? 'user' : 'assistant', content: h.texto })),
    { role: 'user', content: mensaje },
  ];

  if (OPENROUTER_API_KEY) {
    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://www.vitalfarmbright.store',
          'X-Title': 'Agrilux-Sales',
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
        return res.status(200).json({ respuesta: data.choices[0].message.content, provider: 'openrouter' });
      }
    } catch (e) { console.warn('Sales OpenRouter error:', e.message); }
  }

  if (DEEPSEEK_API_KEY) {
    try {
      const r = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
        body: JSON.stringify({ model: 'deepseek-chat', messages, max_tokens: 350, temperature: 0.7 }),
      });
      const data = await r.json();
      if (r.ok && data.choices?.[0]?.message?.content) {
        return res.status(200).json({ respuesta: data.choices[0].message.content, provider: 'deepseek' });
      }
    } catch (e) { console.warn('Sales DeepSeek error:', e.message); }
  }

  if (GITHUB_TOKEN) {
    try {
      const r = await fetch('https://models.inference.ai.azure.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GITHUB_TOKEN}` },
        body: JSON.stringify({ model: 'Phi-4-multimodal-instruct', messages, max_tokens: 350, temperature: 0.7 }),
      });
      const data = await r.json();
      if (r.ok && data.choices?.[0]?.message?.content) {
        return res.status(200).json({ respuesta: data.choices[0].message.content, provider: 'github' });
      }
    } catch (e) { console.warn('Sales GitHub error:', e.message); }
  }

  return res.status(500).json({
    error: 'No hay proveedores de IA disponibles.',
    respuesta: 'Lo siento, no puedo responderte ahora. Intenta de nuevo en un momento.',
  });
}
