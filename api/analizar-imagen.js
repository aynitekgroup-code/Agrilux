// api/analizar-imagen.js
// Cadena de proveedores:
//   CON IMÁGENES: GitHub Phi-4 (gratis) → OpenRouter Gemini (barato, vision) → DeepSeek (solo texto) → HuggingFace
//   SOLO TEXTO:  DeepSeek (barato) → OpenRouter Gemini → GitHub (gratis)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

  console.log('API Keys:', {
    deepseek: DEEPSEEK_API_KEY ? 'OK' : 'MISSING',
    github: GITHUB_TOKEN ? 'OK' : 'MISSING',
    openrouter: OPENROUTER_API_KEY ? 'OK' : 'MISSING',
    huggingface: HUGGINGFACE_API_KEY ? 'OK' : 'MISSING',
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
  //  CASO A: CON IMÁGENES
  //  A1: GitHub Phi-4 (gratis)
  //  A2: OpenRouter Gemini 2.5 Flash (barato, vision excelente)
  //  A3: DeepSeek solo texto (fallback)
  //  A4: HuggingFace (último recurso)
  // ══════════════════════════════════════════════════════════════
  if (tieneImagenes) {

    // A1: GitHub Models Phi-4-multimodal (GRATIS)
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
        console.log('GitHub vision:', { status: res2.status, ok: res2.ok, err: data.error?.message });

        if (res2.ok && data.choices?.[0]?.message?.content) {
          console.log('✓ GitHub Phi-4 respondió (imágenes)');
          return res.status(200).json({
            choices: [{ message: { content: data.choices[0].message.content } }],
            modelo_usado: 'github-phi-4-multimodal',
          });
        }
      } catch (err) {
        console.warn('Error GitHub vision:', err.message);
      }
    }

    // A2: OpenRouter — Gemini 2.5 Flash (barato, vision excelente)
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

    // A3: DeepSeek solo texto (sin análisis visual)
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

    // A4: HuggingFace plant-disease (último recurso)
    if (HUGGINGFACE_API_KEY) {
      try {
        const cleanBase64 = images[0].replace(/^data:image\/[^;]+;base64,/, '');
        const res2 = await fetch(
          'https://api-inference.huggingface.co/models/vasudevgupta/plant-disease-classification',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ inputs: cleanBase64 }),
          }
        );

        if (res2.ok) {
          const data = await res2.json();
          const label = data[0]?.label || 'Enfermedad desconocida';
          const score = data[0]?.score || 0;
          const content = `Diagnóstico: ${label} (confianza: ${(score * 100).toFixed(1)}%). Consulta a un agrónomo local para confirmación.`;
          console.log('✓ HuggingFace respondió');
          return res.status(200).json({
            choices: [{ message: { content } }],
            modelo_usado: 'huggingface-plant-disease',
          });
        }
      } catch (err) {
        console.warn('Error HuggingFace:', err.message);
      }
    }

  // ══════════════════════════════════════════════════════════════
  //  CASO B: SOLO TEXTO
  //  B1: DeepSeek (barato)
  //  B2: OpenRouter Gemini (refuerzo)
  //  B3: GitHub (gratis)
  // ══════════════════════════════════════════════════════════════
  } else {

    // B1: DeepSeek Chat ($0.14/M tokens)
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
          console.log('✓ DeepSeek respondió (texto)');
          return res.status(200).json({
            choices: [{ message: { content: data.choices[0].message.content } }],
            modelo_usado: 'deepseek-chat',
          });
        }
      } catch (err) {
        console.warn('Error DeepSeek:', err.message);
      }
    }

    // B2: OpenRouter Gemini (refuerzo texto)
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

    // B3: GitHub Models fallback (GRATIS)
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
          console.log('✓ GitHub respondió (texto fallback)');
          return res.status(200).json({
            choices: [{ message: { content: data.choices[0].message.content } }],
            modelo_usado: 'github-phi-4-text',
          });
        }
      } catch (err) {
        console.warn('Error GitHub fallback:', err.message);
      }
    }
  }

  // Todos fallaron
  console.error('Todos los providers fallaron');
  return res.status(500).json({
    error: 'No se pudo obtener respuesta de ningún modelo de IA.',
    detalle: 'Configura OPENROUTER_API_KEY, GITHUB_TOKEN o DEEPSEEK_API_KEY en Vercel.',
    providers_tryed: tieneImagenes
      ? ['github-phi-4', 'openrouter-gemini-flash', 'deepseek-chat', 'huggingface']
      : ['deepseek-chat', 'openrouter-gemini-flash', 'github-phi-4'],
  });
}
