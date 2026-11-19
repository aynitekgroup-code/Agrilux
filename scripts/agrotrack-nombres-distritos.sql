-- ============================================================================
-- NOMBRES DE LOS DISTRITOS (18/11/2026, observación III)
-- "Todos los distritos deben comenzar como Distrito y los que tengan nombre
--  largo, como Manuel Antonio Mesones Muro, deben quedar como Distrito MAMM."
--
-- Regla (la misma que usa el importador en src/lib/geocercasImportacion.js):
--   * se quita un "Distrito"/"Dist." (y "de") que ya tenga al inicio;
--   * si quedan 3 palabras o más (sin contar de, del, la, las, los, el, y)
--     se usan sus iniciales:  MANUEL ANTONIO MESONES MURO -> Distrito MAMM
--                             JOSE LEONARDO ORTIZ         -> Distrito JLO
--   * si no, el nombre en formato título:
--                             POMALCA     -> Distrito Pomalca
--                             SANTA ROSA  -> Distrito Santa Rosa
--
-- Cómo usarlo en Supabase (SQL Editor):
--   1) Ejecuta SOLO el bloque "VISTA PREVIA" y revisa la lista.
--   2) Si está bien, ejecuta el archivo completo. Es repetible: un nombre que
--      ya cumple la regla no cambia.
-- Cambia el nombre en agrotrack_geocercas y en el respaldo de visitas
-- (agrotrack_visitas_dia) para que los reportes de días pasados coincidan,
-- y refresca agrotrack_geocercas_subdiv si existe.
-- ============================================================================

create or replace function public.agrotrack_nombre_distrito(p_nombre text)
returns text
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_base   text;
  v_pal    text[];
  v_sig    text[] := '{}';
  v_out    text := '';
  w        text;
  i        int := 0;
  conect   constant text[] := array['de','del','la','las','los','el','y'];
begin
  v_base := btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
  -- Ya abreviado (p. ej. "Distrito MAMM"): se deja igual (repetible).
  if v_base ~ '^Distrito [A-ZÁÉÍÓÚÑ]{2,6}$' then
    return v_base;
  end if;
  v_base := btrim(regexp_replace(v_base, '^(distrito|dist\.?)\s+(de\s+)?', '', 'i'));
  if v_base = '' then
    return 'Distrito';
  end if;
  v_pal := string_to_array(v_base, ' ');
  foreach w in array v_pal loop
    if not (lower(w) = any (conect)) then
      v_sig := v_sig || w;
    end if;
  end loop;
  if coalesce(array_length(v_sig, 1), 0) >= 3 then
    foreach w in array v_sig loop
      v_out := v_out || upper(left(w, 1));
    end loop;
    return 'Distrito ' || v_out;
  end if;
  foreach w in array v_pal loop
    i := i + 1;
    if i > 1 and lower(w) = any (conect) then
      v_out := v_out || ' ' || lower(w);
    else
      v_out := v_out || case when i > 1 then ' ' else '' end
               || upper(left(w, 1)) || lower(substr(w, 2));
    end if;
  end loop;
  return 'Distrito ' || v_out;
end;
$$;

-- ---------------------------------------------------------------------------
-- VISTA PREVIA (ejecuta solo esto primero)
-- ---------------------------------------------------------------------------
select g.nombre                                   as nombre_actual,
       public.agrotrack_nombre_distrito(g.nombre) as nombre_nuevo
from public.agrotrack_geocercas g
where g.tipo = 'distrito'
  and g.nombre is distinct from public.agrotrack_nombre_distrito(g.nombre)
order by 1;

-- ---------------------------------------------------------------------------
-- APLICAR
-- ---------------------------------------------------------------------------
do $$
declare
  n_geo int := 0;
  n_vis int := 0;
begin
  create temporary table _renombre on commit drop as
  select g.empresa_id, g.nombre as viejo, public.agrotrack_nombre_distrito(g.nombre) as nuevo
  from public.agrotrack_geocercas g
  where g.tipo = 'distrito'
    and g.nombre is distinct from public.agrotrack_nombre_distrito(g.nombre);

  update public.agrotrack_geocercas g
     set nombre = r.nuevo
    from _renombre r
   where g.empresa_id = r.empresa_id and g.tipo = 'distrito' and g.nombre = r.viejo;
  get diagnostics n_geo = row_count;

  if to_regclass('public.agrotrack_visitas_dia') is not null then
    update public.agrotrack_visitas_dia v
       set geocerca = r.nuevo
      from _renombre r
     where v.empresa_id = r.empresa_id and v.geocerca = r.viejo;
    get diagnostics n_vis = row_count;
  end if;

  if to_regprocedure('public.agrotrack_refrescar_geocercas_subdiv()') is not null then
    perform public.agrotrack_refrescar_geocercas_subdiv();
  end if;

  raise notice 'Distritos renombrados: %; visitas guardadas actualizadas: %.', n_geo, n_vis;
end $$;
