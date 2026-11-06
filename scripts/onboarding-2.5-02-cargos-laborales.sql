-- ============================================
-- AGRILUX ONBOARDING 2.5 - Migración 02
-- Tabla cargos_laborales (catálogo de cargos, metadata ONLY)
-- Los cargos NO otorgan permisos automáticamente
-- ============================================

CREATE TABLE IF NOT EXISTS cargos_laborales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice de búsqueda por nombre
CREATE INDEX IF NOT EXISTS idx_cargos_laborales_nombre ON cargos_laborales(nombre);
CREATE INDEX IF NOT EXISTS idx_cargos_laborales_activo ON cargos_laborales(activo);

-- Cargos predeterminados (insertar solo si no existen)
INSERT INTO cargos_laborales (nombre, descripcion) VALUES
  ('Gerente', 'Responsable general de la empresa y toma de decisiones estratégicas'),
  ('Ingeniero agrónomo', 'Responsable técnico de cultivos y parcelas'),
  ('Supervisor de campo', 'Supervisión de operaciones en terreno'),
  ('Supervisor de flota', 'Supervisión de vehículos, conductores y telemetría'),
  ('Operador', 'Ejecución de tareas operativas en campo'),
  ('Conductor', 'Conducción de vehículos y transporte de insumos'),
  ('Técnico de mantenimiento', 'Mantenimiento de equipos y maquinaria')
ON CONFLICT (nombre) DO NOTHING;
