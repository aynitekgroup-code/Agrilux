/**
 * agentes/zonar/src/agrilux.js
 * Sesión de Agrilux (Supabase Auth con correo/contraseña — el mismo login que
 * la web) y subida de posiciones a agrotrack_posiciones.
 *
 * Se reutiliza el mismo mecanismo que "Cargar reporte de unidades":
 * upsert con onConflict (empresa_id, source_key) + ignoreDuplicates, así lo que
 * ya cargó Carlos a mano no se duplica.
 */
import { createClient } from '@supabase/supabase-js';

const TAM_LOTE = 1000;

/** Traduce errores de Supabase a instrucciones claras en español. */
function traducirError(error) {
  const codigo = String(error?.code || '');
  const msg = String(error?.message || error || 'error desconocido');
  if (codigo === '42P01' || /schema cache|does not exist/i.test(msg)) {
    return new Error('Falta la tabla agrotrack_posiciones. Ejecuta scripts/agrotrack-posiciones.sql en el SQL Editor de Supabase.');
  }
  if (codigo === '42501' || /row level security|rls/i.test(msg)) {
    return new Error(`Agrilux rechazó la carga por permisos (RLS): ${msg}`);
  }
  if (/invalid login credentials|email not confirmed/i.test(msg)) {
    return new Error(`Agrilux: correo o contraseña incorrectos (${msg}). Revisa configurar.mjs.`);
  }
  return new Error(`Agrilux: ${msg}`);
}

/**
 * Inicia sesión en Agrilux y resuelve la empresa activa.
 * @returns {Promise<{supabase: object, userId: string, empresaId: string}>}
 */
export async function conectarAgrilux(a) {
  const supabase = createClient(a.url, a.anon_key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(a.email).trim().toLowerCase(),
    password: a.password,
  });
  if (error) throw traducirError(error);
  const userId = data?.user?.id;
  if (!userId) throw new Error('Agrilux no devolvió usuario de sesión.');

  let empresaId = a.empresa_id || null;
  if (!empresaId) {
    const { data: membresias, error: errM } = await supabase
      .from('empresa_miembros')
      .select('empresa_id, activo')
      .eq('user_id', userId)
      .eq('activo', true);
    if (errM) throw traducirError(errM);
    if (!membresias?.length) {
      throw new Error('El usuario de Agrilux no pertenece a ninguna empresa activa.');
    }
    empresaId = membresias[0].empresa_id;
  }

  return { supabase, userId, empresaId };
}

/**
 * Sube las posiciones en lotes de 1000, deduplicadas por (empresa_id, source_key).
 * @param {Array<object>} filas filas ya construidas con armarFilaZonar().row
 * @returns {Promise<number>} cuántas filas NUEVAS insertó (las repetidas se omiten)
 */
export async function subirPosiciones(supabase, filas, onLote) {
  let nuevas = 0;
  for (let i = 0; i < filas.length; i += TAM_LOTE) {
    const lote = filas.slice(i, i + TAM_LOTE);
    const { data, error } = await supabase
      .from('agrotrack_posiciones')
      .upsert(lote, { onConflict: 'empresa_id,source_key', ignoreDuplicates: true })
      .select('id');
    if (error) throw traducirError(error);
    nuevas += data?.length ?? 0;
    onLote?.(Math.min(i + lote.length, filas.length), filas.length, nuevas);
  }
  return nuevas;
}
