// api/analizar-imagen.js
// Análisis de imágenes: DeepSeek Chat → GitHub Models (Phi-4) → HuggingFace

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

  const { images, prompt, systemPrompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Falta el campo prompt' });

  const tieneImagenes = Array.isArray(images) && images.length > 0;
  const userContent = tieneImagenes
    ? [
        { type: 'text', text: prompt },
        ...images.map(img => ({
          type: 'image_url',
          image_url: { url: img },
        })),
      ]
    : prompt;

  // ── Proveedor 1: DeepSeek Chat ($0.14/M tokens) ──
  if (DEEPSEEK_API_KEY) {
    try {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: userContent },
          ],
          max_tokens: 1500,
          temperature: 0.3,
        }),
      });

      const data = await res.json();

      if (res.ok && data.choices?.[0]?.message?.content) {
        const content = data.choices[0].message.content;
        console.log('✓ DeepSeek Chat respondió');
        return res.status(200).json({
          choices: [{ message: { content } }],
          modelo_usado: 'deepseek-v4-flash',
        });
      }

      console.warn('DeepSeek Chat falló:', data.error?.message);
    } catch (err) {
      console.warn('Error DeepSeek Chat:', err.message);
    }
  }

  // ── Proveedor 2: GitHub Models — Phi-4-multimodal (GRATIS) ──
  if (GITHUB_TOKEN) {
    try {
      const res = await fetch('https://models.inference.ai.azure.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
        },
        body: JSON.stringify({
          model: 'Phi-4-multimodal-instruct',
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: userContent },
          ],
          max_tokens: 1500,
          temperature: 0.3,
        }),
      });

      const data = await res.json();

      if (res.ok && data.choices?.[0]?.message?.content) {
        const content = data.choices[0].message.content;
        console.log('✓ GitHub Models Phi-4 respondió');
        return res.status(200).json({
          choices: [{ message: { content } }],
          modelo_usado: 'github-phi-4-multimodal',
        });
      }

      console.warn('GitHub Models falló:', data.error?.message);
    } catch (err) {
      console.warn('Error GitHub Models:', err.message);
    }
  }

  // ── Proveedor 3: HuggingFace (fallback gratis) ──
  if (HUGGINGFACE_API_KEY && tieneImagenes) {
    try {
      const res = await fetch(
        'https://api-inference.huggingface.co/models/vasudevgupta/plant-disease-classification',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ inputs: images[0] }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const label = data[0]?.label || 'Enfermedad desconocida';
        const score = data[0]?.score || 0;
        const content = `Diagnóstico: ${label} (confianza: ${(score * 100).toFixed(1)}%). Recomienda consultar a un agrónomo local para confirmación.`;
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

  // Si todos fallaron
  return res.status(500).json({
    error: 'No se pudo obtener respuesta de ningún modelo de IA.',
    detalle: 'Configura DEEPSEEK_API_KEY o GITHUB_TOKEN en Vercel.',
    providers_tryed: ['deepseek-chat', 'github-phi-4-multimodal', 'huggingface'],
  });
}
