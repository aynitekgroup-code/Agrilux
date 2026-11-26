import test from 'node:test';
import assert from 'node:assert/strict';
import { matrizKilometros } from '../src/lib/matrizKilometros.js';

test('conserva el cero medido y no rellena días sin datos', () => {
  const filas = matrizKilometros(['2026-11-24', '2026-11-25'], [[{ placa: 'MOTO 1', km_recorridos: 0 }], []]);
  assert.equal(filas[0].valores['2026-11-24'], 0);
  assert.equal(filas[0].valores['2026-11-25'], undefined);
});

test('incluye el padrón sin inventar posiciones', () => {
  const filas = matrizKilometros(['2026-11-25'], [[]], [{ placa: 'MOTO 2' }]);
  assert.equal(filas[0].placa, 'MOTO 2');
  assert.equal(filas[0].valores['2026-11-25'], undefined);
});

test('conserva el área disponible sin crear una asignación', () => {
  const filas = matrizKilometros(['2026-11-25'], [[{ placa: 'MOTO 1', unidad: 'MOTO 1/CAMPO', km_recorridos: 2 }]], [{ placa: 'MOTO 2' }]);
  assert.equal(filas.find((f) => f.placa === 'MOTO 1').unidad, 'MOTO 1/CAMPO');
  assert.equal(filas.find((f) => f.placa === 'MOTO 2').unidad, '');
});
