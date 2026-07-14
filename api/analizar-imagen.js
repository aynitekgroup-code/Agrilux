// api/analizar-imagen.js
// Análisis de imágenes: DeepSeek Chat → GitHub Models (Phi-4) → HuggingFace

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

  console.log('API Keys:', {
    deepseek: DEEPSEEK_API_KEY ? 'CONFIGURADA' : 'NO CONFIGURADA',
    github: GITHUB_TOKEN ? 'CONFIGURADA' : 'NO CONFIGURADA',
    huggingface: HUGGINGFACE_API_KEY ? 'CONFIGURADA' : 'NO CONFIGURADA',
  });

  const { images, prompt, systemPrompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Falta el campo prompt' });

  const tieneImagenes = Array.isArray(images) && images.length > 0;
  const imageSizes = tieneImagenes ? images.map(img => img?.length || 0) : [];
  console.log('Request:', {
    promptLength: prompt?.length,
    tieneImagenes,
    imageCount: images?.length || 0,
    imageSizes: imageSizes.slice(0, 3),
  });

  // Para DeepSeek, enviamos solo texto primero (sin imágenes para debug)
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
      // DeepSeek Chat: intentamos con imágenes, si falla, solo texto
      const bodyWithImages = {
        model: 'deepseek-chat',
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: userContent },
        ],
        max_tokens: 1500,
        temperature: 0.3,
      };

      const bodyTextOnly = {
        model: 'deepseek-chat',
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
        max_tokens: 1500,
        temperature: 0.3,
      };

      // Intentar primero con imágenes
      let res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify(tieneImagenes ? bodyWithImages : bodyTextOnly),
      });

      let data = await res.json();

      // Si falla con imágenes, intentar solo texto
      if (tieneImagenes && !res.ok) {
        console.log('DeepSeek falló con imágenes, intentando solo texto...');
        res = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify(bodyTextOnly),
        });
        data = await res.json();
      }

      console.log('DeepSeek response:', {
        status: res.status,
        ok: res.ok,
        hasChoices: !!data.choices,
        errorMessage: data.error?.message,
      });

      if (res.ok && data.choices?.[0]?.message?.content) {
        const content = data.choices[0].message.content;
        console.log('✓ DeepSeek Chat respondió');
        return res.status(200).json({
          choices: [{ message: { content } }],
          modelo_usado: 'deepseek-chat',
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

      console.log('GitHub response:', {
        status: res.status,
        ok: res.ok,
        hasChoices: !!data.choices,
        errorMessage: data.error?.message,
      });

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
  console.error('Todos los providers fallaron:', {
    deepseek: DEEPSEEK_API_KEY ? 'intentado' : 'no configurado',
    github: GITHUB_TOKEN ? 'intentado' : 'no configurado',
    huggingface: HUGGINGFACE_API_KEY ? 'intentado' : 'no configurado',
  });

  return res.status(500).json({
    error: 'No se pudo obtener respuesta de ningún modelo de IA.',
    detalle: 'Configura DEEPSEEK_API_KEY o GITHUB_TOKEN en Vercel.',
    providers_tryed: ['deepseek-chat', 'github-phi-4-multimodal', 'huggingface'],
  });
}
