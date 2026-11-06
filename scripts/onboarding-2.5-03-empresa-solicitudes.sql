-- ============================================
-- AGRILUX ONBOARDING 2.5 - Migración 03
-- Tabla empresa_solicitudes (solicitudes de incorporación a empresa)
-- Estados: pendiente, aprobado, rechazado
-- ============================================

CREATE TABLE IF NOT EXISTS empresa_solicitudes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,  -- Mantener TEXT para compatibilidad con usuarios.id UUID (cast implícito)
  email TEXT NOT NULL,
  nombre TEXT NOT NULL,
  cargo_id UUID REFERENCES cargos_laborales(id),
  area_trabajo TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revisado_en TIMESTAMPTZ,
  revisado_por UUID REFERENCES usuarios(id),
  CONSTRAINT empresa_solicitudes_user_id_uuid_check
    CHECK (user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
);

-- Índices de soporte
CREATE INDEX IF NOT EXISTS idx_empresa_solicitudes_empresa ON empresa_solicitudes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_empresa_solicitudes_user ON empresa_solicitudes(user_id);
CREATE INDEX IF NOT EXISTS idx_empresa_solicitudes_estado ON empresa_solicitudes(estado);
CREATE INDEX IF NOT EXISTS idx_empresa_solicitudes_estado_empresa ON empresa_solicitudes(empresa_id, estado);

-- Una solicitud pendiente por usuario y empresa (evitar duplicados pendientes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_empresa_solicitudes_pendiente_unique
  ON empresa_solicitudes(empresa_id, user_id)
  WHERE estado = 'pendiente';
