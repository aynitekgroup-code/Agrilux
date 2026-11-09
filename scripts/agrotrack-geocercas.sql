-- AgroTrack geofences: run after the company onboarding/RLS migrations.
-- Reads are limited to active company members. Engineers and administrators
-- can import/update geofences; only administrators can delete them.

CREATE TABLE IF NOT EXISTS public.agrotrack_geocercas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  fundo_id UUID,
  lote_id UUID,
  nombre TEXT NOT NULL CHECK (btrim(nombre) <> ''),
  tipo TEXT NOT NULL DEFAULT 'poligono',
  forma TEXT NOT NULL DEFAULT 'irregular',
  centro_lat DOUBLE PRECISION,
  centro_lon DOUBLE PRECISION,
  radio_m NUMERIC,
  poligono JSONB,
  velocidad_max_kmh NUMERIC,
  color TEXT,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_key TEXT CHECK (source_key IS NULL OR btrim(source_key) <> ''),
  division TEXT,
  anexo TEXT,
  distrito TEXT,
  provincia TEXT,
  area_declarada NUMERIC,
  atributos_fuente JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(atributos_fuente) = 'object')
);

-- Compatible with the original AgroTrack schema, which stores geometry in
-- `poligono` and requires `tipo` and `forma`.
ALTER TABLE public.agrotrack_geocercas
  ADD COLUMN IF NOT EXISTS source_key TEXT,
  ADD COLUMN IF NOT EXISTS division TEXT,
  ADD COLUMN IF NOT EXISTS anexo TEXT,
  ADD COLUMN IF NOT EXISTS distrito TEXT,
  ADD COLUMN IF NOT EXISTS provincia TEXT,
  ADD COLUMN IF NOT EXISTS area_declarada NUMERIC,
  ADD COLUMN IF NOT EXISTS atributos_fuente JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_agrotrack_geocercas_empresa_source
  ON public.agrotrack_geocercas (empresa_id, source_key);

CREATE INDEX IF NOT EXISTS idx_agrotrack_geocercas_empresa
  ON public.agrotrack_geocercas (empresa_id, division, nombre);

CREATE OR REPLACE FUNCTION public.agrotrack_puede_editar_geocercas(p_empresa_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.empresa_miembros AS miembro
    WHERE miembro.empresa_id = p_empresa_id
      AND miembro.user_id = auth.uid()::TEXT
      AND miembro.activo IS TRUE
      AND miembro.rol IN ('administrador', 'ingeniero')
  );
$$;

REVOKE ALL ON FUNCTION public.agrotrack_puede_editar_geocercas(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agrotrack_puede_editar_geocercas(UUID) TO authenticated;

ALTER TABLE public.agrotrack_geocercas ENABLE ROW LEVEL SECURITY;

-- Remove legacy/permissive policies too: PostgreSQL combines permissive
-- policies with OR, so an older ALL policy could otherwise bypass these rules.
DO $$
DECLARE existing_policy RECORD;
BEGIN
  FOR existing_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'agrotrack_geocercas'
  LOOP
    EXECUTE format(
      'DROP POLICY %I ON public.agrotrack_geocercas',
      existing_policy.policyname
    );
  END LOOP;
END;
$$;

CREATE POLICY agrotrack_geocercas_select_member
  ON public.agrotrack_geocercas
  FOR SELECT TO authenticated
  USING (public.onboarding_es_miembro(empresa_id));

CREATE POLICY agrotrack_geocercas_insert_engineer
  ON public.agrotrack_geocercas
  FOR INSERT TO authenticated
  WITH CHECK (public.agrotrack_puede_editar_geocercas(empresa_id));

CREATE POLICY agrotrack_geocercas_update_engineer
  ON public.agrotrack_geocercas
  FOR UPDATE TO authenticated
  USING (public.agrotrack_puede_editar_geocercas(empresa_id))
  WITH CHECK (public.agrotrack_puede_editar_geocercas(empresa_id));

CREATE POLICY agrotrack_geocercas_delete_admin
  ON public.agrotrack_geocercas
  FOR DELETE TO authenticated
  USING (public.onboarding_es_admin(empresa_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agrotrack_geocercas TO authenticated;
