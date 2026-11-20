-- ============================================
-- AGRILUX ONBOARDING 2.5 - Migración 06
-- Tabla planes (catálogo de planes de suscripción)
-- No implementar pasarela de pagos en esta fase
-- ============================================

CREATE TABLE IF NOT EXISTS planes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  modulos_habilitados JSONB NOT NULL DEFAULT '[]'::jsonb,
  limite_usuarios INTEGER NOT NULL DEFAULT 5,
  precio NUMERIC,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice de búsqueda
CREATE INDEX IF NOT EXISTS idx_planes_nombre ON planes(nombre);
CREATE INDEX IF NOT EXISTS idx_planes_activo ON planes(activo);

-- Plan gratuito predeterminado (insertar solo si no existe)
INSERT INTO planes (nombre, modulos_habilitados, limite_usuarios, precio, activo) VALUES
  ('Gratuito', '["diagnostico", "parcelas_basicas"]'::jsonb, 5, 0, true)
ON CONFLICT (nombre) DO NOTHING;
