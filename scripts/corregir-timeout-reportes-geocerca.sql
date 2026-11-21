-- ============================================================================
-- Agrilux · Fix definitivo de timeouts en reportes de geocerca / actividad
-- 21/11/2026
-- ============================================================================
-- SÍNTOMA (sesión real de Carlos / Pomalca):
--   POST rpc/agrotrack_eventos_geocerca_flota -> 500 {"code":"57014"}
--   POST rpc/agrotrack_actividad_flota (7 días) -> 500 {"code":"57014"}
--
-- CAUSA (confirmada con EXPLAIN ANALYZE sobre la BD real):
--   1) Las dos RPC eran SQL con `security definer` + `set search_path`: no se
--      inlinaban y el plan era genérico.
--   2) Aun inlinadas, PostgREST pasa las fechas como parámetros bind. Con un
--      plan genérico `fecha >= $1` no usa el índice y hacía un Seq Scan de
--      ~724k filas (12 s) en el CTE "ultimo_antes" de eventos.
--   3) "actividad" procesa ~160k posiciones en 7 días con funciones de ventana
--      (~9.6 s) y su CTE "universo" recorría todo el histórico solo para listar
--      las 44 unidades. Además el statement_timeout de los roles de la API era
--      8 s, inferior al tiempo real del reporte semanal.
--
-- FIX:
--   - eventos: PL/pgSQL con SQL dinámico que incrusta Desde/Hasta como
--     literales (el resto sigue parametrizado) y sustituye el `distinct on`
--     de "ultimo_antes" por una consulta correlacionada con LIMIT 1.
--   - actividad: wrapper PL/pgSQL que llama a la función SQL optimizada con
--     fechas literales; "universo" sale de agrotrack_grupos_unidades (44 filas).
--   - statement_timeout de authenticator/authenticated = 20 s.
--
-- Idempotente: se puede volver a ejecutar sin borrar datos ni secretos.
-- ============================================================================

-- 1) Timeout realista para los roles que usa PostgREST.
--    Requiere reiniciar las conexiones (pg_terminate_backend) para que las
--    sesiones ya abiertas tomen el nuevo valor.
alter role authenticator reset plan_cache_mode;
alter role authenticated reset plan_cache_mode;
alter role anon reset plan_cache_mode;
alter role authenticator set statement_timeout = '20s';
alter role authenticated set statement_timeout = '20s';

-- 2) RPC de entradas/salidas de geocerca.
create or replace function public.agrotrack_eventos_geocerca_flota(
  p_empresa_id uuid,
  p_desde      timestamptz default null,
  p_hasta      timestamptz default null,
  p_agrupar    text        default 'geocerca',
  p_limite     integer     default 500,
  p_placas     text[]      default null
)
returns table (
  grupo_tipo text, grupo text, entradas bigint, salidas bigint,
  unidades bigint, ultima_entrada timestamptz
)
language plpgsql
stable
as $fn$
declare
  v_sql text;
begin
  v_sql := $sql$
    with base_eventos as (
      select p.fecha, p.placa,
             btrim(p.pt_referencia) as geocerca,
             (lower(p.evento) like '%entrada%geocerca%') as es_entrada,
             (lower(p.evento) like '%salida%geocerca%') as es_salida
      from public.agrotrack_posiciones p
      where (select public.onboarding_es_miembro($1))
        and p.empresa_id = $1
        and ($2 is null or p.placa = any($2))
        and p.fecha >= coalesce(__DESDE__, '-infinity'::timestamptz)
        and p.fecha <= coalesce(__HASTA__, 'infinity'::timestamptz)
        and (lower(p.evento) like '%entrada%geocerca%'
          or lower(p.evento) like '%salida%geocerca%')
        and p.pt_referencia is not null
        and btrim(p.pt_referencia) <> ''
    ),
    primero as (
      select distinct on (f.placa, f.geocerca)
        f.placa, f.geocerca, f.es_salida
      from base_eventos f
      order by f.placa, f.geocerca, f.fecha
    ),
    ultimo_antes as (
      select f.placa, f.geocerca,
             (
               select lower(p.evento)
               from public.agrotrack_posiciones p
               where p.empresa_id = $1
                 and p.placa = f.placa
                 and btrim(p.pt_referencia) = f.geocerca
                 and p.fecha < __DESDE__
                 and (lower(p.evento) like '%entrada%geocerca%'
                   or lower(p.evento) like '%salida%geocerca%')
               order by p.fecha desc, coalesce(p.secuencia, 0) desc, p.id desc
               limit 1
             ) as evento
      from primero f
      where f.es_salida
    ),
    continuadas as (
      select u.placa, u.geocerca
      from ultimo_antes u
      where u.evento like '%entrada%geocerca%'
    ),
    base as (
      select f.fecha, f.placa, f.geocerca, f.es_entrada, f.es_salida
      from base_eventos f
      union all
      select __DESDE__, c.placa, c.geocerca, true, false
      from continuadas c
    )
    select
      case when $3 in ('dia', 'mes') then $3 else 'geocerca' end as grupo_tipo,
      case
        when $3 = 'dia' then to_char(b.fecha at time zone 'America/Lima', 'YYYY-MM-DD')
        when $3 = 'mes' then to_char(b.fecha at time zone 'America/Lima', 'YYYY-MM')
        else b.geocerca
      end as grupo,
      count(*) filter (where b.es_entrada) as entradas,
      count(*) filter (where b.es_salida) as salidas,
      count(distinct b.placa) filter (where b.es_entrada) as unidades,
      max(b.fecha) filter (where b.es_entrada) as ultima_entrada
    from base b
    group by 2
    order by max(b.fecha) desc nulls last, count(*) desc, grupo
    limit greatest(coalesce($4, 500), 1)
  $sql$;
  v_sql := replace(v_sql, '__DESDE__', coalesce(quote_literal(p_desde), 'NULL') || '::timestamptz');
  v_sql := replace(v_sql, '__HASTA__', coalesce(quote_literal(p_hasta), 'NULL') || '::timestamptz');
  return query execute v_sql using p_empresa_id, p_placas, p_agrupar, p_limite;
end
$fn$;

alter function public.agrotrack_eventos_geocerca_flota(uuid,timestamptz,timestamptz,text,integer,text[]) security invoker;
alter function public.agrotrack_eventos_geocerca_flota(uuid,timestamptz,timestamptz,text,integer,text[]) reset search_path;
grant execute on function public.agrotrack_eventos_geocerca_flota(uuid,timestamptz,timestamptz,text,integer,text[]) to anon, authenticated, service_role;

-- 3) Actividad: cuerpo SQL optimizado (universo desde la tabla maestra).
create or replace function public.agrotrack_actividad_flota_sql2(
  p_empresa_id uuid, p_desde timestamptz default null, p_hasta timestamptz default null,
  p_placa text default null, p_agrupar text default 'dia', p_limite integer default 1000
)
returns table (
  periodo text, placa text, unidad text, km_recorridos numeric,
  encendido_segundos bigint, viaje_segundos bigint, ralenti_segundos bigint,
  vel_max_kmh numeric, alertas bigint, posiciones bigint
)
language sql
stable
as $$
  with base as (
    select p.id, p.placa, p.unidad, p.fecha, p.secuencia, p.evento,
           p.velocidad, p.latitud, p.longitud,
           (p.fecha >= coalesce(p_desde, '-infinity'::timestamptz)
            and p.fecha <= coalesce(p_hasta, 'infinity'::timestamptz)) as en_rango
    from public.agrotrack_posiciones p
    where (select public.onboarding_es_miembro(p_empresa_id))
      and p.empresa_id = p_empresa_id
      and (p_placa is null or p.placa = p_placa)
      and p.fecha >= coalesce(p_desde, '-infinity'::timestamptz) - interval '10 minutes'
      and p.fecha <= coalesce(p_hasta, 'infinity'::timestamptz) + interval '10 minutes'
  ),
  puntos as (
    select b.*,
      (not (lower(b.evento) like '%estacionad%' or lower(b.evento) like '%apagad%')) as encendido,
      (not (lower(b.evento) like '%estacionad%' or lower(b.evento) like '%apagad%'))
        and coalesce(b.velocidad, 0) > 5 as es_viaje
    from base b
  ),
  tramos as (
    select q.*,
      lag(q.latitud) over w as prev_lat, lag(q.longitud) over w as prev_lon,
      lag(q.fecha) over w as prev_fecha, lag(coalesce(q.secuencia,0)) over w as prev_sec,
      lag(q.encendido) over w as prev_encendido, lag(q.es_viaje) over w as prev_viaje
    from puntos q
    window w as (partition by q.placa order by q.fecha, coalesce(q.secuencia,0), q.id)
  ),
  calculado as (
    select t.*,
      (t.prev_fecha is not null and t.prev_fecha = t.fecha
       and coalesce(t.secuencia,0) = coalesce(t.prev_sec,0)) as es_duplicado,
      case when t.prev_fecha is null then null
           when t.prev_fecha = t.fecha and coalesce(t.secuencia,0) = coalesce(t.prev_sec,0) then 0
           when extract(epoch from (t.fecha - t.prev_fecha)) > 600 then null
           else extract(epoch from (t.fecha - t.prev_fecha)) end as dt_bruto,
      case when t.prev_fecha is null then null
           when extract(epoch from (t.fecha - t.prev_fecha)) > 600 then null
           else greatest(0, extract(epoch from (
             least(t.fecha, coalesce(p_hasta, t.fecha))
             - greatest(t.prev_fecha, coalesce(p_desde, t.prev_fecha))))) end as dt_segundos,
      case when t.prev_fecha is null then t.fecha
           else greatest(t.prev_fecha, coalesce(p_desde, t.prev_fecha)) end as fecha_ref,
      case when t.prev_lat is null or t.prev_fecha is null then null
           when t.prev_fecha = t.fecha and coalesce(t.secuencia,0) = coalesce(t.prev_sec,0) then null
           when extract(epoch from (t.fecha - t.prev_fecha)) > 600 then null
           else 2.0 * 6371.0 * asin(least(1.0, sqrt(
             power(sin(radians(t.latitud - t.prev_lat) / 2.0), 2) +
             cos(radians(t.prev_lat)) * cos(radians(t.latitud)) *
             power(sin(radians(t.longitud - t.prev_lon) / 2.0), 2)))) end as dist_bruta
    from tramos t
  ),
  utiles as (
    select c.*,
      case when c.dist_bruta is null or c.dist_bruta >= 5 then 0::double precision
           when coalesce(c.dt_bruto,0) <= 0 then case when c.en_rango then c.dist_bruta else 0 end
           else c.dist_bruta * least(1.0, coalesce(c.dt_segundos,0) / c.dt_bruto) end as dist_km
    from calculado c
    where c.en_rango or coalesce(c.dt_segundos,0) > 0
  ),
  agregado as (
    select
      case when lower(coalesce(p_agrupar,'dia')) = 'unidad' then null
           when lower(p_agrupar) = 'mes' then to_char(c.fecha_ref at time zone 'America/Lima','YYYY-MM')
           else to_char(c.fecha_ref at time zone 'America/Lima','YYYY-MM-DD') end as periodo,
      c.placa, max(c.unidad) as unidad,
      coalesce(round(sum(c.dist_km)::numeric,2),0) as km_recorridos,
      coalesce((sum(c.dt_segundos) filter (where c.prev_encendido))::bigint,0) as encendido_segundos,
      coalesce((sum(c.dt_segundos) filter (where c.prev_viaje))::bigint,0) as viaje_segundos,
      coalesce((sum(c.dt_segundos) filter (where c.prev_encendido and not c.prev_viaje))::bigint,0) as ralenti_segundos,
      max(c.velocidad) filter (where c.en_rango) as vel_max_kmh,
      count(*) filter (where c.en_rango and not c.es_duplicado and (
        (lower(c.evento) like '%alta velocidad%' and lower(c.evento) not like 'fin%')
        or lower(c.evento) like '%pánico%' or lower(c.evento) like '%panico%')) as alertas,
      count(*) filter (where c.en_rango) as posiciones
    from utiles c group by 1, c.placa
  ),
  universo as (
    select g.placa,
           coalesce((
             select p.unidad from public.agrotrack_posiciones p
             where p.empresa_id = g.empresa_id and p.placa = g.placa
             order by p.fecha desc limit 1
           ), g.placa) as unidad
    from public.agrotrack_grupos_unidades g
    where (select public.onboarding_es_miembro(p_empresa_id))
      and g.empresa_id = p_empresa_id
      and (p_placa is null or g.placa = p_placa)
  ),
  sin_datos as (
    select u.placa, u.unidad from universo u
    where not exists (select 1 from agregado a where a.placa = u.placa)
  ),
  periodos as (
    select null::text as periodo where lower(coalesce(p_agrupar,'dia')) = 'unidad'
    union
    select periodo from (
      select a.periodo from agregado a where a.periodo is not null
      union
      select to_char(g at time zone 'America/Lima',
        case when lower(coalesce(p_agrupar,'dia')) = 'mes' then 'YYYY-MM' else 'YYYY-MM-DD' end)
      from generate_series(p_desde, p_hasta,
        case when lower(coalesce(p_agrupar,'dia')) = 'mes' then interval '1 month' else interval '1 day' end) g
      where p_desde is not null and p_hasta is not null
        and lower(coalesce(p_agrupar,'dia')) <> 'unidad'
    ) x
  ),
  claves_cero as (
    select s.placa, s.unidad, t.periodo from sin_datos s cross join periodos t
  ),
  filas as (
    select a.periodo, a.placa, a.unidad, a.km_recorridos, a.encendido_segundos,
           a.viaje_segundos, a.ralenti_segundos, a.vel_max_kmh, a.alertas, a.posiciones
    from agregado a
    union all
    select z.periodo, z.placa, z.unidad, 0::numeric, 0::bigint, 0::bigint, 0::bigint,
           null::numeric, 0::bigint, 0::bigint
    from claves_cero z
  )
  select f.periodo, f.placa, f.unidad, f.km_recorridos, f.encendido_segundos,
         f.viaje_segundos, f.ralenti_segundos, f.vel_max_kmh, f.alertas, f.posiciones
  from filas f
  order by 1 desc nulls last, f.placa
  limit greatest(coalesce(p_limite,1000),1);
$$;

alter function public.agrotrack_actividad_flota_sql2(uuid,timestamptz,timestamptz,text,text,integer) security invoker;
alter function public.agrotrack_actividad_flota_sql2(uuid,timestamptz,timestamptz,text,text,integer) reset search_path;
grant execute on function public.agrotrack_actividad_flota_sql2(uuid,timestamptz,timestamptz,text,text,integer) to authenticated, service_role;

-- 4) Wrapper público: convierte los parámetros de fecha en literales antes de
--    llamar al cuerpo SQL, para que PostgREST no fuerce un plan genérico.
create or replace function public.agrotrack_actividad_flota(
  p_empresa_id uuid, p_desde timestamptz default null, p_hasta timestamptz default null,
  p_placa text default null, p_agrupar text default 'dia', p_limite integer default 1000
)
returns table (
  periodo text, placa text, unidad text, km_recorridos numeric,
  encendido_segundos bigint, viaje_segundos bigint, ralenti_segundos bigint,
  vel_max_kmh numeric, alertas bigint, posiciones bigint
)
language plpgsql
stable
as $fn$
begin
  return query execute format(
    'select * from public.agrotrack_actividad_flota_sql2($1, %L::timestamptz, %L::timestamptz, $2, $3, $4)',
    p_desde, p_hasta
  ) using p_empresa_id, p_placa, p_agrupar, p_limite;
end
$fn$;

alter function public.agrotrack_actividad_flota(uuid,timestamptz,timestamptz,text,text,integer) security invoker;
alter function public.agrotrack_actividad_flota(uuid,timestamptz,timestamptz,text,text,integer) reset search_path;
grant execute on function public.agrotrack_actividad_flota(uuid,timestamptz,timestamptz,text,text,integer) to anon, authenticated, service_role;

-- 5) Verificación rápida (usuario real de prueba / empresa Pomalca).
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '42a04b5a-ecc4-4e0b-8f82-80f9fb89fdde';
  select 'eventos 21/11' as prueba, count(*) as filas
  from public.agrotrack_eventos_geocerca_flota(
    '9ab3a922-1f29-4f06-be93-d6bd7f2457d1',
    '2026-11-21T00:00:00-05:00','2026-11-21T23:59:59-05:00','geocerca',500);
  select 'actividad 14-21/11' as prueba, count(*) as filas
  from public.agrotrack_actividad_flota(
    '9ab3a922-1f29-4f06-be93-d6bd7f2457d1',
    '2026-11-14T20:07:49.000Z','2026-11-21T20:07:49+00:00',null,'unidad',1000);
rollback;
