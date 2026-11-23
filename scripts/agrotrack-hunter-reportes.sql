-- Resúmenes originales de Hunter, separados de Zonar. No crea sincronización.
-- Requiere public.onboarding_es_miembro(uuid). Repetible en SQL Editor.
begin;
create table if not exists public.agrotrack_hunter_reportes (
  empresa_id uuid not null,
  equipo_id text not null,
  unidad text,
  desde timestamptz not null,
  hasta timestamptz not null,
  resumen jsonb not null check (jsonb_typeof(resumen) = 'object'),
  actualizado_en timestamptz not null default now(),
  primary key (empresa_id, equipo_id, desde, hasta),
  check (hasta > desde)
);
alter table public.agrotrack_hunter_reportes enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
    and tablename = 'agrotrack_hunter_reportes' and policyname = 'hunter_reportes_lectura_miembros') then
    create policy hunter_reportes_lectura_miembros on public.agrotrack_hunter_reportes
      for select to authenticated using (public.onboarding_es_miembro(empresa_id));
  end if;
end $$;
grant select on public.agrotrack_hunter_reportes to authenticated;

-- El rango filtra resúmenes completos: no se recortan ni suman informes
-- solapados, pues Hunter no proporciona datos para repartirlos fielmente.
create or replace function public.agrotrack_hunter_actividad(
  p_empresa_id uuid, p_desde timestamptz, p_hasta timestamptz,
  p_offset integer default 0, p_limite integer default 100
)
returns table(equipo_id text, unidad text, desde timestamptz, hasta timestamptz, resumen jsonb, actualizado_en timestamptz)
language sql stable security invoker set search_path = pg_catalog, public, pg_temp
as $$
  select r.equipo_id, r.unidad, r.desde, r.hasta, r.resumen, r.actualizado_en
  from public.agrotrack_hunter_reportes r
  where r.empresa_id = p_empresa_id
    and r.desde >= p_desde and r.hasta <= p_hasta
    and (select public.onboarding_es_miembro(p_empresa_id))
  order by r.desde desc, r.equipo_id, r.hasta desc
  limit least(greatest(coalesce(p_limite, 100), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0)
$$;
revoke all on function public.agrotrack_hunter_actividad(uuid, timestamptz, timestamptz, integer, integer) from public, anon;
grant execute on function public.agrotrack_hunter_actividad(uuid, timestamptz, timestamptz, integer, integer) to authenticated;
commit;
