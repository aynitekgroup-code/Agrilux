#!/usr/bin/env node
/**
 * agentes/zonar/agente.mjs
 * Agente local Zonar -> Agrilux (corre en la PC de Carlos; sale con su IP).
 *
 * Uso:
 *   node agente.mjs correr                 descarga lo de AYER y lo ingresa
 *   node agente.mjs correr --probar        solo 1 unidad (prueba de humo)
 *   node agente.mjs correr --desde=2026-11-10 --hasta=2026-11-12
 *   node agente.mjs correr --sin-ingerir   solo descarga los JSON (nada a Agrilux)
 *   node agente.mjs correr --unidades=1414-1K,T-01
 *   node agente.mjs descubrir              primera corrida de diagnóstico
 *   node agente.mjs estado                 último resumen guardado
 *
 * Credenciales: node configurar.mjs  (se guardan en %APPDATA%\agrilux-zonar).
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { RUTAS, cargarConfig, asegurarCarpetas } from './src/config.js';
import { crearLog, ejecutarCorrida } from './src/pipeline.js';
import {
  loginZonar, crudoUnidades, crudoArbolUnidades, crudoHistorial, hoyPeru, restarDias,
} from './src/zonar.js';
import { fechaDesdeJsonZonar, armarFilaZonar } from './lib/parse.js';

function parsear(argv) {
  return parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      desde: { type: 'string' },
      hasta: { type: 'string' },
      unidades: { type: 'string' },
      probar: { type: 'boolean' },
      'sin-ingerir': { type: 'boolean' },
      'sin-guardar': { type: 'boolean' },
      'fecha-modo': { type: 'string' },
    },
  });
}

/* ── descubrir: diagnóstico de la primera corrida ─────────────────────────── */

async function modoDescubrir(cfg, log) {
  const carpeta = RUTAS.descubrimiento;
  const desde = restarDias(hoyPeru(), 1);
  const hasta = desde;

  log.info('Modo descubrir: login + unidades + 1 historial de muestra.');
  const sesion = await loginZonar(cfg.zonar);
  log.info(`Zonar OK (${sesion.fullname || cfg.zonar.usuario}) · userId=${sesion.userId}`);

  // a) Unidades crudas
  const unidades = await crudoUnidades(cfg.zonar, sesion.token);
  fs.writeFileSync(pathJoin(carpeta, 'unidades.json'), JSON.stringify(unidades, null, 1));
  log.info(`Unidades: ${unidades.length} marcadores. Guardado en ${pathJoin(carpeta, 'unidades.json')}`);
  if (unidades[0]) {
    log.info(`  ejemplo: ${JSON.stringify(unidades[0]).slice(0, 400)}`);
    const conUnitId = unidades.filter((u) => u.UnitID !== undefined && u.UnitID !== null).length;
    const conNombre = unidades.filter((u) => String(u.MarkerName || u.Unit || '').trim()).length;
    log.info(`  con UnitID: ${conUnitId}/${unidades.length} · con nombre: ${conNombre}/${unidades.length}`);
  }

  // b) Árbol REST (best-effort, para comparar)
  try {
    const arbol = await crudoArbolUnidades(cfg.zonar, sesion.token);
    fs.writeFileSync(pathJoin(carpeta, 'arbol-unidades.json'), JSON.stringify(arbol, null, 1));
    log.info(`Árbol GROUPSANDUNITS: guardado (${Array.isArray(arbol) ? `${arbol.length} nodos` : typeof arbol}).`);
    if (Array.isArray(arbol) && arbol[0]) log.info(`  ejemplo nodo: ${JSON.stringify(arbol[0]).slice(0, 400)}`);
  } catch (e) {
    log.aviso(`Árbol REST no disponible: ${e.message}`);
  }

  // c) Historial de muestra de la primera unidad
  const muestra = unidades[0];
  if (!muestra) throw new Error('No hay unidades para la muestra.');
  const unitId = muestra.UnitID ?? muestra.unitId ?? muestra.MarkerID;
  const nombre = muestra.MarkerName ?? muestra.Unit ?? String(unitId);
  log.info(`Historial de muestra: ${nombre} (id ${unitId}) · ${desde} → ${hasta}`);
  const marcas = await crudoHistorial(cfg.zonar, sesion.token, { unitId, desde, hasta });
  fs.writeFileSync(pathJoin(carpeta, 'historial-muestra.json'), JSON.stringify(marcas, null, 1));
  log.info(`  ${marcas.length} marcas. Guardado en ${pathJoin(carpeta, 'historial-muestra.json')}`);

  if (marcas.length) {
    const primera = marcas[0];
    log.info(`  claves: ${Object.keys(primera).join(', ')}`);
    const fechas = marcas.slice(0, 5).map((m) => m.LastEventDate ?? m.Date);
    log.info(`  fechas crudas: ${JSON.stringify(fechas)}`);
    log.info(`  fechas normalizadas: ${JSON.stringify(fechas.map((f) => fechaDesdeJsonZonar(f, cfg.corrida.fecha_modo)))}`);

    let ok = 0;
    let malas = 0;
    const ejemplosError = [];
    for (const m of marcas) {
      const { error } = armarFilaZonar(m, 'EMPRESA-PRUEBA', null, { fechaModo: cfg.corrida.fecha_modo });
      if (error) {
        malas += 1;
        if (ejemplosError.length < 5) ejemplosError.push(`${error} → ${JSON.stringify(m).slice(0, 200)}`);
      } else ok += 1;
    }
    log.info(`  filas válidas: ${ok} · inválidas: ${malas}`);
    ejemplosError.forEach((e) => log.aviso(`  inválida: ${e}`));

    const { row } = armarFilaZonar(primera, 'EMPRESA-PRUEBA', 'USER-PRUEBA', { fechaModo: cfg.corrida.fecha_modo });
    if (row) log.info(`  fila de ejemplo: ${JSON.stringify(row).slice(0, 500)}`);
  } else {
    log.aviso('  sin marcas para ese día (¿la unidad estuvo sin reportar?).');
  }

  log.info('Descubrimiento listo. Revisa los archivos y, si el formato de fecha se ve bien,');
  log.info('corre la prueba real:  node agente.mjs correr --probar');
}

/* ── estado ───────────────────────────────────────────────────────────────── */

function modoEstado() {
  if (!fs.existsSync(RUTAS.estado)) {
    console.log('Todavía no hay corridas registradas (no existe estado.json).');
    return;
  }
  console.log(fs.readFileSync(RUTAS.estado, 'utf8'));
}

/* ── main ─────────────────────────────────────────────────────────────────── */

function pathJoin(dir, archivo) {
  return path.join(dir, archivo);
}

async function main() {
  const { values, positionals } = parsear(process.argv.slice(2));
  const comando = (positionals[0] || 'correr').toLowerCase();

  if (comando === 'estado') {
    modoEstado();
    return;
  }

  asegurarCarpetas();
  const cfg = cargarConfig();

  if (values['fecha-modo']) {
    if (!['auto', 'local', 'utc'].includes(values['fecha-modo'])) {
      throw new Error(`--fecha-modo debe ser auto, local o utc (recibido: ${values['fecha-modo']})`);
    }
    cfg.corrida.fecha_modo = values['fecha-modo'];
  }

  const log = crearLog();
  log.info(`Agente Zonar→Agrilux · comando: ${comando} · log: ${log.archivo}`);

  if (comando === 'descubrir') {
    await modoDescubrir(cfg, log);
    return;
  }
  if (comando !== 'correr') {
    throw new Error(`Comando desconocido: "${comando}". Usa: correr | descubrir | estado.`);
  }

  const opts = {
    desde: values.desde || null,
    hasta: values.hasta || null,
    probar: Boolean(values.probar),
    sinIngerir: Boolean(values['sin-ingerir']),
    guardar: values['sin-guardar'] ? false : undefined,
    unidades: values.unidades
      ? values.unidades.split(',').map((s) => s.trim()).filter(Boolean)
      : null,
  };

  const resumen = await ejecutarCorrida(cfg, opts, log);
  if (!resumen.ok && resumen.unidades_ok === 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(`\n[ERROR] ${e.message}`);
  try {
    asegurarCarpetas();
    fs.appendFileSync(
      path.join(RUTAS.logs, 'errores.log'),
      `[${new Date().toISOString()}] ${e.message}\n`,
    );
  } catch {
    /* mejor esfuerzo */
  }
  process.exitCode = 1;
});
