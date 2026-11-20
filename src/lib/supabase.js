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

// ── Comprobación de conexión a Supabase ─────────────────────────────────────
// Realiza una consulta ligera sin exponer datos de otros usuarios.
// Diferencia errores de red, autenticación y permisos RLS.
export async function checkConnection() {
  const resultado = {
    connected: false,
    error: null,
    type: null, // 'network' | 'auth' | 'rls' | 'unknown'
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const { data, error } = await supabase
      .from('usuarios')
      .select('id')
      .limit(1)
      .abortSignal(controller.signal);

    clearTimeout(timeout);

    if (error) {
      const msg = String(error.message || '').toLowerCase();
      const code = String(error.code || '').toLowerCase();

      if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('timeout')) {
        resultado.type = 'network';
        resultado.error = 'No se pudo alcanzar el servidor de Supabase. Revisa tu conexión a internet.';
      } else if (msg.includes('invalid api key') || msg.includes('unauthorized') || code === '401') {
        resultado.type = 'auth';
        resultado.error = 'Credenciales de Supabase inválidas o expiradas.';
      } else if (msg.includes('row level security') || msg.includes('rls') || code === '42501') {
        resultado.type = 'rls';
        resultado.error = 'Supabase respondió, pero las políticas RLS bloquean la consulta.';
      } else {
        resultado.type = 'unknown';
        resultado.error = error.message || 'Error desconocido de Supabase.';
      }
      resultado.connected = false;
      return resultado;
    }

    resultado.connected = true;
    resultado.error = null;
    resultado.type = null;
    return resultado;
  } catch (e) {
    clearTimeout(timeout);
    const msg = String(e.message || '').toLowerCase();

    if (e.name === 'AbortError' || msg.includes('timeout')) {
      resultado.type = 'network';
      resultado.error = 'La conexión a Supabase excedió el tiempo de espera.';
    } else if (msg.includes('failed to fetch') || msg.includes('network')) {
      resultado.type = 'network';
      resultado.error = 'No se pudo alcanzar el servidor de Supabase. Revisa tu conexión a internet.';
    } else {
      resultado.type = 'unknown';
      resultado.error = e.message || 'Error inesperado al comprobar la conexión.';
    }
    resultado.connected = false;
    return resultado;
  }
}
