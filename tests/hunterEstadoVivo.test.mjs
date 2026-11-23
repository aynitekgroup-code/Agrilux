import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarEstadoHunter } from '../agentes/hunter/estado-vivo.mjs';

test('Hunter vivo conserva fuente, hora Perú e ignición observada', () => {
  const [v] = normalizarEstadoHunter({ 123: { IdVehiculo: 123, Nombre: 'CASE', FechaHora: '2026-11-23 17:25:29', Latitud: '-6.77', Longitud: '-79.77', Velocidad: '0', Ignicion: 'Encendido' } });
  assert.equal(v.fecha, '2026-11-23T17:25:29-05:00');
  assert.equal(v.ignicion, true);
  assert.equal(v.fuente, 'hunter360');
  assert.equal(v.equipo_id, '123');
});
test('Hunter vivo no inventa datos faltantes o fechas inválidas', () => {
  const [v] = normalizarEstadoHunter({ 123: { FechaHora: '2026-02-30 12:00:00', Latitud: '', Longitud: '', Velocidad: '', Ignicion: '?' } });
  assert.equal(v.fecha, null);
  assert.equal(v.latitud, null);
  assert.equal(v.velocidad_kmh, null);
  assert.equal(v.ignicion, null);
});
test('Hunter vivo usa la clave del equipo aunque IdVehiculo sea cero', () => {
  assert.throws(() => normalizarEstadoHunter([]));
  assert.equal(normalizarEstadoHunter({ 123: { IdVehiculo: 0 } })[0].equipo_id, '123');
});
