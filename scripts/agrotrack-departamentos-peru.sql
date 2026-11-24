-- Capa administrativa independiente. No modifica geocercas ni datos Zonar.
-- Los polígonos se cargan por separado tras validar su fuente y duplicados.
begin;
create table if not exists public.agrotrack_departamentos_peru (
  codigo text primary key,
  nombre text not null unique,
  fuente text not null,
  geom extensions.geometry(Geometry, 4326) not null,
  creado_en timestamptz not null default now(),
  check (extensions.st_srid(geom) = 4326),
  check (extensions.st_geometrytype(geom) in ('ST_Polygon', 'ST_MultiPolygon')),
  check (extensions.st_isvalid(geom))
);
create index if not exists agrotrack_departamentos_peru_geom_gix
  on public.agrotrack_departamentos_peru using gist (geom);
alter table public.agrotrack_departamentos_peru enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public'
      and tablename='agrotrack_departamentos_peru' and policyname='departamentos_lectura_autenticados') then
    create policy departamentos_lectura_autenticados on public.agrotrack_departamentos_peru
      for select to authenticated using (true);
  end if;
end $$;
grant select on public.agrotrack_departamentos_peru to authenticated;

-- Piezas exactas (sin simplificación) para evitar evaluar polígonos nacionales
-- completos por cada posición. La carga se puede repetir sin duplicar piezas.
create table if not exists public.agrotrack_departamentos_peru_partes (
  id bigint generated always as identity primary key,
  codigo text not null references public.agrotrack_departamentos_peru(codigo),
  geom extensions.geometry(Geometry, 4326) not null
);
create index if not exists agrotrack_departamentos_peru_partes_geom_gix
  on public.agrotrack_departamentos_peru_partes using gist (geom);
create index if not exists agrotrack_departamentos_peru_partes_codigo_idx
  on public.agrotrack_departamentos_peru_partes (codigo);
alter table public.agrotrack_departamentos_peru_partes enable row level security;
insert into public.agrotrack_departamentos_peru_partes(codigo, geom)
select d.codigo, parte.geom
from public.agrotrack_departamentos_peru d
cross join lateral extensions.st_subdivide(d.geom, 256) as parte(geom)
where not exists (select 1 from public.agrotrack_departamentos_peru_partes p where p.codigo=d.codigo);

-- Pagina las unidades antes del cruce para no truncar en PostgREST.
create or replace function public.agrotrack_hunter_departamentos(
  p_empresa_id uuid, p_offset integer default 0, p_limite integer default 100
)
returns table (equipo_id text, departamento text)
language sql stable security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $$
  with unidades as materialized (
    select v.equipo_id, v.latitud, v.longitud
    from public.agrotrack_hunter_estado_vivo v
    where v.empresa_id = p_empresa_id
      and (select public.onboarding_es_miembro(p_empresa_id))
    order by v.equipo_id
    limit least(greatest(coalesce(p_limite, 100), 1), 200)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select u.equipo_id, d.nombre
  from unidades u
  left join lateral (
    select d.nombre from public.agrotrack_departamentos_peru_partes p
    join public.agrotrack_departamentos_peru d on d.codigo=p.codigo
    where u.latitud is not null and u.longitud is not null
      and extensions.st_covers(p.geom, extensions.st_setsrid(extensions.st_makepoint(u.longitud,u.latitud),4326))
    order by d.codigo limit 1
  ) d on true
  order by u.equipo_id;
$$;
revoke all on function public.agrotrack_hunter_departamentos(uuid, integer, integer) from public, anon;
grant execute on function public.agrotrack_hunter_departamentos(uuid, integer, integer) to authenticated;
commit;
