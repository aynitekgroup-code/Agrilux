// api/analizar-imagen.js
// Cadena de proveedores (orden por calidad):
//   CON IMÁGENES: OpenRouter Gemini 2.5 Flash → DeepSeek (solo texto) → GitHub Phi-4
//   SOLO TEXTO:  OpenRouter Gemini 2.5 Flash → DeepSeek → GitHub Phi-4

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

  console.log('API Keys:', {
    openrouter: OPENROUTER_API_KEY ? 'OK' : 'MISSING',
    deepseek: DEEPSEEK_API_KEY ? 'OK' : 'MISSING',
    github: GITHUB_TOKEN ? 'OK' : 'MISSING',
  });

  const { images, prompt, systemPrompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Falta el campo prompt' });

  const tieneImagenes = Array.isArray(images) && images.length > 0;
  console.log('Request:', { tieneImagenes, imageCount: images?.length || 0, promptLen: prompt?.length });

  const systemMsg = systemPrompt ? [{ role: 'system', content: systemPrompt }] : [];

  const imageContent = tieneImagenes
    ? [
        { type: 'text', text: prompt },
        ...images.map(img => ({
          type: 'image_url',
          image_url: { url: img },
        })),
      ]
    : null;

  // ══════════════════════════════════════════════════════════════
  //  CASO A: CON IMÁGENES → OpenRouter primero (mejores modelos)
  // ══════════════════════════════════════════════════════════════
  if (tieneImagenes) {

    // A1: OpenRouter — Gemini 2.5 Flash (excelente vision, rápido)
    if (OPENROUTER_API_KEY) {
      try {
        const res2 = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://www.vitalfarmbright.store',
            'X-Title': 'Agrilux',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-preview',
            messages: [...systemMsg, { role: 'user', content: imageContent }],
            max_tokens: 1500,
            temperature: 0.3,
          }),
        });

        const data = await res2.json();
        console.log('OpenRouter vision:', { status: res2.status, ok: res2.ok, err: data.error?.message });

        if (res2.ok && data.choices?.[0]?.message?.content) {
          console.log('✓ OpenRouter Gemini respondió (imágenes)');
          return res.status(200).json({
            choices: [{ message: { content: data.choices[0].message.content } }],
            modelo_usado: 'openrouter-gemini-2.5-flash',
          });
        }
      } catch (err) {
        console.warn('Error OpenRouter vision:', err.message);
      }
    }

    // A2: DeepSeek solo texto (fallback sin análisis visual)
    if (DEEPSEEK_API_KEY) {
      try {
        const res2 = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [...systemMsg, { role: 'user', content: prompt }],
            max_tokens: 1500,
            temperature: 0.3,
          }),
        });

        const data = await res2.json();
        if (res2.ok && data.choices?.[0]?.message?.content) {
          console.log('✓ DeepSeek respondió (texto sin imagen)');
          return res.status(200).json({
            choices: [{ message: { content: data.choices[0].message.content } }],
            modelo_usado: 'deepseek-chat-text-only',
          });
        }
      } catch (err) {
        console.warn('Error DeepSeek fallback:', err.message);
      }
    }

    // A3: GitHub Phi-4 (último recurso, gratis)
    if (GITHUB_TOKEN) {
      try {
        const res2 = await fetch('https://models.inference.ai.azure.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
          },
          body: JSON.stringify({
            model: 'Phi-4-multimodal-instruct',
            messages: [...systemMsg, { role: 'user', content: imageContent }],
            max_tokens: 1500,
            temperature: 0.3,
          }),
        });

        const data = await res2.json();
        if (res2.ok && data.choices?.[0]?.message?.content) {
          console.log('✓ GitHub Phi-4 respondió (fallback imágenes)');
          return res.status(200).json({
            choices: [{ message: { content: data.choices[0].message.content } }],
            modelo_usado: 'github-phi-4-multimodal',
          });
        }
      } catch (err) {
        console.warn('Error GitHub vision:', err.message);
      }
    }

  // ══════════════════════════════════════════════════════════════
  //  CASO B: SOLO TEXTO → OpenRouter primero
  // ══════════════════════════════════════════════════════════════
  } else {

    // B1: OpenRouter — Gemini 2.5 Flash (mejor calidad)
    if (OPENROUTER_API_KEY) {
      try {
        const res2 = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://www.vitalfarmbright.store',
            'X-Title': 'Agrilux',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash-preview',
            messages: [...systemMsg, { role: 'user', content: prompt }],
            max_tokens: 1500,
            temperature: 0.3,
          }),
        });

        const data = await res2.json();
        console.log('OpenRouter text:', { status: res2.status, ok: res2.ok, err: data.error?.message });

        if (res2.ok && data.choices?.[0]?.message?.content) {
          console.log('✓ OpenRouter Gemini respondió (texto)');
          return res.status(200).json({
            choices: [{ message: { content: data.choices[0].message.content } }],
            modelo_usado: 'openrouter-gemini-2.5-flash-text',
          });
        }
      } catch (err) {
        console.warn('Error OpenRouter text:', err.message);
      }
    }

    // B2: DeepSeek Chat (barato, fallback)
    if (DEEPSEEK_API_KEY) {
      try {
        const res2 = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [...systemMsg, { role: 'user', content: prompt }],
            max_tokens: 1500,
            temperature: 0.3,
          }),
        });

        const data = await res2.json();
        console.log('DeepSeek text:', { status: res2.status, ok: res2.ok, err: data.error?.message });

        if (res2.ok && data.choices?.[0]?.message?.content) {
          console.log('✓ DeepSeek respondió (texto fallback)');
          return res.status(200).json({
            choices: [{ message: { content: data.choices[0].message.content } }],
            modelo_usado: 'deepseek-chat',
          });
        }
      } catch (err) {
        console.warn('Error DeepSeek:', err.message);
      }
    }

    // B3: GitHub Phi-4 (gratis, último recurso)
    if (GITHUB_TOKEN) {
      try {
        const res2 = await fetch('https://models.inference.ai.azure.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
          },
          body: JSON.stringify({
            model: 'Phi-4-multimodal-instruct',
            messages: [...systemMsg, { role: 'user', content: prompt }],
            max_tokens: 1500,
            temperature: 0.3,
          }),
        });

        const data = await res2.json();
        if (res2.ok && data.choices?.[0]?.message?.content) {
          console.log('✓ GitHub respondió (texto último recurso)');
          return res.status(200).json({
            choices: [{ message: { content: data.choices[0].message.content } }],
            modelo_usado: 'github-phi-4-text',
          });
        }
      } catch (err) {
        console.warn('Error GitHub:', err.message);
      }
    }
  }

  // Todos fallaron
  console.error('Todos los providers fallaron');
  return res.status(500).json({
    error: 'No se pudo obtener respuesta de ningún modelo de IA.',
    detalle: 'Configura OPENROUTER_API_KEY en Vercel.',
    providers_tryed: tieneImagenes
      ? ['openrouter-gemini-flash', 'deepseek-chat', 'github-phi-4']
      : ['openrouter-gemini-flash', 'deepseek-chat', 'github-phi-4'],
  });
}
