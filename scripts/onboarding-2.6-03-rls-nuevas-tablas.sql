-- ============================================
-- AGRILUX ONBOARDING 2.6 - Migración 03
-- SOBRESCRITA por onboarding-2.6-01-saneamiento-rls.sql
-- Este archivo se mantiene por referencia histórica.
-- Todas las políticas RLS de las tablas nuevas y los GRANT EXECUTE
-- están definidos en onboarding-2.6-01-saneamiento-rls.sql.
-- NO ejecutar este archivo por separado.
-- ============================================

-- Funciones helper necesarias para las políticas RLS
-- (GRANT idempotente: se puede ejecutar múltiples veces sin error)
GRANT EXECUTE ON FUNCTION public.onboarding_es_miembro(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.onboarding_es_admin(uuid) TO authenticated;

-- ============================================
-- cargos_laborales: catálogo de solo lectura
-- ============================================
ALTER TABLE public.cargos_laborales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cargos_laborales_select_catalog ON public.cargos_laborales;
DROP POLICY IF EXISTS cargos_laborales_no_insert ON public.cargos_laborales;
DROP POLICY IF EXISTS cargos_laborales_no_update ON public.cargos_laborales;
DROP POLICY IF EXISTS cargos_laborales_no_delete ON public.cargos_laborales;

CREATE POLICY cargos_laborales_select_catalog ON public.cargos_laborales
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY cargos_laborales_no_insert ON public.cargos_laborales
  FOR INSERT WITH CHECK (false);
CREATE POLICY cargos_laborales_no_update ON public.cargos_laborales
  FOR UPDATE USING (false);
CREATE POLICY cargos_laborales_no_delete ON public.cargos_laborales
  FOR DELETE USING (false);

-- ============================================
-- planes: catálogo de solo lectura
-- ============================================
ALTER TABLE public.planes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS planes_select_catalog ON public.planes;
DROP POLICY IF EXISTS planes_no_insert ON public.planes;
DROP POLICY IF EXISTS planes_no_update ON public.planes;
DROP POLICY IF EXISTS planes_no_delete ON public.planes;

CREATE POLICY planes_select_catalog ON public.planes
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY planes_no_insert ON public.planes
  FOR INSERT WITH CHECK (false);
CREATE POLICY planes_no_update ON public.planes
  FOR UPDATE USING (false);
CREATE POLICY planes_no_delete ON public.planes
  FOR DELETE USING (false);

-- ============================================
-- codigos_invitacion: solo administradores de empresa
-- ============================================
ALTER TABLE public.codigos_invitacion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS codigos_invitacion_select_admin ON public.codigos_invitacion;
DROP POLICY IF EXISTS codigos_invitacion_insert_admin ON public.codigos_invitacion;
DROP POLICY IF EXISTS codigos_invitacion_update_none ON public.codigos_invitacion;
DROP POLICY IF EXISTS codigos_invitacion_delete_admin ON public.codigos_invitacion;

CREATE POLICY codigos_invitacion_select_admin ON public.codigos_invitacion
  FOR SELECT USING (public.onboarding_es_admin(empresa_id));
CREATE POLICY codigos_invitacion_insert_admin ON public.codigos_invitacion
  FOR INSERT WITH CHECK (
    public.onboarding_es_admin(empresa_id) AND creado_por = auth.uid()
  );
CREATE POLICY codigos_invitacion_update_none ON public.codigos_invitacion
  FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY codigos_invitacion_delete_admin ON public.codigos_invitacion
  FOR DELETE USING (public.onboarding_es_admin(empresa_id));

-- ============================================
-- empresa_solicitudes: propietario o admin de empresa
-- ============================================
ALTER TABLE public.empresa_solicitudes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empresa_solicitudes_select_authorized ON public.empresa_solicitudes;
DROP POLICY IF EXISTS empresa_solicitudes_insert_own ON public.empresa_solicitudes;
DROP POLICY IF EXISTS empresa_solicitudes_update_admin ON public.empresa_solicitudes;
DROP POLICY IF EXISTS empresa_solicitudes_delete_admin ON public.empresa_solicitudes;

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

-- ============================================
-- invitacion_canjes: historial de canjes
-- ============================================
ALTER TABLE public.invitacion_canjes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invitacion_canjes_select_admin ON public.invitacion_canjes;
DROP POLICY IF EXISTS invitacion_canjes_insert_own ON public.invitacion_canjes;
DROP POLICY IF EXISTS invitacion_canjes_update_own ON public.invitacion_canjes;

CREATE POLICY invitacion_canjes_select_admin ON public.invitacion_canjes
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.codigos_invitacion ci
      WHERE ci.id = invitacion_id
        AND public.onboarding_es_admin(ci.empresa_id)
    )
  );
CREATE POLICY invitacion_canjes_insert_own ON public.invitacion_canjes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND usuario_id = auth.uid());
CREATE POLICY invitacion_canjes_update_own ON public.invitacion_canjes
  FOR UPDATE USING (usuario_id = auth.uid() OR usuario_id IS NULL)
  WITH CHECK (usuario_id = auth.uid());

-- ============================================
-- empresa_plan: membresía de empresa
-- ============================================
ALTER TABLE public.empresa_plan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empresa_plan_select_member ON public.empresa_plan;
DROP POLICY IF EXISTS empresa_plan_insert_none ON public.empresa_plan;
DROP POLICY IF EXISTS empresa_plan_update_admin ON public.empresa_plan;
DROP POLICY IF EXISTS empresa_plan_delete_admin ON public.empresa_plan;

CREATE POLICY empresa_plan_select_member ON public.empresa_plan
  FOR SELECT USING (public.onboarding_es_miembro(empresa_id));
CREATE POLICY empresa_plan_insert_none ON public.empresa_plan
  FOR INSERT WITH CHECK (false);
CREATE POLICY empresa_plan_update_admin ON public.empresa_plan
  FOR UPDATE USING (public.onboarding_es_admin(empresa_id))
  WITH CHECK (public.onboarding_es_admin(empresa_id));
CREATE POLICY empresa_plan_delete_admin ON public.empresa_plan
  FOR DELETE USING (public.onboarding_es_admin(empresa_id));