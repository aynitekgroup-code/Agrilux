import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const customFetch = (url, options) => {
  let u = typeof url === 'string' ? url : url?.url ?? String(url);
  if (u.includes('supabase.co')) {
    u = u.replace(/https?:\/\/[a-z0-9]+\.supabase\.co/, '/api/supabase-proxy');
  }
  return fetch(u, options);
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { fetch: customFetch },
});
export default supabase;
