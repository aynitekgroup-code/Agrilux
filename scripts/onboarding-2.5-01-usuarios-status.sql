-- AGRILUX ONBOARDING 2.5 - Migración 01
-- Sustituye todos los CHECK existentes que gobiernan usuarios.status.
-- No cambia el tipo de la columna ni elimina datos.

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.usuarios'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.usuarios DROP CONSTRAINT %I',
      constraint_name
    );
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.usuarios'::regclass
      AND conname = 'usuarios_status_check'
  ) THEN
    ALTER TABLE public.usuarios
      ADD CONSTRAINT usuarios_status_check
      CHECK (status IN ('aprobado', 'pendiente', 'suspendido'));
  END IF;
END;
$$;
