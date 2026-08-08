// api/senamhi.js
// Proxy al scraping de SENAMHI para clima real de Perú

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'Faltan parámetros lat y lon' });

  try {
    const r = await fetch('https://www.senamhi.gob.pe/?p=pronostico-meteorologico', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!r.ok) return res.status(502).json({ error: 'SENAMHI no disponible' });

    const html = await r.text();
    const regex = /([A-ZÁÉÍÓÚÑ\s]+)\s*-\s*([A-ZÁÉÍÓÚÑ\s]+)[\s\S]*?(-?\d{1,2})\s*º\s*C[\s\S]*?(-?\d{1,2})\s*º\s*C[\s\S]*?([^.]+\.\s*[^.]*\.?)/gi;
    const match = regex.exec(html);

    if (match) {
      return res.status(200).json({
        estacion: match[1].trim(),
        departamento: match[2].trim(),
        tempMax: parseInt(match[3]),
        tempMin: parseInt(match[4]),
        descripcion: match[5].trim(),
      });
    }

    return res.status(200).json({ estacion: null, mensaje: 'No se encontró pronóstico para esta ubicación' });
  } catch (e) {
    return res.status(500).json({ error: 'Error al obtener datos SENAMHI: ' + e.message });
  }
}
