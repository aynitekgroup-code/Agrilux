/**
 * scripts/verificar-resumen-flota.mjs
 * Comprueba que las RPC de scripts/agrotrack-posiciones-resumen.sql existen y
 * devuelven datos. No modifica nada (solo lecturas con la service role key).
 *
 * Uso:
 *   node scripts/verificar-resumen-flota.mjs
 *   node scripts/verificar-resumen-flota.mjs --empresa=<uuid>
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';

function leerEnv() {
  const env = {};
  if (!existsSync('.env')) return env;
  for (const linea of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const match = linea.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = leerEnv();
const url = env.VITE_SUPABASE_URL;
const clave = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !clave) {
  console.error('Falta VITE_SUPABASE_URL o la service role key en .env');
  process.exit(1);
}

const empresaArg = process.argv.find((arg) => arg.startsWith('--empresa='));
const empresaSolicitada = empresaArg ? empresaArg.split('=')[1] : null;

const supabase = createClient(url, clave, { auth: { persistSession: false } });

function fallo(contexto, error) {
  console.error(`\n[ERROR] ${contexto}`);
  console.error(`  código: ${error?.code || '-'}`);
  console.error(`  mensaje: ${error?.message || error}`);
  if (/could not find the function|does not exist/i.test(String(error?.message || ''))) {
    console.error('  → Ejecuta scripts/agrotrack-posiciones-resumen.sql en el SQL Editor de Supabase.');
  }
  process.exitCode = 1;
}

async function main() {
  let empresaId = empresaSolicitada;
  if (!empresaId) {
    const { data, error } = await supabase
      .from('agrotrack_posiciones')
      .select('empresa_id')
      .limit(1);
    if (error) return fallo('No se pudo leer agrotrack_posiciones', error);
    empresaId = data?.[0]?.empresa_id;
    if (!empresaId) {
      console.log('La tabla agrotrack_posiciones está vacía: no hay nada que verificar.');
      return;
    }
  }
  console.log(`Empresa: ${empresaId}\n`);

  const { data: periodo, error: errPeriodo } = await supabase.rpc('agrotrack_periodo_flota', {
    p_empresa_id: empresaId,
  });
  if (errPeriodo) return fallo('agrotrack_periodo_flota', errPeriodo);
  console.log('Periodo:', periodo?.[0] || 'sin filas');

  const { data: eventos, error: errEventos } = await supabase.rpc('agrotrack_conteo_eventos', {
    p_empresa_id: empresaId,
  });
  if (errEventos) return fallo('agrotrack_conteo_eventos', errEventos);
  console.log('\nEventos (evento → total):');
  for (const fila of eventos || []) console.log(`  ${fila.evento} → ${fila.total}`);

  const { data: resumen, error: errResumen } = await supabase.rpc('agrotrack_resumen_flota', {
    p_empresa_id: empresaId,
  });
  if (errResumen) return fallo('agrotrack_resumen_flota', errResumen);
  console.log(`\nResumen: ${resumen?.length || 0} unidades`);
  for (const fila of (resumen || []).slice(0, 10)) {
    console.log(
      `  ${fila.placa} | ${fila.ultimo_evento} | ${fila.ultima_fecha} | ` +
        `${fila.ultima_velocidad ?? '-'} km/h | ${fila.km_recorridos} km | altas: ${fila.eventos_alta_velocidad}`
    );
  }
  const kmTotal = (resumen || []).reduce((suma, fila) => suma + Number(fila.km_recorridos || 0), 0);
  console.log(`  Suma de km: ${kmTotal.toFixed(1)} km`);

  const { data: alertas, error: errAlertas } = await supabase.rpc('agrotrack_alertas_flota', {
    p_empresa_id: empresaId,
    p_limite: 10,
  });
  if (errAlertas) return fallo('agrotrack_alertas_flota', errAlertas);
  console.log(`\nAlertas: ${alertas?.length || 0} (máx. 10)`);
  for (const fila of alertas || []) {
    console.log(`  ${fila.fecha} | ${fila.placa} | ${fila.evento} | ${fila.velocidad ?? '-'} km/h`);
  }

  console.log('\nListo. Si el conteo de eventos no incluye "Alta velocidad" / "Botón de pánico",');
  console.log('ajusta el filtro de agrotrack_alertas_flota en scripts/agrotrack-posiciones-resumen.sql.');
}

main().catch((error) => fallo('Error inesperado', error));
