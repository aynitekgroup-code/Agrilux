import test from 'node:test';
import assert from 'node:assert/strict';
import { formatearDuracion } from '../src/lib/duracionReporte.js';

test('el redondeo no produce 60 minutos', () => {
  assert.equal(formatearDuracion(86399), '24 h 00 min');
  assert.equal(formatearDuracion(3599), '1 h 00 min');
  assert.equal(formatearDuracion(3600), '1 h 00 min');
});

test('distingue cero de ausencia de datos', () => {
  assert.equal(formatearDuracion(0), '0 s');
  assert.equal(formatearDuracion(null), '—');
  assert.equal(formatearDuracion(undefined), '—');
  assert.equal(formatearDuracion(''), '—');
});
