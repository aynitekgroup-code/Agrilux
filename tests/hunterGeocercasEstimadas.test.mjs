import test from 'node:test';
import assert from 'node:assert/strict';
import { estimarHunterPorGeocerca, coberturaHunter } from '../src/lib/hunterGeocercasEstimadas.js';

const geo = [{ id: 'a', nombre: 'Campo', geometria: { type: 'Polygon', coordinates: [[[0,0],[2,0],[2,2],[0,2],[0,0]]] } }];
const punto = (fecha, extra = {}) => ({ fecha, latitud: 1, longitud: 1, ignicion: true, velocidad_kmh: 0, ...extra });
test('computa solo intervalos coherentes y acotados', () => {
  const r = estimarHunterPorGeocerca([punto('2026-11-25T00:00:00Z'), punto('2026-11-25T00:01:00Z'), punto('2026-11-25T00:20:00Z')], geo);
  assert.equal(r.filas[0].detenido, 60);
  assert.equal(r.incierto, 1140);
});

test('cobertura incluye extremos sin datos y no cuenta horas futuras', () => {
  const p = [punto('2026-11-25T00:10:00Z'), punto('2026-11-25T00:11:00Z')];
  const r = coberturaHunter(p, estimarHunterPorGeocerca(p, geo), '2026-11-25T00:00:00Z', '2026-11-25T01:00:00Z', Date.parse('2026-11-25T00:30:00Z'));
  assert.equal(r.total, 1800);
  assert.equal(r.asignado, 60);
  assert.equal(r.sinCoberturaExterna, 1740);
  assert.equal(r.sinAsignar, 1740);
});
test('balance histórico cubre 24 horas incluyendo tiempo sin determinar', () => {
  const p = [punto('2026-11-25T05:00:00Z'), punto('2026-11-25T05:01:00Z')];
  const r = coberturaHunter(p, estimarHunterPorGeocerca(p, geo), '2026-11-25T05:00:00Z', '2026-11-26T05:00:00Z', Date.parse('2026-11-27T05:00:00Z'));
  assert.equal(r.total, 86400);
  assert.equal(r.asignado + r.sinAsignar, 86400);
  assert.equal(r.pendiente, 0);
});
test('día en curso distingue tiempo futuro y completa 24 horas', () => {
  const p = [punto('2026-11-25T05:00:00Z'), punto('2026-11-25T05:01:00Z')];
  const r = coberturaHunter(p, estimarHunterPorGeocerca(p, geo), '2026-11-25T05:00:00Z', '2026-11-26T05:00:00Z', Date.parse('2026-11-25T17:00:00Z'));
  assert.equal(r.total, 43200);
  assert.equal(r.pendiente, 43200);
  assert.equal(r.asignado + r.sinAsignar + r.pendiente, 86400);
});
test('cobertura rechaza asignaciones superiores al periodo transcurrido', () => {
  const r = coberturaHunter([], { filas: [{ apagado: 7200, detenido: 0, ralenti: 0, movimiento: 0 }] }, '2026-11-25T05:00:00Z', '2026-11-26T05:00:00Z', Date.parse('2026-11-25T06:00:00Z'));
  assert.equal(r, null);
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
    punto(`${base}02:00Z`), punto(`${base}03:00Z`),
    punto(`${base}04:00Z`, { velocidad_kmh: 1 }), punto(`${base}05:00Z`, { velocidad_kmh: 5 }),
    punto(`${base}06:00Z`, { velocidad_kmh: 6 }), punto(`${base}07:00Z`, { velocidad_kmh: 8 }),
  ];
  const r = estimarHunterPorGeocerca(p, geo);
  assert.deepEqual([r.filas[0].apagado, r.filas[0].detenido, r.filas[0].ralenti, r.filas[0].movimiento, r.incierto], [60, 60, 60, 60, 180]);
});

test('hueco largo con ignición apagada en ambos extremos permanece incierto', () => {
  const p = [punto('2026-11-25T00:00:00Z', { ignicion: false }), punto('2026-11-25T01:00:00Z', { ignicion: false })];
  const r = estimarHunterPorGeocerca(p, geo);
  assert.equal(r.filas.length, 0);
  assert.equal(r.incierto, 3600);
  assert.equal(r.hipotesisApagado[0].segundos, 3600);
  assert.equal(r.hipotesisApagado[0].geocerca, 'Campo');
});

test('hueco largo que termina con evento Ignición ON permanece incierto', () => {
  const p = [punto('2026-11-25T00:00:00Z', { ignicion: false }), punto('2026-11-25T01:00:00Z', { evento: 'Ignición ON' })];
  const r = estimarHunterPorGeocerca(p, geo);
  assert.equal(r.filas.length, 0);
  assert.equal(r.incierto, 3600);
  assert.equal(r.hipotesisApagado.length, 1);
});

test('hueco largo con encendido al final sin evento de ignición sigue sin determinar', () => {
  const p = [punto('2026-11-25T00:00:00Z', { ignicion: false }), punto('2026-11-25T01:00:00Z')];
  const r = estimarHunterPorGeocerca(p, geo);
  assert.equal(r.filas.length, 0);
  assert.equal(r.incierto, 3600);
  assert.equal(r.hipotesisApagado.length, 0);
});

test('hipótesis no incluye huecos excesivos, distantes ni geocercas solapadas', () => {
  const a = punto('2026-11-25T00:00:00Z', { ignicion: false });
  const fin = (fecha, extra = {}) => punto(fecha, { ignicion: false, ...extra });
  assert.equal(estimarHunterPorGeocerca([a, fin('2026-11-25T01:30:01Z')], geo).hipotesisApagado.length, 0);
  assert.equal(estimarHunterPorGeocerca([a, fin('2026-11-25T01:00:00Z', { longitud: 1.01 })], geo).hipotesisApagado.length, 0);
  assert.equal(estimarHunterPorGeocerca([a, fin('2026-11-25T01:00:00Z')], [...geo, { ...geo[0], id: 'b' }]).hipotesisApagado.length, 0);
});

test('hueco largo con extremos en geocercas distintas, lejanos, con velocidad o solapadas no se asigna', () => {
  const apagado = { ignicion: false };
  const a = punto('2026-11-25T00:00:00Z', apagado);
  const geoB = [{ id: 'b', nombre: 'Otro', geometria: { type: 'Polygon', coordinates: [[[3,0],[5,0],[5,2],[3,2],[3,0]]] } }];
  const otro = punto('2026-11-25T01:00:00Z', { ...apagado, longitud: 4 });
  assert.equal(estimarHunterPorGeocerca([a, otro], [...geo, ...geoB]).incierto, 3600);
  const lejos = punto('2026-11-25T01:00:00Z', { ...apagado, longitud: 1.01 });
  assert.equal(estimarHunterPorGeocerca([a, lejos], geo).incierto, 3600);
  const conVelocidad = punto('2026-11-25T01:00:00Z', { ...apagado, velocidad_kmh: 3 });
  assert.equal(estimarHunterPorGeocerca([a, conVelocidad], geo).incierto, 3600);
  const solapadas = [...geo, { ...geo[0], id: 'b' }];
  assert.equal(estimarHunterPorGeocerca([a, punto('2026-11-25T01:00:00Z', apagado)], solapadas).incierto, 3600);
});

test('ignición encendida con velocidad inválida no se clasifica como encendido lento', () => {
  for (const velocidad_kmh of [-1, NaN, null]) {
    const r = estimarHunterPorGeocerca([punto('2026-11-25T00:00:00Z', { velocidad_kmh }), punto('2026-11-25T00:01:00Z')], geo);
    assert.equal(r.filas.length, 0);
    assert.equal(r.incierto, 60);
  }
});
