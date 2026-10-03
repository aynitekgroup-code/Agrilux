-- ============================================
-- COMPLETE FIX v2: Schema with double-quoted snake_case
-- to match the import SQL column names exactly
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

CREATE TABLE "usuarios" (
  "id" TEXT PRIMARY KEY,
  "nombre" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "ubicacion" TEXT,
  "whatsapp" TEXT,
  "coords" JSONB,
  "rol" TEXT NOT NULL DEFAULT 'agricultor',
  "status" TEXT NOT NULL DEFAULT 'pendiente',
  "creado_por" TEXT DEFAULT 'self',
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  "email_sintetico" TEXT,
  "celular" TEXT,
  "password_default" TEXT
);

CREATE TABLE "diagnosticos" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT,
  "user_name" TEXT,
  "user_email" TEXT,
  "cultivo" TEXT NOT NULL,
  "cultivo_nombre" TEXT,
  "con_foto" BOOLEAN DEFAULT FALSE,
  "consulta_texto" TEXT,
  "clima_contexto" JSONB,
  "resultado" JSONB,
  "confirmado_por_usuario" BOOLEAN,
  "fecha" TEXT NOT NULL,
  "mes" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE "parcelas" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "user_name" TEXT,
  "nombre" TEXT NOT NULL,
  "cultivo" TEXT,
  "cultivo_nombre" TEXT,
  "cultivo_emoji" TEXT,
  "variedad" TEXT,
  "area" TEXT,
  "fecha_siembra" TEXT,
  "gps" TEXT,
  "coordenadas" JSONB
);

CREATE TABLE "registros_parcela" (
  "id" TEXT PRIMARY KEY,
  "parcela_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "foto" TEXT,
  "recomendacion" TEXT,
  "dias_desde_siembra" INTEGER,
  "fecha" TEXT
);

CREATE TABLE "historial_clinico" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT,
  "parcela_id" TEXT,
  "parcela_nombre" TEXT,
  "cultivo" TEXT,
  "tiene_problema" BOOLEAN,
  "problema" TEXT,
  "gravedad" TEXT,
  "recomendacion" TEXT,
  "fuente" TEXT
);

CREATE TABLE "tiendas_comunidad" (
  "id" TEXT PRIMARY KEY,
  "nombre" TEXT NOT NULL,
  "direccion" TEXT,
  "distrito" TEXT,
  "departamento" TEXT,
  "whatsapp" TEXT,
  "verificada" BOOLEAN DEFAULT FALSE,
  "activa" BOOLEAN DEFAULT TRUE
);

CREATE TABLE "tiendas" (
  "id" TEXT PRIMARY KEY,
  "nombre" TEXT NOT NULL,
  "direccion" TEXT,
  "region" TEXT
);

CREATE TABLE "aliados" (
  "id" TEXT PRIMARY KEY,
  "nombre" TEXT NOT NULL,
  "whatsapp" TEXT,
  "empresa" TEXT,
  "ubicacion" TEXT,
  "tipo" TEXT
);

CREATE TABLE "comunidad" (
  "id" TEXT PRIMARY KEY,
  "categoria" TEXT,
  "titulo" TEXT,
  "contenido" TEXT,
  "autor" TEXT,
  "autor_id" TEXT,
  "fecha" TEXT,
  "likes" INTEGER DEFAULT 0
);

CREATE TABLE "contactos_marketing" (
  "id" TEXT PRIMARY KEY,
  "nombre" TEXT,
  "email" TEXT,
  "telefono" TEXT,
  "whatsapp" TEXT,
  "fuente" TEXT,
  "intereses" JSONB,
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE "conversaciones_voz" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT,
  "mensajes" JSONB
);

CREATE TABLE "precios_historicos" (
  "id" TEXT PRIMARY KEY,
  "tienda_id" TEXT,
  "tienda_nombre" TEXT,
  "producto_nombre" TEXT,
  "precio" DOUBLE PRECISION,
  "unidad" TEXT,
  "fecha" TEXT,
  "fuente" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE "usuarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "diagnosticos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "parcelas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "registros_parcela" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "historial_clinico" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tiendas_comunidad" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "precios_historicos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tiendas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "aliados" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "comunidad" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contactos_marketing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversaciones_voz" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON "usuarios" FOR ALL USING (true);
CREATE POLICY "Allow all" ON "diagnosticos" FOR ALL USING (true);
CREATE POLICY "Allow all" ON "parcelas" FOR ALL USING (true);
CREATE POLICY "Allow all" ON "registros_parcela" FOR ALL USING (true);
CREATE POLICY "Allow all" ON "historial_clinico" FOR ALL USING (true);
CREATE POLICY "Allow all" ON "tiendas_comunidad" FOR ALL USING (true);
CREATE POLICY "Allow all" ON "precios_historicos" FOR ALL USING (true);
CREATE POLICY "Allow all" ON "tiendas" FOR ALL USING (true);
CREATE POLICY "Allow all" ON "aliados" FOR ALL USING (true);
CREATE POLICY "Allow all" ON "comunidad" FOR ALL USING (true);
CREATE POLICY "Allow all" ON "contactos_marketing" FOR ALL USING (true);
CREATE POLICY "Allow all" ON "conversaciones_voz" FOR ALL USING (true);

INSERT INTO storage.buckets (id, name, public) VALUES ('tiendas', 'tiendas', true) ON CONFLICT DO NOTHING;
