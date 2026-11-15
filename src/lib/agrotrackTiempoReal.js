/**
 * src/lib/agrotrackTiempoReal.js
 * Datos EN VIVO que llegan de Zonar por el agente (node agente.mjs envivo):
 *   - agrotrack_estado_vivo_flota  : última posición de cada placa + geocerca actual
 *   - agrotrack_zonar_latidos      : cuándo leyó el agente Zonar por última vez
 *   - Supabase Realtime            : avisa a la web apenas cambia una posición
 * Ver scripts/agrotrack-tiempo-real.sql.
 */
import { supabase } from './supabase';

export const AVISO_SQL_TIEMPO_REAL =
  'Falta ejecutar scripts/agrotrack-tiempo-real.sql en Supabase para ver los datos en tiempo real.';

/** Minutos sin latido del agente a partir de los cuales se avisa. */
export const MINUTOS_LATIDO_VIEJO = 10;

function faltaFuncion(error) {
  const t = String(error?.message || '');
  return error?.code === 'PGRST202' || error?.code === '42P01' || /could not find|schema cache|does not exist/i.test(t);
}

/**
 * Filas con la MISMA forma que agrotrack_estado_unidades_flota, para que la
 * tabla de "Status de maquinaria" no cambie.
 */
export async function obtenerEstadoVivo(empresaId) {
  if (!empresaId) return [];
  const { data, error } = await supabase.rpc('agrotrack_estado_vivo_flota', { p_empresa_id: empresaId });
  if (error) throw new Error(faltaFuncion(error) ? AVISO_SQL_TIEMPO_REAL : `No se pudo leer el estado en vivo: ${error.message}`);
  return (data || []).map((f) => ({
    placa: f.placa,
    unidad: f.unidad,
    descripcion: f.descripcion,
    ultima_fecha: f.fecha,
    ultimo_evento: f.evento,
    ultima_velocidad: f.velocidad,
    direccion: f.direccion,
    latitud: f.latitud,
    longitud: f.longitud,
    geocerca: f.geocerca,
    geocerca_division: f.geocerca_division,
    geocerca_ultima: null,
    geocerca_ultima_fecha: null,
    estado_vivo: f.estado,
    minutos_sin_reportar: f.minutos_sin_reportar,
  }));
}

/** Latidos del agente { envivo: {...}, diario: {...} } (null si no hay tabla). */
export async function obtenerLatidos(empresaId) {
  if (!empresaId) return null;
  const { data, error } = await supabase
    .from('agrotrack_zonar_latidos')
    .select('modo, ultima_lectura, ok, unidades, nuevas, mensaje')
    .eq('empresa_id', empresaId);
  if (error) return null;
  const latidos = {};
  (data || []).forEach((l) => { latidos[l.modo] = l; });
  return latidos;
}

/**
 * Número de canal: hace único el nombre de cada suscripción (ver abajo).
 */
let suscripcionSeq = 0;

/**
 * Se suscribe a los cambios de agrotrack_estado_vivo de la empresa.
 *
 * 15/11/2026 — El nombre del canal DEBE ser único por suscriptor:
 * `supabase.channel(topic)` devuelve el canal ya existente cuando el topic se
 * repite (RealtimeClient.channel busca en getChannels()), y si ese canal ya
 * está suscrito, `.on()` lanza "cannot add `postgres_changes` callbacks ...
 * after `subscribe()`". Como la consola (AgroTrackPomalcaPage) y el reporte
 * "Status de maquinaria" (FleetUnitStatus) usaban el mismo topic
 * `estado-vivo-<empresa>`, abrir Reportes lanzaba la excepción dentro de un
 * useEffect y React desmontaba la app entera: pantalla en blanco.
 *
 * Además, cualquier fallo al crear el canal se ignora: el reporte se refresca
 * igual cada 60 s, así que Realtime es una mejora, nunca un requisito.
 *
 * @returns {() => void} función para cancelar la suscripción
 */
export function suscribirEstadoVivo(empresaId, onCambio) {
  if (!empresaId || typeof supabase?.channel !== 'function') return () => {};
  suscripcionSeq += 1;
  const topic = `estado-vivo-${empresaId}-${suscripcionSeq}-${Math.random().toString(36).slice(2, 8)}`;
  let canal = null;
  try {
    canal = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agrotrack_estado_vivo', filter: `empresa_id=eq.${empresaId}` },
        () => onCambio?.(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agrotrack_zonar_latidos', filter: `empresa_id=eq.${empresaId}` },
        () => onCambio?.(),
      )
      .subscribe();
  } catch (e) {
    console.warn('Tiempo real no disponible (se sigue refrescando cada 60 s):', e?.message || e);
    return () => {};
  }
  return () => {
    try {
      supabase.removeChannel(canal);
    } catch {
      /* mejor esfuerzo */
    }
  };
}

/** "hace 3 min" del latido y si está viejo. */
export function describirLatido(latido, ahora = new Date()) {
  if (!latido?.ultima_lectura) {
    return { texto: 'El agente de Zonar aún no ha enviado datos en vivo', viejo: true };
  }
  const min = Math.max(0, Math.floor((ahora.getTime() - Date.parse(latido.ultima_lectura)) / 60000));
  const hace = min < 1 ? 'hace instantes' : min < 60 ? `hace ${min} min` : `hace ${Math.floor(min / 60)} h ${min % 60} min`;
  return {
    texto: `Zonar leído ${hace}${latido.ok === false ? ' · último intento con error' : ''}`,
    viejo: min >= MINUTOS_LATIDO_VIEJO || latido.ok === false,
  };
}
