import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Proxy para ISPs que bloquean *.supabase.co (DNS NXDOMAIN)
const customFetch = (url, options) => {
  let u = typeof url === 'string' ? url : url.url;
  if (u.includes('rtznwwgggjqcfjzqsax.supabase.co')) {
    u = u.replace('https://rtznwwgggjqcfjzqsax.supabase.co', '/api/supabase-proxy');
  }
  return fetch(u, options);
};

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { fetch: customFetch },
});
export default supabase;
