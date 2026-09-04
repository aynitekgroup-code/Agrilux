-- ============================================
-- FIX: 406 error en tabla usuarios
-- Ejecutar ESTO PRIMERO en Supabase SQL Editor
-- ============================================

-- 1. Recargar schema cache de PostgREST (soluciona 406)
SELECT pg_notify('pgrst', 'reload schema');

-- 2. Verificar columnas necesarias
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'ubicacion') THEN
    ALTER TABLE usuarios ADD COLUMN ubicacion TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'usuarios' AND column_name = 'coords') THEN
    ALTER TABLE usuarios ADD COLUMN coords JSONB;
  END IF;
END $$;

-- 3. RLS: Eliminar viejas y crear permisiva
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all authenticated" ON usuarios;
DROP POLICY IF EXISTS "usuarios_all_authenticated" ON usuarios;
DROP POLICY IF EXISTS "usuarios_all_service_role" ON usuarios;
DROP POLICY IF EXISTS "usuarios_select_policy" ON usuarios;
DROP POLICY IF EXISTS "usuarios_insert_policy" ON usuarios;
DROP POLICY IF EXISTS "usuarios_update_policy" ON usuarios;

CREATE POLICY "usuarios_all_authenticated" ON usuarios
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "usuarios_all_service_role" ON usuarios
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Forzar recarga final
SELECT pg_notify('pgrst', 'reload schema');

-- 5. Verificar que funciona
SELECT id, email, ubicacion FROM usuarios LIMIT 5;
