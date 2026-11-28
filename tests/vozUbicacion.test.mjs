import test from 'node:test';
import assert from 'node:assert/strict';
import { textoUbicacionVoz } from '../src/lib/vozUbicacion.js';

test('ubicación reciente incluye máquina, geocerca y hora', () => {
  const r = textoUbicacionVoz({ unidad: 'Auditoría', geocerca: 'Laura I', fecha: '2026-11-27T20:00:00Z', ahora: Date.parse('2026-11-27T20:10:00Z') });
  assert.match(r, /Auditoría.*Laura I.*Última posición/);
  assert.doesNotMatch(r, /Sin reporte reciente/);
});
test('posición antigua se presenta como última conocida y sin reporte reciente', () => {
  const r = textoUbicacionVoz({ unidad: 'CASE 2', geocerca: 'Laura I', fecha: '2026-11-27T20:00:00Z', ahora: Date.parse('2026-11-27T22:00:00Z') });
  assert.match(r, /última ubicación conocida: Laura I.*Sin reporte reciente/);
});
test('sin fecha no se asegura ubicación actual', () => {
  const r = textoUbicacionVoz({ unidad: 'CASE 2', geocerca: 'Laura I', fecha: null });
  assert.match(r, /no se puede confirmar su ubicación actual/);
  assert.doesNotMatch(r, /Laura I/);
});
