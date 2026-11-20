-- ============================================================================
-- Agrilux · P1 estructural: geometría indexada + polígonos subdivididos
-- ============================================================================
-- 18/11/2026. Idempotente. NO toca empresas, fundos, lotes ni parcelas de
-- AGRILUX; solo agrega una columna derivada a agrotrack_posiciones y tablas
-- auxiliares nuevas de solo lectura para los reportes de geocercas.
--
-- 1) agrotrack_posiciones.geom: punto PostGIS generado desde latitud/longitud
--    + índice GIST. Las RPC de reportes siguen usando el punto con
--    ST_MakePoint cuando ya tienen lat/lon en memoria; la columna queda lista
--    para consultas espaciales indexadas sobre posiciones.
-- 2) agrotrack_geocercas_subdiv: cada polígono de agrotrack_geocercas se parte
--    con ST_Subdivide y se guarda con GIST. Es la tabla auxiliar que deben
--    leer los ST_Contains/ST_Intersects de los reportes.
-- 3) agrotrack_geocercas_reportes: vista con la MISMA forma que las geocercas
--    originales (geojson con bbox), pero cada fila es un fragmento ya
--    indexado. Las RPC solo cambian el FROM:
--      from public.agrotrack_geocercas g
--      -> from public.agrotrack_geocercas_reportes g
--    El resto del SQL (filtros activa/incluir_reportes, bbox, ST_Contains)
--    queda idéntico y el resultado es el mismo.
-- 4) agrotrack_refrescar_geocercas_subdiv(): se llama al terminar una
--    importación o edición de geocercas (también se ejecuta aquí una vez).
-- ============================================================================

-- PostGIS vive en el esquema "extensions" en este proyecto de Supabase.
set search_path = public, extensions, pg_catalog, pg_temp;

-- 1) Punto geométrico en posiciones -----------------------------------------
alter table public.agrotrack_posiciones
  add column if not exists geom extensions.geometry(Point, 4326)
  generated always as (
    st_setsrid(st_makepoint(longitud, latitud), 4326)
  ) stored;

create index if not exists agrotrack_posiciones_geom_gix
  on public.agrotrack_posiciones using gist (geom);

-- 2) Tabla auxiliar de polígonos subdivididos -------------------------------
create table if not exists public.agrotrack_geocercas_subdiv (
  id                bigint generated always as identity primary key,
  empresa_id        uuid not null,
  geocerca_id       uuid,
  nombre            text not null,
  division          text,
  activa            boolean not null default true,
  incluir_reportes  boolean not null default true,
  geometria         jsonb not null,
  geom              extensions.geometry(Geometry, 4326) not null
);

create index if not exists agrotrack_geocercas_subdiv_gix
  on public.agrotrack_geocercas_subdiv using gist (geom);
create index if not exists agrotrack_geocercas_subdiv_empresa_nombre_idx
  on public.agrotrack_geocercas_subdiv (empresa_id, nombre);

revoke all on public.agrotrack_geocercas_subdiv from public, anon, authenticated;
grant select on public.agrotrack_geocercas_subdiv to service_role;

-- 3) Vista de reemplazo con la forma de agrotrack_geocercas -----------------
create or replace view public.agrotrack_geocercas_reportes as
select
  g.id,
  g.empresa_id,
  g.fundo_id,
  g.lote_id,
  btrim(g.nombre)                       as nombre,
  g.tipo,
  g.forma,
  g.centro_lat,
  g.centro_lon,
  g.radio_m,
  g.velocidad_max_kmh,
  g.color,
  s.activa,
  g.created_at,
  g.updated_at,
  g.source_key,
  g.division,
  g.anexo,
  g.distrito,
  g.provincia,
  g.area_declarada,
  jsonb_set(
    st_asgeojson(s.geom, 9, 0)::jsonb,
    '{bbox}',
    to_jsonb(array[
      st_xmin(s.geom), st_ymin(s.geom), st_xmax(s.geom), st_ymax(s.geom)
    ])
  )                                     as geometria,
  g.atributos_fuente,
  g.creado_por,
  s.geom,
  g.aplica_todas,
  g.area_parqueo,
  g.salvar_como_zona,
  g.aviso_entrada,
  g.aviso_salida,
  g.aviso_permanencia,
  g.permanencia_min,
  g.margen_salida_m,
  g.notificar_correo,
  g.registrar_excel,
  g.vigilancia_activa,
  g.poligono,
  s.incluir_reportes
from public.agrotrack_geocercas_subdiv s
join public.agrotrack_geocercas g on g.id = s.geocerca_id;

revoke all on public.agrotrack_geocercas_reportes from public, anon, authenticated;
grant select on public.agrotrack_geocercas_reportes to service_role;

comment on view public.agrotrack_geocercas_reportes is
  'Geocercas subdivididas (ST_Subdivide) con GIST. Misma forma que agrotrack_geocercas; la usan las RPC de reportes para ST_Contains.';

-- 4) Refresco de la tabla auxiliar ------------------------------------------
create or replace function public.agrotrack_refrescar_geocercas_subdiv()
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_catalog, pg_temp
as $$
declare
  filas integer;
begin
  delete from public.agrotrack_geocercas_subdiv;

  insert into public.agrotrack_geocercas_subdiv
    (empresa_id, geocerca_id, nombre, division, activa, incluir_reportes, geometria, geom)
  select
    g.empresa_id,
    g.id,
    btrim(g.nombre),
    g.division,
    coalesce(g.activa, false),
    coalesce(g.incluir_reportes, true),
    jsonb_set(
      st_asgeojson(parte.geom, 9, 0)::jsonb,
      '{bbox}',
      to_jsonb(array[
        st_xmin(parte.geom), st_ymin(parte.geom),
        st_xmax(parte.geom), st_ymax(parte.geom)
      ])
    ),
    parte.geom
  from public.agrotrack_geocercas g
  cross join lateral st_subdivide(
    st_setsrid(st_geomfromgeojson(g.geometria::text), 4326),
    64
  ) as parte(geom)
  where g.geometria is not null
    and jsonb_typeof(g.geometria) = 'object'
    and g.geometria ->> 'type' in ('Polygon', 'MultiPolygon');

  get diagnostics filas = row_count;
  return filas;
end;
$$;

grant execute on function public.agrotrack_refrescar_geocercas_subdiv()
  to authenticated, service_role;

-- Carga inicial (idempotente: se puede repetir tras cualquier importación).
select public.agrotrack_refrescar_geocercas_subdiv() as fragmentos_creados;

select
  (select count(*) from public.agrotrack_geocercas_subdiv) as fragmentos,
  (select count(distinct geocerca_id) from public.agrotrack_geocercas_subdiv) as geocercas,
  (select count(*) from public.agrotrack_posiciones where geom is not null) as posiciones_con_punto;
