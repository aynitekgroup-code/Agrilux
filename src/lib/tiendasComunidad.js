import { supabase } from './supabase';

async function eliminarColeccion(nombre) {
  const { data, error } = await supabase.from(nombre).select('id');
  if (error) throw error;
  const docs = data || [];
  if (docs.length === 0) return 0;
  const ids = docs.map(d => d.id);
  // Supabase delete requires filter; delete in chunks
  const BATCH = 200;
  let eliminados = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const { error: delErr } = await supabase.from(nombre).delete().in('id', chunk);
    if (delErr) throw delErr;
    eliminados += chunk.length;
  }
  return eliminados;
}

/** Elimina todas las tiendas de mercado (tiendas_comunidad) y sus precios históricos. */
export async function eliminarTodasTiendasComunidad() {
  const precios = await eliminarColeccion('precios_historicos');
  const tiendas = await eliminarColeccion('tiendas_comunidad');
  return { tiendas, precios };
}
