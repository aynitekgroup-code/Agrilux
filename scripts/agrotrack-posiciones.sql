-- Posiciones GPS por unidad (reportes de Zonar, un punto cada ~2 minutos).
-- Ejecutar completo en el SQL Editor de Supabase. Es repetible: no borra datos.

create table if not exists public.agrotrack_posiciones (
  id            bigint generated always as identity primary key,
  empresa_id    uuid not null,
  placa         text not null,
  unidad        text not null,          -- texto original de Zonar: "PLACA/DESCRIPCION"
  descripcion   text,
  fecha         timestamptz not null,   -- hora de Perú (UTC-5)
  secuencia     integer,
  evento        text not null,          -- Conduciendo, Estacionado, Alta velocidad, etc.
  pt_referencia text,
  direccion     text,
  velocidad     numeric,
  latitud       double precision not null,
  longitud      double precision not null,
  source_key    text not null,          -- evita duplicados al repetir una carga
  creado_por    uuid,
  created_at    timestamptz not null default now(),
  constraint agrotrack_posiciones_empresa_source_key_uk unique (empresa_id, source_key)
);

create index if not exists agrotrack_posiciones_empresa_placa_fecha_idx
  on public.agrotrack_posiciones (empresa_id, placa, fecha);
create index if not exists agrotrack_posiciones_empresa_fecha_idx
  on public.agrotrack_posiciones (empresa_id, fecha);
create index if not exists agrotrack_posiciones_empresa_evento_idx
  on public.agrotrack_posiciones (empresa_id, evento);

alter table public.agrotrack_posiciones enable row level security;

-- Lectura: exactamente la misma regla que agrotrack_geocercas (se copia de su política).
do $$
declare
  lectura text;
begin
  select qual into lectura
  from pg_policies
  where schemaname = 'public'
    and tablename = 'agrotrack_geocercas'
    and policyname = 'agrotrack_geocercas_select_member';

  if lectura is null then
    raise exception 'No se encontró la política agrotrack_geocercas_select_member; no se creó la de lectura.';
  end if;

  execute 'drop policy if exists agrotrack_posiciones_select_member on public.agrotrack_posiciones';
  execute format(
    'create policy agrotrack_posiciones_select_member on public.agrotrack_posiciones for select using (%s)',
    lectura
  );
end $$;

-- Escritura: mismas funciones que usan las geocercas (administrador e ingeniero).
drop policy if exists agrotrack_posiciones_insert_engineer on public.agrotrack_posiciones;
create policy agrotrack_posiciones_insert_engineer on public.agrotrack_posiciones
  for insert with check (agrotrack_puede_editar_geocercas(empresa_id));

drop policy if exists agrotrack_posiciones_update_engineer on public.agrotrack_posiciones;
create policy agrotrack_posiciones_update_engineer on public.agrotrack_posiciones
  for update using (agrotrack_puede_editar_geocercas(empresa_id))
  with check (agrotrack_puede_editar_geocercas(empresa_id));

drop policy if exists agrotrack_posiciones_delete_admin on public.agrotrack_posiciones;
create policy agrotrack_posiciones_delete_admin on public.agrotrack_posiciones
  for delete using (agrotrack_tiene_rol(empresa_id, array['administrador']::text[]));

-- Comprobación: debe listar 4 políticas.
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'agrotrack_posiciones'
order by cmd;