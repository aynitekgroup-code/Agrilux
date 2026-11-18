-- ============================================================================
-- VISITAS A GEOCERCAS GUARDADAS POR DÍA (14/11/2026)
-- "El reporte de geocercas todavía no puede dar el reporte de TODAS las
--  unidades juntas; es importante para el reporte diario" + observación IV
--  ("estos datos van a una base de datos como respaldo de las horas
--  trabajadas por máquina") + la tabla dinámica de las 6:30 a. m.
--
-- Ejecutar completo en el SQL Editor de Supabase DESPUÉS de
-- scripts/agrotrack-geocercas-reportes.sql (usa su motor
-- public.agrotrack_visitas_geocerca_calc). Es repetible e idempotente: no
-- borra posiciones ni geocercas, ni toca las políticas de otras tablas.
--
-- POR QUÉ: calcular en vivo las visitas de las ~44 unidades contra las ~178
-- geocercas de un día entero supera los 8 s que Supabase permite a la web, y
-- además pasa de las 1000 filas que devuelve PostgREST. Por eso:
--   1) el cálculo se hace UNA vez por (día, placa) y queda GUARDADO en
--      public.agrotrack_visitas_dia (es el respaldo de horas por máquina);
--   2) lo hace solo pg_cron cada 10 minutos para hoy y ayer (sin límite de
--      8 s, porque corre como postgres), y también el agente de Zonar al
--      terminar su corrida; la web puede pedirlo por placa si falta algo;
--   3) los reportes LEEN lo guardado, por páginas de 1000 filas: todas las
--      unidades juntas, cualquier rango de días, sin timeout.
--
-- CORTE POR DÍA (igual que Zonar y que la tabla de las 6:30): cada día va de
-- 00:00:00 a 23:59:59 hora de Perú. Una visita que cruza la medianoche se
-- guarda partida: el día 1 termina a las 23:59:59 (abierta) y el día 2
-- empieza a las 00:00:00 (continua_dia_anterior = true). Sumar las horas de
-- varios días nunca duplica tiempo.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Tablas
-- ---------------------------------------------------------------------------
create table if not exists public.agrotrack_visitas_dia (
  id                    bigint generated always as identity primary key,
  empresa_id            uuid        not null,
  dia                   date        not null,      -- día de Perú del corte
  placa                 text        not null,
  geocerca              text        not null,
  entrada               timestamptz not null,
  salida                timestamptz,
  duracion_segundos     integer,
  apagado_segundos      integer     not null default 0,
  ralenti_segundos      integer     not null default 0,
  viaje_segundos        integer     not null default 0,
  abierta               boolean     not null default false, -- sigue dentro al cierre del día
  continua_dia_anterior boolean     not null default false, -- ya estaba dentro a las 00:00
  calculado_en          timestamptz not null default now()
);

create index if not exists agrotrack_visitas_dia_empresa_dia_placa_idx
  on public.agrotrack_visitas_dia (empresa_id, dia, placa);
create index if not exists agrotrack_visitas_dia_empresa_dia_geocerca_idx
  on public.agrotrack_visitas_dia (empresa_id, dia, geocerca);

-- Qué (día, placa) ya está calculado y con cuántas posiciones: si llegan
-- posiciones nuevas de ese día (agente de Zonar, carga manual), el día queda
-- "desactualizado" y se recalcula solo.
create table if not exists public.agrotrack_visitas_dia_estado (
  empresa_id      uuid        not null,
  dia             date        not null,
  placa           text        not null,
  posiciones      integer     not null default 0,
  ultima_carga    timestamptz,                 -- max(created_at) de esas posiciones
  visitas         integer     not null default 0,
  calculado_en    timestamptz not null default now(),
  primary key (empresa_id, dia, placa)
);

-- Lectura directa para los miembros (la web pagina con .range()). Escritura
-- solo por las funciones security definer de abajo (no hay política de
-- insert/update/delete: nadie escribe directo desde la web).
alter table public.agrotrack_visitas_dia enable row level security;
alter table public.agrotrack_visitas_dia_estado enable row level security;

drop policy if exists agrotrack_visitas_dia_select_member on public.agrotrack_visitas_dia;
create policy agrotrack_visitas_dia_select_member on public.agrotrack_visitas_dia
  for select using (public.onboarding_es_miembro(empresa_id));

drop policy if exists agrotrack_visitas_dia_estado_select_member on public.agrotrack_visitas_dia_estado;
create policy agrotrack_visitas_dia_estado_select_member on public.agrotrack_visitas_dia_estado
  for select using (public.onboarding_es_miembro(empresa_id));

grant select on public.agrotrack_visitas_dia, public.agrotrack_visitas_dia_estado to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Motor interno: calcula y GUARDA un día (todas las placas o una sola).
--    Sin validación de membresía (lo llaman pg_cron y las RPC de abajo).
-- ---------------------------------------------------------------------------
drop function if exists public.agrotrack_visitas_dia_calcular_interno(uuid, date, text);

create function public.agrotrack_visitas_dia_calcular_interno(
  p_empresa_id uuid,
  p_dia        date,
  p_placa      text default null
)
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_catalog, pg_temp
as $$
declare
  v_desde timestamptz := (p_dia::timestamp) at time zone 'America/Lima';
  v_hasta timestamptz := ((p_dia + 1)::timestamp) at time zone 'America/Lima' - interval '1 second';
  v_n     integer := 0;
begin
  if p_empresa_id is null or p_dia is null then
    raise exception 'agrotrack_visitas_dia: empresa y día son obligatorios';
  end if;

  delete from public.agrotrack_visitas_dia v
   where v.empresa_id = p_empresa_id
     and v.dia = p_dia
     and (p_placa is null or v.placa = p_placa);

  insert into public.agrotrack_visitas_dia
    (empresa_id, dia, placa, geocerca, entrada, salida, duracion_segundos,
     apagado_segundos, ralenti_segundos, viaje_segundos, abierta, continua_dia_anterior)
  select
    p_empresa_id, p_dia, c.placa, c.geocerca, c.entrada, c.salida,
    c.duracion_segundos,
    coalesce(c.apagado_segundos, 0), coalesce(c.ralenti_segundos, 0), coalesce(c.viaje_segundos, 0),
    coalesce(c.abierta, false),
    (c.entrada = v_desde)
  from public.agrotrack_visitas_geocerca_calc(p_empresa_id, v_desde, v_hasta, p_placa, null) c
  where c.entrada is not null
    and c.placa is not null
    and c.geocerca is not null;
  get diagnostics v_n = row_count;

  -- Estado por placa: TODAS las que reportaron ese día (aunque no hayan
  -- entrado a ninguna geocerca) quedan marcadas como calculadas.
  delete from public.agrotrack_visitas_dia_estado e
   where e.empresa_id = p_empresa_id
     and e.dia = p_dia
     and (p_placa is null or e.placa = p_placa);

  insert into public.agrotrack_visitas_dia_estado
    (empresa_id, dia, placa, posiciones, ultima_carga, visitas, calculado_en)
  select
    p_empresa_id, p_dia, p.placa, count(*)::integer, max(p.created_at),
    (select count(*) from public.agrotrack_visitas_dia v
      where v.empresa_id = p_empresa_id and v.dia = p_dia and v.placa = p.placa)::integer,
    now()
  from public.agrotrack_posiciones p
  where p.empresa_id = p_empresa_id
    and p.fecha >= v_desde
    and p.fecha <= v_hasta
    and (p_placa is null or p.placa = p_placa)
  group by p.placa;

  return v_n;
end;
$$;

revoke all on function public.agrotrack_visitas_dia_calcular_interno(uuid, date, text) from public, anon, authenticated;
grant execute on function public.agrotrack_visitas_dia_calcular_interno(uuid, date, text) to service_role;

-- ---------------------------------------------------------------------------
-- 3) (día, placa) PENDIENTES: sin calcular o con posiciones nuevas desde el
--    último cálculo. Lo usa pg_cron, el agente y la web ("Calcular faltantes").
-- ---------------------------------------------------------------------------
drop function if exists public.agrotrack_visitas_dia_pendientes_interno(uuid, date, date);

create function public.agrotrack_visitas_dia_pendientes_interno(
  p_empresa_id uuid,
  p_desde_dia  date,
  p_hasta_dia  date
)
returns table (dia date, placa text, posiciones integer)
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  with conteo as (
    select
      (p.fecha at time zone 'America/Lima')::date as dia,
      p.placa,
      count(*)::integer                           as posiciones,
      max(p.created_at)                           as ultima_carga
    from public.agrotrack_posiciones p
    where p.empresa_id = p_empresa_id
      and p.fecha >= (p_desde_dia::timestamp) at time zone 'America/Lima'
      and p.fecha <  ((p_hasta_dia + 1)::timestamp) at time zone 'America/Lima'
    group by 1, 2
  )
  select c.dia, c.placa, c.posiciones
  from conteo c
  left join public.agrotrack_visitas_dia_estado e
    on e.empresa_id = p_empresa_id and e.dia = c.dia and e.placa = c.placa
  where e.placa is null
     or e.posiciones <> c.posiciones
     or e.ultima_carga is distinct from c.ultima_carga
     -- el día de HOY sigue abierto: se recalcula si pasaron 10 min
     or (c.dia >= (now() at time zone 'America/Lima')::date
         and e.calculado_en < now() - interval '10 minutes')
  order by c.dia, c.placa;
$$;

revoke all on function public.agrotrack_visitas_dia_pendientes_interno(uuid, date, date) from public, anon, authenticated;
grant execute on function public.agrotrack_visitas_dia_pendientes_interno(uuid, date, date) to service_role;

-- ---------------------------------------------------------------------------
-- 4) RPC para la web y el agente (validan la membresía).
--    La web calcula placa por placa (cada llamada tarda < 1 s y nunca choca
--    con los 8 s); pg_cron hace lo mismo sin límite.
-- ---------------------------------------------------------------------------
drop function if exists public.agrotrack_visitas_dia_pendientes(uuid, date, date);

create function public.agrotrack_visitas_dia_pendientes(
  p_empresa_id uuid,
  p_desde_dia  date,
  p_hasta_dia  date
)
returns table (dia date, placa text, posiciones integer)
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select x.*
  from public.agrotrack_visitas_dia_pendientes_interno(p_empresa_id, p_desde_dia, p_hasta_dia) x
  where (select public.onboarding_es_miembro(p_empresa_id))
    and p_hasta_dia - p_desde_dia <= 62;
$$;

grant execute on function public.agrotrack_visitas_dia_pendientes(uuid, date, date)
  to authenticated, service_role;

drop function if exists public.agrotrack_calcular_visitas_dia(uuid, date, text);

create function public.agrotrack_calcular_visitas_dia(
  p_empresa_id uuid,
  p_dia        date,
  p_placa      text default null
)
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_catalog, pg_temp
as $$
begin
  if not (select public.onboarding_es_miembro(p_empresa_id)) then
    raise exception 'No perteneces a esta empresa.' using errcode = '42501';
  end if;
  return public.agrotrack_visitas_dia_calcular_interno(p_empresa_id, p_dia, p_placa);
end;
$$;

grant execute on function public.agrotrack_calcular_visitas_dia(uuid, date, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5) LECTURA: visitas guardadas (todas las unidades juntas), por páginas.
-- ---------------------------------------------------------------------------
drop function if exists public.agrotrack_visitas_dia_flota(uuid, date, date, text, text, integer, integer);

create function public.agrotrack_visitas_dia_flota(
  p_empresa_id uuid,
  p_desde_dia  date,
  p_hasta_dia  date,
  p_placa      text    default null,
  p_geocerca   text    default null,
  p_offset     integer default 0,
  p_limite     integer default 1000
)
returns table (
  dia                   date,
  placa                 text,
  unidad                text,
  geocerca              text,
  division              text,
  entrada               timestamptz,
  salida                timestamptz,
  duracion_segundos     integer,
  apagado_segundos      integer,
  ralenti_segundos      integer,
  viaje_segundos        integer,
  abierta               boolean,
  continua_dia_anterior boolean
)
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  -- 18/11/2026: antes se escaneaban TODAS las posiciones del rango con
  -- DISTINCT ON para sacar la descripción de cada placa (~72 buffers por
  -- fila devuelta, 4-7 s por página). Ahora solo se buscan las ~40 placas
  -- que tienen visitas, por índice (empresa_id, placa, fecha), y las
  -- geocercas se convierten una sola vez en vez de con un JOIN LATERAL por
  -- fila. Misma salida, lectura en milisegundos.
  with placas as (
    select distinct v.placa
    from public.agrotrack_visitas_dia v
    where v.empresa_id = p_empresa_id
      and v.dia between p_desde_dia and p_hasta_dia
      and (p_placa is null or v.placa = p_placa)
  ),
  unidades as (
    select pl.placa, u.unidad
    from placas pl
    left join lateral (
      select p.unidad from public.agrotrack_posiciones p
      where p.empresa_id = p_empresa_id
        and p.placa = pl.placa
        and p.fecha >= (p_desde_dia::timestamp) at time zone 'America/Lima'
        and p.fecha <  ((p_hasta_dia + 1)::timestamp) at time zone 'America/Lima'
      order by p.fecha desc
      limit 1
    ) u on true
  ),
  geos as (
    select distinct on (btrim(g.nombre)) btrim(g.nombre) as nombre, g.division
    from public.agrotrack_geocercas g
    where g.empresa_id = p_empresa_id
    order by btrim(g.nombre), g.activa desc, g.id
  )
  select v.dia, v.placa, coalesce(u.unidad, v.placa), v.geocerca, g.division,
         v.entrada, v.salida, v.duracion_segundos, v.apagado_segundos,
         v.ralenti_segundos, v.viaje_segundos, v.abierta, v.continua_dia_anterior
  from public.agrotrack_visitas_dia v
  left join unidades u on u.placa = v.placa
  left join geos g on btrim(v.geocerca) = g.nombre
  where (select public.onboarding_es_miembro(p_empresa_id))
    and v.empresa_id = p_empresa_id
    and v.dia between p_desde_dia and p_hasta_dia
    and (p_placa is null or v.placa = p_placa)
    and (p_geocerca is null or lower(btrim(v.geocerca)) = lower(btrim(p_geocerca)))
  order by v.dia, v.entrada, v.placa, v.geocerca
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limite, 1000), 1), 1000);
$$;

grant execute on function public.agrotrack_visitas_dia_flota(uuid, date, date, text, text, integer, integer)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6) TABLA DINÁMICA (la de las 6:30 a. m.): horas por placa x geocerca en el
--    rango de días, con apagado / ralentí / viajando. Una fila por par.
-- ---------------------------------------------------------------------------
drop function if exists public.agrotrack_tabla_geocercas_dia(uuid, date, date, text, text, integer, integer);

create function public.agrotrack_tabla_geocercas_dia(
  p_empresa_id uuid,
  p_desde_dia  date,
  p_hasta_dia  date,
  p_placa      text    default null,
  p_geocerca   text    default null,
  p_offset     integer default 0,
  p_limite     integer default 1000
)
returns table (
  placa             text,
  geocerca          text,
  visitas           bigint,
  duracion_segundos bigint,
  apagado_segundos  bigint,
  ralenti_segundos  bigint,
  viaje_segundos    bigint,
  primera_entrada   timestamptz,
  ultima_salida     timestamptz
)
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  select v.placa, v.geocerca,
         -- una visita partida por la medianoche cuenta una sola vez
         count(*) filter (where not v.continua_dia_anterior),
         coalesce(sum(v.duracion_segundos), 0)::bigint,
         coalesce(sum(v.apagado_segundos), 0)::bigint,
         coalesce(sum(v.ralenti_segundos), 0)::bigint,
         coalesce(sum(v.viaje_segundos), 0)::bigint,
         min(v.entrada), max(v.salida)
  from public.agrotrack_visitas_dia v
  where (select public.onboarding_es_miembro(p_empresa_id))
    and v.empresa_id = p_empresa_id
    and v.dia between p_desde_dia and p_hasta_dia
    and (p_placa is null or v.placa = p_placa)
    and (p_geocerca is null or lower(btrim(v.geocerca)) = lower(btrim(p_geocerca)))
  group by v.placa, v.geocerca
  order by v.placa, v.geocerca
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limite, 1000), 1), 1000);
$$;

grant execute on function public.agrotrack_tabla_geocercas_dia(uuid, date, date, text, text, integer, integer)
  to authenticated, service_role;

-- Vista de respaldo: horas trabajadas por máquina, día y geocerca (para
-- consultarla desde el SQL Editor o Power BI / Excel con la service key).
create or replace view public.agrotrack_v_horas_maquina_dia
with (security_invoker = true) as
select
  v.empresa_id,
  v.dia,
  v.placa,
  v.geocerca,
  count(*) filter (where not v.continua_dia_anterior)      as visitas,
  round(sum(coalesce(v.duracion_segundos, 0)) / 3600.0, 2) as horas_total,
  round(sum(v.apagado_segundos) / 3600.0, 2)               as horas_apagado,
  round(sum(v.ralenti_segundos) / 3600.0, 2)               as horas_ralenti,
  round(sum(v.viaje_segundos) / 3600.0, 2)                 as horas_viajando
from public.agrotrack_visitas_dia v
group by v.empresa_id, v.dia, v.placa, v.geocerca;

grant select on public.agrotrack_v_horas_maquina_dia to authenticated;

-- ---------------------------------------------------------------------------
-- 7) Cálculo automático (pg_cron): cada 10 minutos, hoy y ayer de todas las
--    empresas con posiciones, solo lo pendiente.
-- ---------------------------------------------------------------------------
drop function if exists public.agrotrack_visitas_dia_cron(integer);

create function public.agrotrack_visitas_dia_cron(p_dias integer default 2)
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_catalog, pg_temp
as $$
declare
  r       record;
  v_total integer := 0;
  v_hoy   date := (now() at time zone 'America/Lima')::date;
begin
  for r in
    select distinct e.empresa_id, x.dia
    from (select distinct p.empresa_id
            from public.agrotrack_posiciones p
           where p.fecha >= now() - make_interval(days => greatest(p_dias, 1) + 1)) e
    cross join lateral (
      select distinct q.dia
      from public.agrotrack_visitas_dia_pendientes_interno(
             e.empresa_id, v_hoy - (greatest(p_dias, 1) - 1), v_hoy) q
    ) x
  loop
    -- Un día entero de una vez: corre como postgres, sin el límite de 8 s.
    v_total := v_total + public.agrotrack_visitas_dia_calcular_interno(r.empresa_id, r.dia, null);
  end loop;
  return v_total;
end;
$$;

revoke all on function public.agrotrack_visitas_dia_cron(integer) from public, anon, authenticated;
grant execute on function public.agrotrack_visitas_dia_cron(integer) to service_role;

-- Programar con pg_cron (Supabase: Database > Extensions > pg_cron, o
-- Integrations > Cron). Si la extensión no está disponible, el bloque solo
-- avisa: la web y el agente siguen calculando lo pendiente por su cuenta.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron no disponible (%). Actívalo en Database > Extensions y vuelve a ejecutar este bloque.', sqlerrm;
    return;
  end;
  begin
    perform cron.unschedule('agrotrack-visitas-dia')
      where exists (select 1 from cron.job where jobname = 'agrotrack-visitas-dia');
    perform cron.schedule('agrotrack-visitas-dia', '*/10 * * * *',
                          'select public.agrotrack_visitas_dia_cron(2)');
    raise notice 'pg_cron: visitas de geocercas programadas cada 10 minutos.';
  exception when others then
    raise notice 'No se pudo programar pg_cron (%).', sqlerrm;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Comprobaciones (opcionales, en el SQL Editor):
--   -- calcular a mano los últimos 7 días (una vez, tras instalar):
--   select public.agrotrack_visitas_dia_calcular_interno('<empresa_id>', d::date, null)
--     from generate_series(current_date - 7, current_date, interval '1 day') d;
--   select * from public.agrotrack_v_horas_maquina_dia
--     where empresa_id = '<empresa_id>' and dia = current_date - 1
--     order by placa, geocerca;
-- ---------------------------------------------------------------------------
