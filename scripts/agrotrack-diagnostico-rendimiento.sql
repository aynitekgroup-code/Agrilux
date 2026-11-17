-- ---------------------------------------------------------------------------
-- DIAGNOSTICO DE RENDIMIENTO de los reportes de flota (15/11/2026)
--
-- Sintoma: al abrir Gestion -> Reportes, las RPC pesadas tardan 5-9 s y las
-- que pasan de 8 s devuelven HTTP 500. Supabase corta a los 8 s
-- (statement_timeout del rol authenticated). Todas las consultas de este
-- archivo son de SOLO LECTURA: no modifican nada.
--
-- Ejecutar completo en el SQL Editor y copiar el resultado.
-- ---------------------------------------------------------------------------

-- 1) Volumen real de posiciones por empresa.
select
  empresa_id,
  count(*)                as filas,
  count(distinct placa)   as placas,
  min(fecha)              as desde,
  max(fecha)              as hasta
from public.agrotrack_posiciones
group by empresa_id
order by filas desc;

-- 2) Tamano fisico y basura (tuplas muertas) que obliga a recorrer paginas.
select
  c.relname                                as tabla,
  pg_size_pretty(pg_total_relation_size(c.oid)) as tamano_total,
  pg_size_pretty(pg_relation_size(c.oid))       as solo_datos,
  s.n_live_tup                             as filas_vivas,
  s.n_dead_tup                             as filas_muertas,
  s.last_autovacuum,
  s.last_vacuum
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_stat_user_tables s on s.relid = c.oid
where n.nspname = 'public'
  and c.relname like 'agrotrack%'
  and c.relkind = 'r'
order by pg_total_relation_size(c.oid) desc;

-- 3) Plan de la consulta mas llamada (agrotrack_periodo_flota): dice si usa
--    indices o recorre toda la tabla.
explain (analyze, buffers, format text)
select
  min(p.fecha),
  max(p.fecha),
  count(distinct p.placa),
  count(*)
from public.agrotrack_posiciones p
where p.empresa_id = '9ab3a922-1f29-4f06-be93-d6bd7f2457d1';

-- 4) Plan del UNIVERSO de placas de agrotrack_actividad_flota: recorre TODO el
--    historico en cada llamada, aunque el rango sea de un solo dia.
explain (analyze, buffers, format text)
select p.placa, max(p.unidad)
from public.agrotrack_posiciones p
where p.empresa_id = '9ab3a922-1f29-4f06-be93-d6bd7f2457d1'
group by p.placa;

-- 5) Plan de un dia concreto de agrotrack_actividad_flota (el caso normal de
--    la pantalla: ultimo dia con datos).
explain (analyze, buffers, format text)
select count(*)
from public.agrotrack_posiciones p
where p.empresa_id = '9ab3a922-1f29-4f06-be93-d6bd7f2457d1'
  and p.fecha >= '2026-11-05T00:00:00-05:00'
  and p.fecha <= '2026-11-05T23:59:59-05:00';

-- 6) Indices disponibles sobre agrotrack_posiciones.
select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'agrotrack_posiciones';
