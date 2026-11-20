-- ============================================
-- RESTAURAR USUARIOS DE AUTH (admin + Carlos)
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query > Run
-- Si algún paso da error, COPIA el mensaje exacto y pégamelo.
-- ============================================

-- PASO 1: Diagnóstico — ¿hay triggers en auth.users que puedan estar rompiendo inserts?
SELECT tgname AS trigger_name, tgenabled AS enabled
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal;

-- PASO 2: Restaurar ADMIN (mismo UUID, password temporal)
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  email_confirmed_at, confirmation_sent_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) VALUES (
  '02e748a6-1969-41d8-8126-88ee07b089ba',
  'authenticated',
  'authenticated',
  'aynitek.group@gmail.com',
  crypt('Agrilux2026!', gen_salt('bf')),
  now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"nombre":"Lumajira agro","email":"aynitek.group@gmail.com","email_verified":true}',
  now(), now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '02e748a6-1969-41d8-8126-88ee07b089ba',
  '02e748a6-1969-41d8-8126-88ee07b089ba',
  '{"sub":"02e748a6-1969-41d8-8126-88ee07b089ba","email":"aynitek.group@gmail.com","email_verified":true}',
  'email',
  now(), now()
)
ON CONFLICT DO NOTHING;

-- PASO 3: Restaurar CARLOS PÉREZ (mismo UUID -> sus datos siguen enlazados)
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  email_confirmed_at, confirmation_sent_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) VALUES (
  'c37aa66a-1d3d-472f-af65-4a52f9ac677f',
  'authenticated',
  'authenticated',
  'visionario2306@gmail.com',
  crypt('Agrilux2026!', gen_salt('bf')),
  now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"nombre":"Carlos Pérez Dávila","email":"visionario2306@gmail.com","email_verified":true}',
  now(), now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'c37aa66a-1d3d-472f-af65-4a52f9ac677f',
  'c37aa66a-1d3d-472f-af65-4a52f9ac677f',
  '{"sub":"c37aa66a-1d3d-472f-af65-4a52f9ac677f","email":"visionario2306@gmail.com","email_verified":true}',
  'email',
  now(), now()
)
ON CONFLICT DO NOTHING;

-- PASO 4: Verificación
SELECT id, email, email_confirmed_at IS NOT NULL AS confirmado, created_at
FROM auth.users
ORDER BY created_at;
