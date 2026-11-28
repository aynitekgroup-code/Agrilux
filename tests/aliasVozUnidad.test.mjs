import test from 'node:test';
import assert from 'node:assert/strict';
import { unidadesAliasVoz } from '../src/lib/placaFonetica.js';

test('jej encuentra GG sin modificar identificadores ni confundir palabras', () => {
  const unidades = [{ placa: 'GG-01' }, { placa: 'GG-02' }, { placa: 'ABC-10', descripcion: 'AGGREGADO' }];
  assert.deepEqual(unidadesAliasVoz(unidades, 'jej').map((u) => u.placa), ['GG-01', 'GG-02']);
  assert.deepEqual(unidadesAliasVoz(unidades, 'otra'), []);
});
