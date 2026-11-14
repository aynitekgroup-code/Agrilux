-- Resúmenes de flota a partir de public.agrotrack_posiciones (FASE 1 y FASE 2).
-- Ejecutar completo en el SQL Editor de Supabase. Es repetible e idempotente:
-- no borra ni modifica datos, ni toca RLS ni la tabla agrotrack_geocercas.
--
-- INCLUYE (sección 0) las funciones de membresía onboarding_es_miembro /
-- onboarding_es_admin, que este archivo necesita y que no existían en este
-- proyecto (de ahí el ERROR 42883 al ejecutarlo). No hace falta correr ningún
-- otro archivo antes; scripts/onboarding-es-miembro.sql trae lo mismo por
-- separado si solo se necesitan esas funciones.
--
-- TODAS las RPC son SECURITY DEFINER y validan la membresía con
-- public.onboarding_es_miembro(p_empresa_id) antes de leer: un no-miembro
-- recibe 0 filas (mismo resultado que la RLS), pero la tabla se recorre sin
-- evaluar la política fila por fila.
--
-- Por qué (medido el 2026-11-10 con un usuario autenticado real):
--   count(*) con RLS ....... 5.618 ms   (sin RLS: instantáneo)
--   agrotrack_periodo_flota  6.347 ms
--   agrotrack_resumen_flota  8.410 ms -> 57014 "canceling statement due to
--                                         statement timeout"  <-- el 500 de la consola
-- La política de RLS llama a una función por cada una de las 103.628 filas
-- (~53 µs c/u) y Supabase corta toda consulta a los 8 segundos.
--
-- IMPORTANTE: no se modifica ninguna política de RLS existente, ni la tabla
-- agrotrack_posiciones, ni agrotrack_geocercas. Solo cambia la cabecera de
-- estas funciones y se añade el chequeo de membresía.
--
-- El cálculo ocurre en SQL porque PostgREST devuelve máximo 1000 filas por consulta.
--
-- Valores reales de la columna evento (confirmados el 2026-11-09 sobre
-- agrotrack_posiciones): Estacionado, Conduciendo, Salida de Geocerca,
-- Entrada a Geocerca, Inmóvil - Detenido, Ignición Encendida/Apagada,
-- Inicio de Viaje, Viaje detenido, Alerta de Inmovilidad, Alta velocidad,
-- Fin de alta velocidad, Botón de pánico, Giro Brusco, PING, Encender, etc.

-- ---------------------------------------------------------------------------
-- 0) PREREQUISITO: funciones de membresía.
--
-- Todas las RPC de este archivo validan con public.onboarding_es_miembro(...)
-- y en este proyecto esa función NUNCA se instaló (la migración de onboarding
-- 2.5 no se ejecutó), así que este archivo fallaba con:
--   ERROR: 42883 function public.onboarding_es_miembro(uuid) does not exist
-- Se crean aquí para que este archivo funcione solo, con la MISMA definición
-- de scripts/onboarding-es-miembro.sql (que es la de
-- scripts/onboarding-2.5-10-funciones.sql). Idempotente: solo CREATE OR
-- REPLACE, no toca datos ni políticas. Usa auth.uid() (esquema auth de
-- Supabase) y la tabla empresa_miembros, que sí existen.
-- ---------------------------------------------------------------------------
create or replace function public.onboarding_es_miembro(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
     and exists (
       select 1
       from public.empresa_miembros em
       where em.empresa_id = p_empresa_id
         and em.user_id = auth.uid()::text
         and em.activo is true
     );
$$;

create or replace function public.onboarding_es_admin(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
     and exists (
       select 1
       from public.empresa_miembros em
       where em.empresa_id = p_empresa_id
         and em.user_id = auth.uid()::text
         and em.activo is true
         and em.rol = 'administrador'
     );
$$;

revoke all on function public.onboarding_es_miembro(uuid) from public;
revoke all on function public.onboarding_es_admin(uuid) from public;
grant execute on function public.onboarding_es_miembro(uuid) to authenticated, anon, service_role;
grant execute on function public.onboarding_es_admin(uuid) to authenticated, anon, service_role;

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
security definer
set search_path = public, pg_temp
as $$
  select
    min(p.fecha)          as desde,
    max(p.fecha)          as hasta,
    count(distinct p.placa) as unidades,
    count(*)              as registros
  from public.agrotrack_posiciones p
  -- Misma regla que la RLS, evaluada UNA sola vez: un no-miembro ve 0 filas.
  where (select public.onboarding_es_miembro(p_empresa_id))
    and p.empresa_id = p_empresa_id;
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
security definer
set search_path = public, pg_temp
as $$
  -- UNA sola pasada sobre la tabla (un solo sort, una sola ventana).
  -- Antes había un CTE de deduplicados con row_number (segundo sort) y una
  -- ventana last_value de marco completo: costaba el doble y devolvía lo
  -- mismo. Verificado contra la versión anterior: mismos km, mismas alertas,
  -- misma última posición en las 39 unidades.
  with base as (
    select
      p.id, p.placa, p.unidad, p.descripcion, p.fecha, p.secuencia,
      p.evento, p.velocidad, p.latitud, p.longitud
    from public.agrotrack_posiciones p
    -- Misma regla que la RLS, evaluada UNA sola vez: un no-miembro ve 0 filas.
    where (select public.onboarding_es_miembro(p_empresa_id))
      and p.empresa_id = p_empresa_id
      and (p_desde is null or p.fecha >= p_desde)
      and (p_hasta is null or p.fecha <= p_hasta)
  ),
  -- De aquí salen los tramos consecutivos (lag), el detectador de duplicados
  -- y la última posición del periodo (lead), todo con la MISMA ventana.
  con_prev as (
    select
      b.placa, b.unidad, b.descripcion, b.fecha, b.secuencia, b.evento,
      b.velocidad, b.latitud, b.longitud,
      lag(b.latitud)                 over ventana as prev_lat,
      lag(b.longitud)                over ventana as prev_lon,
      lag(b.fecha)                   over ventana as prev_fecha,
      lag(coalesce(b.secuencia, 0))  over ventana as prev_sec,
      lead(b.fecha)                  over ventana as sig_fecha
    from base b
    window ventana as (
      partition by b.placa
      order by b.fecha, coalesce(b.secuencia, 0), b.id
    )
  ),
  -- Haversine calculado UNA sola vez por tramo. Antes se llamaba dos veces a
  -- la función agrotrack_haversine_km por fila (207 mil llamadas) y su
  -- set search_path impedía el inlining: eso sumaba ~5 s y disparaba el
  -- statement timeout de PostgREST.
  tramos as (
    select
      c.*,
      -- Es la segunda (o tercera…) vez que vemos ese punto: mismo reporte
      -- repetido, así que no aporta distancia ni cuenta como alerta.
      (c.prev_fecha = c.fecha
        and coalesce(c.secuencia, 0) = coalesce(c.prev_sec, 0)) as es_duplicado,
      case
        when c.prev_lat is null or c.prev_fecha is null then null
        when c.prev_fecha = c.fecha
          and coalesce(c.secuencia, 0) = coalesce(c.prev_sec, 0) then null
        -- intervalo mayor a 10 minutos: no hay continuidad
        when extract(epoch from (c.fecha - c.prev_fecha)) > 600 then null
        -- Haversine inlineado (ver comentario arriba)
        else 2.0 * 6371.0 * asin(least(1.0, sqrt(
          power(sin(radians(c.latitud - c.prev_lat) / 2.0), 2) +
          cos(radians(c.prev_lat)) * cos(radians(c.latitud)) *
          power(sin(radians(c.longitud - c.prev_lon) / 2.0), 2)
        )))
      end as dist_km
    from con_prev c
  )
  -- Un solo GROUP BY por placa en lugar de tres pasadas y dos joins.
  -- La última posición es la fila sin siguiente (sig_fecha is null).
  select
    t.placa                                          as placa,
    max(t.unidad)      filter (where t.sig_fecha is null) as unidad,
    max(t.descripcion) filter (where t.sig_fecha is null) as descripcion,
    max(t.evento)      filter (where t.sig_fecha is null) as ultimo_evento,
    max(t.fecha)       filter (where t.sig_fecha is null) as ultima_fecha,
    max(t.latitud)     filter (where t.sig_fecha is null) as ultima_lat,
    max(t.longitud)    filter (where t.sig_fecha is null) as ultima_lon,
    max(t.velocidad)   filter (where t.sig_fecha is null) as ultima_velocidad,
    coalesce(round(sum(
      case
        -- sin previo, duplicado o con salto: no suma
        when t.dist_km is null then 0::double precision
        -- salto de GPS mayor o igual a 5 km: se descarta
        when t.dist_km >= 5 then 0::double precision
        else t.dist_km
      end
    )::numeric, 2), 0)     as km_recorridos,
    -- "Alta velocidad" sí es alerta; "Fin de alta velocidad" es el cierre del
    -- mismo evento (255 aperturas + 255 cierres) y se excluye. Los puntos
    -- repetidos tampoco se cuentan dos veces.
    count(*) filter (
      where not t.es_duplicado
        and lower(t.evento) like '%alta velocidad%'
        and lower(t.evento) not like 'fin%'
    )                      as eventos_alta_velocidad
  from tramos t
  group by t.placa
  order by t.placa;
$$;

grant execute on function public.agrotrack_resumen_flota(uuid, timestamptz, timestamptz)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) Alertas de operación más recientes: "Alta velocidad" y "Botón de pánico".
--    El filtro es deliberadamente tolerante (%alta velocidad%, %pánico% /
--    %panico%) para no depender de la mayúscula ni de la tilde exacta.
-- ---------------------------------------------------------------------------
drop function if exists public.agrotrack_alertas_flota(uuid, timestamptz, timestamptz, integer);
drop function if exists public.agrotrack_alertas_flota(uuid, timestamptz, timestamptz, integer, text[]);

create function public.agrotrack_alertas_flota(
  p_empresa_id uuid,
  p_desde      timestamptz default null,
  p_hasta      timestamptz default null,
  p_limite     integer    default 50,
  -- Filtro opcional por conjunto de placas (pantalla "Mostrar: Unidades /
  -- Grupos" de los reportes de alertas). null = todas las unidades.
  p_placas     text[]     default null
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
security definer
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
  -- Misma regla que la RLS, evaluada UNA sola vez: un no-miembro ve 0 filas.
  where (select public.onboarding_es_miembro(p_empresa_id))
    and p.empresa_id = p_empresa_id
    and (p_placas is null or p.placa = any(p_placas))
    and (p_desde is null or p.fecha >= p_desde)
    and (p_hasta is null or p.fecha <= p_hasta)
    and (
      -- Valores reales confirmados: "Alta velocidad" (255) y "Botón de pánico" (24).
      -- Se excluye "Fin de alta velocidad" (255), que es el cierre del mismo evento.
      (lower(p.evento) like '%alta velocidad%' and lower(p.evento) not like 'fin%')
      or lower(p.evento) like '%pánico%'
      or lower(p.evento) like '%panico%'
    )
  order by p.fecha desc, coalesce(p.secuencia, 0) desc, p.id desc
  limit greatest(coalesce(p_limite, 50), 1);
$$;

grant execute on function public.agrotrack_alertas_flota(uuid, timestamptz, timestamptz, integer, text[])
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
security definer
set search_path = public, pg_temp
as $$
  select
    p.evento  as evento,
    count(*)  as total
  from public.agrotrack_posiciones p
  -- Misma regla que la RLS, evaluada UNA sola vez: un no-miembro ve 0 filas.
  where (select public.onboarding_es_miembro(p_empresa_id))
    and p.empresa_id = p_empresa_id
  group by p.evento
  order by count(*) desc;
$$;

grant execute on function public.agrotrack_conteo_eventos(uuid)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6) Recorrido de una unidad (FASE 2): puntos GPS de una placa en un rango,
--    ya deduplicados y con muestreo para no superar el límite de 1000 filas
--    que PostgREST devuelve por consulta.
--
--    Un día completo a un punto cada 2 minutos son ~720 puntos, así que entra
--    completo. Si el rango trae más, se muestrea por paso entero conservando
--    siempre el primer punto, el último y todas las alertas (alta velocidad /
--    botón de pánico), que la UI dibuja marcadas sobre la línea.
-- ---------------------------------------------------------------------------
drop function if exists public.agrotrack_recorrido_flota(uuid, text, timestamptz, timestamptz, integer);

create function public.agrotrack_recorrido_flota(
  p_empresa_id   uuid,
  p_placa        text,
  p_desde        timestamptz default null,
  p_hasta        timestamptz default null,
  p_max_puntos   integer     default 900
)
returns table (
  id         bigint,
  fecha      timestamptz,
  latitud    double precision,
  longitud   double precision,
  velocidad  numeric,
  evento     text,
  direccion  text,
  es_alerta  boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with base as (
    select
      p.id, p.fecha, p.latitud, p.longitud,
      p.velocidad, p.evento, p.direccion, p.secuencia
    from public.agrotrack_posiciones p
    -- Misma regla que la RLS, evaluada UNA sola vez: un no-miembro ve 0 filas.
    where (select public.onboarding_es_miembro(p_empresa_id))
      and p.empresa_id = p_empresa_id
      and p.placa = p_placa
      and (p_desde is null or p.fecha >= p_desde)
      and (p_hasta is null or p.fecha <= p_hasta)
  ),
  sin_duplicados as (
    select d.*
    from (
      select
        b.*,
        row_number() over (
          partition by b.fecha, coalesce(b.secuencia, 0)
          order by b.id
        ) as orden
      from base b
    ) d
    where d.orden = 1
  ),
  numerado as (
    select
      s.*,
      row_number() over (order by s.fecha, coalesce(s.secuencia, 0), s.id) as rn,
      count(*) over () as total
    from sin_duplicados s
  ),
  muestreado as (
    select
      n.*,
      greatest(1, (n.total + greatest(coalesce(p_max_puntos, 900), 1) - 1)
        / greatest(coalesce(p_max_puntos, 900), 1)) as paso
    from numerado n
  )
  select
    m.id        as id,
    m.fecha     as fecha,
    m.latitud   as latitud,
    m.longitud  as longitud,
    m.velocidad as velocidad,
    m.evento    as evento,
    m.direccion as direccion,
    -- Mismo criterio de alerta que agrotrack_alertas_flota: "Alta velocidad"
    -- cuenta, "Fin de alta velocidad" es el cierre y no.
    (lower(m.evento) like '%alta velocidad%' and lower(m.evento) not like 'fin%')
      or lower(m.evento) like '%pánico%'
      or lower(m.evento) like '%panico%'      as es_alerta
  from muestreado m
  where m.rn = 1
     or m.rn = m.total
     or m.rn % m.paso = 0
     or (lower(m.evento) like '%alta velocidad%' and lower(m.evento) not like 'fin%')
     or lower(m.evento) like '%pánico%'
     or lower(m.evento) like '%panico%'
  order by m.fecha, coalesce(m.secuencia, 0), m.id
  limit greatest(coalesce(p_max_puntos, 900), 1) + 100;
$$;

grant execute on function public.agrotrack_recorrido_flota(uuid, text, timestamptz, timestamptz, integer)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Comprobaciones (opcionales): deben devolver 39 unidades y ~103 mil registros.
-- ---------------------------------------------------------------------------
-- select * from public.agrotrack_periodo_flota('<empresa_id>');
-- select placa, ultimo_evento, ultima_fecha, round(km_recorridos, 1) as km
--   from public.agrotrack_resumen_flota('<empresa_id>') limit 10;
-- select * from public.agrotrack_alertas_flota('<empresa_id>', null, null, 10);
-- select fecha, round(latitud::numeric, 5) as lat, round(longitud::numeric, 5) as lon,
--        es_alerta
--   from public.agrotrack_recorrido_flota('<empresa_id>', '<placa>',
--           '2026-11-05T00:00:00-05:00', '2026-11-05T23:59:59-05:00')
--   limit 10;
