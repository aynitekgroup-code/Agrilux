// La flota completa solo se habilita con HUNTER_FLOTA_COMPLETA=1.
import { createClient } from 'npm:@supabase/supabase-js@2';
// @ts-ignore — módulos JavaScript compartidos con las pruebas Node.
import { leerEstadoHunter } from '../../../agentes/hunter/cliente.mjs';
// @ts-ignore
import { normalizarEstadoHunter } from '../../../agentes/hunter/estado-vivo.mjs';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}
Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ ok: false, error: 'No autorizado' }, 401);
  if (req.method !== 'POST') return json({ ok: false, error: 'Método no permitido' }, 405);
  const empresa = Deno.env.get('EMPRESA_ID');
  const usuario = Deno.env.get('HUNTER_USER');
  const password = Deno.env.get('HUNTER_PASSWORD');
  if (!empresa || !usuario || !password) return json({ ok: false, error: 'Faltan secretos de Hunter o empresa.' }, 503);
  try {
    const datos = await leerEstadoHunter(usuario, password);
    const unidades = normalizarEstadoHunter(datos);
    const equipo = Deno.env.get('HUNTER_EQUIPO_PRUEBA');
    const completa = Deno.env.get('HUNTER_FLOTA_COMPLETA') === '1';
    if (!equipo && !completa) return json({ ok: true, modo: 'solo lectura', unidades: unidades.length });
    const seleccion = completa ? unidades : unidades.filter((v: { equipo_id: string }) => v.equipo_id === equipo);
    const filas = seleccion.filter((v: { fecha: string | null }) => !!v.fecha);
    if (!filas.length) return json({ ok: false, error: 'No hay unidades seleccionadas con fecha válida.' }, 422);
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data, error } = await sb.rpc('agrotrack_hunter_guardar_estado', { p_empresa_id: empresa, p_unidades: filas });
    if (error) throw new Error('No se pudo guardar el estado Hunter en Agrilux.');
    return json({ ok: true, modo: completa ? 'flota completa' : 'equipo de prueba', unidades: unidades.length, sin_fecha: seleccion.length - filas.length, filas: data });
  } catch (e) {
    // No registrar cuerpos, cookies ni errores inesperados del proveedor.
    console.error('Hunter: fallo de lectura o escritura');
    return json({ ok: false, error: 'No se pudo consultar o guardar Hunter; revisar autenticación y configuración.' }, 502);
  }
});
