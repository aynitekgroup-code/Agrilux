/**
 * agentes/zonar/src/pipeline.js
 * Corrida del agente: login en Zonar -> listar unidades -> bajar el historial
 * de cada una en el rango -> transformar a filas de agrotrack_posiciones ->
 * subir a Agrilux -> resumen + log.
 *
 * Modos:
 *   correr     : descarga + ingesta (la corrida diaria de las 05:30)
 *   sinIngerir : solo descarga (guarda JSON en %APPDATA%\agrilux-zonar\descargas)
 */
import fs from 'node:fs';
import path from 'node:path';

import { RUTAS, asegurarCarpetas } from './config.js';
import { loginZonar, listarUnidades, historialUnidad, hoyPeru, restarDias, dormir } from './zonar.js';
import { conectarAgrilux, subirPosiciones } from './agrilux.js';
import { armarFilaZonar } from '../lib/parse.js';

const TOPE_AVISO_HISTORIAL = 50000; // el máximo que avisa la UI de Zonar

/** Log a consola + archivo (logs/AAAA-MM-DD.log). */
export function crearLog() {
  asegurarCarpetas();
  const hoy = hoyPeru();
  const archivo = path.join(RUTAS.logs, `${hoy}.log`);
  const escribir = (nivel, partes) => {
    const msg = partes.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ');
    const linea = `[${new Date().toISOString()}] [${nivel}] ${msg}`;
    console.log(linea);
    try {
      fs.appendFileSync(archivo, `${linea}\n`);
    } catch {
      /* el log en archivo es mejor esfuerzo */
    }
  };
  return {
    archivo,
    info: (...p) => escribir('INFO', p),
    aviso: (...p) => escribir('AVISO', p),
    error: (...p) => escribir('ERROR', p),
  };
}

function escribirEstado(resumen) {
  try {
    fs.writeFileSync(RUTAS.estado, `${JSON.stringify(resumen, null, 2)}\n`);
  } catch {
    /* mejor esfuerzo */
  }
}

/** Borra descargas con más de N días (retención configurable). */
function limpiarDescargas(retenDias) {
  if (!retenDias || retenDias <= 0) return;
  const limite = Date.now() - retenDias * 24 * 3600 * 1000;
  try {
    for (const entrada of fs.readdirSync(RUTAS.descargas, { withFileTypes: true })) {
      if (!entrada.isDirectory()) continue;
      const ruta = path.join(RUTAS.descargas, entrada.name);
      const st = fs.statSync(ruta);
      if (st.mtimeMs < limite) fs.rmSync(ruta, { recursive: true, force: true });
    }
  } catch {
    /* mejor esfuerzo */
  }
}

/**
 * Ejecuta una corrida completa.
 * @param {object} cfg config validado
 * @param {object} opts { desde, hasta, unidades (ids), soloUnidades, probar, sinIngerir, guardar }
 * @param {object} log
 */
export async function ejecutarCorrida(cfg, opts, log) {
  const t0 = Date.now();
  const desde = opts.desde || restarDias(hoyPeru(), 1);
  const hasta = opts.hasta || desde;
  const sinIngerir = Boolean(opts.sinIngerir);

  const resumen = {
    inicio: new Date().toISOString(),
    rango: { desde, hasta },
    modo: sinIngerir ? 'solo-descarga' : 'descarga+ingesta',
    zonar_usuario: cfg.zonar.usuario,
    unidades_total: 0,
    unidades_ok: 0,
    unidades_sin_datos: 0,
    unidades_con_error: 0,
    marcas: 0,
    filas: 0,
    filas_invalidas: 0,
    ejemplos_invalidos: [],
    nuevas: 0,
    empresa_id: null,
    errores: [],
    ok: false,
  };

  log.info(`Corrida ${resumen.modo} · rango ${desde} → ${hasta} · modo fecha: ${cfg.corrida.fecha_modo}`);

  // 1) Login en Zonar (desde la IP de esta máquina).
  const sesion = await loginZonar(cfg.zonar);
  log.info(`Zonar: sesión iniciada (${sesion.fullname || cfg.zonar.usuario}).`);

  // 2) Unidades.
  let unidades = await listarUnidades(cfg.zonar, sesion.token);
  if (cfg.corrida.max_unidades > 0) unidades = unidades.slice(0, cfg.corrida.max_unidades);
  if (opts.unidades?.length) {
    const filtro = new Set(opts.unidades.map(String));
    unidades = unidades.filter((u) => filtro.has(String(u.unitId)) || filtro.has(u.nombre.toUpperCase()));
  }
  if (opts.probar) unidades = unidades.slice(0, 1);
  resumen.unidades_total = unidades.length;
  log.info(`Zonar: ${unidades.length} unidad${unidades.length === 1 ? '' : 'es'} para bajar.`);

  // 3) Sesión de Agrilux (si vamos a ingerir).
  let agrilux = null;
  if (!sinIngerir) {
    agrilux = await conectarAgrilux(cfg.agrilux);
    resumen.empresa_id = agrilux.empresaId;
    log.info(`Agrilux: sesión iniciada · empresa ${agrilux.empresaId}.`);
  }

  // 4) Bajar historial unidad por unidad.
  const todasLasFilas = [];
  const carpetaDia = path.join(RUTAS.descargas, `${desde}_a_${hasta}`);
  const guardar = opts.guardar ?? cfg.corrida.guardar_json;
  if (guardar) fs.mkdirSync(carpetaDia, { recursive: true });

  for (let i = 0; i < unidades.length; i += 1) {
    const u = unidades[i];
    const etiqueta = `[${i + 1}/${unidades.length}] ${u.nombre} (id ${u.unitId})`;
    try {
      const marcas = await historialUnidad(cfg.zonar, sesion.token, {
        unitId: u.unitId, desde, hasta,
      });
      if (marcas.length >= TOPE_AVISO_HISTORIAL) {
        log.aviso(`${etiqueta}: llegó al tope de ${TOPE_AVISO_HISTORIAL} marcas; puede estar incompleto.`);
      }
      resumen.marcas += marcas.length;

      if (guardar) {
        const seguro = u.nombre.replace(/[^\w.-]+/g, '_').slice(0, 60) || String(u.unitId);
        fs.writeFileSync(
          path.join(carpetaDia, `${seguro}__${u.unitId}.json`),
          JSON.stringify(marcas, null, 1),
        );
      }

      let validasUnidad = 0;
      for (const marca of marcas) {
        const { row, error } = armarFilaZonar(marca, agrilux?.empresaId ?? 'SIN-EMPRESA', agrilux?.userId ?? null, {
          fechaModo: cfg.corrida.fecha_modo,
        });
        if (error) {
          resumen.filas_invalidas += 1;
          if (resumen.ejemplos_invalidos.length < 5) {
            resumen.ejemplos_invalidos.push(`${u.nombre}: ${error}`);
          }
        } else {
          todasLasFilas.push(row);
          validasUnidad += 1;
          resumen.filas += 1;
        }
      }

      if (!marcas.length) resumen.unidades_sin_datos += 1;
      resumen.unidades_ok += 1;
      log.info(`${etiqueta}: ${marcas.length} marcas · ${validasUnidad} filas válidas.`);
    } catch (e) {
      resumen.unidades_con_error += 1;
      resumen.errores.push(`${u.nombre}: ${e.message}`);
      log.error(`${etiqueta}: ${e.message}`);
    }

    if (cfg.corrida.delay_ms > 0 && i < unidades.length - 1) await dormir(cfg.corrida.delay_ms);
  }

  // 5) Deduplicar por source_key dentro de la propia corrida y subir.
  if (todasLasFilas.length) {
    const unicas = new Map();
    for (const fila of todasLasFilas) {
      if (!unicas.has(fila.source_key)) unicas.set(fila.source_key, fila);
    }
    const duplicadas = todasLasFilas.length - unicas.size;
    if (duplicadas) log.info(`Se omitieron ${duplicadas} filas repetidas dentro de la corrida.`);

    if (!sinIngerir) {
      log.info(`Subiendo ${unicas.size} posiciones a Agrilux…`);
      resumen.nuevas = await subirPosiciones(agrilux.supabase, [...unicas.values()], (actual, total, nuevas) => {
        if (actual === total || actual % 5000 === 0) {
          log.info(`  guardadas ${actual}/${total} (nuevas hasta ahora: ${nuevas})`);
        }
      });
      log.info(`Agrilux: ${resumen.nuevas} posiciones nuevas; ${unicas.size - resumen.nuevas} ya existían (dedup por source_key).`);
    } else {
      log.info(`Solo descarga: ${unicas.size} filas listas (no se subió nada).`);
    }
  } else {
    log.aviso('No se obtuvieron filas en este rango.');
  }

  limpiarDescargas(cfg.corrida.reten_dias);

  resumen.ok = resumen.unidades_ok > 0 && resumen.unidades_con_error === 0;
  resumen.duracion_seg = Math.round((Date.now() - t0) / 1000);
  resumen.fin = new Date().toISOString();
  escribirEstado(resumen);

  log.info(
    `Listo en ${resumen.duracion_seg}s · unidades ${resumen.unidades_ok}/${resumen.unidades_total}`
    + ` · marcas ${resumen.marcas} · filas ${resumen.filas}`
    + (sinIngerir ? '' : ` · nuevas ${resumen.nuevas}`)
    + (resumen.unidades_con_error ? ` · ERRORES: ${resumen.unidades_con_error}` : ''),
  );
  return resumen;
}
