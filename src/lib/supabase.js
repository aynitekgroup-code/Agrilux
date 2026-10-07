import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const customFetch = (url, options = {}) => {
  let u = typeof url === 'string' ? url : url?.url ?? String(url);
  // En APK nativo NO usar el proxy /api (evita un salto y fallos de rewrite):
  // Supabase ya permite CORS, así que se llama directo.
  const esNativo =
    window.Capacitor?.isNativePlatform?.() ||
    location.protocol === 'capacitor:' ||
    location.protocol === 'file:' ||
    (location.hostname === 'localhost' && !!window.Capacitor);
  if (u.includes('supabase.co') && !esNativo) {
    u = u.replace(/https?:\/\/[a-z0-9]+\.supabase\.co/, '/api/supabase-proxy');
    const headers = new Headers(options.headers || {});
    if (!headers.has('apikey')) headers.set('apikey', supabaseKey);
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${supabaseKey}`);
    if (!headers.has('Accept')) headers.set('Accept', 'application/json');
    options = { ...options, headers };
  }
  return fetch(u, options);
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { fetch: customFetch },
});
export default supabase;
