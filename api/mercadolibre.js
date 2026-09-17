export default async function handler(req, res) {
  const { q, limit = 10, sort = 'relevance' } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Parámetro q requerido' });
  }

  try {
    const url = `https://api.mercadolibre.com/sites/MLU/search?q=${encodeURIComponent(q)}&limit=${limit}&sort=${sort}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Agrilux/1.0'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `MercadoLibre respondió ${response.status}` });
    }

    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
