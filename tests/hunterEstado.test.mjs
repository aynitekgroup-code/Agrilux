import test from 'node:test';
import assert from 'node:assert/strict';
import { estadoHunter } from '../src/lib/hunterEstado.js';

const ahora = Date.parse('2026-11-25T12:00:00Z');
const fila = { fecha: '2026-11-25T12:00:00Z', ignicion: true, velocidad_kmh: 0 };

test('separa detenido, movimiento lento y movimiento', () => {
  assert.equal(estadoHunter(fila, ahora), 'Encendido / detenido');
  assert.equal(estadoHunter({ ...fila, velocidad_kmh: 0.1 }, ahora), 'Encendido / movimiento lento');
  assert.equal(estadoHunter({ ...fila, velocidad_kmh: 5 }, ahora), 'Encendido / movimiento lento');
  assert.equal(estadoHunter({ ...fila, velocidad_kmh: 5.1 }, ahora), 'En movimiento');
});

test('distingue apagado, datos incompletos y reportes antiguos', () => {
  assert.equal(estadoHunter({ ...fila, ignicion: false }, ahora), 'Apagado');
  for (const velocidad of [null, '', -1, 'inválido']) {
    assert.equal(estadoHunter({ ...fila, velocidad_kmh: velocidad }, ahora), 'Desconocido');
  }
  assert.equal(estadoHunter({ ...fila, ignicion: null }, ahora), 'Desconocido');
  assert.equal(estadoHunter({ ...fila, fecha: '2026-11-25T11:29:59Z' }, ahora), 'Sin reporte reciente');
  assert.equal(estadoHunter({ ...fila, fecha: null }, ahora), 'Sin reporte reciente');
});
