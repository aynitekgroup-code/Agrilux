-- ---------------------------------------------------------------------------
-- optimizar-estado-vivo-flota.sql
-- Idempotente · ejecutar en el SQL Editor de Supabase.
--
-- Problema: la RPC agrotrack_estado_vivo_flota tardaba ~10.6 s por llamada
-- (media de 2.9 s con 1,742 llamadas = 5,133 s de CPU acumulada) y saturaba
-- la base. La causa: construía sus geocercas a través de la VISTA
-- agrotrack_geocercas_reportes, que serializa cada polígono con
-- ST_AsGeoJSON(geom, 9) — 1,141 polígonos por llamada, evaluado 4 veces en
-- el filtro — y la función volvía a parsear el resultado con
-- ST_GeomFromGeoJSON (roundtrip JSON completo).
--
-- Solución: leer agrotrack_geocercas_subdiv.geom directamente (la misma
-- columna que alimenta la vista, SRID 4326, ya con índice GIST
-- agrotrack_geocercas_subdiv_gix). ST_XMin/ST_YMin/ST_XMax/ST_YMax leen el
-- bounding box ya calculado en la estructura geometry: sin serialización.
-- Misma salida, misma semántica (prioridad de lotes > oficinas > distritos,
-- bbox como prefiltro antes de ST_Contains).
--
-- Esperado: 10.6 s → <100 ms por llamada.
-- ---------------------------------------------------------------------------

create or replace function public.agrotrack_estado_vivo_flota(p_empresa_id uuid)
returns table(
  placa                text,
  unidad               text,
  descripcion          text,
  fecha                timestamp with time zone,
  evento               text,
  velocidad            numeric,
  direccion            text,
  latitud              double precision,
  longitud             double precision,
  estado               text,
  minutos_sin_reportar integer,
  geocerca             text,
  geocerca_division    text,
  actualizado_en       timestamp with time zone
)
language sql
stable
security definer
set search_path to 'public', 'extensions', 'pg_catalog', 'pg_temp'
as $function$
  with geocercas as materialized (
    select
      btrim(g.nombre)                         as nombre,
      g.division,
      ST_XMin(s.geom)::double precision       as lon_min,
      ST_YMin(s.geom)::double precision       as lat_min,
      ST_XMax(s.geom)::double precision       as lon_max,
      ST_YMax(s.geom)::double precision       as lat_max,
      s.geom                                  as poligono,
      -- los lotes ganan a distritos/divisiones cuando se solapan
      case when coalesce(g.tipo, '') in ('distrito') then 2
           when coalesce(g.tipo, '') in ('oficina') then 1 else 0 end as prioridad
    from public.agrotrack_geocercas_subdiv s
    join public.agrotrack_geocercas g on g.id = s.geocerca_id
    where g.empresa_id = p_empresa_id
      and s.activa is true
      and coalesce(s.incluir_reportes, true)
      and s.geom is not null
      and ST_GeometryType(s.geom) in ('ST_Polygon', 'ST_MultiPolygon')
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
$function$;

revoke all on function public.agrotrack_estado_vivo_flota(uuid) from public, anon;
grant execute on function public.agrotrack_estado_vivo_flota(uuid) to authenticated, service_role;

-- Estadísticas: la tabla agrotrack_posiciones nunca se analizó (el planificador
-- creía que tenía 9,854 filas en vez de ~1 M y elegía planes malos).
analyze public.agrotrack_posiciones;

-- Verificación (debe volver en milisegundos):
-- explain (analyze, costs off)
--   select * from public.agrotrack_estado_vivo_flota('9ab3a922-1f29-4f06-be93-d6bd7f2457d1');
