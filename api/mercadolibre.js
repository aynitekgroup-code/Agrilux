// api/mercadolibre.js — MercadoLibre proxy + Geocode (merged from geocode.js)
// Vercel Hobby limit: 12 functions max

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  const url = new URL(req.url, 'http://localhost');
  const type = url.searchParams.get('type');

  // ── Geocode mode ──
  if (type === 'geocode') {
    const query = url.searchParams.get('q');
    const lat = url.searchParams.get('lat');
    const lon = url.searchParams.get('lon');

    if (lat && lon) {
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=es`,
          { headers: { 'User-Agent': 'Agrilux/1.0 (https://agrilux.example)' } }
        );
        const data = await r.json();
        if (data.error) return res.status(404).json({ error: data.error });
        return res.status(200).json({
          name: data.display_name, lat: data.lat, lon: data.lon,
          type: data.type, address: data.address,
        });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    }

    if (!query) return res.status(400).json({ error: 'Falta el parámetro q' });
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&accept-language=es&q=${encodeURIComponent(query)}`,
        { headers: { 'User-Agent': 'Agrilux/1.0 (https://agrilux.example)' } }
      );
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0)
        return res.status(404).json({ error: 'No se encontró la ubicación' });
      const place = data[0];
      return res.status(200).json({
        name: place.display_name, lat: place.lat, lon: place.lon,
        type: place.type, address: place.address,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // ── MercadoLibre mode (default) ──
  const q = url.searchParams.get('q');
  const limit = url.searchParams.get('limit') || 10;
  const sort = url.searchParams.get('sort') || 'relevance';

  if (!q) return res.status(400).json({ error: 'q required' });

  try {
    const mlUrl = `https://api.mercadolibre.com/sites/MLU/search?q=${encodeURIComponent(q)}&limit=${limit}&sort=${sort}`;
    const response = await fetch(mlUrl, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Agrilux/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return res.status(response.status).json({ error: `ML ${response.status}` });
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
