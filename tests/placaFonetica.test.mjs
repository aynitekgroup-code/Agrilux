import test from 'node:test';
import assert from 'node:assert/strict';
import { clavePlacaFonetica, placasFoneticas } from '../src/lib/placaFonetica.js';

test('reconoce B y V en placas completas sin distinguir guiones', () => {
  assert.equal(clavePlacaFonetica('VPH 816'), clavePlacaFonetica('BPH-816'));
  assert.deepEqual(placasFoneticas([{ placa: 'BPH-816' }, { placa: 'BPH-817' }], 'VPH 816').map((u) => u.placa), ['BPH-816']);
});
test('dos placas homófonas conservan ambas opciones', () => {
  assert.equal(placasFoneticas([{ placa: 'BPH-816' }, { placa: 'VPH-816' }], 'VPH 816').length, 2);
});
test('no usa equivalencia fonética para nombres de geocerca ni áreas', () => {
  assert.equal(clavePlacaFonetica('Valle Verde'), '');
  assert.equal(clavePlacaFonetica('CASE 2'), '');
});
