import { createClient } from '@supabase/supabase-js';

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co')
  .trim()
  .replace(/^['"]|['"]$/g, '')
  .replace(/\/+$/, '');
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

const customFetch = (url, options = {}) => {
  let u = typeof url === 'string' ? url : url?.url ?? String(url);
  if (u && u.includes('supabase.co')) {
    u = u.replace(/https?:\/\/[a-z0-9]+\.supabase\.co/, '/api/supabase-proxy');
    const headers = new Headers(options.headers || {});
    if (!headers.has('apikey')) headers.set('apikey', supabaseKey);
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${supabaseKey}`);
    if (!headers.has('Accept')) headers.set('Accept', 'application/json');
    options = { ...options, headers };
  }
  return fetch(u, options);
};

let client;
try {
  client = createClient(supabaseUrl, supabaseKey, {
    global: { fetch: customFetch },
  });
} catch (e) {
  console.error('Error creating Supabase client:', e);
  client = {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: new Error('Supabase not configured') })
        })
      })
    })
  };
}

export const supabase = client;
export default supabase;
