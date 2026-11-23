#!/usr/bin/env node
// Modo de diagnóstico local: no se conecta a Hunter ni escribe en Supabase.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prepararRecorrido } from './parse.mjs';
import { generarReportesCsv } from './reportes.mjs';

try {
  const [ruta, opcion, carpeta] = process.argv.slice(2);
  if (!ruta || (opcion && (opcion !== '--salida' || !carpeta))) throw new Error('Uso: node agentes/hunter/agente.mjs <captura-privada.json> [--salida <carpeta-privada>]');
  const resultado = prepararRecorrido(JSON.parse(await readFile(ruta, 'utf8')));
  if (opcion === '--salida') {
    const destino = path.resolve(carpeta);
    const archivos = generarReportesCsv(resultado);
    for (const [nombre, contenido] of Object.entries(archivos)) {
      await writeFile(path.join(destino, nombre), contenido, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    }
  }
  console.log(JSON.stringify({ modo: 'diagnóstico sin conexión a Agrilux', equipo: resultado.equipo_id,
    total_original: resultado.total_original, puntos_validos: resultado.puntos.length,
    descartes: resultado.descartes, viajes_y_paradas: resultado.viajes.length,
    viajes_disponibles: resultado.viajes_disponibles, resumen_hunter: resultado.resumen_hunter,
    reportes_locales: opcion === '--salida' }, null, 2));
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
