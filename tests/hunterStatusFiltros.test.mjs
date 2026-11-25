import { test } from 'node:test';
import assert from 'node:assert/strict';
import { opcionesFiltrosHunter, filtrarUnidadesHunter } from '../src/lib/hunterStatusFiltros.js';

const filas = [
  { equipo_id: '1', unidad: 'A', area_operativa: 'Excavadora', grupos_operativos: ['Cosecha'], geocerca: 'Lote' },
  { equipo_id: '2', unidad: 'B', area_operativa: 'Camion', grupos_operativos: ['Cosecha'], geocerca: 'Lote' },
  { equipo_id: '3', unidad: 'C', area_operativa: 'Excavadora', grupos_operativos: ['Drenajes'], geocerca: 'Taller' },
];

test('Hunter: ofrece áreas reales sin inventar asignaciones', () => {
  assert.deepEqual(opcionesFiltrosHunter([...filas, { equipo_id: '4' }]).areas, ['Camion', 'Excavadora']);
});
test('Hunter: filtro de área se combina con grupo y geocerca', () => {
  const filtradas = filtrarUnidadesHunter(filas, { mostrar: 'grupos', opcionFiltro: 'Cosecha', filtroGeocerca: 'Lote', filtroArea: 'Excavadora' });
  assert.deepEqual(filtradas.map((f) => f.equipo_id), ['1']);
});
