export default async function handler(req, res) {
  const supabaseHost = 'https://rtznwwgggjqcfjzqsax.supabase.co';
  const targetPath = req.url.replace(/^\/api\/supabase-proxy/, '');
  const targetUrl = `${supabaseHost}${targetPath}`;

  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;
  delete headers['content-length'];

  const opts = {
    method: req.method,
    headers,
  };
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
    opts.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }
  // Para raw body en Vercel, usar stream
  if (req.method !== 'GET' && !opts.body && req.readable) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (chunks.length) opts.body = Buffer.concat(chunks);
  }

  try {
    const r = await fetch(targetUrl, opts);
    const body = await r.arrayBuffer();
    res.status(r.status);
    r.headers.forEach((v, k) => {
      if (!['content-encoding','content-length','transfer-encoding'].includes(k.toLowerCase())) {
        res.setHeader(k, v);
      }
    });
    res.send(Buffer.from(body));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export const config = { api: { bodyParser: false } };
