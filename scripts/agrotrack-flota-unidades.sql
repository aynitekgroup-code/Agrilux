-- ============================================================================
-- Agrilux · La flota son 44 unidades (P1 del reporte del usuario)
-- ============================================================================
-- 18/11/2026
--
-- SINTOMA
--   Todos los reportes mostraban 41 unidades de 44. Las 3 que faltaban no
--   aparecian NI EN CERO (ni en actividad, ni en estatus, ni en "sin
--   reportar"), porque los reportes se construian con
--   "select distinct placa from agrotrack_posiciones": una unidad que nunca
--   envio un punto GPS simplemente no existia para el sistema.
--
-- DIAGNOSTICO (base real, 18/11/2026)
--   agrotrack_posiciones ......... 41 placas
--   agrotrack_estado_vivo ........ 41 placas (trigger desde posiciones)
--   agrotrack_grupos_unidades .... 44 placas  <-- lista maestra de la flota
--   agrotrack_vehiculos .......... 3 placas (2587-1K, M2-1737, M6E-859)
--   Las 3 de agrotrack_vehiculos son exactamente las 3 que no tienen
--   posiciones (marcadas "fuera_servicio"). 41 + 3 = 44.
--
-- ARREGLO
--   1) Vista public.agrotrack_flota_unidades: la lista maestra, unida de las
--      tres fuentes para que ninguna unidad desaparezca:
--        grupos_unidades (44) U estado_vivo (41) U vehiculos activos (3)
--      Es una vista (no una tabla): se mantiene sola cuando entra una placa
--      nueva, sin migraciones ni procesos de sincronizacion.
--   2) Las RPC de reportes parten de esa vista con LEFT JOIN, asi las
--      unidades sin datos salen en ceros / "sin reporte".
--
--   Funciones actualizadas:
--     agrotrack_periodo_flota        (unidades = 44)
--     agrotrack_resumen_flota        (44 filas)
--     agrotrack_estado_unidades_flota(44 filas, las 3 con fecha null)
--     agrotrack_actividad_flota      (universo = 44)
--     agrotrack_estado_vivo_flota    (44 filas, las 3 sin coordenadas)
--
--   La regla de membresia se mantiene en cada funcion (la vista no tiene RLS,
--   pero solo la leen funciones security definer que ya validan membresia).
--
-- Idempotente: se puede ejecutar varias veces.
-- No toca datos: solo crea una vista y recrea funciones.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) Lista maestra de unidades de la flota
-- ---------------------------------------------------------------------------
create or replace view public.agrotrack_flota_unidades as
with placas as (
  select empresa_id, placa from public.agrotrack_grupos_unidades
  union
  select empresa_id, placa from public.agrotrack_estado_vivo
  union
  select empresa_id, placa from public.agrotrack_vehiculos where activo is true
)
select
  p.empresa_id,
  p.placa,
  g.grupo
from placas p
left join public.agrotrack_grupos_unidades g
  on g.empresa_id = p.empresa_id
 and g.placa = p.placa;

comment on view public.agrotrack_flota_unidades is
  'Lista maestra de unidades de la flota (grupos + estado vivo + vehiculos activos). Los reportes parten de aqui con LEFT JOIN para que una unidad sin posiciones aparezca en ceros.';

revoke all on public.agrotrack_flota_unidades from public, anon, authenticated;
grant select on public.agrotrack_flota_unidades to service_role;


-- ---------------------------------------------------------------------------
-- 2) Periodo: el conteo de unidades es el de la flota, no el de posiciones
-- ---------------------------------------------------------------------------
create or replace function public.agrotrack_periodo_flota(p_empresa_id uuid)
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
    (select min(p.fecha) from public.agrotrack_posiciones p
      where p.empresa_id = p_empresa_id) as desde,
    (select max(p.fecha) from public.agrotrack_posiciones p
      where p.empresa_id = p_empresa_id) as hasta,
    (select count(*) from public.agrotrack_flota_unidades f
      where f.empresa_id = p_empresa_id) as unidades,
    (select count(*) from public.agrotrack_posiciones p
      where p.empresa_id = p_empresa_id) as registros
  -- Misma regla que la RLS, evaluada UNA sola vez: un no-miembro ve 0 filas.
  where (select public.onboarding_es_miembro(p_empresa_id));
$$;

grant execute on function public.agrotrack_periodo_flota(uuid)
  to anon, authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 3) Resumen por unidad: una fila por cada unidad de la flota
--    (las que no reportaron quedan con km 0 y sin última posición).
-- ---------------------------------------------------------------------------
create or replace function public.agrotrack_resumen_flota(
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
  with flota as (
    select f.placa, f.grupo
    from public.agrotrack_flota_unidades f
    where f.empresa_id = p_empresa_id
      and (select public.onboarding_es_miembro(p_empresa_id))
  ),
  base as (
    select
      p.id, p.placa, p.unidad, p.descripcion, p.fecha, p.secuencia,
      p.evento, p.velocidad, p.latitud, p.longitud
    from public.agrotrack_posiciones p
    -- Misma regla que la RLS, evaluada UNA sola vez: un no-miembro ve 0 filas.
    where (select public.onboarding_es_miembro(p_empresa_id))
      and p.empresa_id = p_empresa_id
      and p.fecha >= coalesce(p_desde, '-infinity'::timestamptz)
      and p.fecha <= coalesce(p_hasta, 'infinity'::timestamptz)
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
  ),
  -- Un solo GROUP BY por placa en lugar de tres pasadas y dos joins.
  -- La última posición es la fila sin siguiente (sig_fecha is null).
  agregado as (
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
  )
  select
    f.placa                                                   as placa,
    coalesce(a.unidad, f.placa)                               as unidad,
    coalesce(a.descripcion, f.grupo, f.placa)                 as descripcion,
    a.ultimo_evento                                           as ultimo_evento,
    a.ultima_fecha                                            as ultima_fecha,
    a.ultima_lat                                              as ultima_lat,
    a.ultima_lon                                              as ultima_lon,
    a.ultima_velocidad                                        as ultima_velocidad,
    coalesce(a.km_recorridos, 0)                              as km_recorridos,
    coalesce(a.eventos_alta_velocidad, 0)                     as eventos_alta_velocidad
  from flota f
  left join agregado a on a.placa = f.placa
  order by f.placa;
$$;

grant execute on function public.agrotrack_resumen_flota(uuid, timestamptz, timestamptz)
  to anon, authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 4) Estado de unidades: una fila por unidad de la flota. Las que nunca
--    reportaron salen con ultima_fecha null (la UI las muestra "sin reporte").
-- ---------------------------------------------------------------------------
create or replace function public.agrotrack_estado_unidades_flota(
  p_empresa_id uuid,
  p_desde      timestamptz default null,
  p_hasta      timestamptz default null,
  p_limite     integer     default 500
)
returns table (
  placa             text,
  unidad            text,
  ultima_fecha      timestamptz,
  ultimo_evento     text,
  ultima_velocidad  numeric,
  direccion         text,
  latitud           double precision,
  longitud          double precision,
  geocerca          text,
  geocerca_division text,
  geocerca_ultima       text,
  geocerca_ultima_fecha timestamptz
)
language sql
stable
security definer
set search_path = public, extensions, pg_catalog, pg_temp
as $$
  with flota as (
    select f.placa, f.grupo
    from public.agrotrack_flota_unidades f
    where f.empresa_id = p_empresa_id
      and (select public.onboarding_es_miembro(p_empresa_id))
  ),
  -- Última posición de cada placa en el rango, en una sola pasada.
  ultimos as (
    select distinct on (p.placa)
      p.placa,
      p.unidad,
      p.fecha,
      p.evento,
      p.velocidad,
      p.direccion,
      p.latitud,
      p.longitud
    from public.agrotrack_posiciones p
    -- Misma regla que la RLS, evaluada UNA sola vez: un no-miembro ve 0 filas.
    where (select public.onboarding_es_miembro(p_empresa_id))
      and p.empresa_id = p_empresa_id
      and p.fecha >= coalesce(p_desde, '-infinity'::timestamptz)
      and p.fecha <= coalesce(p_hasta, 'infinity'::timestamptz)
      and p.latitud is not null
      and p.longitud is not null
    order by p.placa, p.fecha desc, coalesce(p.secuencia, 0) desc, p.id desc
  ),
  -- 129 filas: mismo prefilter de bbox + conversión única que agrotrack_lotes_flota.
  geocercas as materialized (
    select
      g.nombre,
      g.division,
      ((g.geometria->'bbox')->>0)::double precision           as lon_min,
      ((g.geometria->'bbox')->>1)::double precision           as lat_min,
      ((g.geometria->'bbox')->>2)::double precision           as lon_max,
      ((g.geometria->'bbox')->>3)::double precision           as lat_max,
      ST_SetSRID(ST_GeomFromGeoJSON(g.geometria::text), 4326) as poligono
    from public.agrotrack_geocercas g
    where g.empresa_id = p_empresa_id
      and g.activa is true
      -- Filtra por incluir_reportes (todas activas tras el UPDATE de la
      -- sección 0.5: oficinas y distritos también pueden ser "geocerca actual").
      and g.incluir_reportes
      and g.geometria is not null
      and jsonb_typeof(g.geometria) = 'object'
      and (g.geometria->>'type') in ('Polygon', 'MultiPolygon')
      and jsonb_typeof(g.geometria->'bbox') = 'array'
  )
  select
    f.placa                                                    as placa,
    coalesce(u.unidad, f.placa)                                as unidad,
    u.fecha                                                    as ultima_fecha,
    u.evento                                                   as ultimo_evento,
    u.velocidad                                                as ultima_velocidad,
    u.direccion,
    u.latitud,
    u.longitud,
    cg.nombre                                                  as geocerca,
    cg.division                                                as geocerca_division,
    cg2.nombre                                                 as geocerca_ultima,
    cg2.fecha                                                  as geocerca_ultima_fecha
  from flota f
  left join ultimos u on u.placa = f.placa
  -- Geocerca actual: el primer polígono (orden alfabético, para que el
  -- resultado sea estable si dos se solapan) que contiene la última posición.
  left join lateral (
    select g2.nombre, g2.division
    from geocercas g2
    where u.latitud  between g2.lat_min and g2.lat_max
      and u.longitud between g2.lon_min and g2.lon_max
      and ST_Contains(g2.poligono, ST_SetSRID(ST_MakePoint(u.longitud, u.latitud), 4326))
    order by g2.nombre
    limit 1
  ) cg on true
  -- Fallback pedido por el Ing. Carlos Perez: si la última posición queda
  -- fuera (unidad estacionada en el patio al cierre), se muestra la ÚLTIMA
  -- geocerca de campo en la que estuvo: el pt_referencia del evento de Zonar
  -- más reciente de la placa en el rango, cruzado contra las geocercas con
  -- incluir_reportes (hoy todas: oficinas y distritos también entran).
  left join lateral (
    select g3.nombre, max(p2.fecha) as fecha
    from public.agrotrack_posiciones p2
    join geocercas g3
      on btrim(p2.pt_referencia) = btrim(g3.nombre)
    where cg.nombre is null
      and p2.empresa_id = p_empresa_id
      and p2.placa = f.placa
      and p2.pt_referencia is not null
      and btrim(p2.pt_referencia) <> ''
      and p2.fecha >= coalesce(p_desde, '-infinity'::timestamptz)
      and p2.fecha <= coalesce(p_hasta, 'infinity'::timestamptz)
      and p2.latitud is not null
      and p2.longitud is not null
    group by g3.nombre
    order by max(p2.fecha) desc
    limit 1
  ) cg2 on cg.nombre is null
  -- Lo más reciente primero: la unidad que reportó hace menos tiempo arriba.
  order by u.fecha desc nulls last, f.placa
  limit greatest(coalesce(p_limite, 500), 1);
$$;

grant execute on function public.agrotrack_estado_unidades_flota(uuid, timestamptz, timestamptz, integer)
  to anon, authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 5) Actividad: el "universo" de unidades pasa a ser la flota completa.
--    (El resto de la función ya generaba las filas en cero por periodo.)
-- ---------------------------------------------------------------------------
do $do$
declare
  cuerpo text;
  nuevo  text;
  -- Se busca por PATRON y no por texto exacto: pg_get_functiondef devuelve el
  -- cuerpo tal como se guardo, y el espaciado/sangria cambia entre versiones
  -- del script. El patron solo fija lo que importa: el CTE "universo" que hoy
  -- se arma con "select distinct placa from agrotrack_posiciones".
  patron constant text := 'universo as \(\s*select\s+p\.placa,\s*max\(p\.unidad\)\s+as\s+unidad.*?group\s+by\s+p\.placa\s*\)';
  nuevo_texto constant text := $nuevo$
  universo as (
    select
      f.placa,
      coalesce(u.unidad, f.placa) as unidad
    from public.agrotrack_flota_unidades f
    left join lateral (
      select p.unidad
      from public.agrotrack_posiciones p
      where p.empresa_id = p_empresa_id
        and p.placa = f.placa
        and p.unidad is not null
      order by p.fecha desc
      limit 1
    ) u on true
    -- Misma regla que la RLS, evaluada UNA sola vez: un no-miembro ve 0 filas.
    where (select public.onboarding_es_miembro(p_empresa_id))
      and f.empresa_id = p_empresa_id
      and (p_placa is null or f.placa = p_placa)
  )$nuevo$;
begin
  select pg_get_functiondef(p.oid) into cuerpo
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'agrotrack_actividad_flota';

  if cuerpo is null then
    raise exception 'No existe public.agrotrack_actividad_flota';
  end if;

  if position('agrotrack_flota_unidades' in cuerpo) > 0 then
    raise notice 'agrotrack_actividad_flota ya usa la lista maestra: sin cambios';
    return;
  end if;

  nuevo := regexp_replace(cuerpo, patron, nuevo_texto);
  if nuevo = cuerpo then
    raise exception 'No se encontro el bloque "universo" esperado en agrotrack_actividad_flota';
  end if;

  execute nuevo;
  raise notice 'agrotrack_actividad_flota: universo = flota completa (44)';
end
$do$;


-- ---------------------------------------------------------------------------
-- 6) Estado en vivo: una fila por unidad de la flota (las 3 sin GPS salen
--    sin fecha ni coordenadas, para que la lista muestre "sin reporte").
-- ---------------------------------------------------------------------------
create or replace function public.agrotrack_estado_vivo_flota(p_empresa_id uuid)
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
  estado             text,
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
  with flota as (
    select f.placa, f.grupo
    from public.agrotrack_flota_unidades f
    where f.empresa_id = p_empresa_id
      and (select public.onboarding_es_miembro(p_empresa_id))
  ),
  geocercas as materialized (
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
    f.placa,
    coalesce(v.unidad, f.placa)      as unidad,
    coalesce(v.descripcion, f.grupo) as descripcion,
    v.fecha, v.evento, v.velocidad, v.direccion,
    v.latitud, v.longitud,
    case
      when v.fecha is null then 'Sin reporte'
      when lower(coalesce(v.evento, '')) like '%apagad%'
        or lower(coalesce(v.evento, '')) like '%estacionad%' then 'Apagado'
      when coalesce(v.velocidad, 0) > 5 then 'En ruta'
      else 'Detenido'
    end,
    case when v.fecha is null then null
         else greatest(0, floor(extract(epoch from (now() - v.fecha)) / 60))::integer
    end,
    cg.nombre,
    cg.division,
    v.actualizado_en
  from flota f
  left join public.agrotrack_estado_vivo v
    on v.empresa_id = p_empresa_id
   and v.placa = f.placa
  left join lateral (
    select g2.nombre, g2.division
    from geocercas g2
    where v.latitud  between g2.lat_min and g2.lat_max
      and v.longitud between g2.lon_min and g2.lon_max
      and ST_Contains(g2.poligono, ST_SetSRID(ST_MakePoint(v.longitud, v.latitud), 4326))
    order by g2.prioridad, g2.nombre
    limit 1
  ) cg on true
  order by f.placa;
$$;

grant execute on function public.agrotrack_estado_vivo_flota(uuid) to authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 7) VERIFICACION: las 5 RPC deben devolver 44 para la empresa real
-- ---------------------------------------------------------------------------
select
  'agrotrack_flota_unidades'                        as objeto,
  count(*)::text                                    as filas
from public.agrotrack_flota_unidades
where empresa_id = '9ab3a922-1f29-4f06-be93-d6bd7f2457d1'
union all
select 'agrotrack_periodo_flota (unidades)',
       (select unidades::text from public.agrotrack_periodo_flota('9ab3a922-1f29-4f06-be93-d6bd7f2457d1'))
union all
select 'agrotrack_resumen_flota',
       (select count(*)::text from public.agrotrack_resumen_flota('9ab3a922-1f29-4f06-be93-d6bd7f2457d1'))
union all
select 'agrotrack_estado_unidades_flota',
       (select count(*)::text from public.agrotrack_estado_unidades_flota('9ab3a922-1f29-4f06-be93-d6bd7f2457d1'))
union all
select 'agrotrack_actividad_flota (unidad)',
       (select count(*)::text from public.agrotrack_actividad_flota('9ab3a922-1f29-4f06-be93-d6bd7f2457d1', null, null, null, 'unidad', 1000))
union all
select 'agrotrack_estado_vivo_flota',
       (select count(*)::text from public.agrotrack_estado_vivo_flota('9ab3a922-1f29-4f06-be93-d6bd7f2457d1'));
