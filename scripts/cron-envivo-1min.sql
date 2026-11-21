-- ---------------------------------------------------------------------------
-- cron-envivo-1min.sql
-- Idempotente · ejecutar en el SQL Editor de Supabase.
--
-- Programa la Edge Function `envivo-rapido` (foto de Zonar cada 1 MINUTO:
-- solo GetUnitsLocator, ~3-5 s) con el mismo mecanismo que `envivo`:
-- pg_cron + net.http_post con header x-cron-secret.
--
-- ANTES DE EJECUTAR: reemplaza REEMPLAZA_CRON_SECRET con el valor real del
-- secret CRON_SECRET (supabase secrets list). NUNCA lo subas al repositorio.
--
-- Si la función no existe, el cron fallará con 404/401 sin romper nada:
--   select cron.unschedule('agrilux-envivo-1min');
--
-- Nota: el cron en producción se creó con este mismo contenido; volver a
-- ejecutarlo lo reprograma con el mismo nombre (cron.schedule con el mismo
-- jobname reemplaza el anterior).
-- ---------------------------------------------------------------------------

select cron.schedule(
  'agrilux-envivo-1min',
  '*/1 * * * *',
  $$
  select net.http_post(
    url := 'https://rtznwwggggjcjfjzqsax.supabase.co/functions/v1/envivo-rapido',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','REEMPLAZA_CRON_SECRET'),
    body := '{}'::jsonb,
    timeout_milliseconds := 50000
  )
  $$
);
