import test from 'node:test';
import assert from 'node:assert/strict';
import { diaMapaPeru } from '../src/lib/fechasMapa.js';

test('hoy y ayer respetan la medianoche de Perú', () => {
  const instante = Date.parse('2026-11-25T02:00:00Z');
  assert.equal(diaMapaPeru(instante), '2026-11-24');
  assert.equal(diaMapaPeru(instante, 1), '2026-11-23');
});
