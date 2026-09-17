// Merged into mercadolibre.js — this file redirects to avoid Vercel Hobby 12-function limit
export default async function handler(req, res) {
  // Proxy to mercadolibre.js with geocode type
  const url = new URL(req.url, 'http://localhost');
  const target = `/api/mercadolibre?type=geocode&${url.searchParams.toString()}`;
  try {
    const resp = await fetch(`https://${req.headers.host}${target}`);
    const data = await resp.json();
    return res.status(resp.status).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
