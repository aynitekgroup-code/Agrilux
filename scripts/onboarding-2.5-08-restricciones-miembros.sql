-- AGRILUX ONBOARDING 2.5 - Migración 08
-- Índices y validaciones de empresa_miembros.
-- PostgreSQL no permite WHERE dentro de una restricción UNIQUE:
-- la unicidad parcial se implementa correctamente con un índice único parcial.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.empresa_miembros'::regclass
      AND conname = 'empresa_miembros_id_empresa_unique'
  ) THEN
    ALTER TABLE public.empresa_miembros
      ADD CONSTRAINT empresa_miembros_id_empresa_unique
      UNIQUE (id, empresa_id);
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_empresa_miembros_empresa_user_activo
  ON public.empresa_miembros (empresa_id, user_id)
  WHERE activo IS TRUE;

-- Mantiene compatibilidad con user_id TEXT y exige UUID en nuevas filas.
-- NOT VALID evita bloquear la instalación si existen datos históricos que
-- deben auditarse antes de ejecutar VALIDATE CONSTRAINT.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.empresa_miembros'::regclass
      AND conname = 'empresa_miembros_user_id_uuid_check'
  ) THEN
    ALTER TABLE public.empresa_miembros
      ADD CONSTRAINT empresa_miembros_user_id_uuid_check
      CHECK (user_id IS NULL OR user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
      NOT VALID;
  END IF;
END;
$$;
