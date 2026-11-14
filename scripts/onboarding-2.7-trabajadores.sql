-- AGRILUX - Trabajadores de empresa
-- RPC: invitar_trabajador_empresa
-- Reglas:
-- 1. Solo un administrador ACTIVO de la empresa destino puede llamarla.
-- 2. Si el correo ya existe en usuarios, se vincula la cuenta (user_id).
-- 3. Si la persona (cuenta o correo) ya es miembro ACTIVO de OTRA empresa,
--    se rechaza. La pertenencia se compara por user_id (cuenta) y email.
-- 4. No se duplica dentro de la misma empresa (nombre o correo igual).
-- SECURITY DEFINER para que las reglas se apliquen aunque RLS cambie.
-- No borra ni modifica datos existentes. Idempotente.

CREATE OR REPLACE FUNCTION public.invitar_trabajador_empresa(
  p_empresa_id uuid,
  p_nombre text,
  p_email text DEFAULT NULL,
  p_rol text DEFAULT 'operario'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_nombre text;
  v_email  text;
  v_user_id uuid;
  v_pertenece text;
  v_row    public.empresa_miembros;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesión requerida';
  END IF;

  v_nombre := btrim(coalesce(p_nombre, ''));
  IF v_nombre = '' THEN
    RAISE EXCEPTION 'El nombre es obligatorio';
  END IF;

  IF coalesce(p_rol, 'operario') NOT IN ('administrador', 'ingeniero', 'supervisor', 'operario') THEN
    RAISE EXCEPTION 'Rol inválido: %', p_rol;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.empresa_miembros em
    WHERE em.empresa_id = p_empresa_id
      AND em.user_id = auth.uid()::text
      AND em.rol = 'administrador'
      AND em.activo IS TRUE
  ) THEN
    RAISE EXCEPTION 'Solo un administrador activo puede agregar trabajadores';
  END IF;

  v_email := lower(btrim(coalesce(p_email, '')));
  IF v_email = '' THEN v_email := NULL; END IF;

  -- Cuenta existente en usuarios (por correo); si no existe, es un trabajador sin cuenta
  IF v_email IS NOT NULL THEN
    SELECT id INTO v_user_id
    FROM public.usuarios
    WHERE lower(email) = v_email
    LIMIT 1;
  ELSE
    v_user_id := NULL;
  END IF;

  -- 3. No puede ser miembro activo de otra empresa (por cuenta o correo)
  SELECT empresa_id::text INTO v_pertenece
  FROM public.empresa_miembros em
  WHERE em.activo IS TRUE
    AND em.empresa_id <> p_empresa_id
    AND (
      (v_user_id IS NOT NULL AND em.user_id = v_user_id::text)
      OR (v_email IS NOT NULL AND lower(em.email) = v_email)
    )
  LIMIT 1;

  IF v_pertenece IS NOT NULL THEN
    RAISE EXCEPTION 'Esta persona ya pertenece a otra empresa';
  END IF;

  -- 4. No duplicar en la misma empresa (nombre o correo)
  IF EXISTS (
    SELECT 1 FROM public.empresa_miembros em
    WHERE em.empresa_id = p_empresa_id
      AND (
        lower(em.nombre) = lower(v_nombre)
        OR (v_email IS NOT NULL AND lower(em.email) = v_email)
      )
  ) THEN
    RAISE EXCEPTION 'Ya existe un trabajador con ese nombre o correo en la empresa';
  END IF;

  INSERT INTO public.empresa_miembros (empresa_id, user_id, nombre, email, rol, activo, created_at)
  VALUES (p_empresa_id, v_user_id::text, v_nombre, v_email, p_rol, true, now())
  RETURNING * INTO v_row;

  RETURN row_to_json(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.invitar_trabajador_empresa(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invitar_trabajador_empresa(uuid, text, text, text) TO authenticated;

-- RPC: vincular_trabajador_por_email
-- Vincula automáticamente los trabajadores (user_id NULL) cuya cuenta
-- coincide por correo con la cuenta que inició sesión.
-- Se llama al cargar las empresas del usuario. Idempotente.
CREATE OR REPLACE FUNCTION public.vincular_trabajador_por_email()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_email text;
  v_n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sesión requerida';
  END IF;

  SELECT lower(email) INTO v_email
  FROM public.usuarios
  WHERE id = auth.uid()::text
  LIMIT 1;

  IF v_email IS NULL THEN
    SELECT lower(email) INTO v_email
    FROM auth.users
    WHERE id = auth.uid()
    LIMIT 1;
  END IF;

  IF v_email IS NULL THEN
    RETURN json_build_object('ok', false, 'vinculados', 0);
  END IF;

  WITH upd AS (
    UPDATE public.empresa_miembros em
    SET user_id = auth.uid()::text
    WHERE em.user_id IS NULL
      AND lower(em.email) = v_email
      AND em.activo IS TRUE
    RETURNING em.id
  )
  SELECT count(*) INTO v_n FROM upd;

  RETURN json_build_object('ok', true, 'vinculados', coalesce(v_n, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.vincular_trabajador_por_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vincular_trabajador_por_email() TO authenticated;
