-- AgroTrack geofences: run after the company onboarding/RLS migrations.
-- Reads are limited to active company members. Engineers and administrators
-- can import/update geofences; only administrators can delete them.

CREATE TABLE IF NOT EXISTS public.agrotrack_geocercas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL CHECK (btrim(source_key) <> ''),
  nombre TEXT NOT NULL CHECK (btrim(nombre) <> ''),
  division TEXT,
  anexo TEXT,
  distrito TEXT,
  provincia TEXT,
  area_declarada NUMERIC,
  geometria JSONB NOT NULL CHECK (
    COALESCE(
      jsonb_typeof(geometria) = 'object'
      AND geometria->>'type' IN ('Polygon', 'MultiPolygon')
      AND jsonb_typeof(geometria->'coordinates') = 'array',
      FALSE
    )
  ),
  atributos_fuente JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(atributos_fuente) = 'object'),
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  creado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_id, source_key)
);

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

DROP POLICY IF EXISTS agrotrack_geocercas_select_member ON public.agrotrack_geocercas;
CREATE POLICY agrotrack_geocercas_select_member
  ON public.agrotrack_geocercas
  FOR SELECT TO authenticated
  USING (public.onboarding_es_miembro(empresa_id));

DROP POLICY IF EXISTS agrotrack_geocercas_insert_engineer ON public.agrotrack_geocercas;
CREATE POLICY agrotrack_geocercas_insert_engineer
  ON public.agrotrack_geocercas
  FOR INSERT TO authenticated
  WITH CHECK (public.agrotrack_puede_editar_geocercas(empresa_id));

DROP POLICY IF EXISTS agrotrack_geocercas_update_engineer ON public.agrotrack_geocercas;
CREATE POLICY agrotrack_geocercas_update_engineer
  ON public.agrotrack_geocercas
  FOR UPDATE TO authenticated
  USING (public.agrotrack_puede_editar_geocercas(empresa_id))
  WITH CHECK (public.agrotrack_puede_editar_geocercas(empresa_id));

DROP POLICY IF EXISTS agrotrack_geocercas_delete_admin ON public.agrotrack_geocercas;
CREATE POLICY agrotrack_geocercas_delete_admin
  ON public.agrotrack_geocercas
  FOR DELETE TO authenticated
  USING (public.onboarding_es_admin(empresa_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agrotrack_geocercas TO authenticated;
