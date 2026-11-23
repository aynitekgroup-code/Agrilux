-- Ejecutar MANUALMENTE en SQL Editor. Idempotente, sin cambios de RLS.
-- Requiere agrotrack-visitas-diarias.sql y el índice empresa/placa/fecha.
-- Los días completos se leen de su respaldo; solo se recalculan visitas
-- cortadas por el horario. No se reconstruyen polígonos ni se prorratean
-- estados: se suman los tramos GPS reales dentro de cada visita guardada.
create or replace function public.agrotrack_visitas_rango_flota(
  p_empresa_id uuid,
  p_desde timestamptz,
  p_hasta timestamptz,
  p_placa text default null,
  p_geocerca text default null,
  p_offset integer default 0,
  p_limite integer default 1000
)
returns table (
  dia date, placa text, unidad text, geocerca text, division text,
  entrada timestamptz, salida timestamptz, duracion_segundos integer,
  apagado_segundos integer, ralenti_segundos integer, viaje_segundos integer,
  abierta boolean, continua_dia_anterior boolean
)
language sql stable security definer
set search_path = public, pg_catalog, pg_temp
as $$
  with visitas as materialized (
    select v.*,
      greatest(v.entrada, p_desde) as inicio,
      least(coalesce(v.salida, v.entrada + v.duracion_segundos * interval '1 second'), p_hasta) as fin
    from public.agrotrack_visitas_dia v
    where (select public.onboarding_es_miembro(p_empresa_id))
      and p_hasta > p_desde
      and v.empresa_id = p_empresa_id
      and v.dia between (p_desde at time zone 'America/Lima')::date
                    and (p_hasta at time zone 'America/Lima')::date
      and (p_placa is null or v.placa = p_placa)
      and (p_geocerca is null or lower(btrim(v.geocerca)) = lower(btrim(p_geocerca)))
      and v.entrada < p_hasta
      and coalesce(v.salida, v.entrada + v.duracion_segundos * interval '1 second') > p_desde
    order by v.dia, v.entrada, v.placa, v.geocerca
    offset greatest(coalesce(p_offset, 0), 0)
    limit least(greatest(coalesce(p_limite, 1000), 1), 1000)
  ), recortes as materialized (
    select v.*, (v.inicio > v.entrada or v.fin < coalesce(v.salida,
      v.entrada + v.duracion_segundos * interval '1 second')) as recortada
    from visitas v
  ), placas as (select distinct r.placa from recortes r),
  unidades as materialized (
    select pl.placa, u.unidad from placas pl
    left join lateral (
      select p.unidad from public.agrotrack_posiciones p
      where p.empresa_id = p_empresa_id and p.placa = pl.placa
      order by p.fecha desc limit 1
    ) u on true
  ), geos as materialized (
    -- Solo atributos. La vista no necesita serializar su geometría GeoJSON.
    select distinct on (btrim(g.nombre)) btrim(g.nombre) as nombre, g.division
    from public.agrotrack_geocercas_reportes g
    where g.empresa_id = p_empresa_id
    order by btrim(g.nombre), g.activa desc, g.id
  ), calculadas as (
    select r.*, s.apagado, s.ralenti, s.viaje
    from recortes r
    left join lateral (
      with puntos as (
        -- Un punto anterior da el estado con el que abre el corte.
        (select p.id, p.fecha, p.evento, p.velocidad
         from public.agrotrack_posiciones p
         where r.recortada and p.empresa_id = p_empresa_id and p.placa = r.placa
           and p.fecha >= r.inicio - interval '10 minutes' and p.fecha < r.inicio
         order by p.fecha desc, coalesce(p.secuencia, 0) desc, p.id desc limit 1)
        union all
        select p.id, p.fecha, p.evento, p.velocidad
        from public.agrotrack_posiciones p
        where r.recortada and p.empresa_id = p_empresa_id and p.placa = r.placa
          and p.fecha >= r.inicio and p.fecha < r.fin
      ), serie as (
        select p.*, lead(p.fecha, 1, r.fin) over (order by p.fecha, p.id) as siguiente
        from puntos p
      ), tramos as (
        select
          case when siguiente - fecha <= interval '10 minutes'
            then greatest(extract(epoch from (least(siguiente, r.fin) - greatest(fecha, r.inicio))), 0)
            else 0 end as segundos,
          not (lower(coalesce(evento, '')) like '%estacionad%'
            or lower(coalesce(evento, '')) like '%apagad%') as encendido,
          coalesce(velocidad, 0) > 5 as viajando
        from serie
      )
      select
        coalesce(sum(segundos) filter (where not encendido), 0)::integer as apagado,
        coalesce(sum(segundos) filter (where encendido and not viajando), 0)::integer as ralenti,
        coalesce(sum(segundos) filter (where encendido and viajando), 0)::integer as viaje
      from tramos
    ) s on r.recortada
  )
  select r.dia, r.placa, coalesce(u.unidad, r.placa), r.geocerca, g.division,
    r.inicio, r.fin,
    case when r.recortada then r.apagado + r.ralenti + r.viaje else r.duracion_segundos end,
    case when r.recortada then r.apagado else r.apagado_segundos end,
    case when r.recortada then r.ralenti else r.ralenti_segundos end,
    case when r.recortada then r.viaje else r.viaje_segundos end,
    r.abierta or r.fin < r.salida,
    r.continua_dia_anterior or r.inicio > r.entrada
  from calculadas r
  left join unidades u on u.placa = r.placa
  left join geos g on g.nombre = btrim(r.geocerca)
  order by r.dia, r.entrada, r.placa, r.geocerca;
$$;

revoke all on function public.agrotrack_visitas_rango_flota(uuid,timestamptz,timestamptz,text,text,integer,integer) from public;
grant execute on function public.agrotrack_visitas_rango_flota(uuid,timestamptz,timestamptz,text,text,integer,integer) to authenticated, service_role;
notify pgrst, 'reload schema';
