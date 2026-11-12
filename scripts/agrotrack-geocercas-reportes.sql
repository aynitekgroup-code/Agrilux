-- Reportes de geocercas + estado de unidades (FASE 3.5 / 3.6): los tres
-- reportes pedidos por Ing. Carlos Perez que necesitan PostGIS.
-- Ejecutar completo en el SQL Editor de Supabase. Es repetible e idempotente:
-- no borra ni modifica datos, ni toca RLS, ni a agrotrack_posiciones,
-- ni a agrotrack_geocercas (solo se LEE).
--
-- REQUIERE POSTGIS (sección 0). Si la sección 0 falla con "permission denied
-- to create extension", ejecutar primero y sola la línea:
--   create extension if not exists postgis with schema public;
--
-- Los tres reportes:
--   1) agrotrack_eventos_geocerca_flota : entradas / salidas por geocerca de los
--      eventos de Zonar ("Entrada a Geocerca" / "Salida de Geocerca", con
--      pt_referencia = nombre del dispositivo). Agrupable por geocerca, por día
--      o por mes.
--   2) agrotrack_lotes_flota            : tiempo dentro de cada lote importado
--      (agrotrack_geocercas, 129 polígonos) calculado punto-dentro-de-polígono
--      con PostGIS sobre las posiciones GPS del periodo. Solo las geocercas de
--      campo: oficinas y distritos (FASE 3.7) quedan fuera con
--      incluir_reportes = false, para que un distrito no se coma el reporte.
--   3) agrotrack_estado_unidades_flota  : estado de unidades (reporte 34 de
--      Zonar): la última posición de cada placa en el rango (fecha, evento,
--      dirección, velocidad, coordenadas) MÁS la geocerca actual: el polígono
--      PostGIS que contiene esa posición (la columna extra que pidió el
--      Ing. Carlos Perez). Igual que en (2), solo geocercas de campo.
--
-- Mismo criterio que los reportes de actividad (FASE 3), para que las cifras
-- sean comparables:
--   * tramos <= 10 minutos entre puntos consecutivos (si no, no hay continuidad);
--   * haversine entre puntos consecutivos, saltos >= 5 km descartados;
--   * puntos repetidos (misma fecha + secuencia) no cuentan dos veces;
--   * día y mes en hora de Perú (America/Lima, UTC-5 sin DST).
--
-- Por qué se calcula en SQL: PostgREST devuelve máximo 1000 filas por consulta
-- y el cruce son 103.628 posiciones x 129 polígonos. Nada de eso se baja al
-- navegador.
--
-- Rendimiento (preparado para el statement timeout de 8 s de Supabase):
--   * el bbox de cada lote sale de geometria->'bbox' (verificado: coincide
--     exacto con el mínimo/máximo de sus coordenadas) y se usa como prefilter
--     de comparaciones de punto flotante ANTES de llamar a PostGIS, así
--     ST_Contains solo se evalúa en los pares que ya pasaron el bbox;
--   * el polígono se convierte UNA sola vez por lote (CTE materializada), no
--     una vez por fila;
--   * siempre conviene mandar p_desde / p_hasta (índice
--     agrotrack_posiciones_empresa_fecha_idx). Con rangos nulos se barre todo
--     el histórico.
--
-- POSTGIS: ST_GeomFromGeoJSON / ST_SetSRID / ST_MakePoint / ST_Contains son
-- funciones núcleo de PostGIS. El search_path de la RPC incluye "extensions"
-- por si la extensión ya estaba instalada en ese esquema (Supabase); si se crea
-- aquí con "with schema public", se resuelve en public.
--
-- No se modifica ninguna política de RLS existente ni la tabla
-- agrotrack_geocercas.

-- ---------------------------------------------------------------------------
-- 0) Sección 0: PostGIS + funciones de membresía.
--
-- a) PostGIS. Si ya existe (en public o en extensions), IF NOT EXISTS la deja
--    como está y no hay error.
-- b) Las RPC validan la membresía con public.onboarding_es_miembro(...)
--    (misma regla que la RLS). En este proyecto esa función no existía; se
--    crea aquí igual que en scripts/onboarding-es-miembro.sql para que este
--    archivo funcione solo. Idempotente: solo CREATE OR REPLACE, sin triggers.
-- ---------------------------------------------------------------------------
create extension if not exists postgis with schema public;

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
-- 0.5) Columna incluir_reportes (FASE 3.7: gestión de geocercas).
--
--    true  (por defecto): geocerca de campo -> entra en "Tiempo en lote" y en
--                         "Geocerca actual", y se exporta a Zonar;
--    false:                oficinas / distritos -> solo se ven en el mapa.
--
--    Es lo que permite cargar esos grupos sin que un distrito (que contiene
--    todas las posiciones) se trague el reporte de tiempo en lote. La columna
--    la pone el importador de src/lib/agrotrackGeocercas.js.
--
--    Idempotente (IF NOT EXISTS) y NO toca RLS ni ninguna otra columna.
-- ---------------------------------------------------------------------------
alter table if exists public.agrotrack_geocercas
  add column if not exists incluir_reportes boolean not null default true;

-- ---------------------------------------------------------------------------
-- 0.6) Checks de forma / tipo ampliados (FASE 3.7: gestión de geocercas).
--
--    La tabla traía dos CHECK restrictivos de AgroTrack:
--      agrotrack_geocercas_forma_check / ck_agrotrack_geocerca_forma
--        -> solo admiten forma = 'poligono';
--      agrotrack_geocercas_tipo_check
--        -> solo admite tipo  = 'autorizada'.
--
--    La FASE 3.7 importa oficinas (tipo = 'oficina') y distritos
--    (tipo = 'distrito'), y el editor crea geocercas nuevas; sin ampliarlos
--    el INSERT falla con "violates check constraint".
--
--    Idempotente (DROP IF EXISTS + ADD) y NO toca RLS: el conjunto permitido
--    solo se AMPLÍA (los valores ya existentes siguen siendo válidos, así que
--    el ADD no puede fallar por datos existentes).
-- ---------------------------------------------------------------------------
alter table if exists public.agrotrack_geocercas
  drop constraint if exists agrotrack_geocercas_forma_check,
  drop constraint if exists ck_agrotrack_geocerca_forma,
  drop constraint if exists agrotrack_geocercas_tipo_check;

alter table if exists public.agrotrack_geocercas
  add constraint agrotrack_geocercas_forma_check
    check (forma in ('poligono', 'multipoligono', 'irregular')),
  add constraint agrotrack_geocercas_tipo_check
    check (tipo in ('autorizada', 'oficina', 'distrito', 'poligono'));

-- ---------------------------------------------------------------------------
-- 1) Reporte de eventos de geocerca: entradas y salidas.
--
--    Fuente: los eventos que ya trae el dispositivo Zonar en
--    agrotrack_posiciones (evento = 'Entrada a Geocerca' / 'Salida de Geocerca')
--    con pt_referencia = nombre de la geocerca del dispositivo (28 nombres
--    reales: Distrito Pomalca, Division Pom1, Base Seg. Pom, Fabrica, etc.).
--
--    p_agrupar:
--      'geocerca' -> una fila por geocerca (por defecto)
--      'dia'      -> una fila por día de Perú
--      'mes'      -> una fila por mes de Perú
--
--    Las salidas pueden no cuadrar con las entradas: el dispositivo registra
--    el estado en cada reporte y un periodo abierto (unidad aún dentro) deja
--    la última entrada sin salida correspondiente.
--
--    CORTE POR DÍAS (bug reportado por el Ing. Carlos Perez): si la máquina
--    entró el día anterior y dentro del rango su primer evento es una salida,
--    la entrada ocurría antes del rango y no aparecía (solo salía la salida).
--    En ese caso se cuenta una ENTRADA CONTINUADA al inicio del rango
--    (p_desde), de modo que entradas y salidas cuadren al cortar por días.
-- ---------------------------------------------------------------------------
drop function if exists public.agrotrack_eventos_geocerca_flota(uuid, timestamptz, timestamptz, text, integer);

create function public.agrotrack_eventos_geocerca_flota(
  p_empresa_id uuid,
  p_desde      timestamptz default null,
  p_hasta      timestamptz default null,
  p_agrupar    text        default 'geocerca',
  p_limite     integer     default 500
)
returns table (
  grupo_tipo     text,            -- 'geocerca' | 'dia' | 'mes'
  grupo          text,            -- nombre de la geocerca, 'YYYY-MM-DD' o 'YYYY-MM'
  entradas       bigint,
  salidas        bigint,
  unidades       bigint,          -- placas distintas que entraron
  ultima_entrada timestamptz
)
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  with base_eventos as (
    select
      p.fecha,
      p.placa,
      btrim(p.pt_referencia)                                 as geocerca,
      (lower(p.evento) like '%entrada%geocerca%')             as es_entrada,
      (lower(p.evento) like '%salida%geocerca%')              as es_salida
    from public.agrotrack_posiciones p
    -- Misma regla que la RLS, evaluada UNA sola vez: un no-miembro ve 0 filas.
    where (select public.onboarding_es_miembro(p_empresa_id))
      and p.empresa_id = p_empresa_id
      and (p_desde is null or p.fecha >= p_desde)
      and (p_hasta is null or p.fecha <= p_hasta)
      -- Tolera mayúsculas/minúsculas y tildes distintas (mismo criterio que
      -- el resto de las RPC: el texto real es "Entrada a Geocerca").
      and (lower(p.evento) like '%entrada%geocerca%'
        or lower(p.evento) like '%salida%geocerca%')
      and p.pt_referencia is not null
      and btrim(p.pt_referencia) <> ''
  ),
  -- Primer evento de cada placa+geocerca dentro del rango.
  primero as (
    select distinct on (f.placa, f.geocerca)
      f.placa, f.geocerca, f.es_salida
    from base_eventos f
    order by f.placa, f.geocerca, f.fecha
  ),
  -- Último evento de cada par ANTES del rango (índice empresa+fecha recorta).
  ultimo_antes as (
    select distinct on (p.placa, btrim(p.pt_referencia))
      p.placa,
      btrim(p.pt_referencia) as geocerca,
      lower(p.evento)        as evento
    from public.agrotrack_posiciones p
    where (select public.onboarding_es_miembro(p_empresa_id))
      and p.empresa_id = p_empresa_id
      and p_desde is not null
      and p.fecha < p_desde
      and (lower(p.evento) like '%entrada%geocerca%'
        or lower(p.evento) like '%salida%geocerca%')
      and p.pt_referencia is not null
      and btrim(p.pt_referencia) <> ''
    order by p.placa, btrim(p.pt_referencia), p.fecha desc
  ),
  -- Entradas continuadas: el par estaba dentro al abrir el rango (su último
  -- evento previo fue una entrada) y su primer evento dentro es una salida.
  continuadas as (
    select u.placa, u.geocerca
    from ultimo_antes u
    where u.evento like '%entrada%geocerca%'
      and exists (
        select 1 from primero f
        where f.placa = u.placa and f.geocerca = u.geocerca and f.es_salida
      )
  ),
  base as (
    select f.fecha, f.placa, f.geocerca, f.es_entrada, f.es_salida
    from base_eventos f
    union all
    -- La entrada continuada cuenta al inicio del rango (p_desde).
    select p_desde as fecha, c.placa, c.geocerca,
           true as es_entrada, false as es_salida
    from continuadas c
  )
  select
    case when p_agrupar in ('dia', 'mes') then p_agrupar else 'geocerca' end as grupo_tipo,
    case
      when p_agrupar = 'dia' then to_char(b.fecha at time zone 'America/Lima', 'YYYY-MM-DD')
      when p_agrupar = 'mes' then to_char(b.fecha at time zone 'America/Lima', 'YYYY-MM')
      else b.geocerca
    end                                                       as grupo,
    count(*) filter (where b.es_entrada)                      as entradas,
    count(*) filter (where b.es_salida)                       as salidas,
    count(distinct b.placa) filter (where b.es_entrada)       as unidades,
    max(b.fecha) filter (where b.es_entrada)                  as ultima_entrada
  from base b
  group by 2
  -- Lo más reciente primero: en 'dia'/'mes' eso es el día/mes más nuevo.
  order by max(b.fecha) desc nulls last, count(*) desc, grupo
  limit greatest(coalesce(p_limite, 500), 1);
$$;

grant execute on function public.agrotrack_eventos_geocerca_flota(uuid, timestamptz, timestamptz, text, integer)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) Reporte de tiempo en cada lote (punto dentro del polígono).
--
--    Cruza las posiciones GPS del periodo con los 129 polígonos de
--    agrotrack_geocercas (columna geometria, GeoJSON Polygon/MultiPolygon en
--    EPSG:4326 con bbox) usando PostGIS. Por lote se devuelve:
--      unidades      placas distintas que entraron
--      visitas       tramos de permanencia (entrada -> salida o fin del tramo)
--      permanencia   segundos dentro del polígono (mismo corte de 10 min)
--      apagado/      desglose de esa permanencia por el estado del evento:
--      ralentí/      apagado (estacionado/apagado) + ralentí (encendido y
--      viajando      <= 5 km/h) + viajando (encendido y > 5 km/h) = total
--      km            recorrido dentro del polígono (haversine, saltos >= 5 km
--                    descartados)
--      puntos        posiciones leídas dentro (sin duplicados)
--      vel_max       velocidad máxima punta registrada dentro
--
--    Solo se listan los lotes con al menos una posición dentro: un lote sin
--    actividad no aporta cifras y solo ensuciaría la tabla.
-- ---------------------------------------------------------------------------
drop function if exists public.agrotrack_lotes_flota(uuid, timestamptz, timestamptz, integer);

create function public.agrotrack_lotes_flota(
  p_empresa_id uuid,
  p_desde      timestamptz default null,
  p_hasta      timestamptz default null,
  p_limite     integer     default 200
)
returns table (
  geocerca_id         uuid,
  lote                text,
  division            text,
  anexo               text,
  area_ha             numeric,
  unidades            bigint,
  visitas             bigint,
  permanencia_segundos bigint,
  -- Desglose pedido por el Ing. Carlos Perez: apagado + ralentí + viajando
  -- = hora total en la geocerca (= permanencia_segundos).
  apagado_segundos     bigint,
  ralenti_segundos     bigint,
  viaje_segundos       bigint,
  km_recorridos       numeric,
  puntos              bigint,
  vel_max_kmh         numeric,
  primera_visita      timestamptz,
  ultima_visita       timestamptz
)
language sql
stable
security definer
set search_path = public, extensions, pg_catalog, pg_temp
as $$
  -- 129 filas: se materializa para convertir el GeoJSON a geometría UNA sola
  -- vez (no una vez por posición) y para calcular el bbox de prefilter.
  with geocercas as materialized (
    select
      g.id,
      g.nombre,
      g.division,
      g.anexo,
      g.area_declarada,
      g.geometria                                              as geojson,
      ((g.geometria->'bbox')->>0)::double precision            as lon_min,
      ((g.geometria->'bbox')->>1)::double precision            as lat_min,
      ((g.geometria->'bbox')->>2)::double precision            as lon_max,
      ((g.geometria->'bbox')->>3)::double precision            as lat_max,
      ST_SetSRID(ST_GeomFromGeoJSON(g.geometria::text), 4326)  as poligono
    from public.agrotrack_geocercas g
    where g.empresa_id = p_empresa_id
      and g.activa is true
      -- Solo geocercas de campo: oficinas y distritos (incluir_reportes =
      -- false, FASE 3.7) no entran en el reporte de tiempo en lote.
      and g.incluir_reportes
      and g.geometria is not null
      and jsonb_typeof(g.geometria) = 'object'
      and (g.geometria->>'type') in ('Polygon', 'MultiPolygon')
      and jsonb_typeof(g.geometria->'bbox') = 'array'
  ),
  puntos as (
    select p.id, p.placa, p.fecha, p.secuencia, p.latitud, p.longitud, p.velocidad, p.evento
    from public.agrotrack_posiciones p
    -- Misma regla que la RLS, evaluada UNA sola vez: un no-miembro ve 0 filas.
    where (select public.onboarding_es_miembro(p_empresa_id))
      and p.empresa_id = p_empresa_id
      and (p_desde is null or p.fecha >= p_desde)
      and (p_hasta is null or p.fecha <= p_hasta)
      and p.latitud is not null
      and p.longitud is not null
  ),
  -- Prefilter barato (solo comparaciones de punto flotante) contra el bbox de
  -- cada lote: sin esto PostGIS se evaluaría en los 129 x N pares posibles.
  candidatos as (
    select
      g.id as geocerca_id, g.nombre, g.division, g.anexo, g.area_declarada,
      g.geojson, g.poligono,
      p.id as punto_id, p.placa, p.fecha, p.secuencia,
      p.latitud, p.longitud, p.velocidad, p.evento
    from geocercas g
    join puntos p
      on p.latitud  between g.lat_min and g.lat_max
     and p.longitud between g.lon_min and g.lon_max
  ),
  -- Aquí sí PostGIS: punto dentro del polígono (borde incluido por el bbox
  -- previo; ST_Contains descarta rápido con el bbox del polígono).
  dentro as (
    -- Solo las columnas que siguen: la geometría ya cumplió su función y no
    -- debe arrastrarse por el sort de la ventana de más abajo.
    select
      c.geocerca_id, c.nombre, c.division, c.anexo, c.area_declarada,
      c.punto_id, c.placa, c.fecha, c.secuencia,
      c.latitud, c.longitud, c.velocidad, c.evento
    from candidatos c
    where ST_Contains(c.poligono, ST_SetSRID(ST_MakePoint(c.longitud, c.latitud), 4326))
  ),
  -- UNA sola ventana por (lote, placa): tramo anterior + detector de
  -- duplicados, igual que agrotrack_resumen_flota / agrotrack_actividad_flota.
  con_prev as (
    select
      d.*,
      lag(d.fecha)                 over ventana as prev_fecha,
      lag(d.latitud)               over ventana as prev_lat,
      lag(d.longitud)              over ventana as prev_lon,
      lag(coalesce(d.secuencia, 0)) over ventana as prev_sec
    from dentro d
    window ventana as (
      partition by d.geocerca_id, d.placa
      order by d.fecha, coalesce(d.secuencia, 0), d.punto_id
    )
  ),
  tramos as (
    select
      c.*,
      -- Es la segunda (o tercera…) vez que vemos ese punto: reporte repetido.
      (c.prev_fecha is not null
        and c.prev_fecha = c.fecha
        and coalesce(c.secuencia, 0) = coalesce(c.prev_sec, 0))  as es_duplicado,
      case
        when c.prev_fecha is null then null
        when c.prev_fecha = c.fecha
          and coalesce(c.secuencia, 0) = coalesce(c.prev_sec, 0) then null
        -- intervalo mayor a 10 minutos: no hay continuidad dentro del lote
        when extract(epoch from (c.fecha - c.prev_fecha)) > 600 then null
        else extract(epoch from (c.fecha - c.prev_fecha))
      end                                                        as dt_segundos,
      case
        when c.prev_fecha is null then null
        when c.prev_fecha = c.fecha
          and coalesce(c.secuencia, 0) = coalesce(c.prev_sec, 0) then null
        when extract(epoch from (c.fecha - c.prev_fecha)) > 600 then null
        when c.prev_lat is null then null
        -- Haversine inlineado (mismo motivo que en agrotrack_resumen_flota:
        -- la función con set search_path no se puede inlinear y cuesta ~12 µs
        -- por fila).
        else 2.0 * 6371.0 * asin(least(1.0, sqrt(
          power(sin(radians(c.latitud - c.prev_lat) / 2.0), 2) +
          cos(radians(c.prev_lat)) * cos(radians(c.latitud)) *
          power(sin(radians(c.longitud - c.prev_lon) / 2.0), 2)
        )))
      end                                                        as dist_km,
      -- Estado del tramo = estado del punto final (mismo criterio único que
      -- agrotrack_actividad_flota): apagado / ralentí / viajando.
      (not (lower(coalesce(c.evento, '')) like '%estacionad%'
         or lower(coalesce(c.evento, '')) like '%apagad%'))       as encendido,
      (not (lower(coalesce(c.evento, '')) like '%estacionad%'
         or lower(coalesce(c.evento, '')) like '%apagad%'))
        and coalesce(c.velocidad, 0) > 5                          as es_viaje
    from con_prev c
  )
  select
    t.geocerca_id                                              as geocerca_id,
    t.nombre                                                   as lote,
    t.division                                                 as division,
    t.anexo                                                    as anexo,
    t.area_declarada                                           as area_ha,
    count(distinct t.placa)                                    as unidades,
    -- Una visita = primer punto de un tramo (inicio o tras un hueco > 10 min).
    count(*) filter (where not t.es_duplicado and t.dt_segundos is null) as visitas,
    coalesce(sum(case when t.es_duplicado then 0 else coalesce(t.dt_segundos, 0) end), 0)::bigint
                                                               as permanencia_segundos,
    -- Desglose pedido por el Ing. Carlos Perez: apagado + ralentí + viajando
    -- = hora total en la geocerca (= permanencia). Misma base de sum, solo
    -- que partida por el estado del tramo.
    coalesce((sum(case when t.es_duplicado then 0 else coalesce(t.dt_segundos, 0) end)
              filter (where not t.encendido))::bigint, 0)        as apagado_segundos,
    coalesce((sum(case when t.es_duplicado then 0 else coalesce(t.dt_segundos, 0) end)
              filter (where t.encendido and not t.es_viaje))::bigint, 0)
                                                                as ralenti_segundos,
    coalesce((sum(case when t.es_duplicado then 0 else coalesce(t.dt_segundos, 0) end)
              filter (where t.es_viaje))::bigint, 0)            as viaje_segundos,
    -- Mismos límites de km que el resto de la flota: tramo <= 10 min y salto
    -- >= 5 km descartado.
    coalesce(round(sum(
      case
        when t.es_duplicado or t.dist_km is null then 0::double precision
        when t.dist_km >= 5 then 0::double precision
        else t.dist_km
      end
    )::numeric, 2), 0)                                          as km_recorridos,
    count(*) filter (where not t.es_duplicado)                  as puntos,
    max(t.velocidad) filter (where not t.es_duplicado)          as vel_max_kmh,
    min(t.fecha) filter (where not t.es_duplicado)              as primera_visita,
    max(t.fecha) filter (where not t.es_duplicado)              as ultima_visita
  from tramos t
  group by t.geocerca_id, t.nombre, t.division, t.anexo, t.area_declarada
  -- Los que más tiempo pasaron primero (los sin actividad quedan fuera).
  having count(*) filter (where not t.es_duplicado) > 0
  order by permanencia_segundos desc, km_recorridos desc, lote
  limit greatest(coalesce(p_limite, 200), 1);
$$;

grant execute on function public.agrotrack_lotes_flota(uuid, timestamptz, timestamptz, integer)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) Estado de unidades + geocerca actual (reporte 34 de Zonar).
--
--    Una fila por placa con su posición MÁS RECIENTE del rango (distinct on,
--    mismo orden que el resto de las RPC: fecha, secuencia, id) y el nombre
--    del polígono que la contiene, resuelto con PostGIS + el mismo prefilter
--    de bbox que agrotrack_lotes_flota. Si la posición cae fuera de todos
--    los polígonos, geocerca queda en null (la UI lo muestra como
--    "Fuera de geocercas").
--
--    Rendimiento: son pocas placas (~20-30) contra 129 polígonos, con el
--    bbox descartando casi todo antes de ST_Contains. El distinct on usa el
--    índice agrotrack_posiciones_empresa_placa_fecha_idx.
--
--    Nota: la columna "Current Odometer" del reporte de Zonar NO se puede
--    replicar: el archivo "Reporte por placa" que importamos no trae
--    odómetro (ver src/lib/agrotrackPosiciones.js), así que la UI la
--    muestra en «—» con esta aclaración.
-- ---------------------------------------------------------------------------
drop function if exists public.agrotrack_estado_unidades_flota(uuid, timestamptz, timestamptz, integer);

create function public.agrotrack_estado_unidades_flota(
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
  geocerca          text,           -- nombre del polígono que contiene la posición (null = fuera)
  geocerca_division text
)
language sql
stable
security definer
set search_path = public, extensions, pg_catalog, pg_temp
as $$
  -- Última posición de cada placa en el rango, en una sola pasada.
  with ultimos as (
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
      and (p_desde is null or p.fecha >= p_desde)
      and (p_hasta is null or p.fecha <= p_hasta)
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
      -- Solo geocercas de campo: oficinas y distritos (incluir_reportes =
      -- false, FASE 3.7) no pueden ser la "geocerca actual" de una unidad.
      and g.incluir_reportes
      and g.geometria is not null
      and jsonb_typeof(g.geometria) = 'object'
      and (g.geometria->>'type') in ('Polygon', 'MultiPolygon')
      and jsonb_typeof(g.geometria->'bbox') = 'array'
  )
  select
    u.placa,
    u.unidad,
    u.fecha                                                    as ultima_fecha,
    u.evento                                                   as ultimo_evento,
    u.velocidad                                                as ultima_velocidad,
    u.direccion,
    u.latitud,
    u.longitud,
    cg.nombre                                                  as geocerca,
    cg.division                                                as geocerca_division
  from ultimos u
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
  -- Lo más reciente primero: la unidad que reportó hace menos tiempo arriba.
  order by u.fecha desc nulls last, u.placa
  limit greatest(coalesce(p_limite, 500), 1);
$$;

grant execute on function public.agrotrack_estado_unidades_flota(uuid, timestamptz, timestamptz, integer)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Comprobaciones (opcionales): deben devolver 28 geocerca, ~129 lotes y
-- una fila por placa con su geocerca actual.
-- ---------------------------------------------------------------------------
-- select * from public.agrotrack_eventos_geocerca_flota('<empresa_id>');
-- select * from public.agrotrack_eventos_geocerca_flota('<empresa_id>',
--           '2026-11-01T00:00:00-05:00', '2026-11-07T23:59:59-05:00', 'dia');
-- select lote, division, unidades, visitas,
--        round(permanencia_segundos / 3600.0, 2) as horas, km_recorridos
--   from public.agrotrack_lotes_flota('<empresa_id>',
--           '2026-11-01T00:00:00-05:00', '2026-11-07T23:59:59-05:00')
--   limit 20;
-- select placa, ultima_fecha, ultimo_evento, geocerca, geocerca_division
--   from public.agrotrack_estado_unidades_flota('<empresa_id>',
--           '2026-11-01T00:00:00-05:00', '2026-11-07T23:59:59-05:00');
