-- ============================================
-- FIX: Recreate all tables with TEXT ids (no FK to auth.users)
-- Then run supabase-import.sql (original snake_case)
-- Then rename columns via Table Editor
-- ============================================

DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS diagnosticos CASCADE;
DROP TABLE IF EXISTS parcelas CASCADE;
DROP TABLE IF EXISTS registros_parcela CASCADE;
DROP TABLE IF EXISTS historial_clinico CASCADE;
DROP TABLE IF EXISTS tiendas_comunidad CASCADE;
DROP TABLE IF EXISTS precios_historicos CASCADE;
DROP TABLE IF EXISTS tiendas CASCADE;
DROP TABLE IF EXISTS aliados CASCADE;
DROP TABLE IF EXISTS comunidad CASCADE;
DROP TABLE IF EXISTS contactos_marketing CASCADE;
DROP TABLE IF EXISTS conversaciones_voz CASCADE;

CREATE TABLE usuarios (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  ubicacion TEXT,
  whatsapp TEXT,
  coords JSONB,
  rol TEXT NOT NULL DEFAULT 'agricultor',
  status TEXT NOT NULL DEFAULT 'pendiente',
  creado_por TEXT DEFAULT 'self',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  email_sintetico TEXT,
  celular TEXT,
  password_default TEXT
);

CREATE TABLE diagnosticos (
  id TEXT PRIMARY KEY,
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

CREATE TABLE parcelas (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT,
  nombre TEXT NOT NULL,
  cultivo TEXT,
  cultivo_nombre TEXT,
  cultivo_emoji TEXT,
  variedad TEXT,
  area TEXT,
  fecha_siembra TEXT,
  notas TEXT,
  foto_url TEXT,
  activa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE registros_parcela (
  id TEXT PRIMARY KEY,
  parcela_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  fecha TEXT NOT NULL,
  tipo TEXT,
  descripcion TEXT,
  foto_url TEXT,
  dias_desde_siembra INTEGER,
  temperatura DOUBLE PRECISION,
  humedad DOUBLE PRECISION,
  lluvia DOUBLE PRECISION,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE historial_clinico (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  parcela_id TEXT,
  parcela_nombre TEXT,
  cultivo TEXT,
  tiene_problema BOOLEAN DEFAULT FALSE,
  problema_cientifico TEXT,
  producto_aplicado TEXT,
  fecha_aplicacion TEXT,
  resultado TEXT,
  fecha_resultado TIMESTAMPTZ,
  observaciones_resultado TEXT,
  calificacion INTEGER,
  util BOOLEAN,
  comentario_feedback TEXT,
  clima JSONB,
  suelo JSONB,
  fuente TEXT DEFAULT 'diagnostico',
  foto_url TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tiendas_comunidad (
  id TEXT PRIMARY KEY,
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

CREATE TABLE precios_historicos (
  id TEXT PRIMARY KEY,
  tienda_id TEXT,
  tienda_nombre TEXT,
  producto_nombre TEXT,
  precio DOUBLE PRECISION,
  unidad TEXT,
  fecha TEXT,
  fuente TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tiendas (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  direccion TEXT,
  telefono TEXT,
  whatsapp TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  activa BOOLEAN DEFAULT TRUE,
  creado_por TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ
);

CREATE TABLE aliados (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo TEXT,
  direccion TEXT,
  telefono TEXT,
  email TEXT,
  whatsapp TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  activo BOOLEAN DEFAULT TRUE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE comunidad (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  contenido TEXT,
  tipo TEXT DEFAULT 'publicacion',
  autor_id TEXT,
  autor_nombre TEXT,
  likes INTEGER DEFAULT 0,
  comentarios INTEGER DEFAULT 0,
  fotos JSONB,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE contactos_marketing (
  id TEXT PRIMARY KEY,
  nombre TEXT,
  email TEXT,
  telefono TEXT,
  whatsapp TEXT,
  fuente TEXT,
  intereses JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE conversaciones_voz (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  mensaje TEXT,
  respuesta TEXT,
  duracion INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
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

CREATE POLICY "Allow all" ON usuarios FOR ALL USING (true);
CREATE POLICY "Allow all" ON diagnosticos FOR ALL USING (true);
CREATE POLICY "Allow all" ON parcelas FOR ALL USING (true);
CREATE POLICY "Allow all" ON registros_parcela FOR ALL USING (true);
CREATE POLICY "Allow all" ON historial_clinico FOR ALL USING (true);
CREATE POLICY "Allow all" ON tiendas_comunidad FOR ALL USING (true);
CREATE POLICY "Allow all" ON precios_historicos FOR ALL USING (true);
CREATE POLICY "Allow all" ON tiendas FOR ALL USING (true);
CREATE POLICY "Allow all" ON aliados FOR ALL USING (true);
CREATE POLICY "Allow all" ON comunidad FOR ALL USING (true);
CREATE POLICY "Allow all" ON contactos_marketing FOR ALL USING (true);
CREATE POLICY "Allow all" ON conversaciones_voz FOR ALL USING (true);

-- Storage
INSERT INTO storage.buckets (id, name, public) VALUES ('tiendas', 'tiendas', true) ON CONFLICT DO NOTHING;
CREATE POLICY "Allow public access" ON storage.objects FOR SELECT USING (bucket_id = 'tiendas');
CREATE POLICY "Allow authenticated uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'tiendas');
CREATE POLICY "Allow delete own" ON storage.objects FOR DELETE USING (bucket_id = 'tiendas');
