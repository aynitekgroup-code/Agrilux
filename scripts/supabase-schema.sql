-- ============================================
-- AGRILUX - Schema para Supabase
-- Migración desde Firebase Firestore
-- ============================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. USUARIOS
-- ============================================
CREATE TABLE usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  ubicacion TEXT,
  whatsapp TEXT,
  coords JSONB,
  rol TEXT NOT NULL DEFAULT 'agricultor' CHECK (rol IN ('agricultor', 'admin')),
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('aprobado', 'pendiente')),
  creado_por TEXT DEFAULT 'self',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  email_sintetico TEXT,
  celular TEXT,
  password_default TEXT
);

-- ============================================
-- 2. DIAGNOSTICOS
-- ============================================
CREATE TABLE diagnosticos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  user_name TEXT,
  user_email TEXT,
  cultivo TEXT NOT NULL,
  cultivo_nombre TEXT,
  con_foto BOOLEAN DEFAULT FALSE,
  consulta_texto TEXT,
  clima_contexto JSONB,
  resultado JSONB,
  confirmado_por_usuario BOOLEAN,
  fecha TEXT NOT NULL,
  mes INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. PARCELAS
-- ============================================
CREATE TABLE parcelas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  user_name TEXT,
  nombre TEXT NOT NULL,
  cultivo TEXT,
  cultivo_nombre TEXT,
  cultivo_emoji TEXT,
  variedad TEXT,
  area TEXT,
  fecha_siembra TEXT,
  gps TEXT,
  coordenadas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. REGISTROS PARCELA
-- ============================================
CREATE TABLE registros_parcela (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parcela_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  foto TEXT,
  recomendacion TEXT,
  dias_desde_siembra INTEGER,
  fecha TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. HISTORIAL CLINICO
-- ============================================
CREATE TABLE historial_clinico (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  parcela_id TEXT,
  parcela_nombre TEXT,
  cultivo TEXT,
  variedad TEXT,
  tiene_problema BOOLEAN DEFAULT FALSE,
  problema TEXT,
  problema_cientifico TEXT,
  gravedad TEXT,
  severidad INTEGER,
  causa TEXT,
  recomendacion TEXT,
  producto_aplicado TEXT,
  fecha_aplicacion TIMESTAMPTZ,
  resultado TEXT CHECK (resultado IN ('mejoro', 'empeoro', 'sin_cambio', 'resuelto', NULL)),
  fecha_resultado TIMESTAMPTZ,
  observaciones_resultado TEXT,
  calificacion INTEGER CHECK (calificacion BETWEEN 1 AND 5),
  util BOOLEAN,
  comentario_feedback TEXT,
  clima JSONB,
  suelo JSONB,
  fuente TEXT DEFAULT 'diagnostico' CHECK (fuente IN ('diagnostico', 'monitoreo', 'voz')),
  foto_url TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. TIENDAS COMUNIDAD
-- ============================================
CREATE TABLE tiendas_comunidad (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  direccion TEXT,
  distrito TEXT,
  departamento TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  whatsapp TEXT,
  whatsapp_formateado TEXT,
  facebook TEXT,
  instagram TEXT,
  web TEXT,
  especialidades JSONB,
  horario TEXT,
  descripcion TEXT,
  fotos JSONB,
  propietario_id TEXT,
  propietario_nombre TEXT,
  propietario_email TEXT,
  fuente TEXT DEFAULT 'comunidad',
  verificada BOOLEAN DEFAULT FALSE,
  activa BOOLEAN DEFAULT TRUE,
  ventas INTEGER DEFAULT 0,
  precios_actuales JSONB,
  ultima_actualizacion TEXT,
  ultima_consulta TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  eliminada_at TEXT,
  eliminada_por TEXT
);

-- ============================================
-- 7. PRECIOS HISTORICOS
-- ============================================
CREATE TABLE precios_historicos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tienda_id TEXT NOT NULL,
  tienda_nombre TEXT,
  producto TEXT NOT NULL,
  producto_nombre TEXT,
  precio DOUBLE PRECISION NOT NULL,
  unidad TEXT,
  notas TEXT,
  fuente TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  departamento TEXT,
  fecha TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. TIENDAS (Admin)
-- ============================================
CREATE TABLE tiendas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  direccion TEXT,
  region TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  whatsapp TEXT,
  facebook TEXT,
  instagram TEXT,
  web TEXT,
  productos TEXT,
  horario TEXT,
  notas TEXT,
  creado_por TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. ALIADOS
-- ============================================
CREATE TABLE aliados (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  whatsapp TEXT,
  facebook TEXT,
  instagram TEXT,
  tiktok TEXT,
  web TEXT,
  ubicacion TEXT,
  empresa TEXT,
  notas TEXT,
  tipo TEXT DEFAULT 'agricultor' CHECK (tipo IN ('agricultor', 'aliado', 'distribuidor', 'otro')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. COMUNIDAD
-- ============================================
CREATE TABLE comunidad (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  categoria TEXT NOT NULL CHECK (categoria IN ('plagas', 'enfermedades', 'consejos', 'general')),
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL,
  ubicacion TEXT,
  autor TEXT,
  autor_id TEXT,
  fecha TEXT NOT NULL,
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 11. CONTACTOS MARKETING
-- ============================================
CREATE TABLE contactos_marketing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  ubicacion TEXT,
  cultivo TEXT,
  plataforma TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 12. CONVERSACIONES VOZ
-- ============================================
CREATE TABLE conversaciones_voz (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  mensajes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ÍNDICES para performance
-- ============================================
CREATE INDEX idx_diagnosticos_user ON diagnosticos(user_id);
CREATE INDEX idx_diagnosticos_fecha ON diagnosticos(fecha);
CREATE INDEX idx_parcelas_user ON parcelas(user_id);
CREATE INDEX idx_registros_parcela_parcela ON registros_parcela(parcela_id);
CREATE INDEX idx_registros_parcela_user ON registros_parcela(user_id);
CREATE INDEX idx_historial_user ON historial_clinico(user_id);
CREATE INDEX idx_historial_parcela ON historial_clinico(parcela_id);
CREATE INDEX idx_tiendas_comunidad_activa ON tiendas_comunidad(activa);
CREATE INDEX idx_tiendas_comunidad_dpto ON tiendas_comunidad(departamento);
CREATE INDEX idx_precios_historicos_tienda ON precios_historicos(tienda_id);
CREATE INDEX idx_precios_historicos_producto ON precios_historicos(producto);
CREATE INDEX idx_precios_historicos_fecha ON precios_historicos(fecha);
CREATE INDEX idx_comunidad_categoria ON comunidad(categoria);
CREATE INDEX idx_comunidad_fecha ON comunidad(fecha);
CREATE INDEX idx_contactos_marketing_user ON contactos_marketing(created_at);
CREATE INDEX idx_conversaciones_voz_user ON conversaciones_voz(user_id);

-- ============================================
-- RLS (Row Level Security) - básico
-- ============================================
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnosticos ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_parcela ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_clinico ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiendas_comunidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE precios_historicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE aliados ENABLE ROW LEVEL SECURITY;
ALTER TABLE comunidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE contactos_marketing ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversaciones_voz ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas (migrar gradualmente a más restrictivas)
CREATE POLICY "Allow all authenticated" ON usuarios FOR ALL USING (true);
CREATE POLICY "Allow all authenticated" ON diagnosticos FOR ALL USING (true);
CREATE POLICY "Allow all authenticated" ON parcelas FOR ALL USING (true);
CREATE POLICY "Allow all authenticated" ON registros_parcela FOR ALL USING (true);
CREATE POLICY "Allow all authenticated" ON historial_clinico FOR ALL USING (true);
CREATE POLICY "Allow all authenticated" ON tiendas_comunidad FOR ALL USING (true);
CREATE POLICY "Allow all authenticated" ON precios_historicos FOR ALL USING (true);
CREATE POLICY "Allow all authenticated" ON tiendas FOR ALL USING (true);
CREATE POLICY "Allow all authenticated" ON aliados FOR ALL USING (true);
CREATE POLICY "Allow all authenticated" ON comunidad FOR ALL USING (true);
CREATE POLICY "Allow all authenticated" ON contactos_marketing FOR ALL USING (true);
CREATE POLICY "Allow all authenticated" ON conversaciones_voz FOR ALL USING (true);

-- ============================================
-- Storage bucket para fotos de tiendas
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('tiendas', 'tiendas', true);

CREATE POLICY "Allow public access" ON storage.objects FOR SELECT USING (bucket_id = 'tiendas');
CREATE POLICY "Allow authenticated uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'tiendas');
CREATE POLICY "Allow delete own" ON storage.objects FOR DELETE USING (bucket_id = 'tiendas');
