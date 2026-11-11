-- Helper de membresía (PREREQUISITO de los scripts de flota).
-- Ejecutar en el SQL Editor de Supabase ANTES que:
--   * scripts/agrotrack-posiciones-resumen.sql
--   * scripts/agrotrack-reportes-flota.sql
--   * scripts/agrotrack-geocercas.sql (su política usa la misma función)
--
-- POR QUÉ EXISTE ESTE ARCHIVO
-- Los scripts de flota validan la membresía con
-- public.onboarding_es_miembro(p_empresa_id) y en este proyecto esa función
-- NUNCA se creó (error 42883 "function public.onboarding_es_miembro(uuid)
-- does not exist" al ejecutar cualquiera de ellos). Las tablas que usa
-- (empresa_miembros) sí existen.
--
-- POR QUÉ NO SE USA scripts/onboarding-2.5-10-funciones.sql COMPLETO
-- Ese archivo también instala triggers de protección sobre
-- usuarios / empresa_miembros / empresa_plan / empresa_solicitudes que
-- bloquean cambios de rol y status hechos fuera de los RPC de onboarding.
-- Instalarlos de golpe podría romper flujos que hoy funcionan (por ejemplo
-- la aprobación de usuarios desde el panel Admin). Este archivo trae SOLO
-- las dos funciones de lectura, sin triggers y sin tocar datos.
--
-- Es idempotente: se puede ejecutar tantas veces como se quiera. No borra ni
-- modifica datos, ni toca RLS, ni a las tablas agrotrack_*.
--
-- Comprobación tras ejecutar:
--   select public.onboarding_es_miembro('9ab3a922-1f29-4f06-be93-d6bd7f2457d1');
--   -- debe devolver true/false (no un error 42883)

-- No requiere extensiones: solo auth.uid() (esquema auth de Supabase) y la
-- tabla empresa_miembros.

-- ¿Es miembro ACTIVO de la empresa? Misma definición de
-- scripts/onboarding-2.5-10-funciones.sql (líneas 6-21), sin cambios.
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

-- ¿Es miembro activo con rol administrador? Misma definición de
-- scripts/onboarding-2.5-10-funciones.sql (líneas 23-39), sin cambios.
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

-- Mismos permisos que la migración original (el definer de las RPC de flota
-- las llama como postgres; authenticated las usa en políticas de RLS).
revoke all on function public.onboarding_es_miembro(uuid) from public;
revoke all on function public.onboarding_es_admin(uuid) from public;
grant execute on function public.onboarding_es_miembro(uuid) to authenticated, anon, service_role;
grant execute on function public.onboarding_es_admin(uuid) to authenticated, anon, service_role;

alter function public.onboarding_es_miembro(uuid) owner to postgres;
alter function public.onboarding_es_admin(uuid) owner to postgres;

-- Nota de seguridad: ambas funciones son SECURITY DEFINER porque leen
-- empresa_miembros (con RLS) desde el cuerpo de otras funciones SECURITY
-- DEFINER. Solo devuelven un boolean; no exponen filas ni permiten escritura.
