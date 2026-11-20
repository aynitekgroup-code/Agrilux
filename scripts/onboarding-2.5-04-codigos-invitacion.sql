-- ============================================
-- AGRILUX ONBOARDING 2.5 - Migración 04
-- Tabla codigos_invitacion (invitaciones seguras a empresa)
-- Tokens almacenados como hash SHA-256 (nunca texto plano)
-- Estados de reserva: disponible, reservada, agotada
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
  reserva_id UUID,  -- Identificador único de la reserva activa (sin FK obligatoria)
  reservado_por UUID,  -- Usuario que tiene la reserva activa (opcional, puede ser NULL antes de registro)
  reservado_en TIMESTAMPTZ,
  reserva_expira_en TIMESTAMPTZ,
  expira_en TIMESTAMPTZ NOT NULL,  -- Expiración absoluta de la invitación
  usos_maximos INTEGER NOT NULL DEFAULT 1,
  usos_consumidos INTEGER NOT NULL DEFAULT 0,
  revocado BOOLEAN NOT NULL DEFAULT FALSE,
  creado_por UUID NOT NULL REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Restricciones de consistencia
-- Una reserva activa debe tener reservado_en y reserva_expira_en definidos
ALTER TABLE codigos_invitacion
ADD CONSTRAINT codigos_invitacion_reserva_consistencia
CHECK (
  (estado_reserva <> 'reservada')
  OR (reservado_en IS NOT NULL AND reserva_expira_en IS NOT NULL)
);

-- Usos consumidos no pueden exceder máximos
ALTER TABLE codigos_invitacion
ADD CONSTRAINT codigos_invitacion_usos_validos
CHECK (usos_consumidos <= usos_maximos);

-- Una invitación agotada no puede tener usos pendientes
ALTER TABLE codigos_invitacion
ADD CONSTRAINT codigos_invitacion_agotada_consistencia
CHECK (
  (estado_reserva <> 'agotada')
  OR (usos_consumidos >= usos_maximos)
);

-- Índices de soporte
CREATE INDEX IF NOT EXISTS idx_codigos_invitacion_empresa ON codigos_invitacion(empresa_id);
CREATE INDEX IF NOT EXISTS idx_codigos_invitacion_token ON codigos_invitacion(token_hash);
CREATE INDEX IF NOT EXISTS idx_codigos_invitacion_estado ON codigos_invitacion(estado_reserva);
CREATE INDEX IF NOT EXISTS idx_codigos_invitacion_reserva ON codigos_invitacion(reserva_id) WHERE reserva_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_codigos_invitacion_expira ON codigos_invitacion(expira_en);
