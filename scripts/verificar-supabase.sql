-- ===========================================================================
-- VERIFICAR QUE SUPABASE TIENE TODAS LAS TABLAS / VISTAS / FUNCIONES / ÍNDICES
-- que Agrilux necesita para los reportes de flota.
--
-- Script de solo lectura: no crea ni modifica nada.
-- Es UNA sola consulta; pégala entera en el SQL Editor de Supabase.
-- Cada fila devuelta indica estado = 'ok' o 'FALTA'.
-- ===========================================================================

with

tablas(t) as (
  values
    ('agrotrack_posiciones'),
    ('agrotrack_geocercas'),
    ('agrotrack_grupos_unidades'),
    ('agrotrack_flota_unidades'),
    ('agrotrack_visitas_dia'),
    ('agrotrack_visitas_dia_estado'),
    ('agrotrack_vehiculos'),
    ('agrotrack_geocercas_subdiv'),
    ('agrotrack_estado_vivo'),
    ('agrotrack_zonar_latidos')
),

vistas(v) as (
  values
    ('agrotrack_geocercas_reportes')
),

funciones(f) as (
  values
    ('agrotrack_periodo_flota'),
    ('agrotrack_actividad_flota'),
    ('agrotrack_resumen_flota'),
    ('agrotrack_alertas_flota'),
    ('agrotrack_conteo_eventos'),
    ('agrotrack_recorrido_flota'),
    ('agrotrack_eventos_geocerca_flota'),
    ('agrotrack_lotes_flota'),
    ('agrotrack_limite_velocidad_flota'),
    ('agrotrack_visitas_geocerca_flota'),
    ('agrotrack_visitas_geocerca_calc'),
    ('agrotrack_visitas_dia_flota'),
    ('agrotrack_tabla_geocercas_dia'),
    ('agrotrack_visitas_dia_pendientes'),
    ('agrotrack_visitas_dia_pendientes_interno'),
    ('agrotrack_visitas_dia_calcular_interno'),
    ('agrotrack_calcular_visitas_dia'),
    ('agrotrack_grupos_unidades'),
    ('agrotrack_guardar_grupo_unidad'),
    ('agrotrack_estado_unidades_flota'),
    ('agrotrack_estado_vivo_flota'),
    ('agrotrack_registrar_latido'),
    ('agrotrack_refrescar_geocercas_subdiv'),
    ('agrotrack_haversine_km'),
    ('agrotrack_puede_editar_geocercas'),
    ('agrotrack_tiene_rol'),
    ('onboarding_es_miembro'),
    ('onboarding_es_admin')
),

indices_gist(i) as (
  values
    ('agrotrack_posiciones_empresa_placa_fecha_idx'),
    ('agrotrack_posiciones_empresa_fecha_idx'),
    ('agrotrack_posiciones_empresa_evento_idx'),
    ('agrotrack_posiciones_geom_gix'),
    ('agrotrack_geocercas_subdiv_gix'),
    ('agrotrack_geocercas_subdiv_empresa_nombre_idx'),
    ('agrotrack_visitas_dia_empresa_dia_placa_idx')
),

verificacion as (
  select 'tabla'    as tipo, t as nombre,
         case when to_regclass('public.' || t) is not null then 'ok' else 'FALTA' end as estado
  from   tablas
  union all
  select 'vista'   as tipo, v as nombre,
         case when exists (
           select 1 from information_schema.views
           where table_schema = 'public' and table_name = v
         ) then 'ok' else 'FALTA' end
  from   vistas
  union all
  select 'funcion' as tipo, f as nombre,
         case when exists (
           select 1
           from   pg_proc p
           join   pg_namespace n on n.oid = p.pronamespace
           where  n.nspname = 'public' and p.proname = f
         ) then 'ok' else 'FALTA' end
  from   funciones
  union all
  select 'indice'  as tipo, i as nombre,
         case when to_regclass('public.' || i) is not null then 'ok' else 'FALTA' end
  from   indices_gist
)

select tipo, nombre, estado
from   verificacion
order  by
  case when estado = 'FALTA' then 0 else 1 end,
  tipo, nombre;
