-- ============================================
-- AGRILUX ONBOARDING 2.6 - Migración 02
-- Creación de las 6 tablas de onboarding faltantes
-- Orden de dependencias respetado:
-- 1. cargos_laborales (sin dependencias)
-- 2. planes (sin dependencias)
-- 3. codigos_invitacion (depende de empresas, cargos_laborales, usuarios)
-- 4. empresa_solicitudes (depende de empresas, cargos_laborales, usuarios)
-- 5. invitacion_canjes (depende de codigos_invitacion, usuarios)
-- 6. empresa_plan (depende de empresas, planes)
-- Todas las sentencias usan IF NOT EXISTS para ser idempotentes.
-- ============================================

-- ============================================
-- 1. cargos_laborales
-- ============================================
CREATE TABLE IF NOT EXISTS cargos_laborales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cargos_laborales_nombre ON cargos_laborales(nombre);
CREATE INDEX IF NOT EXISTS idx_cargos_laborales_activo ON cargos_laborales(activo);

INSERT INTO cargos_laborales (nombre, descripcion) VALUES
  ('Gerente', 'Responsable general de la empresa y toma de decisiones estratégicas'),
  ('Ingeniero agrónomo', 'Responsable técnico de cultivos y parcelas'),
  ('Supervisor de campo', 'Supervisión de operaciones en terreno'),
  ('Supervisor de flota', 'Supervisión de vehículos, conductores y telemetría'),
  ('Operador', 'Ejecución de tareas operativas en campo'),
  ('Conductor', 'Conducción de vehículos y transporte de insumos'),
  ('Técnico de mantenimiento', 'Mantenimiento de equipos y maquinaria')
ON CONFLICT (nombre) DO NOTHING;

-- ============================================
-- 2. planes
-- ============================================
CREATE TABLE IF NOT EXISTS planes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL UNIQUE,
  modulos_habilitados JSONB NOT NULL DEFAULT '[]'::jsonb,
  limite_usuarios INTEGER NOT NULL DEFAULT 5,
  precio NUMERIC,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planes_nombre ON planes(nombre);
CREATE INDEX IF NOT EXISTS idx_planes_activo ON planes(activo);

INSERT INTO planes (nombre, modulos_habilitados, limite_usuarios, precio, activo) VALUES
  ('Gratuito', '["diagnostico", "parcelas_basicas"]'::jsonb, 5, 0, true)
ON CONFLICT (nombre) DO NOTHING;

-- ============================================
-- 3. codigos_invitacion
-- Depende de: empresas, cargos_laborales, usuarios
-- ============================================
CREATE TABLE IF NOT EXISTS codigos_invitacion (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  email_destino TEXT,
  rol_asignado TEXT NOT NULL
    CHECK (rol_asignado IN ('administrador', 'ingeniero', 'supervisor', 'operario')),
  cargo_id UUID REFERENCES cargos_laborales(id),
  estado_reserva TEXT NOT NULL DEFAULT 'disponible'
    CHECK (estado_reserva IN ('disponible', 'reservada', 'agotada')),
  reserva_id UUID,
  reservado_por UUID,
  reservado_en TIMESTAMPTZ,
  reserva_expira_en TIMESTAMPTZ,
  expira_en TIMESTAMPTZ NOT NULL,
  usos_maximos INTEGER NOT NULL DEFAULT 1,
  usos_consumidos INTEGER NOT NULL DEFAULT 0,
  revocado BOOLEAN NOT NULL DEFAULT FALSE,
  creado_por TEXT NOT NULL REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.codigos_invitacion'::regclass
      AND conname = 'codigos_invitacion_reserva_consistencia'
  ) THEN
    ALTER TABLE public.codigos_invitacion
      ADD CONSTRAINT codigos_invitacion_reserva_consistencia
      CHECK (
        (estado_reserva <> 'reservada')
        OR (reservado_en IS NOT NULL AND reserva_expira_en IS NOT NULL)
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.codigos_invitacion'::regclass
      AND conname = 'codigos_invitacion_usos_validos'
  ) THEN
    ALTER TABLE public.codigos_invitacion
      ADD CONSTRAINT codigos_invitacion_usos_validos
      CHECK (usos_consumidos <= usos_maximos);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.codigos_invitacion'::regclass
      AND conname = 'codigos_invitacion_agotada_consistencia'
  ) THEN
    ALTER TABLE public.codigos_invitacion
      ADD CONSTRAINT codigos_invitacion_agotada_consistencia
      CHECK (
        (estado_reserva <> 'agotada')
        OR (usos_consumidos >= usos_maximos)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_codigos_invitacion_empresa ON codigos_invitacion(empresa_id);
CREATE INDEX IF NOT EXISTS idx_codigos_invitacion_token ON codigos_invitacion(token_hash);
CREATE INDEX IF NOT EXISTS idx_codigos_invitacion_estado ON codigos_invitacion(estado_reserva);
CREATE INDEX IF NOT EXISTS idx_codigos_invitacion_reserva ON codigos_invitacion(reserva_id) WHERE reserva_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_codigos_invitacion_expira ON codigos_invitacion(expira_en);

-- ============================================
-- 4. empresa_solicitudes
-- Depende de: empresas, cargos_laborales, usuarios
-- ============================================
CREATE TABLE IF NOT EXISTS empresa_solicitudes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  nombre TEXT NOT NULL,
  cargo_id UUID REFERENCES cargos_laborales(id),
  area_trabajo TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revisado_en TIMESTAMPTZ,
  revisado_por TEXT REFERENCES usuarios(id),
  CONSTRAINT empresa_solicitudes_user_id_uuid_check
    CHECK (user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
);

CREATE INDEX IF NOT EXISTS idx_empresa_solicitudes_empresa ON empresa_solicitudes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_empresa_solicitudes_user ON empresa_solicitudes(user_id);
CREATE INDEX IF NOT EXISTS idx_empresa_solicitudes_estado ON empresa_solicitudes(estado);
CREATE INDEX IF NOT EXISTS idx_empresa_solicitudes_estado_empresa ON empresa_solicitudes(empresa_id, estado);

CREATE UNIQUE INDEX IF NOT EXISTS idx_empresa_solicitudes_pendiente_unique
  ON empresa_solicitudes(empresa_id, user_id)
  WHERE estado = 'pendiente';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.empresa_solicitudes'::regclass
      AND conname = 'empresa_solicitudes_user_id_uuid_check'
  ) THEN
    ALTER TABLE public.empresa_solicitudes
      ADD CONSTRAINT empresa_solicitudes_user_id_uuid_check
      CHECK (user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$');
  END IF;
END $$;

-- ============================================
-- 5. invitacion_canjes
-- Depende de: codigos_invitacion, usuarios
-- ============================================
CREATE TABLE IF NOT EXISTS invitacion_canjes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invitacion_id UUID NOT NULL REFERENCES codigos_invitacion(id) ON DELETE CASCADE,
  reserva_id UUID,
  usuario_id TEXT REFERENCES usuarios(id),
  email_usado TEXT NOT NULL,
  fecha_intento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  estado_intento TEXT NOT NULL
    CHECK (estado_intento IN ('pendiente', 'exitoso', 'fallido', 'abandonado', 'expirado')),
  motivo_fallo TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invitacion_canjes_pendiente
  ON invitacion_canjes(invitacion_id)
  WHERE estado_intento = 'pendiente';

CREATE INDEX IF NOT EXISTS idx_invitacion_canjes_invitacion ON invitacion_canjes(invitacion_id);
CREATE INDEX IF NOT EXISTS idx_invitacion_canjes_usuario ON invitacion_canjes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_invitacion_canjes_estado ON invitacion_canjes(estado_intento);
CREATE INDEX IF NOT EXISTS idx_invitacion_canjes_fecha ON invitacion_canjes(fecha_intento);

-- ============================================
-- 6. empresa_plan
-- Depende de: empresas, planes
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_empresa_plan_activa_unique
  ON empresa_plan(empresa_id)
  WHERE estado = 'activa';

CREATE INDEX IF NOT EXISTS idx_empresa_plan_empresa ON empresa_plan(empresa_id);
CREATE INDEX IF NOT EXISTS idx_empresa_plan_estado ON empresa_plan(estado);
CREATE INDEX IF NOT EXISTS idx_empresa_plan_vencimiento ON empresa_plan(fecha_vencimiento);