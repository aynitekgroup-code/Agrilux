# Incidente 21/11/2026 — geocercas no cargaban / flota dejó de actualizar en tiempo real

## Síntoma

- El mapa/reportes dejaron de dibujar geocercas de forma fiable.
- El tiempo real de la flota se quedaba “congelado”.
- Logs de Postgres: `canceling statement due to statement timeout` cada ~8 s en
  `public.agrotrack_calcular_visitas_dia`; cola `agrotrack_visitas_dia_pendientes`
  creciendo (61 pendientes) y errores en API Gateway/Realtime.

## Causa raíz

1. El cron de 1 min y la RPC `agrotrack_estado_vivo_flota` saturaban conexiones
   (corregido antes con `scripts/optimizar-estado-vivo-flota.sql`).
2. El motor `public.agrotrack_visitas_geocerca_calc` tenía `security definer` y
   `set search_path = public, extensions, pg_catalog, pg_temp`. Cualquiera de esas
   cláusulas impide que PostgreSQL **inlinee** una función SQL: se ejecutaba como
   `Function Scan` opaca, sin usar el índice `(empresa_id, placa, fecha)`.
   Medido: **13,3 s por placa** → timeout de 8 s del cron. La misma consulta como
   SQL inlineado tarda **0,14-0,9 s**.

No era RLS: con el usuario de prueba (`42a04b5a-…`),
`onboarding_es_miembro(empresa) = true` y `agrotrack_geocercas` devuelve 178 filas.
El `0` visto en el SQL Editor era un artefacto de no tener `auth.uid()`.

## Corrección aplicada

- `scripts/agrotrack-geocercas-reportes.sql`: el motor pasa a `language sql`,
  sin `security definer` ni `set search_path`, con PostGIS esquematizado
  (`extensions.ST_Contains`). La membresía la siguen validando las RPC públicas
  que lo llaman.
- `scripts/corregir-timeout-visitas-geocerca.sql`: parche idempotente para la BD
  ya desplegada (reconstruye la función desde su `prosrc` actual).
- `scripts/agrotrack-rendimiento.sql`: nueva verificación para detectar
  regresiones (`prosecdef` o `proconfig` en el motor).
- `CRON_SECRET` rotado (estaba expuesto en `cron.job.command`) y ambos crons
  actualizados: `agrilux-envivo-5min` (`*/5`) y `agrilux-envivo-1min` (`*/1`).

## Verificación

- `agrotrack_visitas_geocerca_calc` para `1414-1K`, `BPI-733`, `BVN-736`, etc.:
  **8-859 ms** por placa (antes 13.000 ms).
- `agrotrack_calcular_visitas_dia` simulando usuario autenticado: **437 ms**,
  sin errores de permisos.
- Pendientes de visitas: **61 → 15** (los 15 restantes son del día en curso).
- Logs de Postgres: desaparecieron los `canceling statement due to statement timeout`.
- `agrotrack_estado_vivo = 44` unidades; Realtime publica
  `agrotrack_estado_vivo`, `agrotrack_geocerca_eventos`,
  `agrotrack_geocerca_visitas` y `agrotrack_zonar_latidos`.
- Llamada a `envivo-rapido` con el nuevo secreto: `200 {"ok":true,"unidades":44,...}`;
  con el secreto anterior: `401`.
- Objetos temporales de diagnóstico eliminados (`debug_visitas*`, `debug_timings`).

## Pendiente

- Validación visual en producción con credenciales de usuario (la URL pública
  redirige a `/registro` cuando no hay sesión).

---

# Incidente 21/11/2026 (2ª parte) — `57014` en “Entradas y salidas” y “Tiempo en cada lote”

## Síntoma

En la pestaña *Geocercas* de `gestion/vehiculos-flota`, con el usuario de prueba
de Pomalca, ambos reportes mostraban “No se pudo cargar el reporte”:

- `POST /api/supabase-proxy/rest/v1/rpc/agrotrack_eventos_geocerca_flota`
  → `500 {"code":"57014","message":"canceling statement due to statement timeout"}`
  en ~8,5 s.
- `POST /api/supabase-proxy/rest/v1/rpc/agrotrack_actividad_flota` con un rango
  de 7 días → el mismo `57014`.

## Causa raíz (confirmada con `EXPLAIN ANALYZE` sobre la BD real)

1. Las dos RPC eran `language sql` con `security definer` +
   `set search_path = public, pg_temp`. Eso impide el *inlining*: aparecían como
   `Function Scan` opaco con plan genérico. Medido: **44,5 s** en eventos del día.
2. Al quitar `definer`/`search_path` la función ya se inlinaba (1,6 s en SQL
   Editor), pero **PostgREST pasa las fechas como parámetros bind** y el plan
   genérico no usaba el índice de fecha: el CTE `ultimo_antes` hacía un
   `Seq Scan` de ~724.000 filas (**12 s**). `force_custom_plan` no lo resolvió
   (se revirtió).
3. `agrotrack_actividad_flota` procesa ~160.000 posiciones en 7 días con
   funciones de ventana (~9,6 s reales), y su CTE `universo` recorría todo el
   histórico solo para listar las 44 unidades.
4. Los roles de la API (`authenticator`, `authenticated`) tenían
   `statement_timeout = 8s`, por debajo del tiempo real del reporte semanal.
   El timeout de 8 s de `src/lib/supabase.js` es solo de `checkConnection()`;
   las RPC van por el proxy `/api/supabase-proxy` de `vercel.json`.

## Corrección aplicada

`scripts/corregir-timeout-reportes-geocerca.sql` (idempotente, autoridad para
replicar el fix en BD):

- **Eventos**: `agrotrack_eventos_geocerca_flota` reescrita en PL/pgSQL con SQL
  dinámico que incrusta `p_desde`/`p_hasta` como literales (el resto sigue
  parametrizado) para forzar el índice sin depender del plan cache. El CTE
  `ultimo_antes` pasa de `distinct on` sobre todo el histórico a una subconsulta
  correlacionada por placa+geocerca con `LIMIT 1`.
- **Actividad**: cuerpo optimizado en `agrotrack_actividad_flota_sql2`
  (`universo` desde `agrotrack_grupos_unidades`, 44 filas) y wrapper público
  PL/pgSQL que incrusta las fechas como literales antes de llamarlo.
- Ambas funciones: `security invoker` y `search_path` sin configurar.
- `statement_timeout = 20s` para `authenticator` y `authenticated`; se
  terminaron las conexiones abiertas de `authenticator` para que tomaran el
  nuevo valor.
- Se alinearon `scripts/agrotrack-geocercas-reportes.sql` y
  `scripts/agrotrack-reportes-flota.sql` con esta versión final, para que una
  futura ejecución no reintroduzca las definiciones lentas.

## Verificación

- `agrotrack_eventos_geocerca_flota` desde la app: **200**, 29 filas, ~1,5-3 s.
- `agrotrack_actividad_flota` 7 días desde la app: **200**, 40 filas, ~17 s.
- Ya no aparece `57014` en las llamadas de los reportes.
