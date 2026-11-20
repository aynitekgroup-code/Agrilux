// scripts/subir-apk-supabase.mjs
// Sube public/agrilux.apk al bucket 'apk' de Supabase para que la página
// /descargar la ofrezca de inmediato (sin esperar push/deploy).
// Uso: node scripts/subir-apk-supabase.mjs [ruta-apk]
import { readFileSync, existsSync, statSync } from 'node:fs';
import { basename } from 'node:path';

function loadEnv(path = '.env') {
  const env = {};
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

const apkPath = process.argv[2] || 'public/agrilux.apk';
if (!existsSync(apkPath)) {
  console.error('No existe:', apkPath);
  process.exit(1);
}
const buf = readFileSync(apkPath);
const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
const fileName = `agrilux-v2-${stamp}-${Date.now().toString().slice(-6)}.apk`;
console.log(`Subiendo ${(buf.length / 1048576).toFixed(1)} MB como ${fileName} ...`);

const up = await fetch(`${SUPABASE_URL}/storage/v1/object/apk/${fileName}`, {
  method: 'POST',
  headers: {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/vnd.android.package-archive',
    'x-upsert': 'false',
  },
  body: buf,
});
if (!up.ok) {
  console.error('Upload falló:', up.status, await up.text());
  process.exit(1);
}
console.log('Upload OK:', up.status);

const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/apk/${fileName}`;
const head = await fetch(publicUrl, { method: 'HEAD' });
console.log('HEAD public URL status:', head.status);
console.log('URL pública:', publicUrl);
console.log('Archivo en bucket:', basename(fileName));
