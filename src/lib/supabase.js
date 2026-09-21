import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const customFetch = (url, options = {}) => {
  let u = typeof url === 'string' ? url : url?.url ?? String(url);
  if (u.includes('supabase.co')) {
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
