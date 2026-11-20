-- AGRILUX ONBOARDING 2.5 - Migración 11
-- RLS restrictiva. Las comprobaciones de membresía usan funciones
-- SECURITY DEFINER para evitar recursividad al consultar empresa_miembros.

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'usuarios', 'empresas', 'empresa_miembros', 'empresa_solicitudes',
        'codigos_invitacion', 'invitacion_canjes', 'cargos_laborales',
        'planes', 'empresa_plan'
      ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END;
$$;

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY usuarios_select_own ON public.usuarios
  FOR SELECT USING (id = auth.uid()::text);
CREATE POLICY usuarios_insert_own ON public.usuarios
  FOR INSERT WITH CHECK (id = auth.uid()::text);
CREATE POLICY usuarios_update_own ON public.usuarios
  FOR UPDATE USING (id = auth.uid()::text) WITH CHECK (id = auth.uid()::text);

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY empresas_select_member ON public.empresas
  FOR SELECT USING (public.onboarding_es_miembro(id));
CREATE POLICY empresas_insert_owner ON public.empresas
  FOR INSERT WITH CHECK (created_by = auth.uid()::text);
CREATE POLICY empresas_update_admin ON public.empresas
  FOR UPDATE USING (public.onboarding_es_admin(id))
  WITH CHECK (public.onboarding_es_admin(id));
CREATE POLICY empresas_delete_admin ON public.empresas
  FOR DELETE USING (public.onboarding_es_admin(id));

ALTER TABLE public.empresa_miembros ENABLE ROW LEVEL SECURITY;
CREATE POLICY empresa_miembros_select_member ON public.empresa_miembros
  FOR SELECT USING (
    user_id = auth.uid()::text OR public.onboarding_es_miembro(empresa_id)
  );
CREATE POLICY empresa_miembros_insert_admin ON public.empresa_miembros
  FOR INSERT WITH CHECK (public.onboarding_es_admin(empresa_id));
CREATE POLICY empresa_miembros_update_admin ON public.empresa_miembros
  FOR UPDATE USING (public.onboarding_es_admin(empresa_id))
  WITH CHECK (public.onboarding_es_admin(empresa_id));
CREATE POLICY empresa_miembros_delete_admin ON public.empresa_miembros
  FOR DELETE USING (public.onboarding_es_admin(empresa_id));

ALTER TABLE public.empresa_solicitudes ENABLE ROW LEVEL SECURITY;
CREATE POLICY empresa_solicitudes_select_authorized ON public.empresa_solicitudes
  FOR SELECT USING (
    user_id = auth.uid()::text OR public.onboarding_es_admin(empresa_id)
  );
CREATE POLICY empresa_solicitudes_insert_own ON public.empresa_solicitudes
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY empresa_solicitudes_update_admin ON public.empresa_solicitudes
  FOR UPDATE USING (public.onboarding_es_admin(empresa_id))
  WITH CHECK (public.onboarding_es_admin(empresa_id));
CREATE POLICY empresa_solicitudes_delete_admin ON public.empresa_solicitudes
  FOR DELETE USING (public.onboarding_es_admin(empresa_id));

ALTER TABLE public.codigos_invitacion ENABLE ROW LEVEL SECURITY;
CREATE POLICY codigos_invitacion_select_admin ON public.codigos_invitacion
  FOR SELECT USING (public.onboarding_es_admin(empresa_id));
CREATE POLICY codigos_invitacion_insert_admin ON public.codigos_invitacion
  FOR INSERT WITH CHECK (
    public.onboarding_es_admin(empresa_id) AND creado_por = auth.uid()::text
  );
-- La reserva, revocación y consumo ocurren únicamente por RPC.
CREATE POLICY codigos_invitacion_update_none ON public.codigos_invitacion
  FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY codigos_invitacion_delete_admin ON public.codigos_invitacion
  FOR DELETE USING (public.onboarding_es_admin(empresa_id));

ALTER TABLE public.invitacion_canjes ENABLE ROW LEVEL SECURITY;
CREATE POLICY invitacion_canjes_select_admin ON public.invitacion_canjes
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.codigos_invitacion ci
      WHERE ci.id = invitacion_id
        AND public.onboarding_es_admin(ci.empresa_id)
    )
  );
-- El historial lo crea/actualiza el flujo SECURITY DEFINER.
CREATE POLICY invitacion_canjes_insert_own ON public.invitacion_canjes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND usuario_id = auth.uid()::text);
CREATE POLICY invitacion_canjes_update_own ON public.invitacion_canjes
  FOR UPDATE USING (usuario_id = auth.uid()::text OR usuario_id IS NULL)
  WITH CHECK (usuario_id = auth.uid()::text);

ALTER TABLE public.cargos_laborales ENABLE ROW LEVEL SECURITY;
CREATE POLICY cargos_laborales_select_catalog ON public.cargos_laborales
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY cargos_laborales_no_insert ON public.cargos_laborales
  FOR INSERT WITH CHECK (false);
CREATE POLICY cargos_laborales_no_update ON public.cargos_laborales
  FOR UPDATE USING (false);
CREATE POLICY cargos_laborales_no_delete ON public.cargos_laborales
  FOR DELETE USING (false);

ALTER TABLE public.planes ENABLE ROW LEVEL SECURITY;
CREATE POLICY planes_select_catalog ON public.planes
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY planes_no_insert ON public.planes
  FOR INSERT WITH CHECK (false);
CREATE POLICY planes_no_update ON public.planes
  FOR UPDATE USING (false);
CREATE POLICY planes_no_delete ON public.planes
  FOR DELETE USING (false);

ALTER TABLE public.empresa_plan ENABLE ROW LEVEL SECURITY;
CREATE POLICY empresa_plan_select_member ON public.empresa_plan
  FOR SELECT USING (public.onboarding_es_miembro(empresa_id));
CREATE POLICY empresa_plan_insert_none ON public.empresa_plan
  FOR INSERT WITH CHECK (false);
CREATE POLICY empresa_plan_update_admin ON public.empresa_plan
  FOR UPDATE USING (public.onboarding_es_admin(empresa_id))
  WITH CHECK (public.onboarding_es_admin(empresa_id));
CREATE POLICY empresa_plan_delete_admin ON public.empresa_plan
  FOR DELETE USING (public.onboarding_es_admin(empresa_id));
