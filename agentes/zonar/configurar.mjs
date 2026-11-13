#!/usr/bin/env node
/**
 * agentes/zonar/configurar.mjs
 * Asistente que guarda las credenciales del agente en
 * %APPDATA%\agrilux-zonar\config.json (FUERA del repo) y verifica que
 * funcionen antes de terminar.
 *
 * Uso:  node configurar.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import { guardarConfig, RUTAS, asegurarCarpetas } from './src/config.js';
import { loginZonar } from './src/zonar.js';
import { conectarAgrilux } from './src/agrilux.js';

/** Pregunta por stdin; si ocultar=true no ecoa lo que se escribe (contraseñas). */
function preguntar(pregunta, { ocultar = false, defecto = '' } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    process.stdout.write(`${pregunta}${defecto ? ` [${defecto}]` : ''}: `);
    if (ocultar) {
      // No ecoar las teclas; solo cerramos línea cuando se pulsa Enter.
      rl._writeToOutput = (s) => {
        if (s === '\n' || s === '\r' || s === '\r\n') process.stdout.write('\n');
      };
    }
    rl.question('', (respuesta) => {
      rl.close();
      const valor = String(respuesta ?? '').trim();
      resolve(valor || defecto);
    });
  });
}

/** Lee .env del repo (si existe) para precargar URL y anon key de Supabase. */
function precargarSupabase() {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i += 1) {
    const env = path.join(dir, '.env');
    if (fs.existsSync(env)) {
      const texto = fs.readFileSync(env, 'utf8');
      const url = texto.match(/^VITE_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
      const key = texto.match(/^VITE_SUPABASE_ANON_KEY=(.+)$/m)?.[1]?.trim();
      if (url && key) return { url, key };
    }
    const padre = path.dirname(dir);
    if (padre === dir) break;
    dir = padre;
  }
  return { url: '', key: '' };
}

async function main() {
  asegurarCarpetas();
  console.log('═'.repeat(64));
  console.log(' Configuración del agente Zonar → Agrilux');
  console.log(` Se guarda en: ${RUTAS.config}`);
  console.log(' (ese archivo queda fuera del repo y está ignorado por git)');
  console.log('═'.repeat(64));

  const supa = precargarSupabase();

  const cfg = {
    zonar: {
      base: 'https://app.tsomobile.com',
      api: 'https://rest.tsomobile.com',
      appid: 38,
      lang: 'es',
      usuario: await preguntar('Usuario de Zonar (app.tsomobile.com)'),
      password: await preguntar('Contraseña de Zonar', { ocultar: true }),
    },
    agrilux: {
      url: await preguntar('URL de Supabase de Agrilux', { defecto: supa.url }),
      anon_key: await preguntar('Anon key de Supabase', { defecto: supa.key }),
      email: await preguntar('Correo de Agrilux'),
      password: await preguntar('Contraseña de Agrilux', { ocultar: true }),
      empresa_id: await preguntar('Empresa ID (vacío = la primera de tus membresías)', { defecto: '' }),
    },
    corrida: {
      hora: '05:30',
      fecha_modo: 'auto',
      delay_ms: 400,
      guardar_json: true,
      reten_dias: 30,
      max_unidades: 0,
    },
  };

  if (!cfg.zonar.usuario || !cfg.zonar.password) throw new Error('Faltan las credenciales de Zonar.');
  if (!cfg.agrilux.url || !cfg.agrilux.anon_key || !cfg.agrilux.email || !cfg.agrilux.password) {
    throw new Error('Faltan datos de Agrilux/Supabase.');
  }

  guardarConfig(cfg);
  console.log(`\nGuardado en ${RUTAS.config}`);

  // Verificación rápida de ambas sesiones.
  console.log('\nVerificando credenciales…');
  try {
    const sesion = await loginZonar(cfg.zonar);
    console.log(`  ✓ Zonar: sesión OK (${sesion.fullname || cfg.zonar.usuario})`);
  } catch (e) {
    console.log(`  ✗ Zonar: ${e.message}`);
  }
  try {
    const agrilux = await conectarAgrilux(cfg.agrilux);
    console.log(`  ✓ Agrilux: sesión OK · empresa ${agrilux.empresaId}`);
  } catch (e) {
    console.log(`  ✗ Agrilux: ${e.message}`);
  }

  console.log('\nSiguientes pasos:');
  console.log('  1) node agente.mjs descubrir     (diagnóstico de la primera corrida)');
  console.log('  2) node agente.mjs correr --probar   (1 unidad, sin riesgo)');
  console.log('  3) node agente.mjs correr         (todo el día anterior)');
  console.log('  4) instalar-tarea.bat             (automático cada día a las 05:30)');
}

main().catch((e) => {
  console.error(`\n[ERROR] ${e.message}`);
  process.exitCode = 1;
});
