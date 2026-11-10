-- Reportes de actividad de flota (FASE 3) a partir de public.agrotrack_posiciones.
-- Ejecutar completo en el SQL Editor de Supabase. Es repetible e idempotente:
-- no borra ni modifica datos, ni toca RLS, ni la tabla agrotrack_posiciones,
-- ni agrotrack_geocercas, ni las funciones de scripts/agrotrack-posiciones-resumen.sql.
--
-- Réplica de lo que el Ing. Carlos Perez pidió textualmente de Zonar:
--   "reporte de actividad... que salga el reporte por día, y por ralentí,
--    hora de viaje y encendido, y recorrido por separado y por mes"
-- Cubre 4 de los 95 reportes de Zonar (los 4 pedidos):
--   Actividades Sumarizado (por día) · Actividades por mes ·
--   Ralentí · Horas de viaje / encendido (recorrido en km aparte).
--
-- MISMA receta que agrotrack-posiciones-resumen.sql:
--   * SECURITY DEFINER + validación de membresía con
--     public.onboarding_es_miembro(p_empresa_id) evaluada UNA sola vez
--     (un no-miembro recibe 0 filas sin recorrer la tabla con RLS fila a fila).
--   * Todo el cálculo ocurre en SQL: PostgREST devuelve máximo 1000 filas.
--   * Los grants no afectan a RLS ni a las políticas existentes.
--
-- ---------------------------------------------------------------------------
-- CRITERIOS (definidos en UN solo lugar: este archivo)
-- ---------------------------------------------------------------------------
--   Rango        : p_desde / p_hasta (null = todo el histórico cargado).
--                  La consola manda día completo 00:00–23:59 hora de Perú.
--   Continuidad  : un tramo solo cuenta si el intervalo con el punto anterior
--                  es <= 10 minutos (mismo umbral del cálculo de km).
--   Encendido    : el evento NO indica estacionado ni apagado
--                  ("%estacionad%" / "%apagad%" cubre "Estacionado",
--                   "Ignición Apagada", "Apagado", "Viaje detenido" no aplica).
--   Viaje        : encendido y velocidad > 5 km/h  (UMBRAL_VIAJE_KMH = 5)
--   Ralentí      : encendido y velocidad <= 5 km/h (UMBRAL_RALENTI_KMH = 5)
--                  -> por construcción  encendido = viaje + ralentí.
--   Recorrido    : haversine entre puntos consecutivos (orden fecha, secuencia)
--                  descartando duplicados, saltos > 600 s y >= 5 km.
--   Duplicados   : mismo (fecha, secuencia) repetidos al recargar el reporte.
--   Día/Mes      : fecha at time zone 'America/Lima' (UTC-5, sin DST).
--   Primer tramo : el primer punto del rango no tiene anterior, así que no
--                  aporta tiempo (como máximo 10 min por unidad y rango).
--
-- El umbral de 5 km/h es una decisión de negocio: cambiar UMBRAL_VIAJE_KMH /
-- UMBRAL_RALENTI_KMH más abajo cambia el reporte completo, nunca se duplica
-- el criterio en el código de la interfaz.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1) Reporte de actividad por unidad, agrupado por día, por mes o total.
--
--    p_agrupar: 'dia'   -> una fila por unidad y día   ('2026-11-05')
--               'mes'   -> una fila por unidad y mes   ('2026-11')
--               'unidad'-> una fila por unidad en todo el rango (periodo null)
--
--    Aviso PostgREST: 39 unidades x 31 días = 1209 filas > 1000. La consola
--    usa 'mes' cuando el rango supera ~40 días y 'unidad' para los totales
--    que consume el resumen de IA; p_limita corta el exceso de forma ordenada.
--
--    Aviso de rendimiento: SIEMPRE conviene mandar p_desde / p_hasta (el
--    índice agrotrack_posiciones_empresa_fecha_idx recorta el rango). Con
--    rango nulo la función recorre las +103 mil filas completas: ahí estaba
--    el statement timeout de 8 s de Supabase.
-- ---------------------------------------------------------------------------
drop function if exists public.agrotrack_actividad_flota(uuid, timestamptz, timestamptz, text, text, integer);

create function public.agrotrack_actividad_flota(
  p_empresa_id uuid,
  p_desde      timestamptz default null,
  p_hasta      timestamptz default null,
  p_placa      text        default null,
  p_agrupar    text        default 'dia',
  p_limite     integer     default 1000
)
returns table (
  periodo            text,          -- 'YYYY-MM-DD' | 'YYYY-MM' | null (total)
  placa              text,
  unidad             text,
  km_recorridos      numeric,       -- recorrido del periodo
  encendido_segundos bigint,        -- horas de encendido del motor
  viaje_segundos     bigint,        -- hora de viaje
  ralenti_segundos   bigint,        -- tiempo en ralentí
  vel_max_kmh        numeric,       -- velocidad máxima punta
  alertas            bigint,        -- alta velocidad (apertura) + botón de pánico
  posiciones         bigint         -- puntos leídos (densidad del reporte)
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with base as (
    select
      p.id, p.placa, p.unidad, p.fecha, p.secuencia, p.evento,
      p.velocidad, p.latitud, p.longitud
    from public.agrotrack_posiciones p
    -- Misma regla que la RLS, evaluada UNA sola vez: un no-miembro ve 0 filas.
    where (select public.onboarding_es_miembro(p_empresa_id))
      and p.empresa_id = p_empresa_id
      and (p_placa is null or p.placa = p_placa)
      and (p_desde is null or p.fecha >= p_desde)
      and (p_hasta is null or p.fecha <= p_hasta)
  ),
  -- Estado de cada punto según el criterio único de la cabecera.
  puntos as (
    select
      b.*,
      -- motor encendido: el evento no dice estacionado ni apagado
      (not (lower(b.evento) like '%estacionad%'
         or lower(b.evento) like '%apagad%'))                    as encendido,
      -- en viaje: encendido y por encima del umbral
      (not (lower(b.evento) like '%estacionad%'
         or lower(b.evento) like '%apagad%'))
        and coalesce(b.velocidad, 0) > 5                         as es_viaje
    from base b
  ),
  -- UNA sola ventana: con ella salen el tramo anterior (lag), el detector de
  -- duplicados y la distancia, igual que agrotrack_resumen_flota.
  tramos as (
    select
      q.*,
      lag(q.latitud)                over ventana as prev_lat,
      lag(q.longitud)               over ventana as prev_lon,
      lag(q.fecha)                  over ventana as prev_fecha,
      lag(coalesce(q.secuencia, 0)) over ventana as prev_sec,
      lag(q.es_viaje)               over ventana as prev_viaje
    from puntos q
    window ventana as (
      partition by q.placa
      order by q.fecha, coalesce(q.secuencia, 0), q.id
    )
  ),
  calculado as (
    select
      t.*,
      -- Es la segunda (o tercera…) vez que vemos ese punto: reporte repetido.
      (t.prev_fecha is not null
        and t.prev_fecha = t.fecha
        and coalesce(t.secuencia, 0) = coalesce(t.prev_sec, 0))  as es_duplicado,
      case
        when t.prev_fecha is null then null
        when t.prev_fecha = t.fecha
          and coalesce(t.secuencia, 0) = coalesce(t.prev_sec, 0) then 0
        when extract(epoch from (t.fecha - t.prev_fecha)) > 600 then null
        else extract(epoch from (t.fecha - t.prev_fecha))
      end                                                        as dt_segundos,
      case
        when t.prev_lat is null or t.prev_fecha is null then null
        when t.prev_fecha = t.fecha
          and coalesce(t.secuencia, 0) = coalesce(t.prev_sec, 0) then null
        when extract(epoch from (t.fecha - t.prev_fecha)) > 600 then null
        -- Haversine inlineado (mismo motivo que en agrotrack_resumen_flota)
        else 2.0 * 6371.0 * asin(least(1.0, sqrt(
          power(sin(radians(t.latitud - t.prev_lat) / 2.0), 2) +
          cos(radians(t.prev_lat)) * cos(radians(t.latitud)) *
          power(sin(radians(t.longitud - t.prev_lon) / 2.0), 2)
        )))
      end                                                        as dist_km
    from tramos t
  )
  select
    case
      when lower(coalesce(p_agrupar, 'dia')) = 'unidad' then null
      when lower(p_agrupar) = 'mes'
        then to_char(c.fecha at time zone 'America/Lima', 'YYYY-MM')
      else to_char(c.fecha at time zone 'America/Lima', 'YYYY-MM-DD')
    end                                                as periodo,
    c.placa                                            as placa,
    max(c.unidad)                                      as unidad,
    -- Recorrido: mismas reglas que agrotrack_resumen_flota (<= 10 min, < 5 km).
    coalesce(round(sum(
      case
        when c.dist_km is null or c.dist_km >= 5 then 0::double precision
        else c.dist_km
      end
    )::numeric, 2), 0)                                 as km_recorridos,
    -- Encendido = viaje + ralentí (los tres son coherentes por construcción).
    coalesce((sum(c.dt_segundos) filter (where c.encendido))::bigint, 0)   as encendido_segundos,
    coalesce((sum(c.dt_segundos) filter (where c.es_viaje))::bigint, 0)    as viaje_segundos,
    coalesce((sum(c.dt_segundos) filter (where c.encendido and not c.es_viaje))::bigint, 0)
                                                                         as ralenti_segundos,
    max(c.velocidad)                                   as vel_max_kmh,
    -- Mismo filtro de alertas que agrotrack_alertas_flota: "Alta velocidad"
    -- cuenta, "Fin de alta velocidad" es el cierre y no.
    count(*) filter (
      where not c.es_duplicado
        and (
          (lower(c.evento) like '%alta velocidad%'
            and lower(c.evento) not like 'fin%')
          or lower(c.evento) like '%pánico%'
          or lower(c.evento) like '%panico%'
        )
    )                                                  as alertas,
    count(*)                                           as posiciones
  from calculado c
  -- Ordinal 1 = periodo: agrupa por el período calculado sin repetir la fórmula.
  group by 1, c.placa
  order by 1 desc nulls last, c.placa
  limit greatest(coalesce(p_limite, 1000), 1);
$$;

grant execute on function public.agrotrack_actividad_flota(uuid, timestamptz, timestamptz, text, text, integer)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Comprobaciones (opcionales):
--   select * from public.agrotrack_actividad_flota('<empresa_id>',
--     '2026-11-01T00:00:00-05:00', '2026-11-01T23:59:59-05:00', null, 'dia');
--   select * from public.agrotrack_actividad_flota('<empresa_id>',
--     '2026-11-01T00:00:00-05:00', '2026-11-30T23:59:59-05:00', null, 'mes');
--   select * from public.agrotrack_actividad_flota('<empresa_id>',
--     null, null, null, 'unidad');
--   -- coherencia: encendido = viaje + ralentí en todas las filas
--   select count(*) from public.agrotrack_actividad_flota('<empresa_id>')
--     where encendido_segundos <> viaje_segundos + ralenti_segundos;
-- ---------------------------------------------------------------------------
