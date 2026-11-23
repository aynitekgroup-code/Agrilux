-- Preparación aislada para Hunter; NO conecta ni programa el proveedor.
-- Requiere public.onboarding_es_miembro(uuid). Ejecutar entero en SQL Editor.
begin;

create table if not exists public.agrotrack_hunter_estado_vivo (
  empresa_id uuid not null,
  equipo_id text not null check (length(equipo_id) between 1 and 128),
  unidad text,
  fecha timestamptz not null,
  latitud double precision check (latitud between -90 and 90),
  longitud double precision check (longitud between -180 and 180),
  velocidad_kmh numeric check (velocidad_kmh >= 0),
  ignicion boolean,
  direccion text,
  grupo_id text,
  actualizado_en timestamptz not null default now(),
  primary key (empresa_id, equipo_id),
  check ((latitud is null) = (longitud is null))
);

alter table public.agrotrack_hunter_estado_vivo enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'agrotrack_hunter_estado_vivo'
      and policyname = 'hunter_estado_lectura_miembros'
  ) then
    create policy hunter_estado_lectura_miembros on public.agrotrack_hunter_estado_vivo
      for select to authenticated using (public.onboarding_es_miembro(empresa_id));
  end if;
end $$;
grant select on public.agrotrack_hunter_estado_vivo to authenticated;

-- Solo el backend de confianza con service_role podrá ejecutar esta función.
-- Una lectura atrasada no sobrescribe una posición más reciente.
create or replace function public.agrotrack_hunter_guardar_estado(p_empresa_id uuid, p_unidades jsonb)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare v_filas integer;
begin
  if p_empresa_id is null or jsonb_typeof(p_unidades) is distinct from 'array' then
    raise exception 'Empresa o lista de unidades inválida';
  end if;
  if jsonb_array_length(p_unidades) > 1000 then
    raise exception 'Máximo 1000 unidades por lote';
  end if;
  insert into public.agrotrack_hunter_estado_vivo as actual
    (empresa_id, equipo_id, unidad, fecha, latitud, longitud, velocidad_kmh, ignicion, direccion, grupo_id)
  select p_empresa_id, x.equipo_id, x.unidad, x.fecha, x.latitud, x.longitud,
    x.velocidad_kmh, x.ignicion, x.direccion, x.grupo_id
  from jsonb_to_recordset(p_unidades) as x(
    equipo_id text, unidad text, fecha timestamptz, latitud double precision,
    longitud double precision, velocidad_kmh numeric, ignicion boolean, direccion text, grupo_id text
  )
  on conflict (empresa_id, equipo_id) do update set
    unidad = excluded.unidad, fecha = excluded.fecha, latitud = excluded.latitud,
    longitud = excluded.longitud, velocidad_kmh = excluded.velocidad_kmh,
    ignicion = excluded.ignicion, direccion = excluded.direccion,
    grupo_id = excluded.grupo_id, actualizado_en = now()
  where excluded.fecha >= actual.fecha;
  get diagnostics v_filas = row_count;
  return v_filas;
end $$;
revoke all on function public.agrotrack_hunter_guardar_estado(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.agrotrack_hunter_guardar_estado(uuid, jsonb) to service_role;

commit;
