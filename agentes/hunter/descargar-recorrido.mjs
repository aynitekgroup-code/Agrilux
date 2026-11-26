#!/usr/bin/env node
// Descarga privada de diagnóstico; no sincroniza datos ni calcula pagos.
import { writeFile } from 'node:fs/promises';
import { leerRecorridoHunter } from './cliente.mjs';
import { prepararRecorrido } from './parse.mjs';

try {
  const [equipo, dia, destino] = process.argv.slice(2);
  if (!equipo || !dia || !destino) throw new Error('Uso: node agentes/hunter/descargar-recorrido.mjs <equipo> <AAAA-MM-DD> <archivo-privado.json>');
  const captura = await leerRecorridoHunter(process.env.HUNTER_USUARIO, process.env.HUNTER_PASSWORD, { equipo, dia });
  const resultado = prepararRecorrido(captura);
  await writeFile(destino, JSON.stringify(captura), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  console.log(`Captura privada guardada. Puntos válidos: ${resultado.puntos.length}; paradas agrupadas: ${resultado.descartes.paradas_agrupadas}.`);
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
