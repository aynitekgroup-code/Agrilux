-- Resúmenes de flota a partir de public.agrotrack_posiciones (FASE 1).
-- Ejecutar completo en el SQL Editor de Supabase. Es repetible e idempotente:
-- no borra ni modifica datos, ni toca RLS ni la tabla agrotrack_geocercas.
--
-- Todas las funciones usan SECURITY INVOKER para que la RLS de
-- agrotrack_posiciones_seleccione_member se aplique con el usuario que llama.
-- El cálculo ocurre en SQL porque PostgREST devuelve máximo 1000 filas por consulta.
--
-- Antes de ejecutar, confirma los textos reales de la columna evento:
--   select evento, count(*) from public.agrotrack_posiciones group by 1 order by 2 desc;

-- ---------------------------------------------------------------------------
-- 1) Distancia haversine en kilómetros entre dos puntos.
-- ---------------------------------------------------------------------------
drop function if exists public.agrotrack_haversine_km(double precision, double precision, double precision, double precision);

create function public.agrotrack_haversine_km(
  p_lat1 double precision,
  p_lon1 double precision,
  p_lat2 double precision,
  p_lon2 double precision
)
returns double precision
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select case
    when p_lat1 is null or p_lon1 is null or p_lat2 is null or p_lon2 is null then null
    else 2.0 * 6371.0 * asin(least(1.0, sqrt(
      power(sin(radians(p_lat2 - p_lat1) / 2.0), 2) +
      cos(radians(p_lat1)) * cos(radians(p_lat2)) *
      power(sin(radians(p_lon2 - p_lon1) / 2.0), 2)
    )))
  end;
$$;

grant execute on function public.agrotrack_haversine_km(double precision, double precision, double precision, double precision)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) Periodo cargado de la empresa: usado para saber si hay datos reales y
--    contra qué fecha se compara el estado de cada unidad (nunca "hoy").
-- ---------------------------------------------------------------------------
drop function if exists public.agrotrack_periodo_flota(uuid);

create function public.agrotrack_periodo_flota(p_empresa_id uuid)
returns table (
  desde      timestamptz,
  hasta      timestamptz,
  unidades   bigint,
  registros  bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    min(p.fecha)          as desde,
    max(p.fecha)          as hasta,
    count(distinct p.placa) as unidades,
    count(*)              as registros
  from public.agrotrack_posiciones p
  where p.empresa_id = p_empresa_id;
$$;

grant execute on function public.agrotrack_periodo_flota(uuid)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) Resumen por unidad: última posición, km recorridos y eventos de alta
--    velocidad dentro del rango (p_desde / p_hasta; null = todo el histórico).
--
--    Kilómetros: haversine entre puntos consecutivos de la misma placa
--    (orden fecha, secuencia) solo si el intervalo es <= 10 minutos y el salto
--    es < 5 km (los saltos de GPS se descartan). Duplicados eliminados antes.
-- ---------------------------------------------------------------------------
drop function if exists public.agrotrack_resumen_flota(uuid, timestamptz, timestamptz);

create function public.agrotrack_resumen_flota(
  p_empresa_id uuid,
  p_desde      timestamptz default null,
  p_hasta      timestamptz default null
)
returns table (
  placa                    text,
  unidad                   text,
  descripcion               text,
  ultimo_evento            text,
  ultima_fecha             timestamptz,
  ultima_lat               double precision,
  ultima_lon               double precision,
  ultima_velocidad         numeric,
  km_recorridos            numeric,
  eventos_alta_velocidad   bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with base as (
    select
      p.id, p.placa, p.unidad, p.descripcion, p.fecha, p.secuencia,
      p.evento, p.direccion, p.velocidad, p.latitud, p.longitud
    from public.agrotrack_posiciones p
    where p.empresa_id = p_empresa_id
      and (p_desde is null or p.fecha >= p_desde)
      and (p_hasta is null or p.fecha <= p_hasta)
  ),
  -- Duplicados: mismo punto reportado más de una vez (placa + fecha + secuencia).
  sin_duplicados as (
    select d.*
    from (
      select
        b.*,
        row_number() over (
          partition by b.placa, b.fecha, coalesce(b.secuencia, 0)
          order by b.id
        ) as orden
      from base b
    ) d
    where d.orden = 1
  ),
  ordenados as (
    select
      s.placa, s.unidad, s.descripcion, s.fecha, s.evento,
      s.velocidad, s.latitud, s.longitud,
      lag(s.latitud)  over ventana as prev_lat,
      lag(s.longitud) over ventana as prev_lon,
      lag(s.fecha)    over ventana as prev_fecha
    from sin_duplicados s
    window ventana as (partition by s.placa order by s.fecha, coalesce(s.secuencia, 0))
  ),
  tramos as (
    select
      o.placa,
      case
        when o.prev_lat is null or o.prev_fecha is null then 0::double precision
        -- intervalo mayor a 10 minutos: no hay continuidad
        when extract(epoch from (o.fecha - o.prev_fecha)) > 600 then 0::double precision
        -- salto de GPS mayor o igual a 5 km: se descarta
        when public.agrotrack_haversine_km(o.prev_lat, o.prev_lon, o.latitud, o.longitud) >= 5
          then 0::double precision
        else public.agrotrack_haversine_km(o.prev_lat, o.prev_lon, o.latitud, o.longitud)
      end as km
    from ordenados o
  ),
  distancias as (
    select t.placa, sum(t.km) as km_total
    from tramos t
    group by t.placa
  ),
  altas as (
    select s.placa, count(*) as total
    from sin_duplicados s
    where lower(s.evento) like '%alta velocidad%'
    group by s.placa
  ),
  ultima as (
    select u.*
    from (
      select
        s.placa, s.unidad, s.descripcion, s.fecha, s.evento,
        s.velocidad, s.latitud, s.longitud,
        row_number() over (
          partition by s.placa
          order by s.fecha desc, coalesce(s.secuencia, 0) desc, s.id desc
        ) as orden
      from sin_duplicados s
    ) u
    where u.orden = 1
  )
  select
    u.placa                  as placa,
    u.unidad                 as unidad,
    u.descripcion            as descripcion,
    u.evento                 as ultimo_evento,
    u.fecha                  as ultima_fecha,
    u.latitud                as ultima_lat,
    u.longitud               as ultima_lon,
    u.velocidad              as ultima_velocidad,
    coalesce(round(d.km_total::numeric, 2), 0) as km_recorridos,
    coalesce(a.total, 0)     as eventos_alta_velocidad
  from ultima u
  left join distancias d on d.placa = u.placa
  left join altas a       on a.placa = u.placa
  order by u.placa;
$$;

grant execute on function public.agrotrack_resumen_flota(uuid, timestamptz, timestamptz)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) Alertas de operación más recientes: "Alta velocidad" y "Botón de pánico".
--    El filtro es deliberadamente tolerante (%alta velocidad%, %pánico% /
--    %panico%) para no depender de la mayúscula ni de la tilde exacta.
-- ---------------------------------------------------------------------------
drop function if exists public.agrotrack_alertas_flota(uuid, timestamptz, timestamptz, integer);

create function public.agrotrack_alertas_flota(
  p_empresa_id uuid,
  p_desde      timestamptz default null,
  p_hasta      timestamptz default null,
  p_limite     integer    default 50
)
returns table (
  id         bigint,
  placa      text,
  unidad     text,
  fecha      timestamptz,
  evento     text,
  velocidad  numeric,
  direccion  text
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    p.id         as id,
    p.placa      as placa,
    p.unidad     as unidad,
    p.fecha      as fecha,
    p.evento     as evento,
    p.velocidad  as velocidad,
    p.direccion  as direccion
  from public.agrotrack_posiciones p
  where p.empresa_id = p_empresa_id
    and (p_desde is null or p.fecha >= p_desde)
    and (p_hasta is null or p.fecha <= p_hasta)
    and (
      lower(p.evento) like '%alta velocidad%'
      or lower(p.evento) like '%pánico%'
      or lower(p.evento) like '%panico%'
    )
  order by p.fecha desc, coalesce(p.secuencia, 0) desc, p.id desc
  limit greatest(coalesce(p_limite, 50), 1);
$$;

grant execute on function public.agrotrack_alertas_flota(uuid, timestamptz, timestamptz, integer)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5) Diagnóstico: conteo real de la columna evento (no asume los textos).
-- ---------------------------------------------------------------------------
drop function if exists public.agrotrack_conteo_eventos(uuid);

create function public.agrotrack_conteo_eventos(p_empresa_id uuid)
returns table (
  evento text,
  total  bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    p.evento  as evento,
    count(*)  as total
  from public.agrotrack_posiciones p
  where p.empresa_id = p_empresa_id
  group by p.evento
  order by count(*) desc;
$$;

grant execute on function public.agrotrack_conteo_eventos(uuid)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Comprobaciones (opcionales): deben devolver 39 unidades y ~103 mil registros.
-- ---------------------------------------------------------------------------
-- select * from public.agrotrack_periodo_flota('<empresa_id>');
-- select placa, ultimo_evento, ultima_fecha, round(km_recorridos, 1) as km
--   from public.agrotrack_resumen_flota('<empresa_id>') limit 10;
-- select * from public.agrotrack_alertas_flota('<empresa_id>', null, null, 10);
