// api/admin-auth.js
// Validación server-side de la clave de administrador

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { clave } = req.body;
  if (!clave) return res.status(400).json({ error: 'Falta la clave' });

  const ADMIN_KEY = process.env.ADMIN_KEY || process.env.VITE_ADMIN_KEY;

  if (!ADMIN_KEY) {
    return res.status(500).json({ error: 'ADMIN_KEY no configurada en el servidor' });
  }

  if (clave === ADMIN_KEY) {
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({ ok: false, error: 'Clave incorrecta' });
}
