-- Asignaciones operativas Hunter independientes de las placas y grupos Zonar.
-- No asigna máquinas automáticamente ni altera políticas existentes.
begin;
create table if not exists public.agrotrack_hunter_grupos (
  empresa_id uuid not null,
  equipo_id text not null check (length(trim(equipo_id)) between 1 and 128),
  grupo text not null check (length(trim(grupo)) between 1 and 120),
  primary key (empresa_id, equipo_id, grupo)
);
alter table public.agrotrack_hunter_grupos enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public'
    and tablename='agrotrack_hunter_grupos' and policyname='hunter_grupos_lectura_miembros') then
    create policy hunter_grupos_lectura_miembros on public.agrotrack_hunter_grupos
      for select to authenticated using (public.onboarding_es_miembro(empresa_id));
  end if;
end $$;
grant select on public.agrotrack_hunter_grupos to authenticated;
create table if not exists public.agrotrack_hunter_areas (
  empresa_id uuid not null,
  equipo_id text not null check (length(trim(equipo_id)) between 1 and 128),
  area text not null check (length(trim(area)) between 1 and 120),
  primary key (empresa_id, equipo_id)
);
alter table public.agrotrack_hunter_areas enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public'
    and tablename='agrotrack_hunter_areas' and policyname='hunter_areas_lectura_miembros') then
    create policy hunter_areas_lectura_miembros on public.agrotrack_hunter_areas
      for select to authenticated using (public.onboarding_es_miembro(empresa_id));
  end if;
end $$;
grant select on public.agrotrack_hunter_areas to authenticated;
commit;
