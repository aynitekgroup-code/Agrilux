-- ============================================
-- AGRILUX ONBOARDING 2.5 - Migración 09
-- Índices de soporte para tablas de onboarding
-- ============================================

-- Índices para empresa_solicitudes
CREATE INDEX IF NOT EXISTS idx_empresa_solicitudes_estado_empresa
  ON empresa_solicitudes(empresa_id, estado);
CREATE INDEX IF NOT EXISTS idx_empresa_solicitudes_user_estado
  ON empresa_solicitudes(user_id, estado);

-- Índices para codigos_invitacion
CREATE INDEX IF NOT EXISTS idx_codigos_invitacion_empresa_estado
  ON codigos_invitacion(empresa_id, estado_reserva);
CREATE INDEX IF NOT EXISTS idx_codigos_invitacion_reserva_id
  ON codigos_invitacion(reserva_id) WHERE reserva_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_codigos_invitacion_revocado
  ON codigos_invitacion(revocado) WHERE revocado = false;
CREATE INDEX IF NOT EXISTS idx_codigos_invitacion_usos
  ON codigos_invitacion(usos_consumidos, usos_maximos);

-- Índices para invitacion_canjes
CREATE INDEX IF NOT EXISTS idx_invitacion_canjes_invitacion_estado
  ON invitacion_canjes(invitacion_id, estado_intento);
CREATE INDEX IF NOT EXISTS idx_invitacion_canjes_usuario_fecha
  ON invitacion_canjes(usuario_id, fecha_intento DESC);

-- Índices para empresa_plan
CREATE INDEX IF NOT EXISTS idx_empresa_plan_empresa_estado
  ON empresa_plan(empresa_id, estado);
CREATE INDEX IF NOT EXISTS idx_empresa_plan_vencimiento_estado
  ON empresa_plan(fecha_vencimiento, estado);

-- Índices para cargos_laborales (ya creados en migración 02, pero asegurar)
CREATE INDEX IF NOT EXISTS idx_cargos_laborales_nombre_activo
  ON cargos_laborales(nombre, activo);
