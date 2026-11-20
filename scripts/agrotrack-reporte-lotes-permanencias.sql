-- ===========================================================================
-- Agrilux · Reporte "Tiempo en cada lote": división normalizada + Excel plano
-- 20/11/2026. Idempotente.
--
-- NO toca las tablas AGRILUX empresas, fundos, lotes ni parcelas. Solo trabaja
-- sobre tablas auxiliares de AgroTrack (prefijo agrotrack_).
--
-- 1) Tabla de equivalencias y función única de normalización:
--      division = COALESCE(NULLIF(TRIM(division), ''), nombre)
--    y además homologa Pamp / Pom1 / Pom2 / Sal-Sip para no duplicar columnas.
-- 2) Aplica la regla a agrotrack_geocercas, a la tabla subdividida y refresca
--    la vista agrotrack_geocercas_reportes. Las visitas guardadas no tienen
--    columna division: la RPC la resuelve leyendo la geocerca, así que también
--    quedan corregidas sin reescribirlas.
-- 3) RPC plana para el Excel: una fila por permanencia, ya recortada al rango
--    Desde/Hasta y convertida a hora de Perú (America/Lima).
-- ===========================================================================

-- 1) Equivalencias de división ------------------------------------------------
create table if not exists public.agrotrack_division_equivalencias (
  alias             text primary key,
  division_canonica text not null
);

insert into public.agrotrack_division_equivalencias (alias, division_canonica)
values
  ('pamp', 'Pampagrande'),
  ('pampagrande', 'Pampagrande'),
  ('pom1', 'Pomalca 1'),
  ('pomalca1', 'Pomalca 1'),
  ('pomalca 1', 'Pomalca 1'),
  ('pom2', 'Pomalca 2'),
  ('pomalca2', 'Pomalca 2'),
  ('pomalca 2', 'Pomalca 2'),
  ('sal-sip', 'Saltur - Sipan'),
  ('saltur-sipan', 'Saltur - Sipan'),
  ('saltur sipan', 'Saltur - Sipan'),
  ('saltur - sipan', 'Saltur - Sipan')
on conflict (alias) do update
set division_canonica = excluded.division_canonica;

revoke all on public.agrotrack_division_equivalencias from public, anon, authenticated;

-- Unifica vacío -> nombre y alias -> nombre canónico. Se usa al escribir y
-- también al leer, para que filas viejas o importaciones nuevas no dupliquen
-- columnas en la tabla dinámica.
create or replace function public.agrotrack_normalizar_division(
  p_division text,
  p_nombre   text default null
)
returns text
language sql
stable
set search_path = public, pg_catalog, pg_temp
as $$
  with valor as (
    select coalesce(
      nullif(btrim(coalesce(p_division, '')), ''),
      nullif(btrim(coalesce(p_nombre, '')), ''),
      ''
    ) as texto
  )
  select coalesce(
    (
      select e.division_canonica
      from public.agrotrack_division_equivalencias e, valor v
      where lower(btrim(e.alias)) = lower(v.texto)
      order by length(btrim(e.alias)) desc
      limit 1
    ),
    v.texto
  )
  from valor v;
$$;

comment on function public.agrotrack_normalizar_division(text, text) is
  'Regla única de división: COALESCE(NULLIF(TRIM(division),''''), nombre) y equivalencias Pamp/Pom1/Pom2/Sal-Sip.';

-- 2) Aplicar la regla a las geocercas ----------------------------------------
update public.agrotrack_geocercas g
set division = public.agrotrack_normalizar_division(g.division, g.nombre),
    updated_at = now()
where g.division is distinct from public.agrotrack_normalizar_division(g.division, g.nombre);

-- La vista agrotrack_geocercas_reportes lee g.division directamente; la tabla
-- subdividida es un materializado y debe quedar coherente aunque el refresco
-- espacial falle. Después se regenera desde la fuente.
update public.agrotrack_geocercas_subdiv s
set division = g.division
from public.agrotrack_geocercas g
where s.geocerca_id = g.id
  and s.division is distinct from g.division;

select public.agrotrack_refrescar_geocercas_subdiv();

-- 3) RPC plana de permanencias para el Excel ---------------------------------
drop function if exists public.agrotrack_permanencias_lote_excel(uuid, timestamptz, timestamptz, text, text[], integer, integer);

create function public.agrotrack_permanencias_lote_excel(
  p_empresa_id uuid,
  p_desde      timestamptz,
  p_hasta      timestamptz,
  p_placa      text    default null,
  p_placas     text[]  default null,
  p_offset     integer default 0,
  p_limite     integer default 1000
)
returns table (
  fecha_entrada          text,
  hora_entrada           text,
  grupo                  text,
  area_cod               text,
  placa                  text,
  nombre                 text,
  division               text,
  duracion_horas_decimal numeric
)
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
  with recortadas as (
    select
      upper(btrim(v.placa))                              as placa,
      btrim(v.geocerca)                                  as nombre,
      greatest(v.entrada, p_desde)                       as ini,
      least(coalesce(v.salida, v.entrada), p_hasta)      as fin
    from public.agrotrack_visitas_dia v
    where (select public.onboarding_es_miembro(p_empresa_id))
      and v.empresa_id = p_empresa_id
      and v.dia between (p_desde at time zone 'America/Lima')::date
                    and (p_hasta at time zone 'America/Lima')::date
      and v.entrada <= p_hasta
      and coalesce(v.salida, v.entrada) >= p_desde
      and (p_placa is null or upper(btrim(v.placa)) = upper(btrim(p_placa)))
      and (
        p_placas is null
        or upper(btrim(v.placa)) = any (
          select upper(btrim(x)) from unnest(p_placas) as x
        )
      )
  ),
  permanencias as (
    select r.*,
           greatest(0, extract(epoch from (r.fin - r.ini)))::numeric as segundos
    from recortadas r
    where r.fin > r.ini
  ),
  placas as (
    select distinct p.placa from permanencias p
  ),
  grupos as (
    select upper(btrim(g.placa)) as placa,
           coalesce(nullif(btrim(g.grupo), ''), 'Sin grupo') as grupo
    from public.agrotrack_grupos_unidades g
    where g.empresa_id = p_empresa_id
  ),
  unidades as (
    select pl.placa,
           coalesce(
             nullif(btrim(v.area), ''),
             nullif(btrim(split_part(pos.unidad, '/', 2)), ''),
             'Sin área'
           ) as area_cod
    from placas pl
    left join public.agrotrack_vehiculos v
      on v.empresa_id = p_empresa_id
     and upper(btrim(v.placa)) = pl.placa
    left join lateral (
      select p.unidad
      from public.agrotrack_posiciones p
      where p.empresa_id = p_empresa_id
        -- pl.placa ya viene normalizada desde agrotrack_visitas_dia; comparar
        -- directo mantiene el índice (empresa_id, placa, fecha).
        and p.placa = pl.placa
        and p.fecha >= p_desde
        and p.fecha <= p_hasta
      order by p.fecha desc
      limit 1
    ) pos on true
  ),
  geos as (
    select distinct on (btrim(g.nombre))
           btrim(g.nombre) as nombre,
           public.agrotrack_normalizar_division(g.division, g.nombre) as division
    from public.agrotrack_geocercas g
    where g.empresa_id = p_empresa_id
    order by btrim(g.nombre), g.activa desc, g.id
  )
  select
    to_char(p.ini at time zone 'America/Lima', 'YYYY-MM-DD') as fecha_entrada,
    to_char(p.ini at time zone 'America/Lima', 'HH24:MI')    as hora_entrada,
    coalesce(g.grupo, 'Sin grupo')                           as grupo,
    coalesce(u.area_cod, 'Sin área')                         as area_cod,
    p.placa                                                  as placa,
    coalesce(nullif(btrim(geo.nombre), ''), p.nombre)        as nombre,
    coalesce(
      nullif(btrim(geo.division), ''),
      public.agrotrack_normalizar_division(null, p.nombre),
      'Sin nombre'
    )                                                        as division,
    round(p.segundos / 3600.0, 2)                            as duracion_horas_decimal
  from permanencias p
  left join geos geo     on geo.nombre = p.nombre
  left join grupos g     on g.placa = p.placa
  left join unidades u   on u.placa = p.placa
  order by fecha_entrada, hora_entrada, placa, nombre
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limite, 1000), 1), 1000);
$$;

grant execute on function public.agrotrack_permanencias_lote_excel(uuid, timestamptz, timestamptz, text, text[], integer, integer)
  to authenticated, service_role;

comment on function public.agrotrack_permanencias_lote_excel(uuid, timestamptz, timestamptz, text, text[], integer, integer) is
  'Excel plano del reporte Tiempo en cada lote: una fila por permanencia recortada al rango, en hora de Perú. Duración en horas decimales numéricas.';

-- Comprobaciones rápidas (SQL Editor) ----------------------------------------
-- select public.agrotrack_normalizar_division('Pom1', null);          -- Pomalca 1
-- select public.agrotrack_normalizar_division(null, 'Distrito Chiclayo'); -- Distrito Chiclayo
-- select count(*) from public.agrotrack_geocercas
--   where nullif(btrim(division), '') is null;                        -- 0
-- select distinct division from public.agrotrack_geocercas order by 1;
-- select sum(duracion_horas_decimal) from public.agrotrack_permanencias_lote_excel(
--   '9ab3a922-1f29-4f06-be93-d6bd7f2457d1',
--   timestamp '2026-11-18 00:00' at time zone 'America/Lima',
--   timestamp '2026-11-18 23:59:59' at time zone 'America/Lima',
--   null, null, 0, 1000);
