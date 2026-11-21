-- ============================================================================
-- Agrilux · Fix de timeouts en "Entradas y salidas de geocerca" y actividad
-- 21/11/2026
-- ============================================================================
-- SÍNTOMA (sesión real de Carlos / Pomalca):
--   POST rpc/agrotrack_eventos_geocerca_flota -> 500
--   {"code":"57014","message":"canceling statement due to statement timeout"}
--   Igual en agrotrack_actividad_flota con rangos de 7 días. El mapa y las
--   geocercas sí cargaban (178 polígonos, 44 unidades, Realtime conectado).
--
-- CAUSA:
--   Ambas RPC son SQL pero tenían `security definer` + `set search_path`.
--   PostgreSQL NO inlinea una SQL function con esas propiedades: ejecuta el
--   cuerpo con plan genérico, sin ver p_desde/p_hasta. El índice de fecha
--   queda inservible y el CTE "ultimo_antes" (último evento por placa y
--   geocerca ANTERIOR al rango) recorre todo el histórico.
--   Es el mismo patrón ya corregido en agrotrack_visitas_geocerca_calc.
--
-- FIX:
--   1) Índice de expresión para el DISTINCT ON por (placa, btrim(pt_referencia), fecha).
--   2)Alterar esas dos funciones a SECURITY INVOKER y quitarles el SET.
--      La membresía la sigue validando public.onboarding_es_miembro y la RLS
--      de agrotrack_posiciones; no se toca ninguna tabla AGRILUX ni RLS.
--
-- Idempotente: repetirlo no cambia nada. No contiene secretos.
-- ============================================================================

-- 1) Índice para "último evento antes del rango" por placa + geocerca.
create index if not exists agrotrack_posiciones_empresa_placa_geo_fecha_idx
  on public.agrotrack_posiciones (empresa_id, placa, (btrim(pt_referencia)), fecha desc)
  where pt_referencia is not null and btrim(pt_referencia) <> '';

analyze public.agrotrack_posiciones;

-- 2) Volver inlineables solo las RPC que fallaban.
--    (agrotrack_visitas_geocerca_flota NO se toca: llama al motor
--     service_role-only agrotrack_visitas_geocerca_calc y necesita definer.)
do $do$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as firma
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname in (
        'agrotrack_eventos_geocerca_flota',
        'agrotrack_actividad_flota'
      )
  loop
    execute format('alter function %s security invoker', f.firma);
    execute format('alter function %s reset search_path', f.firma);
    raise notice 'INLINEABLE %', f.firma;
  end loop;
end
$do$;

-- 3) Verificación: ambos deben dar FALSE y NULL.
select
  p.oid::regprocedure              as funcion,
  p.prosecdef                      as security_definer,
  p.proconfig                      as set_search_path
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'agrotrack_eventos_geocerca_flota',
    'agrotrack_actividad_flota'
  )
order by p.proname;

-- 4) Prueba de rendimiento CON la sesión de Carlos (no aplicar en producción
--    con otro usuario). Debe bajar de 8 s a ~1 s o menos.
begin;
  set local role authenticated;
  set local request.jwt.claim.sub = '42a04b5a-ecc4-4e0b-8f82-80f9fb89fdde';

  select 'eventos 21/11' as prueba, count(*) as filas
  from public.agrotrack_eventos_geocerca_flota(
    '9ab3a922-1f29-4f06-be93-d6bd7f2457d1',
    '2026-11-21T00:00:00-05:00',
    '2026-11-21T23:59:59-05:00',
    'geocerca',
    500
  );

  select 'actividad 14-21/11' as prueba, count(*) as filas
  from public.agrotrack_actividad_flota(
    '9ab3a922-1f29-4f06-be93-d6bd7f2457d1',
    '2026-11-14T20:07:49.000Z',
    '2026-11-21T20:07:49+00:00',
    null,
    'unidad',
    1000
  );
rollback;
