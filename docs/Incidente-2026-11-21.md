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
