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
const LIMITE_ALERTAS = 500;

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

  // Cronómetro: cada RPC con su duración, para detectar timeouts.
  const medir = async (nombre, params) => {
    const inicio = Date.now();
    const { data, error } = await supabase.rpc(nombre, params);
    const ms = Date.now() - inicio;
    console.log(`  ⏱  ${nombre}: ${ms} ms${error ? `  [ERROR ${error.code}] ${error.message}` : ''}`);
    if (error) return { error, ms };
    return { data, ms };
  };

  console.log('Tiempos por RPC:');
  const conteoTabla = await supabase
    .from('agrotrack_posiciones')
    .select('id', { count: 'exact', head: true });
  console.log(
    `  ⏱  scan agrotrack_posiciones (count con RLS): ${conteoTabla.count ?? '-'} filas` +
      (conteoTabla.error ? ` [ERROR] ${conteoTabla.error.message}` : '')
  );

  const periodo = await medir('agrotrack_periodo_flota', { p_empresa_id: empresaId });
  if (periodo.error) return fallo('agrotrack_periodo_flota', periodo.error);
  console.log('Periodo:', periodo.data?.[0] || 'sin filas');

  const eventos = await medir('agrotrack_conteo_eventos', { p_empresa_id: empresaId });
  if (eventos.error) return fallo('agrotrack_conteo_eventos', eventos.error);
  console.log('\nEventos (evento → total):');
  for (const fila of eventos.data || []) console.log(`  ${fila.evento} → ${fila.total}`);

  const resumen = await medir('agrotrack_resumen_flota', { p_empresa_id: empresaId });
  if (resumen.error) return fallo('agrotrack_resumen_flota', resumen.error);
  console.log(`\nResumen: ${resumen.data?.length || 0} unidades`);
  for (const fila of (resumen.data || []).slice(0, 10)) {
    console.log(
      `  ${fila.placa} | ${fila.ultimo_evento} | ${fila.ultima_fecha} | ` +
        `${fila.ultima_velocidad ?? '-'} km/h | ${fila.km_recorridos} km | altas: ${fila.eventos_alta_velocidad}`
    );
  }
  const kmTotal = (resumen.data || []).reduce((suma, fila) => suma + Number(fila.km_recorridos || 0), 0);
  const altasTotal = (resumen.data || []).reduce((suma, fila) => suma + Number(fila.eventos_alta_velocidad || 0), 0);
  console.log(`  Suma de km: ${kmTotal.toFixed(1)} km | Suma de altas: ${altasTotal}`);

  const alertas = await medir('agrotrack_alertas_flota', {
    p_empresa_id: empresaId,
    p_limite: LIMITE_ALERTAS,
  });
  if (alertas.error) return fallo('agrotrack_alertas_flota', alertas.error);
  console.log(`\nAlertas: ${alertas.data?.length || 0} (tope ${LIMITE_ALERTAS})`);
  for (const fila of (alertas.data || []).slice(0, 6)) {
    console.log(`  ${fila.fecha} | ${fila.placa} | ${fila.evento} | ${fila.velocidad ?? '-'} km/h`);
  }

  console.log('\nListo.');
}

main().catch((error) => fallo('Error inesperado', error));
