-- ============================================================================
-- AGRILUX ⇄ ZONAR EN TIEMPO REAL (14/11/2026)
--
-- Ejecutar completo en el SQL Editor de Supabase DESPUÉS de
-- scripts/agrotrack-posiciones.sql y scripts/agrotrack-geocercas-reportes.sql.
-- Repetible e idempotente: no borra posiciones ni toca las políticas de
-- agrotrack_posiciones ni de agrotrack_geocercas.
--
-- Cómo fluye el dato:
--   Zonar (app.tsomobile.com)
--     └─ agente local "node agente.mjs envivo" (PC de Carlos, cada 2 min)
--          └─ upsert en public.agrotrack_posiciones (misma clave source_key
--             que la carga manual y la corrida diaria: nunca duplica)
--               └─ trigger → public.agrotrack_estado_vivo (1 fila por placa,
--                  siempre la última posición)
--                    └─ Supabase Realtime → la web se actualiza sola
--                       (Status de maquinaria, localizador, mapa)
--
-- Lo que crea:
--   1) public.agrotrack_estado_vivo          última posición de cada placa
--   2) trigger en agrotrack_posiciones        la mantiene al día (por sentencia,
--                                             barato aunque entren 36 mil filas)
--   3) public.agrotrack_zonar_latidos         "latido" del agente: cuándo leyó
--                                             Zonar por última vez y si falló
--   4) RPC agrotrack_estado_vivo_flota        estado + geocerca actual + minutos
--                                             sin reportar, para la web
--   5) RPC agrotrack_registrar_latido         la usa el agente
--   6) publicación supabase_realtime          para las dos tablas nuevas
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Última posición por placa
-- ---------------------------------------------------------------------------
create table if not exists public.agrotrack_estado_vivo (
  empresa_id    uuid        not null,
  placa         text        not null,
  unidad        text,
  descripcion   text,
  fecha         timestamptz not null,
  evento        text,
  velocidad     numeric,
  direccion     text,
  pt_referencia text,
  latitud       double precision not null,
  longitud      double precision not null,
  posicion_id   bigint,
  actualizado_en timestamptz not null default now(),
  primary key (empresa_id, placa)
);

alter table public.agrotrack_estado_vivo enable row level security;
drop policy if exists agrotrack_estado_vivo_select_member on public.agrotrack_estado_vivo;
create policy agrotrack_estado_vivo_select_member on public.agrotrack_estado_vivo
  for select using (public.onboarding_es_miembro(empresa_id));
grant select on public.agrotrack_estado_vivo to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Trigger por SENTENCIA: una sola actualización por placa y por lote
--    insertado (la carga diaria de 36 mil filas no hace 36 mil upserts).
-- ---------------------------------------------------------------------------
create or replace function public.agrotrack_estado_vivo_desde_posiciones()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
begin
  insert into public.agrotrack_estado_vivo as ev
    (empresa_id, placa, unidad, descripcion, fecha, evento, velocidad, direccion,
     pt_referencia, latitud, longitud, posicion_id, actualizado_en)
  select distinct on (n.empresa_id, n.placa)
    n.empresa_id, n.placa, n.unidad, n.descripcion, n.fecha, n.evento, n.velocidad,
    n.direccion, n.pt_referencia, n.latitud, n.longitud, n.id, now()
  from nuevas n
  order by n.empresa_id, n.placa, n.fecha desc, coalesce(n.secuencia, 0) desc, n.id desc
  on conflict (empresa_id, placa) do update
    set unidad        = excluded.unidad,
        descripcion   = excluded.descripcion,
        fecha         = excluded.fecha,
        evento        = excluded.evento,
        velocidad     = excluded.velocidad,
        direccion     = excluded.direccion,
        pt_referencia = excluded.pt_referencia,
        latitud       = excluded.latitud,
        longitud      = excluded.longitud,
        posicion_id   = excluded.posicion_id,
        actualizado_en = now()
    -- una carga de días pasados nunca pisa una posición más nueva
    where excluded.fecha >= ev.fecha;
  return null;
end;
$$;

drop trigger if exists agrotrack_posiciones_estado_vivo on public.agrotrack_posiciones;
create trigger agrotrack_posiciones_estado_vivo
  after insert on public.agrotrack_posiciones
  referencing new table as nuevas
  for each statement
  execute function public.agrotrack_estado_vivo_desde_posiciones();

-- Carga inicial con lo que ya existe (idempotente).
insert into public.agrotrack_estado_vivo as ev
  (empresa_id, placa, unidad, descripcion, fecha, evento, velocidad, direccion,
   pt_referencia, latitud, longitud, posicion_id)
select distinct on (p.empresa_id, p.placa)
  p.empresa_id, p.placa, p.unidad, p.descripcion, p.fecha, p.evento, p.velocidad,
  p.direccion, p.pt_referencia, p.latitud, p.longitud, p.id
from public.agrotrack_posiciones p
order by p.empresa_id, p.placa, p.fecha desc, coalesce(p.secuencia, 0) desc, p.id desc
on conflict (empresa_id, placa) do update
  set unidad = excluded.unidad, descripcion = excluded.descripcion, fecha = excluded.fecha,
      evento = excluded.evento, velocidad = excluded.velocidad, direccion = excluded.direccion,
      pt_referencia = excluded.pt_referencia, latitud = excluded.latitud,
      longitud = excluded.longitud, posicion_id = excluded.posicion_id
  where excluded.fecha >= ev.fecha;

-- ---------------------------------------------------------------------------
-- 3) Latido del agente de Zonar
-- ---------------------------------------------------------------------------
create table if not exists public.agrotrack_zonar_latidos (
  empresa_id     uuid        not null,
  modo           text        not null,          -- 'envivo' | 'diario'
  ultima_lectura timestamptz not null default now(),
  ok             boolean     not null default true,
  unidades       integer,
  nuevas         integer,
  mensaje        text,
  primary key (empresa_id, modo)
);

alter table public.agrotrack_zonar_latidos enable row level security;
drop policy if exists agrotrack_zonar_latidos_select_member on public.agrotrack_zonar_latidos;
create policy agrotrack_zonar_latidos_select_member on public.agrotrack_zonar_latidos
  for select using (public.onboarding_es_miembro(empresa_id));
grant select on public.agrotrack_zonar_latidos to authenticated;

drop function if exists public.agrotrack_registrar_latido(uuid, text, boolean, integer, integer, text);

create function public.agrotrack_registrar_latido(
  p_empresa_id uuid,
  p_modo       text,
  p_ok         boolean default true,
  p_unidades   integer default null,
  p_nuevas     integer default null,
  p_mensaje    text    default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
begin
  if not (select public.onboarding_es_miembro(p_empresa_id)) then
    raise exception 'No perteneces a esta empresa.' using errcode = '42501';
  end if;
  insert into public.agrotrack_zonar_latidos as l
    (empresa_id, modo, ultima_lectura, ok, unidades, nuevas, mensaje)
  values (p_empresa_id, left(coalesce(p_modo, 'envivo'), 20), now(), coalesce(p_ok, true),
          p_unidades, p_nuevas, left(p_mensaje, 500))
  on conflict (empresa_id, modo) do update
    set ultima_lectura = now(), ok = excluded.ok, unidades = excluded.unidades,
        nuevas = excluded.nuevas, mensaje = excluded.mensaje;
end;
$$;

grant execute on function public.agrotrack_registrar_latido(uuid, text, boolean, integer, integer, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) Estado en vivo para la web: una fila por placa, con la geocerca donde
--    está AHORA (PostGIS, mismo prefilter de bbox que los reportes), el
--    estado (En ruta / Detenido / Apagado) y los minutos sin reportar.
-- ---------------------------------------------------------------------------
drop function if exists public.agrotrack_estado_vivo_flota(uuid);

create function public.agrotrack_estado_vivo_flota(p_empresa_id uuid)
returns table (
  placa              text,
  unidad             text,
  descripcion        text,
  fecha              timestamptz,
  evento             text,
  velocidad          numeric,
  direccion          text,
  latitud            double precision,
  longitud           double precision,
  estado             text,     -- 'En ruta' | 'Detenido' | 'Apagado'
  minutos_sin_reportar integer,
  geocerca           text,
  geocerca_division  text,
  actualizado_en     timestamptz
)
language sql
stable
security definer
set search_path = public, extensions, pg_catalog, pg_temp
as $$
  with geocercas as materialized (
    select
      g.nombre,
      g.division,
      ((g.geometria->'bbox')->>0)::double precision           as lon_min,
      ((g.geometria->'bbox')->>1)::double precision           as lat_min,
      ((g.geometria->'bbox')->>2)::double precision           as lon_max,
      ((g.geometria->'bbox')->>3)::double precision           as lat_max,
      ST_SetSRID(ST_GeomFromGeoJSON(g.geometria::text), 4326) as poligono,
      -- los lotes ganan a distritos/divisiones cuando se solapan
      case when coalesce(g.tipo, '') in ('distrito') then 2
           when coalesce(g.tipo, '') in ('oficina') then 1 else 0 end as prioridad
    from public.agrotrack_geocercas g
    where g.empresa_id = p_empresa_id
      and g.activa is true
      and coalesce(g.incluir_reportes, true)
      and g.geometria is not null
      and jsonb_typeof(g.geometria) = 'object'
      and (g.geometria->>'type') in ('Polygon', 'MultiPolygon')
      and jsonb_typeof(g.geometria->'bbox') = 'array'
  )
  select
    v.placa, v.unidad, v.descripcion, v.fecha, v.evento, v.velocidad, v.direccion,
    v.latitud, v.longitud,
    case
      when lower(coalesce(v.evento, '')) like '%apagad%'
        or lower(coalesce(v.evento, '')) like '%estacionad%' then 'Apagado'
      when coalesce(v.velocidad, 0) > 5 then 'En ruta'
      else 'Detenido'
    end,
    greatest(0, floor(extract(epoch from (now() - v.fecha)) / 60))::integer,
    cg.nombre,
    cg.division,
    v.actualizado_en
  from public.agrotrack_estado_vivo v
  left join lateral (
    select g2.nombre, g2.division
    from geocercas g2
    where v.latitud  between g2.lat_min and g2.lat_max
      and v.longitud between g2.lon_min and g2.lon_max
      and ST_Contains(g2.poligono, ST_SetSRID(ST_MakePoint(v.longitud, v.latitud), 4326))
    order by g2.prioridad, g2.nombre
    limit 1
  ) cg on true
  where (select public.onboarding_es_miembro(p_empresa_id))
    and v.empresa_id = p_empresa_id
  order by v.placa;
$$;

grant execute on function public.agrotrack_estado_vivo_flota(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5) Realtime: la web se suscribe a los cambios de estas dos tablas.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.agrotrack_estado_vivo;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.agrotrack_zonar_latidos;
    exception when duplicate_object then null;
    end;
  else
    raise notice 'No existe la publicación supabase_realtime (¿no es Supabase?). La web hará consultas cada minuto.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Comprobaciones:
--   select * from public.agrotrack_estado_vivo order by fecha desc limit 20;
--   select * from public.agrotrack_zonar_latidos;
-- ---------------------------------------------------------------------------
