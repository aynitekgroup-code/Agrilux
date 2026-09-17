// api/mercadolibre.js — MercadoLibre proxy + Geocode + Product Search
// Vercel Hobby limit: 12 functions max

// Buscar productos en MercadoLibre con scraping ligero
async function buscarML(q, limit = 10) {
  // Intentar API de MercadoLibre
  try {
    const mlUrl = `https://api.mercadolibre.com/sites/MLU/search?q=${encodeURIComponent(q)}&limit=${limit}`;
    const response = await fetch(mlUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        return data.results.slice(0, limit).map(item => ({
          producto: item.title,
          precio: item.price,
          precio_original: item.original_price,
          descuento: item.original_price ? Math.round((1 - item.price / item.original_price) * 100) : null,
          tienda: item.seller?.nickname || 'MercadoLibre',
          url: item.permalink,
          imagen: item.thumbnail?.replace('http:', 'https:'),
          fuente: 'MercadoLibre',
          ubicacion: item.address?.state_name || 'Perú',
          envio_gratis: item.shipping?.free_shipping || false,
          ventas: item.sold_quantity || 0,
          rating: item.reviews?.rating_average || null,
        }));
      }
    }
  } catch (e) {
    // API falló, intentar scraping
  }

  // Fallback: generar cards de búsqueda
  const terminos = q.split(' ').slice(0, 3);
  return [{
    producto: q,
    precio: null,
    tienda: 'MercadoLibre',
    url: `https://listado.mercadolibre.com.pe/${encodeURIComponent(q.replace(/\s+/g, '-'))}`,
    imagen: null,
    fuente: 'MercadoLibre (búsqueda)',
    ubicacion: 'Perú',
  }];
}

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

  // ── Product search mode ──
  const q = url.searchParams.get('q');
  const limit = parseInt(url.searchParams.get('limit') || '10');

  if (!q) return res.status(400).json({ error: 'q required' });

  const results = await buscarML(q, limit);
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate');
  return res.status(200).json({ results, query: q });
}
