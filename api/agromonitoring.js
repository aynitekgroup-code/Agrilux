// api/agromonitoring.js
// Compatibilidad: el frontend antiguo (src/lib/agromonitoring.js) llama a
// /api/agromonitoring?action=geocode|weather. Este handler lo implementa
// con servicios gratuitos (Nominatim + Open-Meteo) para que no dé 404
// ni en web ni en la APK (con CORS habilitado).

export default async function handler(req, res) {
  // CORS para APK Capacitor (origen capacitor:// / https://localhost) y web
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const url = new URL(req.url, 'http://localhost');
  const action = url.searchParams.get('action') || 'weather';

  try {
    if (action === 'geocode') {
      const q = url.searchParams.get('q') || '';
      if (!q) return res.status(400).json({ error: 'Falta q' });
      const g = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=es&q=${encodeURIComponent(q)}`,
        { headers: { 'User-Agent': 'Agrilux/1.0' }, signal: AbortSignal.timeout(8000) }
      );
      const gd = await g.json();
      if (!gd.length) return res.status(404).json({ error: 'Ubicación no encontrada' });
      return res.status(200).json({ lat: parseFloat(gd[0].lat), lon: parseFloat(gd[0].lon), name: gd[0].display_name });
    }

    // action=weather
    const lat = parseFloat(url.searchParams.get('lat'));
    const lon = parseFloat(url.searchParams.get('lon'));
    if (!lat || !lon) return res.status(400).json({ error: 'Falta lat/lon' });
    const omRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=7`,
      { signal: AbortSignal.timeout(10000) }
    );
    const om = await omRes.json();
    return res.status(200).json({
      source: 'open-meteo',
      location: { lat, lon },
      current: om.current ? {
        temp: om.current.temperature_2m,
        temperature: om.current.temperature_2m,
        humidity: om.current.relative_humidity_2m,
        precip: om.current.precipitation,
        wind: om.current.wind_speed_10m,
        description: String(om.current.weather_code ?? ''),
      } : null,
      daily: om.daily || null,
      timezone: om.timezone || null,
    });
  } catch (e) {
    return res.status(500).json({ error: 'Error en agromonitoring: ' + e.message });
  }
}
