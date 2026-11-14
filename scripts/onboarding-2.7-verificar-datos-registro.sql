-- Verificación de datos personales duplicados antes del registro.
-- Uso: RPC verificar_datos_registro(p_email, p_whatsapp) → json
--   { email_registrado: bool, whatsapp_registrado: bool }
-- SECURITY DEFINER porque anon/authenticated no pueden hacer SELECT en
-- public.usuarios (RLS usuarios_select_own). No expone datos, solo booleanos.
-- Ejecutar en Supabase SQL Editor (idempotente).

CREATE OR REPLACE FUNCTION public.verificar_datos_registro(
  p_email text DEFAULT NULL,
  p_whatsapp text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_email text;
  v_wa    text;
  v_email_registrado    boolean := false;
  v_whatsapp_registrado boolean := false;
BEGIN
  v_email := lower(btrim(coalesce(p_email, '')));
  v_wa    := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');

  IF v_email <> '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.usuarios WHERE lower(email) = v_email
    ) INTO v_email_registrado;
  END IF;

  IF v_wa <> '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g') = v_wa
    ) INTO v_whatsapp_registrado;
  END IF;

  RETURN json_build_object(
    'email_registrado',    v_email_registrado,
    'whatsapp_registrado', v_whatsapp_registrado
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verificar_datos_registro(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verificar_datos_registro(text, text) TO anon, authenticated;
