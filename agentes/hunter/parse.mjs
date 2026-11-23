import { createHash } from 'node:crypto';
import { prepararRecorrido as preparar } from './parse-core.mjs';

export function prepararRecorrido(captura) {
  return preparar(captura, (equipo, id) => `hunter:${createHash('sha256').update(JSON.stringify([equipo, id])).digest('hex')}`);
}
