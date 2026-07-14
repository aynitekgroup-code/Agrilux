// api/analizar-imagen.js
// Estrategia combinada:
//   Con imágenes → GitHub Models Phi-4 (gratis, soporta imágenes)
//   Solo texto   → DeepSeek Chat (barato, $0.14/M tokens)
//   Fallback     → HuggingFace plant-disease

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

  console.log('API Keys:', {
    deepseek: DEEPSEEK_API_KEY ? 'OK' : 'MISSING',
    github: GITHUB_TOKEN ? 'OK' : 'MISSING',
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
  //  CASO A: CON IMÁGENES → GitHub primero (gratis, soporta vision)
  // ══════════════════════════════════════════════════════════════
  if (tieneImagenes) {

    // A1: GitHub Models Phi-4-multimodal (GRATIS, soporta imágenes)
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

    // A2: DeepSeek solo texto (sin análisis visual, pero responde al prompt)
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

    // A3: HuggingFace plant-disease (último recurso, gratis)
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
  //  CASO B: SOLO TEXTO → DeepSeek primero (barato)
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

    // B2: GitHub Models fallback (GRATIS)
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
    detalle: 'Configura GITHUB_TOKEN (imágenes) o DEEPSEEK_API_KEY (texto) en Vercel.',
    providers_tryed: tieneImagenes
      ? ['github-phi-4-multimodal', 'deepseek-chat-text-only', 'huggingface']
      : ['deepseek-chat', 'github-phi-4-text'],
  });
}
