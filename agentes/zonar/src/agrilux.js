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

/**
 * Latido del agente (scripts/agrotrack-tiempo-real.sql): la web muestra
 * "Zonar leído hace N min". Si el SQL aún no se ejecutó, no hace nada.
 */
export async function registrarLatido(agrilux, modo, { ok = true, unidades = null, nuevas = null, mensaje = null } = {}) {
  const { error } = await agrilux.supabase.rpc('agrotrack_registrar_latido', {
    p_empresa_id: agrilux.empresaId,
    p_modo: modo,
    p_ok: ok,
    p_unidades: unidades,
    p_nuevas: nuevas,
    p_mensaje: mensaje ? String(mensaje).slice(0, 500) : null,
  });
  if (error && !/could not find|schema cache/i.test(error.message || '')) {
    throw traducirError(error);
  }
}

/**
 * Calcula y GUARDA las visitas a geocercas pendientes del rango
 * (scripts/agrotrack-visitas-diarias.sql), de a una placa por llamada para
 * no chocar con el límite de 8 s. Devuelve cuántos (día, placa) calculó.
 */
export async function calcularVisitasPendientes(agrilux, desdeDia, hastaDia, log = null) {
  const { data: pendientes, error } = await agrilux.supabase.rpc('agrotrack_visitas_dia_pendientes', {
    p_empresa_id: agrilux.empresaId,
    p_desde_dia: desdeDia,
    p_hasta_dia: hastaDia,
  });
  if (error) {
    if (/could not find|schema cache/i.test(error.message || '')) return 0;
    throw traducirError(error);
  }
  let hechas = 0;
  for (const p of pendientes || []) {
    const { error: e2 } = await agrilux.supabase.rpc('agrotrack_calcular_visitas_dia', {
      p_empresa_id: agrilux.empresaId,
      p_dia: p.dia,
      p_placa: p.placa,
    });
    if (e2) log?.aviso?.(`  visitas ${p.placa} ${p.dia}: ${e2.message}`);
    else hechas += 1;
  }
  return hechas;
}
