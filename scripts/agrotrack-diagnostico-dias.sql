-- ============================================================================
-- DIAGNÓSTICO: ¿qué días tiene Agrilux de cada mes? (18/11/2026)
-- "Se envió del 1 al 11 de noviembre y Agrilux muestra desde el 16."
-- Solo LECTURA: no cambia nada. Ejecutar en el SQL Editor de Supabase.
-- ============================================================================

-- 1) Posiciones por día (hora de Perú) de los últimos 60 días, con cuántas
--    unidades reportaron y CUÁNDO se cargaron (agente o carga manual).
select
  (p.fecha at time zone 'America/Lima')::date            as dia,
  count(*)                                               as posiciones,
  count(distinct p.placa)                                as unidades,
  min(p.created_at at time zone 'America/Lima')          as primera_carga,
  max(p.created_at at time zone 'America/Lima')          as ultima_carga,
  count(*) filter (where p.creado_por is null)           as por_agente_o_sistema,
  count(*) filter (where p.creado_por is not null)       as por_usuario
from public.agrotrack_posiciones p
where p.fecha >= now() - interval '60 days'
group by 1
order by 1;

-- 2) Fechas fuera de lugar (señal de un archivo con la fecha mal leída):
--    posiciones con fecha futura o de años anteriores.
select
  date_trunc('month', p.fecha at time zone 'America/Lima')::date as mes,
  count(*)                                                       as posiciones,
  min(p.created_at)                                              as cargadas_desde
from public.agrotrack_posiciones p
where p.fecha > now() + interval '1 day'
   or p.fecha < date '2026-01-01'
group by 1
order by 1;

-- 3) Visitas a geocercas ya calculadas por día (tabla diaria de las 6:30).
select v.dia, count(*) as visitas, count(distinct v.placa) as unidades
from public.agrotrack_visitas_dia v
where v.dia >= current_date - 60
group by v.dia
order by v.dia;
