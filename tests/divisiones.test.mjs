import test from 'node:test';
import assert from 'node:assert/strict';
import {
  agruparPorDivision,
  aplanarGrupos,
  normalizarDivision,
  nombreDivision,
} from '../src/lib/agrotrackDivisiones.js';

const filas = [
  { lote: 'Lote I', division: 'Pomalca 1', visitas: 2, permanencia_segundos: 100 },
  { lote: 'Bola de Oro', division: 'Pom1', visitas: 3, permanencia_segundos: 200 },
  { lote: 'Abelardo A', division: 'Pamp', visitas: 1, permanencia_segundos: 50 },
  { lote: 'Oficinas', division: null, nombre: 'Oficinas Pomalca', visitas: 4, permanencia_segundos: 10 },
  { lote: 'Establo', division: '   ', nombre: 'Establo Saltur', visitas: 5, permanencia_segundos: 20 },
];

test('normaliza division vacia con nombre y homologa alias', () => {
  assert.equal(normalizarDivision(null, 'Distrito Chiclayo'), 'Distrito Chiclayo');
  assert.equal(normalizarDivision('   ', 'Oficinas Pomalca'), 'Oficinas Pomalca');
  assert.equal(normalizarDivision('Pamp', null), 'Pampagrande');
  assert.equal(normalizarDivision('Sal-Sip', null), 'Saltur - Sipan');
  assert.equal(nombreDivision(filas[3]), 'Oficinas Pomalca');
});

test('agrupa por division sin grupo "Sin división"', () => {
  const grupos = agruparPorDivision(filas);
  assert.deepEqual(grupos.map((g) => g.division), [
    'Establo Saltur',
    'Oficinas Pomalca',
    'Pampagrande',
    'Pomalca 1',
  ]);
  // Pom1 se homologa con Pomalca 1: una sola columna.
  assert.equal(grupos.at(-1).filas.length, 2);
  assert.equal(grupos.at(-1).totales.visitas, 5);
  assert.equal(grupos.at(-1).totales.permanencia_segundos, 300);
  assert.equal(grupos.some((g) => /sin división/i.test(g.division)), false);
});

test('aplanarGrupos intercala encabezado de division y sus lotes', () => {
  const planas = aplanarGrupos(agruparPorDivision(filas));
  assert.equal(planas.length, filas.length + 4);
  assert.equal(planas[0].tipo, 'division');
  assert.equal(planas[0].division, 'Establo Saltur');
  assert.equal(planas[1].tipo, 'lote');
  assert.equal(planas[1].fila.lote, 'Establo');
});
