import { createClient } from 'npm:@supabase/supabase-js@2';
// @ts-ignore: cliente compartido con las pruebas Node.
import { leerRecorridoHunter } from '../../../agentes/hunter/cliente.mjs';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return json({ error: 'Inicia sesión.' }, 401);
  const empresa = Deno.env.get('EMPRESA_ID');
  const usuario = Deno.env.get('HUNTER_USER');
  const password = Deno.env.get('HUNTER_PASSWORD');
  if (!empresa || !usuario || !password) return json({ error: 'Hunter no está configurado.' }, 503);
  try {
    const cliente = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: identidad, error: errAuth } = await cliente.auth.getUser();
    if (errAuth || !identidad.user) return json({ error: 'Sesión inválida.' }, 401);
    const { data: miembro, error: errMiembro } = await cliente.rpc('onboarding_es_miembro', { p_empresa_id: empresa });
    if (errMiembro || miembro !== true) return json({ error: 'Sin acceso a esta empresa.' }, 403);
    const { equipo, dia } = await req.json();
    if (!/^\d{1,24}$/.test(String(equipo || '')) || !/^\d{4}-\d{2}-\d{2}$/.test(String(dia || ''))) return json({ error: 'Equipo o fecha inválidos.' }, 400);
    const { data: unidad, error: errUnidad } = await cliente.from('agrotrack_hunter_estado_vivo').select('equipo_id').eq('empresa_id', empresa).eq('equipo_id', String(equipo)).maybeSingle();
    if (errUnidad || !unidad) return json({ error: 'Equipo no disponible para esta empresa.' }, 403);
    const captura = await leerRecorridoHunter(usuario, password, { equipo: String(equipo), dia });
    return json(captura);
  } catch {
    console.error('Error al consultar recorrido Hunter');
    return json({ error: 'No se pudo consultar Hunter. Revisa la fecha o intenta nuevamente.' }, 502);
  }
});
