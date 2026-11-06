-- ============================================
-- AGRILUX ONBOARDING 2.5 - Migración 05
-- Tabla invitacion_canjes (historial de canjes de invitaciones)
-- Estados: pendiente, exitoso, fallido, abandonado, expirado
-- ============================================

CREATE TABLE IF NOT EXISTS invitacion_canjes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invitacion_id UUID NOT NULL REFERENCES codigos_invitacion(id) ON DELETE CASCADE,
  reserva_id UUID,  -- Identificador de la reserva que originó el intento (sin FK obligatoria)
  usuario_id UUID REFERENCES usuarios(id),  -- Solo si estado_intento = 'exitoso'
  email_usado TEXT NOT NULL,
  fecha_intento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  estado_intento TEXT NOT NULL
    CHECK (estado_intento IN ('pendiente', 'exitoso', 'fallido', 'abandonado', 'expirado')),
  motivo_fallo TEXT
);

-- Un intento pendiente por invitación (evitar duplicados indefinidos)
CREATE UNIQUE INDEX IF NOT EXISTS idx_invitacion_canjes_pendiente
  ON invitacion_canjes(invitacion_id)
  WHERE estado_intento = 'pendiente';

-- Índices de soporte
CREATE INDEX IF NOT EXISTS idx_invitacion_canjes_invitacion ON invitacion_canjes(invitacion_id);
CREATE INDEX IF NOT EXISTS idx_invitacion_canjes_usuario ON invitacion_canjes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_invitacion_canjes_estado ON invitacion_canjes(estado_intento);
CREATE INDEX IF NOT EXISTS idx_invitacion_canjes_fecha ON invitacion_canjes(fecha_intento);
