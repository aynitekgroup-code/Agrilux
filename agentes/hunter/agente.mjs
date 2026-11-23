#!/usr/bin/env node
// Modo de diagnóstico local: no se conecta a Hunter ni escribe en Supabase.
import { readFile } from 'node:fs/promises';
import { prepararRecorrido } from './parse.mjs';

try {
  const ruta = process.argv[2];
  if (!ruta) throw new Error('Uso: node agentes/hunter/agente.mjs <captura-privada.json>');
  const resultado = prepararRecorrido(JSON.parse(await readFile(ruta, 'utf8')));
  console.log(JSON.stringify({ modo: 'diagnóstico sin escritura', equipo: resultado.equipo_id,
    total_original: resultado.total_original, puntos_validos: resultado.puntos.length,
    descartes: resultado.descartes, resumen_hunter: resultado.resumen_hunter }, null, 2));
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
