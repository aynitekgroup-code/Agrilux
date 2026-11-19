import test from 'node:test';
import assert from 'node:assert/strict';
import { agruparPorDivision, aplanarGrupos, SIN_DIVISION } from '../src/lib/agrotrackDivisiones.js';

const filas = [
  { lote: 'Lote I', division: 'Pomalca 1', visitas: 2, permanencia_segundos: 100 },
  { lote: 'Bola de Oro', division: 'Pomalca 1', visitas: 3, permanencia_segundos: 200 },
  { lote: 'Abelardo A', division: 'Pampagrande', visitas: 1, permanencia_segundos: 50 },
  { lote: 'Oficinas', division: null, visitas: 4, permanencia_segundos: 10 },
  { lote: 'Establo', division: '   ', visitas: 5, permanencia_segundos: 20 },
];

test('agrupa por division y deja "Sin división" al final', () => {
  const grupos = agruparPorDivision(filas);
  assert.deepEqual(grupos.map((g) => g.division), ['Pampagrande', 'Pomalca 1', SIN_DIVISION]);
  assert.equal(grupos[1].filas.length, 2);
  assert.equal(grupos[1].totales.visitas, 5);
  assert.equal(grupos[1].totales.permanencia_segundos, 300);
  assert.equal(grupos[2].filas.length, 2);
});

test('aplanarGrupos intercala encabezado de division y sus lotes', () => {
  const planas = aplanarGrupos(agruparPorDivision(filas));
  assert.equal(planas.length, filas.length + 3);
  assert.equal(planas[0].tipo, 'division');
  assert.equal(planas[0].division, 'Pampagrande');
  assert.equal(planas[1].tipo, 'lote');
  assert.equal(planas[1].fila.lote, 'Abelardo A');
  assert.equal(planas.at(-1).tipo, 'lote');
  assert.equal(planas.at(-1).fila.lote, 'Establo');
});
