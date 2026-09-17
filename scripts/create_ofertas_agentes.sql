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

CREATE INDEX IF NOT EXISTS idx_ofertas_agentes_producto ON ofertas_agentes(producto);
CREATE INDEX IF NOT EXISTS idx_ofertas_agentes_fuente ON ofertas_agentes(fuente);
CREATE INDEX IF NOT EXISTS idx_ofertas_agentes_created ON ofertas_agentes(created_at DESC);

ALTER TABLE ofertas_agentes ENABLE ROW LEVEL SECURITY;

-- Lectura pública
CREATE POLICY "Ofertas agentes son publicas"
  ON ofertas_agentes FOR SELECT USING (true);

-- Insertar desde el cliente (anon)
CREATE POLICY "Anyone can insert ofertas"
  ON ofertas_agentes FOR INSERT
  WITH CHECK (true);

-- Limpiar automáticamente cada 7 días
CREATE OR REPLACE FUNCTION limpiar_ofertas_antiguas()
RETURNS trigger AS $$
BEGIN
  DELETE FROM ofertas_agentes WHERE created_at < NOW() - INTERVAL '7 days';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ejecutar limpieza al insertar (trigger cada 100 inserts)
CREATE OR REPLACE TRIGGER trigger_limpiar_ofertas
  AFTER INSERT ON ofertas_agentes
  FOR EACH STATEMENT
  EXECUTE FUNCTION limpiar_ofertas_antiguas();
