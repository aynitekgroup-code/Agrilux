-- ============================================
-- AGRILUX EMPRESAS - Seccion Parcela empresarial
-- Pegar en Supabase: Dashboard -> SQL Editor -> New query
-- Tablas: empresas, miembros, fundos, campanas, lotes,
--         labores, tareas, cosechas, gastos, hallazgos
-- Convenciones: mismas que supabase-schema.sql
-- (uuid_generate_v4, RLS + politicas permisivas)
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. EMPRESAS
-- ============================================
CREATE TABLE IF NOT EXISTS empresas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  ruc TEXT,
  telefono TEXT,
  ubicacion TEXT,
  campana_activa TEXT NOT NULL DEFAULT '2026-A',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. MIEMBROS (roles por empresa)
-- ============================================
CREATE TABLE IF NOT EXISTS empresa_miembros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  user_id TEXT,
  nombre TEXT NOT NULL,
  email TEXT,
  rol TEXT NOT NULL DEFAULT 'operario'
    CHECK (rol IN ('administrador', 'ingeniero', 'supervisor', 'operario')),
  fundo_id UUID,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. FUNDOS
-- ============================================
CREATE TABLE IF NOT EXISTS fundos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  ubicacion TEXT,
  hectareas NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. CAMPANAS
-- ============================================
CREATE TABLE IF NOT EXISTS campanas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  fecha_inicio DATE,
  fecha_fin DATE,
  activa BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. LOTES
-- ============================================
CREATE TABLE IF NOT EXISTS lotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  fundo_id UUID REFERENCES fundos(id) ON DELETE SET NULL,
  parcela_id TEXT,
  nombre TEXT NOT NULL,
  cultivo TEXT,
  variedad TEXT,
  area_ha NUMERIC DEFAULT 0,
  fecha_siembra DATE,
  etapa TEXT,
  riesgo TEXT NOT NULL DEFAULT 'bajo'
    CHECK (riesgo IN ('bajo', 'moderado', 'alto', 'critico')),
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  gps TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. LABORES (bitacora: siembra, riego, abonado, fumigacion)
-- ============================================
CREATE TABLE IF NOT EXISTS labores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  lote_id UUID NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  producto TEXT,
  dosis TEXT,
  responsable TEXT,
  responsable_nombre TEXT,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  carencia_hasta DATE,
  costo NUMERIC DEFAULT 0,
  observaciones TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. TAREAS DEL EQUIPO
-- ============================================
CREATE TABLE IF NOT EXISTS tareas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  lote_id UUID REFERENCES lotes(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  asignado_a TEXT,
  asignado_nombre TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'en_curso', 'hecha', 'atrasada')),
  vence DATE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. COSECHAS
-- ============================================
CREATE TABLE IF NOT EXISTS cosechas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  lote_id UUID NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
  campana TEXT NOT NULL DEFAULT '2026-A',
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  sacos NUMERIC NOT NULL DEFAULT 0,
  area_ha NUMERIC DEFAULT 0,
  precio_unit NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. GASTOS (insumos, mano de obra, riego, maquinaria, otros)
-- ============================================
CREATE TABLE IF NOT EXISTS gastos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  lote_id UUID REFERENCES lotes(id) ON DELETE SET NULL,
  campana TEXT NOT NULL DEFAULT '2026-A',
  categoria TEXT NOT NULL DEFAULT 'insumos'
    CHECK (categoria IN ('insumos', 'mano_obra', 'riego', 'maquinaria', 'otros')),
  concepto TEXT NOT NULL,
  monto NUMERIC NOT NULL DEFAULT 0,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. HALLAZGOS (puntos marcados en el mapa del lote)
-- ============================================
CREATE TABLE IF NOT EXISTS hallazgos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  lote_id UUID NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'plaga',
  descripcion TEXT,
  foto_url TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDICES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_empresa_miembros_empresa ON empresa_miembros(empresa_id);
CREATE INDEX IF NOT EXISTS idx_fundos_empresa ON fundos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_campanas_empresa ON campanas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_lotes_empresa ON lotes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_lotes_fundo ON lotes(fundo_id);
CREATE INDEX IF NOT EXISTS idx_labores_empresa ON labores(empresa_id);
CREATE INDEX IF NOT EXISTS idx_labores_lote ON labores(lote_id);
CREATE INDEX IF NOT EXISTS idx_labores_fecha ON labores(fecha);
CREATE INDEX IF NOT EXISTS idx_tareas_empresa ON tareas(estado, empresa_id);
CREATE INDEX IF NOT EXISTS idx_tareas_vence ON tareas(vence);
CREATE INDEX IF NOT EXISTS idx_cosechas_empresa ON cosechas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cosechas_lote ON cosechas(lote_id);
CREATE INDEX IF NOT EXISTS idx_gastos_empresa ON gastos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_gastos_campana ON gastos(campana);
CREATE INDEX IF NOT EXISTS idx_hallazgos_lote ON hallazgos(lote_id);

-- ============================================
-- RLS + POLITICAS (igual que el resto de Agrilux)
-- ============================================
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresa_miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE fundos ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanas ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE labores ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cosechas ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE hallazgos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'empresas') THEN
    CREATE POLICY "Allow all authenticated" ON empresas FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'empresa_miembros') THEN
    CREATE POLICY "Allow all authenticated" ON empresa_miembros FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fundos') THEN
    CREATE POLICY "Allow all authenticated" ON fundos FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'campanas') THEN
    CREATE POLICY "Allow all authenticated" ON campanas FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lotes') THEN
    CREATE POLICY "Allow all authenticated" ON lotes FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'labores') THEN
    CREATE POLICY "Allow all authenticated" ON labores FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tareas') THEN
    CREATE POLICY "Allow all authenticated" ON tareas FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cosechas') THEN
    CREATE POLICY "Allow all authenticated" ON cosechas FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gastos') THEN
    CREATE POLICY "Allow all authenticated" ON gastos FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hallazgos') THEN
    CREATE POLICY "Allow all authenticated" ON hallazgos FOR ALL USING (true);
  END IF;
END $$;
