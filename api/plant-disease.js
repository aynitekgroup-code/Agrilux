// api/plant-disease.js
// Identificación de enfermedades de plantas
// Cadena: Crop.health (kindwise) → Plant.id → HuggingFace (fallback)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { images } = req.body;
  if (!images || !images.length) return res.status(400).json({ error: 'Falta el campo images' });

  const CROP_HEALTH_API_KEY = process.env.CROP_HEALTH_API_KEY;
  const PLANT_ID_API_KEY = process.env.PLANT_ID_API_KEY;
  const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

  // Si ningún proveedor está configurado, retornar 204 (no content)
  if (!CROP_HEALTH_API_KEY && !PLANT_ID_API_KEY && !HUGGINGFACE_API_KEY) {
    return res.status(204).end();
  }

  // 1. Intentar con Crop.health (kindwise) — especializado en cultivos
  if (CROP_HEALTH_API_KEY) {
    try {
      const r = await fetch('https://plant.id/api/v3/identification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': CROP_HEALTH_API_KEY,
        },
        body: JSON.stringify({
          images: images.slice(0, 1),
          modifiers: ['crops'],
          latitude: null,
          longitude: null,
        }),
      });
      const data = await r.json();
      if (r.ok && data.result) {
        return res.status(200).json({
          provider: 'crop.health',
          nombre: data.result.classification?.suggestions?.[0]?.name || 'Desconocido',
          confianza: data.result.classification?.suggestions?.[0]?.probability || 0,
          detalles: data.result.classification?.suggestions?.slice(0, 3) || [],
          es_enfermedad: data.result.is_healthy === false,
        });
      }
    } catch (e) {
      console.warn('Crop.health error:', e.message);
    }
  }

  // 2. Intentar con Plant.id — generalista
  if (PLANT_ID_API_KEY) {
    try {
      const r = await fetch('https://plant.id/api/v3/identification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': PLANT_ID_API_KEY,
        },
        body: JSON.stringify({
          images: images.slice(0, 1),
        }),
      });
      const data = await r.json();
      if (r.ok && data.result) {
        return res.status(200).json({
          provider: 'plant.id',
          nombre: data.result.classification?.suggestions?.[0]?.name || 'Desconocido',
          confianza: data.result.classification?.suggestions?.[0]?.probability || 0,
          detalles: data.result.classification?.suggestions?.slice(0, 3) || [],
          es_enfermedad: data.result.is_healthy === false,
        });
      }
    } catch (e) {
      console.warn('Plant.id error:', e.message);
    }
  }

  // 3. Intentar con HuggingFace — fallback gratuito
  if (HUGGINGFACE_API_KEY) {
    try {
      const imageUrl = images[0];
      const r = await fetch(
        'https://api-inference.huggingface.co/models/vasudevgupta/plant-disease-classification',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ inputs: imageUrl }),
        }
      );
      const data = await r.json();
      if (r.ok && Array.isArray(data)) {
        const top = data[0];
        return res.status(200).json({
          provider: 'huggingface',
          nombre: top.label || 'Desconocido',
          confianza: top.score || 0,
          detalles: data.slice(0, 3),
          es_enfermedad: true,
        });
      }
    } catch (e) {
      console.warn('HuggingFace error:', e.message);
    }
  }

  return res.status(200).json({
    provider: null,
    nombre: 'No se pudo identificar',
    confianza: 0,
    detalles: [],
    es_enfermedad: false,
    mensaje: 'Ningún proveedor devolvió resultados válidos',
  });
}
