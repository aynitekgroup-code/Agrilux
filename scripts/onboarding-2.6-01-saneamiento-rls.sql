-- ============================================
-- AGRILUX ONBOARDING 2.6 - Migración 01
-- Saneamiento de políticas RLS: elimina permisivas
-- y crea políticas restrictivas por empresa/usuario
-- ============================================

-- 1. Eliminar TODAS las políticas existentes en tablas afectadas
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
        'planes', 'empresa_plan',
        'diagnosticos', 'parcelas', 'registros_parcela', 'historial_clinico',
        'tiendas_comunidad', 'precios_historicos', 'tiendas', 'aliados',
        'comunidad', 'contactos_marketing', 'conversaciones_voz', 'fundos',
        'campanas', 'lotes', 'labores', 'tareas', 'cosechas', 'gastos',
        'hallazgos'
      ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- ============================================
-- 2. Tablas personales (aislamiento por user_id)
-- ============================================

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY usuarios_select_own ON public.usuarios
  FOR SELECT USING (id = auth.uid());
CREATE POLICY usuarios_insert_own ON public.usuarios
  FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY usuarios_update_own ON public.usuarios
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

ALTER TABLE public.diagnosticos ENABLE ROW LEVEL SECURITY;
CREATE POLICY diagnosticos_select_own ON public.diagnosticos
  FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY diagnosticos_insert_own ON public.diagnosticos
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

ALTER TABLE public.parcelas ENABLE ROW LEVEL SECURITY;
CREATE POLICY parcelas_select_own ON public.parcelas
  FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY parcelas_insert_own ON public.parcelas
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY parcelas_delete_own ON public.parcelas
  FOR DELETE USING (user_id = auth.uid()::text);

ALTER TABLE public.registros_parcela ENABLE ROW LEVEL SECURITY;
CREATE POLICY registros_parcela_select_own ON public.registros_parcela
  FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY registros_parcela_insert_own ON public.registros_parcela
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY registros_parcela_delete_own ON public.registros_parcela
  FOR DELETE USING (user_id = auth.uid()::text);

ALTER TABLE public.historial_clinico ENABLE ROW LEVEL SECURITY;
CREATE POLICY historial_clinico_select_own ON public.historial_clinico
  FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY historial_clinico_insert_own ON public.historial_clinico
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY historial_clinico_update_own ON public.historial_clinico
  FOR UPDATE USING (user_id = auth.uid()::text) WITH CHECK (user_id = auth.uid()::text);

ALTER TABLE public.conversaciones_voz ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversaciones_voz_select_own ON public.conversaciones_voz
  FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY conversaciones_voz_insert_own ON public.conversaciones_voz
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

-- ============================================
-- 3. Tablas públicas de solo lectura
-- ============================================

ALTER TABLE public.tiendas_comunidad ENABLE ROW LEVEL SECURITY;
CREATE POLICY tiendas_comunidad_select_public ON public.tiendas_comunidad
  FOR SELECT USING (activa IS TRUE);
CREATE POLICY tiendas_comunidad_insert_own ON public.tiendas_comunidad
  FOR INSERT WITH CHECK (propietario_id = auth.uid()::text);
CREATE POLICY tiendas_comunidad_update_own ON public.tiendas_comunidad
  FOR UPDATE USING (propietario_id = auth.uid()::text)
  WITH CHECK (propietario_id = auth.uid()::text);
CREATE POLICY tiendas_comunidad_delete_own ON public.tiendas_comunidad
  FOR DELETE USING (propietario_id = auth.uid()::text);

ALTER TABLE public.precios_historicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY precios_historicos_select_auth ON public.precios_historicos
  FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE public.tiendas ENABLE ROW LEVEL SECURITY;
CREATE POLICY tiendas_select_auth ON public.tiendas
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY tiendas_insert_auth ON public.tiendas
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY tiendas_update_auth ON public.tiendas
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY tiendas_delete_auth ON public.tiendas
  FOR DELETE USING (auth.role() = 'authenticated');

ALTER TABLE public.aliados ENABLE ROW LEVEL SECURITY;
CREATE POLICY aliados_select_auth ON public.aliados
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY aliados_insert_auth ON public.aliados
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY aliados_update_auth ON public.aliados
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY aliados_delete_auth ON public.aliados
  FOR DELETE USING (auth.role() = 'authenticated');

ALTER TABLE public.comunidad ENABLE ROW LEVEL SECURITY;
CREATE POLICY comunidad_select_auth ON public.comunidad
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY comunidad_insert_own ON public.comunidad
  FOR INSERT WITH CHECK (autor_id = auth.uid()::text);
CREATE POLICY comunidad_update_own ON public.comunidad
  FOR UPDATE USING (autor_id = auth.uid()::text)
  WITH CHECK (autor_id = auth.uid()::text);

ALTER TABLE public.contactos_marketing ENABLE ROW LEVEL SECURITY;
CREATE POLICY contactos_marketing_select_auth ON public.contactos_marketing
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY contactos_marketing_insert_auth ON public.contactos_marketing
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY contactos_marketing_delete_auth ON public.contactos_marketing
  FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================
-- 4. Tablas empresariales (aislamiento por membresía)
-- ============================================

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

ALTER TABLE public.fundos ENABLE ROW LEVEL SECURITY;
CREATE POLICY fundos_select_member ON public.fundos
  FOR SELECT USING (public.onboarding_es_miembro(empresa_id));
CREATE POLICY fundos_insert_admin ON public.fundos
  FOR INSERT WITH CHECK (public.onboarding_es_admin(empresa_id));
CREATE POLICY fundos_update_admin ON public.fundos
  FOR UPDATE USING (public.onboarding_es_admin(empresa_id))
  WITH CHECK (public.onboarding_es_admin(empresa_id));
CREATE POLICY fundos_delete_admin ON public.fundos
  FOR DELETE USING (public.onboarding_es_admin(empresa_id));

ALTER TABLE public.campanas ENABLE ROW LEVEL SECURITY;
CREATE POLICY campanas_select_member ON public.campanas
  FOR SELECT USING (public.onboarding_es_miembro(empresa_id));
CREATE POLICY campanas_insert_admin ON public.campanas
  FOR INSERT WITH CHECK (public.onboarding_es_admin(empresa_id));
CREATE POLICY campanas_update_admin ON public.campanas
  FOR UPDATE USING (public.onboarding_es_admin(empresa_id))
  WITH CHECK (public.onboarding_es_admin(empresa_id));
CREATE POLICY campanas_delete_admin ON public.campanas
  FOR DELETE USING (public.onboarding_es_admin(empresa_id));

ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY lotes_select_member ON public.lotes
  FOR SELECT USING (public.onboarding_es_miembro(empresa_id));
CREATE POLICY lotes_insert_admin ON public.lotes
  FOR INSERT WITH CHECK (public.onboarding_es_admin(empresa_id));
CREATE POLICY lotes_update_admin ON public.lotes
  FOR UPDATE USING (public.onboarding_es_admin(empresa_id))
  WITH CHECK (public.onboarding_es_admin(empresa_id));
CREATE POLICY lotes_delete_admin ON public.lotes
  FOR DELETE USING (public.onboarding_es_admin(empresa_id));

ALTER TABLE public.labores ENABLE ROW LEVEL SECURITY;
CREATE POLICY labores_select_member ON public.labores
  FOR SELECT USING (public.onboarding_es_miembro(empresa_id));
CREATE POLICY labores_insert_admin ON public.labores
  FOR INSERT WITH CHECK (public.onboarding_es_admin(empresa_id));
CREATE POLICY labores_update_admin ON public.labores
  FOR UPDATE USING (public.onboarding_es_admin(empresa_id))
  WITH CHECK (public.onboarding_es_admin(empresa_id));
CREATE POLICY labores_delete_admin ON public.labores
  FOR DELETE USING (public.onboarding_es_admin(empresa_id));

ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;
CREATE POLICY tareas_select_member ON public.tareas
  FOR SELECT USING (public.onboarding_es_miembro(empresa_id));
CREATE POLICY tareas_insert_admin ON public.tareas
  FOR INSERT WITH CHECK (public.onboarding_es_admin(empresa_id));
CREATE POLICY tareas_update_admin ON public.tareas
  FOR UPDATE USING (public.onboarding_es_admin(empresa_id))
  WITH CHECK (public.onboarding_es_admin(empresa_id));
CREATE POLICY tareas_delete_admin ON public.tareas
  FOR DELETE USING (public.onboarding_es_admin(empresa_id));

ALTER TABLE public.cosechas ENABLE ROW LEVEL SECURITY;
CREATE POLICY cosechas_select_member ON public.cosechas
  FOR SELECT USING (public.onboarding_es_miembro(empresa_id));
CREATE POLICY cosechas_insert_admin ON public.cosechas
  FOR INSERT WITH CHECK (public.onboarding_es_admin(empresa_id));
CREATE POLICY cosechas_update_admin ON public.cosechas
  FOR UPDATE USING (public.onboarding_es_admin(empresa_id))
  WITH CHECK (public.onboarding_es_admin(empresa_id));
CREATE POLICY cosechas_delete_admin ON public.cosechas
  FOR DELETE USING (public.onboarding_es_admin(empresa_id));

ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
CREATE POLICY gastos_select_member ON public.gastos
  FOR SELECT USING (public.onboarding_es_miembro(empresa_id));
CREATE POLICY gastos_insert_admin ON public.gastos
  FOR INSERT WITH CHECK (public.onboarding_es_admin(empresa_id));
CREATE POLICY gastos_update_admin ON public.gastos
  FOR UPDATE USING (public.onboarding_es_admin(empresa_id))
  WITH CHECK (public.onboarding_es_admin(empresa_id));
CREATE POLICY gastos_delete_admin ON public.gastos
  FOR DELETE USING (public.onboarding_es_admin(empresa_id));

ALTER TABLE public.hallazgos ENABLE ROW LEVEL SECURITY;
CREATE POLICY hallazgos_select_member ON public.hallazgos
  FOR SELECT USING (public.onboarding_es_miembro(empresa_id));
CREATE POLICY hallazgos_insert_admin ON public.hallazgos
  FOR INSERT WITH CHECK (public.onboarding_es_admin(empresa_id));
CREATE POLICY hallazgos_update_admin ON public.hallazgos
  FOR UPDATE USING (public.onboarding_es_admin(empresa_id))
  WITH CHECK (public.onboarding_es_admin(empresa_id));
CREATE POLICY hallazgos_delete_admin ON public.hallazgos
  FOR DELETE USING (public.onboarding_es_admin(empresa_id));

-- ============================================
-- 5. Tablas de onboarding (reafirmar políticas restrictivas)
-- ============================================

ALTER TABLE public.cargos_laborales ENABLE ROW LEVEL SECURITY;
CREATE POLICY cargos_laborales_select_catalog ON public.cargos_laborales
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY cargos_laborales_no_insert ON public.cargos_laborales
  FOR INSERT WITH CHECK (false);
CREATE POLICY cargos_laborales_no_update ON public.cargos_laborales
  FOR UPDATE USING (false);
CREATE POLICY cargos_laborales_no_delete ON public.cargos_laborales
  FOR DELETE USING (false);

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
    public.onboarding_es_admin(empresa_id) AND creado_por = auth.uid()
  );
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
CREATE POLICY invitacion_canjes_insert_own ON public.invitacion_canjes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND usuario_id = auth.uid());
CREATE POLICY invitacion_canjes_update_own ON public.invitacion_canjes
  FOR UPDATE USING (usuario_id = auth.uid() OR usuario_id IS NULL)
  WITH CHECK (usuario_id = auth.uid());

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

-- ============================================
-- 6. Permisos EXECUTE para funciones helper de RLS
-- ============================================
GRANT EXECUTE ON FUNCTION public.onboarding_es_miembro(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.onboarding_es_admin(uuid) TO authenticated;

-- ============================================
-- 7. Revocar privilegios excesivos
-- ============================================
-- TRUNCATE es peligroso: permite vaciar tablas completas.
-- Revocamos de anon y authenticated. service_role y postgres mantienen sus privilegios.
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM authenticated;

-- anon no necesita escritura en tablas empresariales ni personales.
REVOKE INSERT ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE UPDATE ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE DELETE ON ALL TABLES IN SCHEMA public FROM anon;

-- authenticated mantiene DML directo; RLS controla el acceso.
-- No revocamos DML de authenticated para evitar romper el frontend.