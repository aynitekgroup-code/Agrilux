-- Cruce de la última posición Hunter con geocercas existentes de la empresa.
-- No crea ni modifica geocercas, grupos, políticas RLS ni datos de Zonar.
begin;
create or replace function public.agrotrack_hunter_estado_geocercas(
  p_empresa_id uuid, p_offset integer default 0, p_limite integer default 100
)
returns table (
  equipo_id text, unidad text, fecha timestamptz, velocidad_kmh numeric,
  ignicion boolean, direccion text, actualizado_en timestamptz,
  geocerca text, division_geografica text
)
language sql stable security definer
set search_path = public, extensions, pg_catalog, pg_temp
as $$
  with unidades as materialized (
    select v.* from public.agrotrack_hunter_estado_vivo v
    where v.empresa_id = p_empresa_id
      and (select public.onboarding_es_miembro(p_empresa_id))
    order by v.equipo_id
    limit least(greatest(coalesce(p_limite, 100), 1), 200)
    offset greatest(coalesce(p_offset, 0), 0)
  ), geocercas as materialized (
    select g.nombre, g.division,
      ((g.geometria->'bbox')->>0)::double precision as lon_min,
      ((g.geometria->'bbox')->>1)::double precision as lat_min,
      ((g.geometria->'bbox')->>2)::double precision as lon_max,
      ((g.geometria->'bbox')->>3)::double precision as lat_max,
      st_setsrid(st_geomfromgeojson(g.geometria::text), 4326) as poligono,
      case when coalesce(g.tipo, '') = 'distrito' then 2
           when coalesce(g.tipo, '') = 'oficina' then 1 else 0 end as prioridad
    from public.agrotrack_geocercas_reportes g
    where g.empresa_id = p_empresa_id and g.activa is true
      and coalesce(g.incluir_reportes, true)
      and jsonb_typeof(g.geometria) = 'object'
      and g.geometria->>'type' in ('Polygon', 'MultiPolygon')
      and jsonb_typeof(g.geometria->'bbox') = 'array'
      and (select public.onboarding_es_miembro(p_empresa_id))
  )
  select v.equipo_id, v.unidad, v.fecha, v.velocidad_kmh, v.ignicion,
    v.direccion, v.actualizado_en, g.nombre, g.division
  from unidades v
  left join lateral (
    select c.nombre, c.division from geocercas c
    where v.latitud between c.lat_min and c.lat_max
      and v.longitud between c.lon_min and c.lon_max
      and st_covers(c.poligono, st_setsrid(st_makepoint(v.longitud, v.latitud), 4326))
    order by c.prioridad, c.nombre limit 1
  ) g on true
  order by v.equipo_id;
$$;
revoke all on function public.agrotrack_hunter_estado_geocercas(uuid, integer, integer) from public, anon;
grant execute on function public.agrotrack_hunter_estado_geocercas(uuid, integer, integer) to authenticated;
commit;
