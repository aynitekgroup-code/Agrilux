import test from 'node:test';
import assert from 'node:assert/strict';
import { estimarHunterPorGeocerca } from '../src/lib/hunterGeocercasEstimadas.js';

const geo = [{ id: 'a', nombre: 'Campo', geometria: { type: 'Polygon', coordinates: [[[0,0],[2,0],[2,2],[0,2],[0,0]]] } }];
const punto = (fecha, extra = {}) => ({ fecha, latitud: 1, longitud: 1, ignicion: true, velocidad_kmh: 0, ...extra });
test('computa solo intervalos coherentes y acotados', () => {
  const r = estimarHunterPorGeocerca([punto('2026-11-25T00:00:00Z'), punto('2026-11-25T00:01:00Z'), punto('2026-11-25T00:20:00Z')], geo);
  assert.equal(r.filas[0].ralenti, 60);
  assert.equal(r.incierto, 1140);
});
test('no asigna tiempo con ignición desconocida ni geocercas solapadas', () => {
  const p = [punto('2026-11-25T00:00:00Z', { ignicion: null }), punto('2026-11-25T00:01:00Z')];
  assert.equal(estimarHunterPorGeocerca(p, geo).incierto, 60);
  const dos = [...geo, { ...geo[0], id: 'b' }];
  assert.equal(estimarHunterPorGeocerca(p.map((x) => ({ ...x, ignicion: true })), dos).filas.length, 0);
});

test('separa apagado, encendido lento y movimiento sin sumar intervalos inciertos', () => {
  const base = '2026-11-25T00:';
  const p = [
    punto(`${base}00:00Z`, { ignicion: false }), punto(`${base}01:00Z`, { ignicion: false }),
    punto(`${base}02:00Z`), punto(`${base}03:00Z`, { velocidad_kmh: 5 }),
    punto(`${base}04:00Z`, { velocidad_kmh: 6 }), punto(`${base}05:00Z`, { velocidad_kmh: 8 }),
  ];
  const r = estimarHunterPorGeocerca(p, geo);
  assert.deepEqual([r.filas[0].apagado, r.filas[0].ralenti, r.filas[0].movimiento, r.incierto], [60, 60, 60, 120]);
});

test('ignición encendida con velocidad inválida no se clasifica como encendido lento', () => {
  for (const velocidad_kmh of [-1, NaN, null]) {
    const r = estimarHunterPorGeocerca([punto('2026-11-25T00:00:00Z', { velocidad_kmh }), punto('2026-11-25T00:01:00Z')], geo);
    assert.equal(r.filas.length, 0);
    assert.equal(r.incierto, 60);
  }
});
