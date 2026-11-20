-- ============================================================================
-- Agrilux · Rendimiento de los reportes de flota
-- ============================================================================
-- 16-17/11/2026
--
-- SINTOMA
--   La seccion Gestion -> Reportes devolvia HTTP 500 en las RPC de flota
--   (agrotrack_*_flota). Supabase corta a los 8 s (statement_timeout del rol
--   authenticated) y las funciones tardaban entre 14 s y mas de 60 s.
--
-- CAUSA 1 · PREDICADOS NO INDEXABLES
--   Las funciones son SECURITY DEFINER y el planificador las ejecuta con PLAN
--   GENERICO (no ve los valores de p_desde / p_hasta). Con predicados del tipo
--   "(p_desde is null or p.fecha >= p_desde)" el indice
--   agrotrack_posiciones_empresa_fecha_idx queda inservible y se recorren los
--   269 078 puntos de la empresa. Medido con plan generico: 27,6 s.
--
--   ARREGLO: reescribir el predicado para que SIEMPRE sea indexable:
--     p.fecha >= coalesce(p_desde, '-infinity'::timestamptz)
--     p.fecha <= coalesce(p_hasta, 'infinity'::timestamptz)
--   -infinity / infinity conservan la semantica de "sin limite" y el indice se
--   usa igual con plan generico. Medido: 27,6 s -> 4,6 s.
--
-- CAUSA 2 · CTE RECALCULADO POR GEOCERCA (visitas)
--   En agrotrack_visitas_geocerca_calc la CTE "antes" (ultima posicion de cada
--   placa antes del rango) se recalculaba UNA VEZ POR GEOCERCA:
--   178 geocercas x 88 000 filas = 5 s solo en esa parte, y crecia con el
--   historico. Medido: dia completo > 60 s.
--
--   ARREGLO: "antes as materialized" (se calcula una vez, 41 filas) y
--   "dentro as materialized" (se usa en dos CTE). Medido: dia completo 5,4 s.
--
-- CAUSA 3 · SOBRECARGA AMBIGUA
--   agrotrack_eventos_geocerca_flota tenia DOS firmas en la base (5 y 6
--   argumentos, la de 6 con p_placas). PostgREST no podia elegir candidata
--   (PGRST203) y el reporte fallaba. Se elimina la de 5.
--
-- Los .sql fuente ya estan corregidos:
--   scripts/agrotrack-posiciones-resumen.sql
--   scripts/agrotrack-geocercas-reportes.sql
--   scripts/agrotrack-reportes-flota.sql
--
-- Este script NO toca datos: solo recrea (CREATE OR REPLACE) funciones leyendo
-- su definicion actual con pg_get_functiondef. Es idempotente.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) ARREGLO · predicados indexables en todas las funciones afectadas
-- ----------------------------------------------------------------------------
do $do$
declare
  f          record;
  cuerpo     text;
  nuevo      text;
  -- (p_desde is null or <alias>.fecha >= p_desde [ - interval '...' ])
  re_desde   constant text := $re$\(\s*p_desde\s+is\s+null\s+or\s+([a-z0-9_]+)\.fecha\s*>=\s*p_desde(\s*[-+]\s*interval\s+'[^']*')?\s*\)$re$;
  -- (p_hasta is null or <alias>.fecha <= p_hasta [ + interval '...' ])
  re_hasta   constant text := $re$\(\s*p_hasta\s+is\s+null\s+or\s+([a-z0-9_]+)\.fecha\s*<=\s*p_hasta(\s*[-+]\s*interval\s+'[^']*')?\s*\)$re$;
  rp_desde   constant text := $rp$\1.fecha >= coalesce(p_desde, '-infinity'::timestamptz)\2$rp$;
  rp_hasta   constant text := $rp$\1.fecha <= coalesce(p_hasta, 'infinity'::timestamptz)\2$rp$;
begin
  for f in
    select p.oid, p.oid::regprocedure as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and (p.prosrc ~ 'is\s+null\s+or\s+[a-z0-9_]+\.fecha\s*>='
        or p.prosrc ~ 'is\s+null\s+or\s+[a-z0-9_]+\.fecha\s*<=')
    order by p.proname
  loop
    cuerpo := pg_get_functiondef(f.oid);
    nuevo  := regexp_replace(cuerpo, re_desde, rp_desde, 'g');
    nuevo  := regexp_replace(nuevo,  re_hasta, rp_hasta, 'g');

    if nuevo is distinct from cuerpo then
      execute nuevo;
      raise notice 'PARCHEADA  %', f.firma;
    end if;
  end loop;
end
$do$;


-- ----------------------------------------------------------------------------
-- 2) ARREGLO · CTE "antes" y "dentro" materializadas en las visitas
-- ----------------------------------------------------------------------------
do $do$
declare
  f      record;
  cuerpo text;
  nuevo  text;
begin
  for f in
    select p.oid, p.oid::regprocedure as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'agrotrack_visitas_geocerca_calc'
  loop
    cuerpo := pg_get_functiondef(f.oid);
    nuevo  := replace(cuerpo, 'antes as (',  'antes as materialized (');
    nuevo  := replace(nuevo,  'dentro as (', 'dentro as materialized (');
    if nuevo is distinct from cuerpo then
      execute nuevo;
      raise notice 'PARCHEADA  %', f.firma;
    end if;
  end loop;
end
$do$;


-- ----------------------------------------------------------------------------
-- 3) ARREGLO · eliminar la sobrecarga ambigua de eventos de geocerca
-- ----------------------------------------------------------------------------
drop function if exists public.agrotrack_eventos_geocerca_flota(uuid, timestamptz, timestamptz, text, integer);


-- ----------------------------------------------------------------------------
-- 4) VERIFICACION · todas deben devolver 0 filas
-- ----------------------------------------------------------------------------
select 'predicado no indexable' as problema, p.oid::regprocedure as objeto
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
  and p.prosrc ~ 'is\s+null\s+or\s+[a-z0-9_]+\.fecha\s*(>=|<=)'

union all
select 'visitas sin materializar', p.oid::regprocedure
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'agrotrack_visitas_geocerca_calc'
  and (p.prosrc !~ 'antes as materialized' or p.prosrc !~ 'dentro as materialized')

union all
select 'sobrecarga ambigua', p.oid::regprocedure
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'agrotrack_eventos_geocerca_flota'
  and (select count(*)
         from pg_proc p2
         join pg_namespace n2 on n2.oid = p2.pronamespace
        where n2.nspname = 'public'
          and p2.proname = 'agrotrack_eventos_geocerca_flota') > 1
order by 1, 2;


-- ----------------------------------------------------------------------------
-- 5) INVENTARIO · como quedo cada RPC de reportes
-- ----------------------------------------------------------------------------
select
  p.oid::regprocedure                                             as funcion,
  (p.prosrc ~ 'coalesce\(p_desde, ''-infinity''::timestamptz\)')  as fecha_indexable,
  length(p.prosrc)                                                as bytes_cuerpo
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
  and p.proname like 'agrotrack\_%'
order by p.proname;
