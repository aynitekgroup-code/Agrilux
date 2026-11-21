-- ---------------------------------------------------------------------------
-- CORRECCIÓN 21/11/2026 · timeouts del cron al calcular visitas a geocercas
-- ---------------------------------------------------------------------------
-- Síntoma: `canceling statement due to statement timeout` cada ~8 s en
--   `public.agrotrack_calcular_visitas_dia`, pendientes que no bajaban y
--   geocercas/tiempo real que dejaban de actualizarse.
--
-- Causa: `public.agrotrack_visitas_geocerca_calc` tenía `security definer`
--   y `set search_path = ...`. Cualquiera de esas cláusulas (en particular
--   el SET) impide que PostgreSQL inline una función SQL: se ejecutaba como
--   Function Scan "caja negra", sin usar el índice
--   (empresa_id, placa, fecha). 13 s por placa -> timeout de 8 s.
--
-- Solución: quitar ambas cláusulas y esquematizar PostGIS (`extensions.`).
--   El motor ya no valida membresía (la validan las RPC que lo llaman), así
--   que no necesita `security definer`. Inlineado: ~0,4-0,9 s por placa.
--
-- Idempotente: se puede ejecutar varias veces. No toca tablas AGRILUX.
-- ---------------------------------------------------------------------------

do $$
declare
  o      oid;
  src    text;
  args   text;
  ret    text;
  newsrc text;
begin
  o := 'public.agrotrack_visitas_geocerca_calc(uuid, timestamp with time zone, timestamp with time zone, text, text)'::regprocedure;

  select p.prosrc,
         pg_get_function_arguments(p.oid),
         pg_get_function_result(p.oid)
    into src, args, ret
    from pg_proc p
   where p.oid = o;

  if not found then
    raise notice 'La función no existe; no hay nada que corregir.';
    return;
  end if;

  -- Si la BD aún tiene la versión plpgsql con placeholders %L del repo
  -- anterior, este parche no sirve: hay que ejecutar el script canónico.
  if src like '%\%L%' or src like '%return query execute format%' then
    raise exception 'La función es la versión antigua con %L; ejecuta primero scripts/agrotrack-geocercas-reportes.sql';
  end if;

  newsrc := replace(src, 'ST_Contains(', 'extensions.ST_Contains(');

  execute format(
    'create or replace function public.agrotrack_visitas_geocerca_calc(%s) '
    'returns %s language sql stable as $body$ %s $body$',
    args, ret, newsrc
  );
end $$;

-- Verificación: debe devolver 0 filas.
select p.oid::regprocedure as sigue_sin_inlinear
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname = 'agrotrack_visitas_geocerca_calc'
   and (p.prosecdef or p.proconfig is not null);
