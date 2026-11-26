import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clasificarEstadoGeocerca,
  agruparPorGeocerca,
  totalesPorEstado,
  UMBRAL_SIN_DATO_MINUTOS,
} from '../src/lib/estadoGeocerca.js';

const AHORA = new Date('2026-11-26T12:00:00Z');
const HACE_10_MIN = '2026-11-26T11:50:00Z';

function fila(extra = {}) {
  return {
    placa: 'ABC-123',
    unidad: 'ABC-123/31.PREP. TRR',
    ultima_fecha: HACE_10_MIN,
    ultimo_evento: 'Ralentí',
    ultima_velocidad: 0,
    geocerca: 'Pomalca 1',
    ...extra,
  };
}

test('sin fecha o fecha inválida -> sin dato', () => {
  assert.equal(clasificarEstadoGeocerca(fila({ ultima_fecha: null }), AHORA), 'sin_dato');
  assert.equal(clasificarEstadoGeocerca(fila({ ultima_fecha: 'no-es-fecha' }), AHORA), 'sin_dato');
});

test(`más de ${UMBRAL_SIN_DATO_MINUTOS} min sin posición -> sin dato`, () => {
  assert.equal(
    clasificarEstadoGeocerca(fila({ ultima_fecha: '2026-11-26T11:25:00Z' }), AHORA),
    'sin_dato',
  );
});

test('fecha adelantada más de 5 min -> sin dato', () => {
  assert.equal(
    clasificarEstadoGeocerca(fila({ ultima_fecha: '2026-11-26T12:10:00Z' }), AHORA),
    'sin_dato',
  );
});

test('evento apagado o estacionado -> apagado', () => {
  assert.equal(clasificarEstadoGeocerca(fila({ ultimo_evento: 'Apagado' }), AHORA), 'apagado');
  assert.equal(clasificarEstadoGeocerca(fila({ ultimo_evento: 'Estacionado' }), AHORA), 'apagado');
});

test('estado en vivo Apagado -> apagado aunque la velocidad no venga', () => {
  assert.equal(
    clasificarEstadoGeocerca(fila({ estado_vivo: 'Apagado', ultima_velocidad: null }), AHORA),
    'apagado',
  );
});

test('velocidad 0 o hasta 5 km/h -> ralentí', () => {
  assert.equal(clasificarEstadoGeocerca(fila({ ultima_velocidad: 0 }), AHORA), 'ralenti');
  assert.equal(clasificarEstadoGeocerca(fila({ ultima_velocidad: 3 }), AHORA), 'ralenti');
  assert.equal(clasificarEstadoGeocerca(fila({ ultima_velocidad: 5 }), AHORA), 'ralenti');
});

test('más de 5 km/h o estado En ruta -> conduciendo', () => {
  assert.equal(clasificarEstadoGeocerca(fila({ ultima_velocidad: 6 }), AHORA), 'conduciendo');
  assert.equal(
    clasificarEstadoGeocerca(fila({ estado_vivo: 'En ruta', ultima_velocidad: 0 }), AHORA),
    'conduciendo',
  );
});

test('estado Sin reporte -> sin dato', () => {
  assert.equal(clasificarEstadoGeocerca(fila({ estado_vivo: 'Sin reporte' }), AHORA), 'sin_dato');
});

test('unidad sin telemetría -> sin dato', () => {
  assert.equal(clasificarEstadoGeocerca(fila({ sin_telemetria: true }), AHORA), 'sin_dato');
});

test('agruparPorGeocerca cuenta los 3 estados y suma el total', () => {
  const grupos = agruparPorGeocerca([
    fila({ placa: 'A-1', geocerca: 'Pomalca 1', ultima_velocidad: 8 }),
    fila({ placa: 'A-2', geocerca: 'Pomalca 1', ultima_velocidad: 0 }),
    fila({ placa: 'A-3', geocerca: 'Pomalca 1', ultimo_evento: 'Apagado' }),
    fila({ placa: 'A-4', geocerca: 'Pomalca 1', ultima_fecha: '2026-11-26T10:00:00Z' }),
    fila({ placa: 'B-1', geocerca: 'Saltur', ultima_velocidad: 12 }),
    fila({ placa: 'C-1', geocerca: null, ultima_velocidad: 0 }),
  ], AHORA);

  const pomalca = grupos.find((g) => g.geocerca === 'Pomalca 1');
  assert.equal(pomalca.conduciendo, 1);
  assert.equal(pomalca.ralenti, 1);
  assert.equal(pomalca.apagado, 1);
  assert.equal(pomalca.sinDato, 1);
  assert.equal(pomalca.total, 4);
  assert.equal(pomalca.unidades.length, 4);

  // Orden: más unidades primero y "Sin geocerca" al final.
  assert.equal(grupos[0].geocerca, 'Pomalca 1');
  assert.equal(grupos[grupos.length - 1].geocerca, 'Sin geocerca');
});

test('totalesPorEstado suma todos los grupos', () => {
  const grupos = agruparPorGeocerca([
    fila({ geocerca: 'Pomalca 1', ultima_velocidad: 9 }),
    fila({ geocerca: 'Saltur', ultima_velocidad: 0 }),
    fila({ geocerca: 'Saltur', ultimo_evento: 'Apagado' }),
  ], AHORA);

  assert.deepEqual(totalesPorEstado(grupos), {
    apagado: 1,
    ralenti: 1,
    conduciendo: 1,
    sinDato: 0,
    total: 3,
  });
});
