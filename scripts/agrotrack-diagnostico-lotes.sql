-- ---------------------------------------------------------------------------
-- DIAGNÓSTICO DE "TIEMPO EN CADA LOTE" — Business case (18/11/2026)
--
-- Síntoma: gestión → Reportes → "Tiempo en cada lote" → 500 por statement_timeout
-- 8 s con un rango de 1 día sobre 44 unidades y ~310 mil posiciones / 178 geocercas.
--
-- Objetivo: comprobar si Supabase está consumiendo (memoria/CPU/IO) y si el
-- motor PostGIS usa los índices GIST creados en
--   agrotrack_posiciones(geom)          -> agrotrack_posiciones_geom_gix
--   agrotrack_geocercas_subdiv(geom)   -> agrotrack_geocercas_subdiv_gix
-- Ambos índices deben existir y aparecer como "Index Scan" en los planes.
--
-- Todas las consultas son de SOLO LECTURA.
-- ---------------------------------------------------------------------------

-- 0) Verificación rápida de índices GIST (si no aparecen como 'ok' en
--    scripts/verificar-supabase.sql, ejecutar antes scripts/agrotrack-geometria-reportes.sql)
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'agrotrack_posiciones_geom_gix',
    'agrotrack_geocercas_subdiv_gix',
    'agrotrack_geocercas_subdiv_empresa_nombre_idx',
    'agrotrack_visitas_dia_empresa_dia_placa_idx'
  )
order by indexname;

-- 1) Volumen REAL de posiciones para esa empresa y ese día (ayer, 17/11/2026)
select
  empresa_id,
  count(*)                as filas,
  count(distinct placa)   as placas,
  min(fecha)              as desde,
  max(fecha)              as hasta,
  round(pg_total_relation_size('public.agrotrack_posiciones')::numeric / 1024 / 1024, 2) || ' MB' as tabla_total
from public.agrotrack_posiciones
where empresa_id = '9ab3a922-1f29-4f06-be93-d6bd7f2457d1'
  and fecha >= '2026-11-17T00:00:00-05:00'
  and fecha <= '2026-11-17T23:59:59-05:00'
group by empresa_id;

-- 2) Cantidad de fragmentos GIS por empresa (subdiv)
select empresa_id, count(*) as fragmentos, count(distinct geocerca_id) as geocercas
from public.agrotrack_geocercas_subdiv
group by empresa_id;

-- 3) Estadísticas de la tabla que usa el motor de geocercas
select relname, last_autovacuum, last_vacuum, n_live_tup, n_dead_tup
from pg_stat_user_tables
where relname in ('agrotrack_posiciones', 'agrotrack_geocercas_subdiv', 'agrotrack_geocercas')
order by relname;

-- 4) EXPLAIN de la llamada EXACTA que hace la web SIN p_placas (todas las unidades)
explain (analyze, buffers, format text)
select *
from public.agrotrack_lotes_flota(
  '9ab3a922-1f29-4f06-be93-d6bd7f2457d1',
  '2026-11-17T00:00:00-05:00'::timestamptz,
  '2026-11-17T23:59:59-05:00'::timestamptz,
  null,
  null,
  null,
  null,
  200
);

-- 5) EXPLAIN de la MISMA llamada limitando a UNA placa (p_placas = array[...])
--    (cambia 'BPI-733' por una placa representativa suya)
explain (analyze, buffers, format text)
select *
from public.agrotrack_lotes_flota(
  '9ab3a922-1f29-4f06-be93-d6bd7f2457d1',
  '2026-11-17T00:00:00-05:00'::timestamptz,
  '2026-11-17T23:59:59-05:00'::timestamptz,
  null,
  array['BPI-733']::text[],
  null,
  null,
  200
);

-- 6) Límite de 8 s: ¿cuánto tarda la consulta AGREGANDO por un día cualquiera?
--    (compara con la misma llamada pero SIN explain, directamente)
select
  'plan_subset_para_la_semana' as tipo,
  count(*)                     as filas_conteo_simple
from public.agrotrack_posiciones
where empresa_id = '9ab3a922-1f29-4f06-be93-d6bd7f2457d1'
  and fecha >= '2026-11-17T00:00:00-05:00'
  and fecha <= '2026-11-17T23:59:59-05:00';

-- Cómo interpretar lo que devuelven las consultas 0 y 6:
--   - Si 4 tarda > 8 s pero 5 tarda < 1 s: el problema es que el día completo
--     de TODAS las placas excede el statement_timeout de Supabase (8 s) y
--     no falla por bug: es volumen.
--   - Si aparece Seq Scan en posiciones o en subdiv: los índices GIS no se
--     están usando; revisar índice/permisos (o refrescarlo).
--   - Si n_dead_tup en posiciones es muy alto, ejecutar vacuum analyze.
--     (No lo hacemos aquí porque supondría modificar la tabla.)
--   - Compara desde SQL Editor porque postgres NO está limitado por el mismo
--     statement_timeout de authenticated (8 s). Si la query en postgres tarda
--     poco, el problema es el rol: el informe tiene que correr autenticado
--     desde la web, por lo que hay que recortar el rango o usar p_placas.
