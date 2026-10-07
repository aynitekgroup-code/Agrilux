// api/daily-news.js
// Stub con CORS para que /descargar, NoticiasDiarias y la APK no fallen con 404.
// TODO: conectar a fuente real (SENASA/INIA) cuando esté lista.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  return res.status(200).json({
    success: true,
    noticias: [],
    stats: { total: 0 },
    mensaje: 'Servicio de noticias en preparación. Próximamente: SENASA, INIA y alertas fitosanitarias.',
    timestamp: new Date().toISOString(),
  });
}
