-- ============================================
-- AGRILUX ONBOARDING 2.5 - Migración 07
-- Tabla empresa_plan (historial de suscripciones por empresa)
-- Una sola suscripción activa por empresa
-- ============================================

CREATE TABLE IF NOT EXISTS empresa_plan (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES planes(id),
  estado TEXT NOT NULL DEFAULT 'pendiente_pago'
    CHECK (estado IN ('activa', 'vencida', 'cancelada', 'pendiente_pago')),
  fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_vencimiento TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Una sola suscripción activa por empresa
CREATE UNIQUE INDEX IF NOT EXISTS idx_empresa_plan_activa_unique
  ON empresa_plan(empresa_id)
  WHERE estado = 'activa';

-- Índices de soporte
CREATE INDEX IF NOT EXISTS idx_empresa_plan_empresa ON empresa_plan(empresa_id);
CREATE INDEX IF NOT EXISTS idx_empresa_plan_estado ON empresa_plan(estado);
CREATE INDEX IF NOT EXISTS idx_empresa_plan_vencimiento ON empresa_plan(fecha_vencimiento);
