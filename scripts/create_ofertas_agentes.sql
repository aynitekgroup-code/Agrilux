-- =============================================
-- Tabla para ofertas detectadas por agentes
-- =============================================

CREATE TABLE IF NOT EXISTS ofertas_agentes (
  id SERIAL PRIMARY KEY,
  producto TEXT NOT NULL,
  precio NUMERIC,
  tienda TEXT,
  fuente TEXT,
  url TEXT,
  ubicacion TEXT,
  tipo TEXT DEFAULT 'precio_agricola',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_ofertas_agentes_producto ON ofertas_agentes(producto);
CREATE INDEX IF NOT EXISTS idx_ofertas_agentes_fuente ON ofertas_agentes(fuente);
CREATE INDEX IF NOT EXISTS idx_ofertas_agentes_created ON ofertas_agentes(created_at DESC);

-- Limpiar ofertas antiguas (más de 7 días)
CREATE OR REPLACE FUNCTION limpiar_ofertas_antiguas()
RETURNS void AS $$
BEGIN
  DELETE FROM ofertas_agentes
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Habilitar RLS
ALTER TABLE ofertas_agentes ENABLE ROW LEVEL SECURITY;

-- Política para lectura pública
CREATE POLICY "Ofertas agentes son públicas"
  ON ofertas_agentes FOR SELECT
  USING (true);

-- Política para inserts (solo service role)
CREATE POLICY "Solo service role puede insertar ofertas"
  ON ofertas_agentes FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
