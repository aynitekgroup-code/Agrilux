-- AGRILUX ONBOARDING 2.5 - Migración 10
-- RPC protegidas para onboarding empresarial.
-- No recibe ni almacena contraseñas: Supabase Auth gestiona las credenciales.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.onboarding_es_miembro(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.empresa_miembros em
       WHERE em.empresa_id = p_empresa_id
         AND em.user_id = auth.uid()::text
         AND em.activo IS TRUE
     );
$$;

CREATE OR REPLACE FUNCTION public.onboarding_es_admin(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.empresa_miembros em
       WHERE em.empresa_id = p_empresa_id
         AND em.user_id = auth.uid()::text
         AND em.activo IS TRUE
         AND em.rol = 'administrador'
     );
$$;

CREATE OR REPLACE FUNCTION public.onboarding_marcar_rpc()
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$ SELECT set_config('app.onboarding_rpc', '1', true); $$;

CREATE OR REPLACE FUNCTION public.onboarding_proteger_usuarios()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.id <> auth.uid()::text
       OR NEW.rol IS DISTINCT FROM 'agricultor'
       OR NEW.status NOT IN ('aprobado', 'pendiente') THEN
      RAISE EXCEPTION 'Perfil de usuario no autorizado';
    END IF;
  ELSIF current_setting('app.onboarding_rpc', true) IS DISTINCT FROM '1'
     AND (NEW.rol IS DISTINCT FROM OLD.rol OR NEW.status IS DISTINCT FROM OLD.status) THEN
    RAISE EXCEPTION 'Los campos rol y status solo pueden cambiarse por un flujo autorizado';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.password_default IS NOT NULL THEN
    RAISE EXCEPTION 'No se almacenan contraseñas en usuarios.password_default';
  ELSIF TG_OP = 'UPDATE'
     AND NEW.password_default IS DISTINCT FROM OLD.password_default
     AND NEW.password_default IS NOT NULL THEN
    RAISE EXCEPTION 'No se almacenan contraseñas en usuarios.password_default';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS usuarios_proteger_onboarding ON public.usuarios;
CREATE TRIGGER usuarios_proteger_onboarding
BEFORE INSERT OR UPDATE ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.onboarding_proteger_usuarios();

CREATE OR REPLACE FUNCTION public.onboarding_proteger_miembro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND current_setting('app.onboarding_rpc', true) IS DISTINCT FROM '1'
     AND (NEW.rol IS DISTINCT FROM OLD.rol OR NEW.activo IS DISTINCT FROM OLD.activo) THEN
    RAISE EXCEPTION 'rol y activo solo pueden cambiarse por una RPC autorizada';
  END IF;
  IF NEW.user_id IS NOT NULL
     AND NEW.user_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'user_id no es un UUID válido';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS empresa_miembros_proteger_onboarding ON public.empresa_miembros;
CREATE TRIGGER empresa_miembros_proteger_onboarding
BEFORE INSERT OR UPDATE ON public.empresa_miembros
FOR EACH ROW EXECUTE FUNCTION public.onboarding_proteger_miembro();

CREATE OR REPLACE FUNCTION public.onboarding_proteger_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.estado <> 'activa' THEN
    RAISE EXCEPTION 'El estado de empresa_plan solo lo define un flujo autorizado';
  ELSIF TG_OP = 'UPDATE'
     AND current_setting('app.onboarding_rpc', true) IS DISTINCT FROM '1'
     AND NEW.estado IS DISTINCT FROM OLD.estado THEN
    RAISE EXCEPTION 'estado de empresa_plan solo puede cambiarse por un flujo autorizado';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS empresa_plan_proteger_onboarding ON public.empresa_plan;
CREATE TRIGGER empresa_plan_proteger_onboarding
BEFORE INSERT OR UPDATE ON public.empresa_plan
FOR EACH ROW EXECUTE FUNCTION public.onboarding_proteger_plan();

CREATE OR REPLACE FUNCTION public.onboarding_proteger_solicitud()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND current_setting('app.onboarding_rpc', true) IS DISTINCT FROM '1'
     AND (NEW.estado IS DISTINCT FROM OLD.estado
       OR NEW.revisado_en IS DISTINCT FROM OLD.revisado_en
       OR NEW.revisado_por IS DISTINCT FROM OLD.revisado_por) THEN
    RAISE EXCEPTION 'El estado de la solicitud solo puede cambiarse por una RPC autorizada';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS empresa_solicitudes_proteger_onboarding ON public.empresa_solicitudes;
CREATE TRIGGER empresa_solicitudes_proteger_onboarding
BEFORE INSERT OR UPDATE ON public.empresa_solicitudes
FOR EACH ROW EXECUTE FUNCTION public.onboarding_proteger_solicitud();

-- Limpia firmas antiguas incompatibles de las primeras iteraciones.
DROP FUNCTION IF EXISTS public.crear_empresa_con_administrador(text, text, text, text, jsonb, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.confirmar_canje_invitacion(uuid, text);

CREATE OR REPLACE FUNCTION public.validar_codigo_invitacion(p_token_plano text)
RETURNS TABLE(ok boolean, data jsonb, mensaje text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_invitacion public.codigos_invitacion%ROWTYPE;
BEGIN
  IF p_token_plano IS NULL OR length(trim(p_token_plano)) < 16 THEN
    RETURN QUERY SELECT false, NULL::jsonb, 'Código de invitación inválido';
    RETURN;
  END IF;

  SELECT * INTO v_invitacion
  FROM public.codigos_invitacion
  WHERE token_hash = encode(digest(trim(p_token_plano), 'sha256'), 'hex')
    AND revocado IS FALSE
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::jsonb, 'Código de invitación no encontrado';
  ELSIF v_invitacion.expira_en <= clock_timestamp() THEN
    RETURN QUERY SELECT false, NULL::jsonb, 'La invitación ha expirado';
  ELSIF v_invitacion.estado_reserva = 'agotada'
     OR v_invitacion.usos_consumidos >= v_invitacion.usos_maximos THEN
    RETURN QUERY SELECT false, NULL::jsonb, 'La invitación ha sido agotada';
  ELSE
    RETURN QUERY SELECT true, jsonb_build_object(
      'invitacion_id', v_invitacion.id,
      'empresa_id', v_invitacion.empresa_id,
      'empresa', jsonb_build_object(
        'id', v_invitacion.empresa_id,
        'nombre', (SELECT e.nombre FROM public.empresas e WHERE e.id = v_invitacion.empresa_id)
      ),
      'rol_asignado', v_invitacion.rol_asignado,
      'estado_reserva', v_invitacion.estado_reserva,
      'usos_consumidos', v_invitacion.usos_consumidos,
      'usos_maximos', v_invitacion.usos_maximos
    ), NULL::text;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reservar_codigo_invitacion(
  p_token_plano text,
  p_email_usuario text
)
RETURNS TABLE(reserva_id uuid, empresa_id uuid, invitacion_id uuid, ok boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_reserva uuid := gen_random_uuid();
  v_id uuid;
  v_empresa uuid;
BEGIN
  IF p_email_usuario IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::uuid, false;
    RETURN;
  END IF;
  UPDATE public.codigos_invitacion ci
  SET estado_reserva = 'reservada',
      reserva_id = v_reserva,
      reservado_por = auth.uid(),
      reservado_en = now(),
      reserva_expira_en = now() + interval '10 minutes'
  WHERE ci.id = (
    SELECT ci.id
    FROM public.codigos_invitacion ci
    WHERE ci.token_hash = encode(digest(trim(p_token_plano), 'sha256'), 'hex')
      AND ci.estado_reserva = 'disponible'
      AND ci.revocado IS FALSE
      AND ci.expira_en > now()
      AND (ci.email_destino IS NULL OR lower(ci.email_destino) = lower(trim(p_email_usuario)))
      AND ci.usos_consumidos < ci.usos_maximos
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING ci.id, ci.empresa_id INTO v_id, v_empresa;

  RETURN QUERY SELECT v_reserva, v_empresa, v_id, v_id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.liberar_reserva_invitacion(p_reserva_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.codigos_invitacion
  SET estado_reserva = 'disponible',
      reserva_id = NULL, reservado_por = NULL,
      reservado_en = NULL, reserva_expira_en = NULL
  WHERE reserva_id = p_reserva_id
    AND (reservado_por = auth.uid() OR reservado_por IS NULL)
    AND estado_reserva = 'reservada';
END;
$$;

CREATE OR REPLACE FUNCTION public.confirmar_canje_invitacion(
  p_reserva_id uuid,
  p_email_usado text,
  p_nombre text,
  p_ubicacion text DEFAULT '',
  p_whatsapp text DEFAULT NULL
)
RETURNS TABLE(empresa_id uuid, miembro_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_inv public.codigos_invitacion%ROWTYPE;
  v_member uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sesión requerida'; END IF;
  SELECT * INTO v_inv FROM public.codigos_invitacion
  WHERE reserva_id = p_reserva_id
    AND reservado_por = auth.uid()
    AND estado_reserva = 'reservada'
    AND reserva_expira_en > now()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reserva de invitación inválida o expirada'; END IF;

  -- Verificar que el usuario no sea ya miembro activo de la empresa objetivo
  IF EXISTS (
    SELECT 1 FROM public.empresa_miembros em
    WHERE em.empresa_id = v_inv.empresa_id
      AND em.user_id = auth.uid()::text
      AND em.activo IS TRUE
  ) THEN
    RAISE EXCEPTION 'El usuario ya es miembro activo de esta empresa';
  END IF;

  PERFORM public.onboarding_marcar_rpc();
  INSERT INTO public.usuarios (id, nombre, email, ubicacion, whatsapp, rol, status, creado_por)
  VALUES (auth.uid(), trim(p_nombre), lower(trim(p_email_usado)), p_ubicacion, p_whatsapp, 'agricultor', 'aprobado', 'invitation')
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO v_member
  FROM public.empresa_miembros em
  WHERE em.empresa_id = v_inv.empresa_id
    AND em.user_id = auth.uid()::text
    AND em.activo IS TRUE
  LIMIT 1;

  IF v_member IS NULL THEN
    INSERT INTO public.empresa_miembros (empresa_id, user_id, nombre, email, rol, activo, created_at)
    VALUES (v_inv.empresa_id, auth.uid()::text, trim(p_nombre), lower(trim(p_email_usado)), v_inv.rol_asignado, true, now())
    RETURNING id INTO v_member;
  END IF;

  -- Si no hay miembro válido, abortar todo sin consumir la invitación
  IF v_member IS NULL THEN
    RAISE EXCEPTION 'No se pudo crear la membresía en la empresa';
  END IF;

  -- Solo consumir la invitación si se creó o confirmó una membresía válida
  UPDATE public.codigos_invitacion
  SET usos_consumidos = usos_consumidos + 1,
      estado_reserva = CASE WHEN usos_consumidos + 1 >= usos_maximos THEN 'agotada' ELSE 'disponible' END,
      reserva_id = NULL, reservado_por = NULL, reservado_en = NULL, reserva_expira_en = NULL
  WHERE id = v_inv.id;

  UPDATE public.invitacion_canjes
  SET usuario_id = auth.uid(), estado_intento = 'exitoso'
  WHERE reserva_id = p_reserva_id AND estado_intento = 'pendiente';
  RETURN QUERY SELECT v_inv.empresa_id, v_member;
END;
$$;

CREATE OR REPLACE FUNCTION public.crear_empresa_con_administrador(
  p_nombre text, p_email text, p_ubicacion text, p_coords jsonb,
  p_whatsapp text, p_nombre_empresa text, p_ruc text,
  p_telefono text, p_ubicacion_empresa text
)
RETURNS TABLE(empresa_id uuid, empresa_nombre text, usuario_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_empresa uuid; v_plan uuid; v_member uuid; v_plan_empresa uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sesión requerida'; END IF;
  PERFORM public.onboarding_marcar_rpc();
  INSERT INTO public.usuarios (id, nombre, email, ubicacion, coords, whatsapp, rol, status, creado_por)
  VALUES (auth.uid(), trim(p_nombre), lower(trim(p_email)), p_ubicacion, p_coords, p_whatsapp, 'agricultor', 'aprobado', 'self')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.empresas (nombre, ruc, telefono, ubicacion, created_by, campana_activa)
  VALUES (trim(p_nombre_empresa), nullif(trim(p_ruc), ''), p_telefono, p_ubicacion_empresa, auth.uid()::text, '2026-A')
  RETURNING id INTO v_empresa;
  SELECT id INTO v_member
  FROM public.empresa_miembros em
  WHERE em.empresa_id = v_empresa
    AND em.user_id = auth.uid()::text
    AND em.activo IS TRUE
  LIMIT 1;

  IF v_member IS NULL THEN
    INSERT INTO public.empresa_miembros (empresa_id, user_id, nombre, email, rol, activo, created_at)
    VALUES (v_empresa, auth.uid()::text, trim(p_nombre), lower(trim(p_email)), 'administrador', true, now())
    RETURNING id INTO v_member;
  END IF;

  -- Si no hay membresía activa, abortar: no hay empresa sin administrador
  IF v_member IS NULL THEN
    RAISE EXCEPTION 'No se pudo crear la membresía de administrador en la empresa';
  END IF;

  SELECT id INTO v_plan FROM public.planes WHERE nombre = 'Gratuito' AND activo IS TRUE LIMIT 1;
  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'No existe el plan gratuito activo';
  END IF;

  INSERT INTO public.empresa_plan (empresa_id, plan_id, estado, fecha_inicio)
  VALUES (v_empresa, v_plan, 'activa', now())
  RETURNING id INTO v_plan_empresa;

  -- Si no se pudo crear el plan, abortar: no hay empresa sin plan
  IF v_plan_empresa IS NULL THEN
    RAISE EXCEPTION 'No se pudo crear el plan de empresa';
  END IF;

  RETURN QUERY SELECT v_empresa, trim(p_nombre_empresa), auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.modificar_miembro_empresa(
  p_miembro_id uuid, p_nuevo_rol text DEFAULT NULL, p_nuevo_activo boolean DEFAULT NULL
)
RETURNS public.empresa_miembros
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_old public.empresa_miembros; v_new public.empresa_miembros; v_admin_count integer;
BEGIN
  SELECT * INTO v_old FROM public.empresa_miembros WHERE id = p_miembro_id FOR UPDATE;
  IF NOT FOUND OR NOT public.onboarding_es_admin(v_old.empresa_id) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF v_old.user_id = auth.uid()::text AND p_nuevo_activo IS FALSE THEN RAISE EXCEPTION 'No puedes desactivar tu propia membresía'; END IF;
  IF p_nuevo_rol IS NOT NULL AND p_nuevo_rol NOT IN ('administrador','ingeniero','supervisor','operario') THEN RAISE EXCEPTION 'Rol inválido'; END IF;
  IF v_old.rol = 'administrador' AND (
        p_nuevo_activo IS FALSE OR
        (p_nuevo_rol IS NOT NULL AND p_nuevo_rol <> 'administrador')
      ) THEN
    SELECT count(*) INTO v_admin_count
    FROM public.empresa_miembros
    WHERE empresa_id = v_old.empresa_id
      AND rol = 'administrador'
      AND activo IS TRUE
      AND id <> p_miembro_id;
    IF v_admin_count = 0 THEN
      RAISE EXCEPTION 'No se puede desactivar o cambiar el rol del último administrador activo de la empresa';
    END IF;
  END IF;
  PERFORM public.onboarding_marcar_rpc();
  UPDATE public.empresa_miembros
  SET rol = COALESCE(p_nuevo_rol, rol), activo = COALESCE(p_nuevo_activo, activo)
  WHERE id = p_miembro_id
  RETURNING * INTO v_new;
  RETURN v_new;
END;
$$;

CREATE OR REPLACE FUNCTION public.aprobar_solicitud_empresa(p_solicitud_id uuid)
RETURNS public.empresa_miembros
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE s public.empresa_solicitudes%ROWTYPE; m public.empresa_miembros;
BEGIN
  SELECT * INTO s FROM public.empresa_solicitudes WHERE id = p_solicitud_id FOR UPDATE;
  IF NOT FOUND OR NOT public.onboarding_es_admin(s.empresa_id) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  PERFORM public.onboarding_marcar_rpc();
  INSERT INTO public.empresa_miembros (empresa_id, user_id, nombre, email, rol, activo, created_at)
  VALUES (s.empresa_id, s.user_id, s.nombre, s.email, 'operario', true, now())
  RETURNING * INTO m;
  UPDATE public.empresa_solicitudes SET estado = 'aprobado', revisado_en = now(), revisado_por = auth.uid() WHERE id = s.id;
  RETURN m;
END;
$$;

CREATE OR REPLACE FUNCTION public.rechazar_solicitud_empresa(p_solicitud_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_empresa uuid;
BEGIN
  SELECT empresa_id INTO v_empresa FROM public.empresa_solicitudes WHERE id = p_solicitud_id;
  IF v_empresa IS NULL OR NOT public.onboarding_es_admin(v_empresa) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  UPDATE public.empresa_solicitudes SET estado = 'rechazado', revisado_en = now(), revisado_por = auth.uid() WHERE id = p_solicitud_id;
END;
$$;

-- Crear empresa para usuario autenticado existente (miembro administrador)
-- Usada cuando el usuario ya tiene cuenta de Auth y quiere crear su empresa
CREATE OR REPLACE FUNCTION public.crear_empresa_con_miembro_existente(
  p_nombre_empresa text, p_ruc text, p_telefono text, p_ubicacion_empresa text,
  p_usuario_id uuid, p_usuario_nombre text, p_usuario_email text
)
RETURNS TABLE(empresa_id uuid, empresa_nombre text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_empresa uuid; v_plan uuid; v_member uuid; v_plan_empresa uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sesión requerida'; END IF;
  IF auth.uid() <> p_usuario_id THEN RAISE EXCEPTION 'No autorizado'; END IF;

  INSERT INTO public.empresas (nombre, ruc, telefono, ubicacion, created_by, campana_activa)
  VALUES (trim(p_nombre_empresa), nullif(trim(p_ruc), ''), p_telefono, p_ubicacion_empresa, p_usuario_id::text, '2026-A')
  RETURNING id INTO v_empresa;

  SELECT id INTO v_member
  FROM public.empresa_miembros em
  WHERE em.empresa_id = v_empresa
    AND em.user_id = p_usuario_id::text
    AND em.activo IS TRUE
  LIMIT 1;

  IF v_member IS NULL THEN
    INSERT INTO public.empresa_miembros (empresa_id, user_id, nombre, email, rol, activo, created_at)
    VALUES (v_empresa, p_usuario_id::text, trim(p_usuario_nombre), lower(trim(p_usuario_email)), 'administrador', true, now())
    RETURNING id INTO v_member;
  END IF;

  -- Si no hay membresía activa, abortar
  IF v_member IS NULL THEN
    RAISE EXCEPTION 'No se pudo crear la membresía de administrador en la empresa';
  END IF;

  SELECT id INTO v_plan FROM public.planes WHERE nombre = 'Gratuito' AND activo IS TRUE LIMIT 1;
  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'No existe el plan gratuito activo';
  END IF;

  INSERT INTO public.empresa_plan (empresa_id, plan_id, estado, fecha_inicio)
  VALUES (v_empresa, v_plan, 'activa', now())
  RETURNING id INTO v_plan_empresa;

  -- Si no se pudo crear el plan, abortar
  IF v_plan_empresa IS NULL THEN
    RAISE EXCEPTION 'No se pudo crear el plan de empresa';
  END IF;

  RETURN QUERY SELECT v_empresa, trim(p_nombre_empresa);
END;
$$;

-- No se permite invocar estas funciones anónimamente ni modificar sus políticas.
REVOKE ALL ON FUNCTION public.onboarding_es_miembro(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.onboarding_es_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.onboarding_marcar_rpc() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.onboarding_proteger_solicitud() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validar_codigo_invitacion(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reservar_codigo_invitacion(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.liberar_reserva_invitacion(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirmar_canje_invitacion(uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crear_empresa_con_administrador(text, text, text, jsonb, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.modificar_miembro_empresa(uuid, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.aprobar_solicitud_empresa(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rechazar_solicitud_empresa(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crear_empresa_con_miembro_existente(text, text, text, text, uuid, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.rechazar_solicitud_empresa(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_empresa_con_miembro_existente(text, text, text, text, uuid, text, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.onboarding_es_miembro(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.onboarding_es_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_codigo_invitacion(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reservar_codigo_invitacion(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_codigo_invitacion(text) TO anon;
GRANT EXECUTE ON FUNCTION public.liberar_reserva_invitacion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.liberar_reserva_invitacion(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.confirmar_canje_invitacion(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_empresa_con_administrador(text, text, text, jsonb, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.modificar_miembro_empresa(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aprobar_solicitud_empresa(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rechazar_solicitud_empresa(uuid) TO authenticated;

ALTER FUNCTION public.onboarding_es_miembro(uuid) OWNER TO postgres;
ALTER FUNCTION public.onboarding_es_admin(uuid) OWNER TO postgres;
ALTER FUNCTION public.onboarding_marcar_rpc() OWNER TO postgres;
ALTER FUNCTION public.onboarding_proteger_usuarios() OWNER TO postgres;
ALTER FUNCTION public.onboarding_proteger_miembro() OWNER TO postgres;
ALTER FUNCTION public.onboarding_proteger_plan() OWNER TO postgres;
ALTER FUNCTION public.onboarding_proteger_solicitud() OWNER TO postgres;
ALTER FUNCTION public.onboarding_proteger_solicitud() OWNER TO postgres;
ALTER FUNCTION public.validar_codigo_invitacion(text) OWNER TO postgres;
ALTER FUNCTION public.reservar_codigo_invitacion(text, text) OWNER TO postgres;
ALTER FUNCTION public.liberar_reserva_invitacion(uuid) OWNER TO postgres;
ALTER FUNCTION public.confirmar_canje_invitacion(uuid, text, text, text, text) OWNER TO postgres;
ALTER FUNCTION public.crear_empresa_con_administrador(text, text, text, jsonb, text, text, text, text, text) OWNER TO postgres;
ALTER FUNCTION public.modificar_miembro_empresa(uuid, text, boolean) OWNER TO postgres;
ALTER FUNCTION public.aprobar_solicitud_empresa(uuid) OWNER TO postgres;
ALTER FUNCTION public.rechazar_solicitud_empresa(uuid) OWNER TO postgres;
