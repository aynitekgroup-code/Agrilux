-- Reportes de actividad de flota (FASE 3) a partir de public.agrotrack_posiciones.
-- Ejecutar completo en el SQL Editor de Supabase. Es repetible e idempotente:
-- no borra ni modifica datos, ni toca RLS, ni la tabla agrotrack_posiciones,
-- ni agrotrack_geocercas, ni las funciones de scripts/agrotrack-posiciones-resumen.sql.
--
-- INCLUYE (sección 0) las funciones de membresía onboarding_es_miembro /
-- onboarding_es_admin, que no existían en este proyecto (de ahí el ERROR 42883
-- "function public.onboarding_es_miembro(uuid) does not exist" al ejecutarlo).
-- Tampoco hace falta correr otro archivo antes.
--
-- Réplica de lo que el Ing. Carlos Perez pidió textualmente de Zonar:
--   "reporte de actividad... que salga el reporte por día, y por ralentí,
--    hora de viaje y encendido, y recorrido por separado y por mes"
-- Cubre 4 de los 95 reportes de Zonar (los 4 pedidos):
--   Actividades Sumarizado (por día) · Actividades por mes ·
--   Ralentí · Horas de viaje / encendido (recorrido en km aparte).
--
-- MISMA receta que agrotrack-posiciones-resumen.sql:
--   * SECURITY DEFINER + validación de membresía con
--     public.onboarding_es_miembro(p_empresa_id) evaluada UNA sola vez
--     (un no-miembro recibe 0 filas sin recorrer la tabla con RLS fila a fila).
--   * Todo el cálculo ocurre en SQL: PostgREST devuelve máximo 1000 filas.
--   * Los grants no afectan a RLS ni a las políticas existentes.
--
-- ---------------------------------------------------------------------------
-- CRITERIOS (definidos en UN solo lugar: este archivo)
-- ---------------------------------------------------------------------------
--   Rango        : p_desde / p_hasta (null = todo el histórico cargado).
--                  La consola manda día completo 00:00–23:59 hora de Perú.
--   Continuidad  : un tramo solo cuenta si el intervalo con el punto anterior
--                  es <= 10 minutos (mismo umbral del cálculo de km).
--   Encendido    : el evento NO indica estacionado ni apagado
--                  ("%estacionad%" / "%apagad%" cubre "Estacionado",
--                   "Ignición Apagada", "Apagado", "Viaje detenido" no aplica).
--   Viaje        : encendido y velocidad > 5 km/h  (UMBRAL_VIAJE_KMH = 5)
--   Ralentí      : encendido y velocidad <= 5 km/h (UMBRAL_RALENTI_KMH = 5)
--                  -> por construcción  encendido = viaje + ralentí.
--   Recorrido    : haversine entre puntos consecutivos (orden fecha, secuencia)
--                  descartando duplicados, saltos > 600 s y >= 5 km.
--   Duplicados   : mismo (fecha, secuencia) repetidos al recargar el reporte.
--   Día/Mes      : fecha at time zone 'America/Lima' (UTC-5, sin DST).
--   Estado tramo : (14/11/2026) cada tramo toma el estado del punto donde
--                  EMPIEZA (un estado dura hasta el siguiente evento, como
--                  en Zonar).
--   Bordes       : (14/11/2026) se leen 10 min antes y después del rango y
--                  cada tramo se recorta a [p_desde, p_hasta]: el tramo que
--                  cruza la medianoche se reparte entre los dos días.
--
-- El umbral de 5 km/h es una decisión de negocio: cambiar UMBRAL_VIAJE_KMH /
-- UMBRAL_RALENTI_KMH más abajo cambia el reporte completo, nunca se duplica
-- el criterio en el código de la interfaz.
--
-- UNIDADES EN CERO (observaciones I y II del Ing. Carlos Perez):
--   Antes solo salían las unidades que tuvieron posiciones en el rango; una
--   máquina en taller/mantenimiento desaparecía del reporte. Ahora se cruza
--   el agregado contra el UNIVERSO de placas de la empresa (histórico completo
--   de public.agrotrack_posiciones, sin filtro de rango) y la unidad sin una
--   sola posición en el rango sale con km 0, encendido 0, viaje 0, ralentí 0,
--   alertas 0, vel_max null y posiciones 0 (= cero tramos).
--   Una fila "en cero" se reconoce porque posiciones = 0 (una fila real nunca
--   tiene 0 posiciones). NO se agrega ninguna columna al returns table: la
--   firma y las columnas son idénticas a las de antes, así que la UI no se
--   entera del cambio.
--   Clave de agrupación de esas filas (y por qué NO rompe el tope de 1000):
--     * p_agrupar 'unidad' -> UNA sola fila por unidad (periodo null). 39
--       unidades = 39 filas como máximo. Es el modo que usa el Reporte 15
--       "Eventos resumidos" (FleetEventsSummary.jsx), así que ahí también
--       aparecen las unidades sin eventos: Stop = rango completo, Idle y
--       Drive = 0.
--     * p_agrupar 'dia'/'mes' -> una fila en cero por CADA día/mes del rango
--       pedido (si el rango está acotado, que es lo normal porque la consola
--       manda día completo) o por los periodos con datos si el rango es
--       abierto. Solo entran las unidades sin posiciones en TODO el rango
--       (Z placas x P periodos); una unidad que reportó algún día no genera
--       filas en los demás días: hacer el cruce completo (39 unidades x 31
--       días) son 1209 filas por sí solo y ya superaría el tope.
--   El límite sigue intacto: el ORDER BY + LIMIT final de la función corta en
--   p_limite (1000 por defecto) el conjunto unido, y el orden por periodo
--   descendente hace que se conserven primero los días/meses más recientes
--   (mismo comportamiento que antes ante un rango largo). Ninguna consulta
--   puede devolver más de 1000 filas a PostgREST.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 0) PREREQUISITO: funciones de membresía (ver el mismo bloque en
-- scripts/agrotrack-posiciones-resumen.sql y en scripts/onboarding-es-miembro.sql).
--
-- Este archivo validaba con public.onboarding_es_miembro(...) que no existía
-- en este proyecto (ERROR 42883 "function public.onboarding_es_miembro(uuid)
-- does not exist"). Se crean aquí para que el archivo funcione solo:
-- idempotente (solo CREATE OR REPLACE), no toca datos ni políticas. Requiere
-- auth.uid() (esquema auth de Supabase) y la tabla empresa_miembros.
-- ---------------------------------------------------------------------------
create or replace function public.onboarding_es_miembro(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
     and exists (
       select 1
       from public.empresa_miembros em
       where em.empresa_id = p_empresa_id
         and em.user_id = auth.uid()::text
         and em.activo is true
     );
$$;

create or replace function public.onboarding_es_admin(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null
     and exists (
       select 1
       from public.empresa_miembros em
       where em.empresa_id = p_empresa_id
         and em.user_id = auth.uid()::text
         and em.activo is true
         and em.rol = 'administrador'
     );
$$;

revoke all on function public.onboarding_es_miembro(uuid) from public;
revoke all on function public.onboarding_es_admin(uuid) from public;
grant execute on function public.onboarding_es_miembro(uuid) to authenticated, anon, service_role;
grant execute on function public.onboarding_es_admin(uuid) to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------
-- 1) Reporte de actividad por unidad, agrupado por día, por mes o total.
--
--    p_agrupar: 'dia'   -> una fila por unidad y día   ('2026-11-05')
--               'mes'   -> una fila por unidad y mes   ('2026-11')
--               'unidad'-> una fila por unidad en todo el rango (periodo null)
--
--    Aviso PostgREST: 39 unidades x 31 días = 1209 filas > 1000. La consola
--    usa 'mes' cuando el rango supera ~40 días y 'unidad' para los totales
--    que consume el resumen de IA; p_limita corta el exceso de forma ordenada.
--
--    Unidades en cero (obs. I y II): las unidades SIN posiciones en el rango
--    (taller / mantenimiento) salen con todos los conteos en 0; el detalle y
--    el porqué de no romper el tope de 1000 están en la cabecera del archivo.
--    Este es también el dato del Reporte 15 "Eventos resumidos"
--    (src/components/gestion/fleet/FleetEventsSummary.jsx), que la llama con
--    p_agrupar = 'unidad': ahí una unidad en cero aparece con Stop = rango
--    completo e Idle = Drive = 0.
--
--    Aviso de rendimiento: SIEMPRE conviene mandar p_desde / p_hasta (el
--    índice agrotrack_posiciones_empresa_fecha_idx recorta el rango). Con
--    rango nulo la función recorre las +103 mil filas completas: ahí estaba
--    el statement timeout de 8 s de Supabase.
-- ---------------------------------------------------------------------------
drop function if exists public.agrotrack_actividad_flota(uuid, timestamptz, timestamptz, text, text, integer);

create function public.agrotrack_actividad_flota(
  p_empresa_id uuid,
  p_desde      timestamptz default null,
  p_hasta      timestamptz default null,
  p_placa      text        default null,
  p_agrupar    text        default 'dia',
  p_limite     integer     default 1000
)
returns table (
  periodo            text,          -- 'YYYY-MM-DD' | 'YYYY-MM' | null (total)
  placa              text,
  unidad             text,
  km_recorridos      numeric,       -- recorrido del periodo
  encendido_segundos bigint,        -- horas de encendido del motor
  viaje_segundos     bigint,        -- hora de viaje
  ralenti_segundos   bigint,        -- tiempo en ralentí
  vel_max_kmh        numeric,       -- velocidad máxima punta
  alertas            bigint,        -- alta velocidad (apertura) + botón de pánico
  posiciones         bigint         -- puntos leídos (densidad del reporte)
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- ---------------------------------------------------------------------------
  -- CRITERIO 14/11/2026 (diferencia de ~10 % contra Zonar, observaciones I y II):
  --   1) Cada tramo entre dos reportes toma el estado del punto donde EMPIEZA
  --      (como Zonar: un estado dura hasta el siguiente evento). Antes tomaba
  --      el del punto final, y el tiempo estacionado previo a una
  --      "Ignición Encendida" se contaba como motor prendido.
  --   2) Corte de días y horas exacto: se leen también los 10 minutos antes de
  --      p_desde y después de p_hasta, y cada tramo se RECORTA al rango. Así el
  --      tramo que cruza la medianoche se reparte entre los dos días en vez de
  --      perderse, y un rango 08:00–12:00 suma exactamente esas horas.
  -- ---------------------------------------------------------------------------
  with base as (
    select
      p.id, p.placa, p.unidad, p.fecha, p.secuencia, p.evento,
      p.velocidad, p.latitud, p.longitud,
      ((p_desde is null or p.fecha >= p_desde)
        and (p_hasta is null or p.fecha <= p_hasta))              as en_rango
    from public.agrotrack_posiciones p
    -- Misma regla que la RLS, evaluada UNA sola vez: un no-miembro ve 0 filas.
    where (select public.onboarding_es_miembro(p_empresa_id))
      and p.empresa_id = p_empresa_id
      and (p_placa is null or p.placa = p_placa)
      -- 10 minutos de margen a cada lado: el tramo que cruza el borde existe.
      and (p_desde is null or p.fecha >= p_desde - interval '10 minutes')
      and (p_hasta is null or p.fecha <= p_hasta + interval '10 minutes')
  ),
  -- Estado de cada punto según el criterio único de la cabecera.
  puntos as (
    select
      b.*,
      (not (lower(b.evento) like '%estacionad%'
         or lower(b.evento) like '%apagad%'))                    as encendido,
      (not (lower(b.evento) like '%estacionad%'
         or lower(b.evento) like '%apagad%'))
        and coalesce(b.velocidad, 0) > 5                         as es_viaje
    from base b
  ),
  tramos as (
    select
      q.*,
      lag(q.latitud)                over ventana as prev_lat,
      lag(q.longitud)               over ventana as prev_lon,
      lag(q.fecha)                  over ventana as prev_fecha,
      lag(coalesce(q.secuencia, 0)) over ventana as prev_sec,
      lag(q.encendido)              over ventana as prev_encendido,
      lag(q.es_viaje)               over ventana as prev_viaje
    from puntos q
    window ventana as (
      partition by q.placa
      order by q.fecha, coalesce(q.secuencia, 0), q.id
    )
  ),
  calculado as (
    select
      t.*,
      (t.prev_fecha is not null
        and t.prev_fecha = t.fecha
        and coalesce(t.secuencia, 0) = coalesce(t.prev_sec, 0))  as es_duplicado,
      -- Duración bruta del tramo (null = sin continuidad: hueco > 10 min).
      case
        when t.prev_fecha is null then null
        when t.prev_fecha = t.fecha
          and coalesce(t.secuencia, 0) = coalesce(t.prev_sec, 0) then 0
        when extract(epoch from (t.fecha - t.prev_fecha)) > 600 then null
        else extract(epoch from (t.fecha - t.prev_fecha))
      end                                                        as dt_bruto,
      -- Parte del tramo que cae DENTRO del rango pedido.
      case
        when t.prev_fecha is null then null
        when extract(epoch from (t.fecha - t.prev_fecha)) > 600 then null
        else greatest(0, extract(epoch from (
               least(t.fecha, coalesce(p_hasta, t.fecha))
               - greatest(t.prev_fecha, coalesce(p_desde, t.prev_fecha)))))
      end                                                        as dt_segundos,
      -- Inicio del tramo (recortado): decide en qué día/mes cae.
      case
        when t.prev_fecha is null then t.fecha
        else greatest(t.prev_fecha, coalesce(p_desde, t.prev_fecha))
      end                                                        as fecha_ref,
      case
        when t.prev_lat is null or t.prev_fecha is null then null
        when t.prev_fecha = t.fecha
          and coalesce(t.secuencia, 0) = coalesce(t.prev_sec, 0) then null
        when extract(epoch from (t.fecha - t.prev_fecha)) > 600 then null
        else 2.0 * 6371.0 * asin(least(1.0, sqrt(
          power(sin(radians(t.latitud - t.prev_lat) / 2.0), 2) +
          cos(radians(t.prev_lat)) * cos(radians(t.latitud)) *
          power(sin(radians(t.longitud - t.prev_lon) / 2.0), 2)
        )))
      end                                                        as dist_bruta
    from tramos t
  ),
  -- Solo filas que aportan: un punto dentro del rango o un tramo que entra en él.
  utiles as (
    select
      c.*,
      -- km del tramo proporcional a la parte que cae dentro del rango
      case
        when c.dist_bruta is null or c.dist_bruta >= 5 then 0::double precision
        when coalesce(c.dt_bruto, 0) <= 0 then case when c.en_rango then c.dist_bruta else 0 end
        else c.dist_bruta * least(1.0, coalesce(c.dt_segundos, 0) / c.dt_bruto)
      end                                                        as dist_km
    from calculado c
    where c.en_rango or coalesce(c.dt_segundos, 0) > 0
  ),
  -- ---------------------------------------------------------------------------
  -- AGREGADO: una fila por (periodo, placa) con datos en el rango.
  -- ---------------------------------------------------------------------------
  agregado as (
    select
      case
        when lower(coalesce(p_agrupar, 'dia')) = 'unidad' then null
        when lower(p_agrupar) = 'mes'
          then to_char(c.fecha_ref at time zone 'America/Lima', 'YYYY-MM')
        else to_char(c.fecha_ref at time zone 'America/Lima', 'YYYY-MM-DD')
      end                                                as periodo,
      c.placa                                            as placa,
      max(c.unidad)                                      as unidad,
      coalesce(round(sum(c.dist_km)::numeric, 2), 0)     as km_recorridos,
      -- El tramo toma el estado del punto donde empieza (prev_*).
      coalesce((sum(c.dt_segundos) filter (where c.prev_encendido))::bigint, 0) as encendido_segundos,
      coalesce((sum(c.dt_segundos) filter (where c.prev_viaje))::bigint, 0)     as viaje_segundos,
      coalesce((sum(c.dt_segundos) filter (where c.prev_encendido and not c.prev_viaje))::bigint, 0)
                                                                              as ralenti_segundos,
      max(c.velocidad) filter (where c.en_rango)         as vel_max_kmh,
      count(*) filter (
        where c.en_rango
          and not c.es_duplicado
          and (
            (lower(c.evento) like '%alta velocidad%'
              and lower(c.evento) not like 'fin%')
            or lower(c.evento) like '%pánico%'
            or lower(c.evento) like '%panico%'
          )
      )                                                  as alertas,
      count(*) filter (where c.en_rango)                 as posiciones
    from utiles c
    group by 1, c.placa
  ),
  -- ---------------------------------------------------------------------------
  -- UNIVERSO de placas (observación I/II): histórico COMPLETO de la empresa
  -- sin filtro de rango, para que una unidad en taller/mantenimiento (sin una
  -- sola posición en el rango) también salga en el reporte. Respetan la
  -- membresía y el filtro p_placa igual que el resto de la función.
  -- ---------------------------------------------------------------------------
  universo as (
    select p.placa, max(p.unidad) as unidad
    from public.agrotrack_posiciones p
    -- Misma regla que la RLS, evaluada UNA sola vez: un no-miembro ve 0 filas.
    where (select public.onboarding_es_miembro(p_empresa_id))
      and p.empresa_id = p_empresa_id
      and (p_placa is null or p.placa = p_placa)
    group by p.placa
  ),
  -- Unidades sin NINGUNA posición en el rango: las candidatas a fila en cero.
  sin_datos as (
    select u.placa, u.unidad
    from universo u
    where not exists (select 1 from agregado a where a.placa = u.placa)
  ),
  -- Periodos que deben aparecer en cero (ver la cabecera del archivo):
  --   'unidad' -> una sola clave con periodo null;
  --   'dia'/'mes' -> los periodos con datos UNION los días/meses del rango
  --   pedido (si p_desde y p_hasta están acotados; con rango abierto no se
  --   pueden inventar fechas y solo valen los periodos con datos).
  --   generate_series con límites null devuelve 0 filas (no es error), así
  --   que el guard con p_desde/p_hasta basta.
  periodos as (
    select null::text as periodo
    where lower(coalesce(p_agrupar, 'dia')) = 'unidad'
    union
    select periodo from (
      select a.periodo from agregado a where a.periodo is not null
      union
      select to_char(g at time zone 'America/Lima',
                     case when lower(coalesce(p_agrupar, 'dia')) = 'mes'
                          then 'YYYY-MM' else 'YYYY-MM-DD' end)
      from generate_series(
        p_desde, p_hasta,
        case when lower(coalesce(p_agrupar, 'dia')) = 'mes'
             then interval '1 month' else interval '1 day' end
      ) g
      where p_desde is not null
        and p_hasta is not null
        and lower(coalesce(p_agrupar, 'dia')) <> 'unidad'
    ) t
  ),
  -- Claves en cero: cada unidad sin datos x cada periodo que corresponde.
  claves_cero as (
    select s.placa, s.unidad, t.periodo
    from sin_datos s
    cross join periodos t
  ),
  filas as (
    select
      a.periodo, a.placa, a.unidad, a.km_recorridos, a.encendido_segundos,
      a.viaje_segundos, a.ralenti_segundos, a.vel_max_kmh, a.alertas, a.posiciones
    from agregado a
    union all
    -- Fila en cero: km/encendido/viaje/ralentí/alertas 0, vel_max null
    -- (nunca hubo posición que mida) y posiciones 0 => cero tramos.
    select
      z.periodo, z.placa, z.unidad,
      0::numeric, 0::bigint, 0::bigint, 0::bigint, null::numeric, 0::bigint, 0::bigint
    from claves_cero z
  )
  select
    f.periodo                                             as periodo,
    f.placa                                               as placa,
    f.unidad                                              as unidad,
    f.km_recorridos                                       as km_recorridos,
    f.encendido_segundos                                  as encendido_segundos,
    f.viaje_segundos                                      as viaje_segundos,
    f.ralenti_segundos                                    as ralenti_segundos,
    f.vel_max_kmh                                         as vel_max_kmh,
    f.alertas                                             as alertas,
    f.posiciones                                          as posiciones
  from filas f
  -- Único ORDER BY + LIMIT del conjunto unido: es el que garantiza que nunca
  -- se superen las 1000 filas de PostgREST (las filas en cero compiten por el
  -- mismo tope y el periodo descendente conserva primero lo más reciente).
  order by 1 desc nulls last, f.placa
  limit greatest(coalesce(p_limite, 1000), 1);
$$;

grant execute on function public.agrotrack_actividad_flota(uuid, timestamptz, timestamptz, text, text, integer)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Comprobaciones (opcionales):
--   select * from public.agrotrack_actividad_flota('<empresa_id>',
--     '2026-11-01T00:00:00-05:00', '2026-11-01T23:59:59-05:00', null, 'dia');
--   select * from public.agrotrack_actividad_flota('<empresa_id>',
--     '2026-11-01T00:00:00-05:00', '2026-11-30T23:59:59-05:00', null, 'mes');
--   select * from public.agrotrack_actividad_flota('<empresa_id>',
--     null, null, null, 'unidad');
--   -- coherencia: encendido = viaje + ralentí en todas las filas
--   select count(*) from public.agrotrack_actividad_flota('<empresa_id>')
--     where encendido_segundos <> viaje_segundos + ralenti_segundos;
-- ---------------------------------------------------------------------------
