import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseFechaZonar as webFecha,
  separarUnidad as webUnidad,
  cleanText as webTexto,
  numberOrNull as webNumero,
  armarSourceKey as webKey,
} from '../src/lib/agrotrackParse.js';

import {
  parseFechaZonar as agFecha,
  separarUnidad as agUnidad,
  cleanText as agTexto,
  numberOrNull as agNumero,
  armarSourceKey as agKey,
  fechaDesdeJsonZonar,
  armarFilaZonar,
} from '../agentes/zonar/lib/parse.js';

/**
 * El agente de Zonar (agentes/zonar) es autocontenido: lleva su propia copia de
 * la lógica de parseo para poder instalarse en la PC de Carlos sin el repo.
 * Este test obliga a que ambas copias se comporten IGUAL — sobre todo el
 * source_key, que es lo que hace que la carga automática del agente y la
 * importación manual del Excel colisionen en el upsert (empresa_id, source_key)
 * en lugar de duplicar filas.
 */

const FECHAS_EXCEL = [
  'Nov 01 2026 12:01 AM',
  'Nov 09 2026 11:58 PM',
  'Dec 31 2026 07:05 AM',
  'Ene 15 2026 06:30 PM',
  'sep 01 2026 09:00 am',
  'no es fecha',
  '',
  null,
  undefined,
  12345,
];

const UNIDADES = [
  'BPH-767/SEGURIDAD',
  '1414-1K/31.SEG.IN.PG',
  'P01-1K',
  '  con espacios  ',
  '',
  null,
  'a/b/c',
];

const NUMEROS = [null, undefined, '', '0', '40', '40,5', ' 12 ', 'x', 7, NaN, Infinity];

const COORDS = [
  [-6.6, -79.6],
  [0, 0],
  [-90, -180],
  [90.0000001, 0],
  [10, 200],
];

test('paridad: parseFechaZonar idéntico en web y en el agente', () => {
  for (const f of FECHAS_EXCEL) assert.equal(webFecha(f), agFecha(f), `fecha: ${String(f)}`);
});

test('paridad: separarUnidad idéntico en web y en el agente', () => {
  for (const u of UNIDADES) assert.deepEqual(webUnidad(u), agUnidad(u), `unidad: ${String(u)}`);
});

test('paridad: cleanText y numberOrNull idénticos', () => {
  for (const v of [...FECHAS_EXCEL, ...NUMEROS]) {
    assert.equal(webTexto(v), agTexto(v), `texto: ${String(v)}`);
    assert.equal(webNumero(v), agNumero(v), `numero: ${String(v)}`);
  }
});

test('paridad: armarSourceKey idéntico (clave del upsert)', () => {
  for (const [lat, lon] of COORDS) {
    for (const fecha of ['2026-11-09T23:58:00-05:00', '2026-01-01T00:00:00-05:00']) {
      assert.equal(
        webKey('P01-1K', fecha, 'Conduciendo', lat, lon),
        agKey('P01-1K', fecha, 'Conduciendo', lat, lon),
      );
    }
  }
});

test('source_key del agente coincide con el formato histórico del importador', () => {
  // Misma fila que producía buildRow de agrotrackPosiciones.js antes del refactor.
  assert.equal(
    agKey('BPH-767', '2026-11-09T23:58:00-05:00', 'Estacionado', -6.6, -79.6),
    'BPH-767|2026-11-09T23:58:00-05:00|Estacionado|-6.6000000|-79.6000000',
  );
});

/* ── fechaDesdeJsonZonar: normalización del JSON de GetUnitsHistory ───────── */

test('fecha: texto de Excel -> igual que parseFechaZonar', () => {
  assert.equal(fechaDesdeJsonZonar('Nov 09 2026 11:58 PM'), '2026-11-09T23:58:00-05:00');
  assert.equal(fechaDesdeJsonZonar('Nov 01 2026 12:01 AM'), '2026-11-01T00:01:00-05:00');
});

test('fecha: WCF /Date(ms)/ se convierte a hora de Perú', () => {
  // 2026-11-10T04:58:00Z = 2026-11-09 23:58 en Perú
  const ms = Date.UTC(2026, 10, 10, 4, 58, 0);
  assert.equal(fechaDesdeJsonZonar(`/Date(${ms})/`), '2026-11-09T23:58:00-05:00');
  assert.equal(fechaDesdeJsonZonar(`/Date(${ms})/`), fechaDesdeJsonZonar('Nov 09 2026 11:58 PM'));
});

test('fecha: ISO con Z o offset se convierte a hora de Perú', () => {
  assert.equal(fechaDesdeJsonZonar('2026-11-10T04:58:00Z'), '2026-11-09T23:58:00-05:00');
  assert.equal(fechaDesdeJsonZonar('2026-11-10T04:58:00+00:00'), '2026-11-09T23:58:00-05:00');
  assert.equal(fechaDesdeJsonZonar('2026-11-10T00:58:00-04:00'), '2026-11-09T23:58:00-05:00');
});

test('fecha: ISO sin zona se asume hora de Perú (auto/local) o UTC si se pide', () => {
  assert.equal(fechaDesdeJsonZonar('2026-11-09T23:58:00'), '2026-11-09T23:58:00-05:00');
  assert.equal(fechaDesdeJsonZonar('2026-11-09 23:58:00'), '2026-11-09T23:58:00-05:00');
  assert.equal(fechaDesdeJsonZonar('2026-11-10T04:58:00', 'utc'), '2026-11-09T23:58:00-05:00');
  assert.equal(fechaDesdeJsonZonar('2026-11-09T23:58:00', 'utc'), '2026-11-09T18:58:00-05:00');
});

test('fecha: epoch en segundos y milisegundos', () => {
  const ms = Date.UTC(2026, 10, 10, 4, 58, 0);
  assert.equal(fechaDesdeJsonZonar(ms), '2026-11-09T23:58:00-05:00');
  assert.equal(fechaDesdeJsonZonar(ms / 1000), '2026-11-09T23:58:00-05:00');
});

test('fecha: inválida -> null', () => {
  assert.equal(fechaDesdeJsonZonar(null), null);
  assert.equal(fechaDesdeJsonZonar(''), null);
  assert.equal(fechaDesdeJsonZonar('ayer'), null);
  assert.equal(fechaDesdeJsonZonar({}), null);
});

/* ── armarFilaZonar: fila equivalente a la del importador web ─────────────── */

test('fila: mismo shape y source_key que buildRow del importador', () => {
  const marcador = {
    Sequence: '825',
    Unit: '1414-1K/31.SEG.IN.PG',
    Event: 'Estacionado',
    LastEventDate: 'Nov 09 2026 11:58 PM',
    Landmark: '',
    Address: 'Av Via Haca Rajada Sipan-65, Pomalca, Chiclayo, Lambayeque, Perú',
    Speed: '0',
    Latitude: '-6.7912345',
    Longitude: '-79.8123456',
  };
  const { row, error } = armarFilaZonar(marcador, 'EMPRESA-1', 'USER-1');
  assert.ok(!error, error);
  assert.deepEqual(row, {
    empresa_id: 'EMPRESA-1',
    placa: '1414-1K',
    unidad: '1414-1K/31.SEG.IN.PG',
    descripcion: '31.SEG.IN.PG',
    fecha: '2026-11-09T23:58:00-05:00',
    secuencia: 825,
    evento: 'Estacionado',
    pt_referencia: null,
    direccion: 'Av Via Haca Rajada Sipan-65, Pomalca, Chiclayo, Lambayeque, Perú',
    velocidad: 0,
    latitud: -6.7912345,
    longitud: -79.8123456,
    source_key: '1414-1K|2026-11-09T23:58:00-05:00|Estacionado|-6.7912345|-79.8123456',
    creado_por: 'USER-1',
  });
});

test('fila: válida aunque LastEventDate venga en ISO o /Date()/', () => {
  const base = { Unit: 'P01-1K', Event: 'Conduciendo', Latitude: -6.6, Longitude: -79.6 };
  const a = armarFilaZonar({ ...base, LastEventDate: 'Nov 09 2026 11:58 PM' }, 'E', 'U');
  const b = armarFilaZonar({ ...base, LastEventDate: '2026-11-09T23:58:00' }, 'E', 'U');
  const c = armarFilaZonar({ ...base, LastEventDate: `/Date(${Date.UTC(2026, 10, 10, 4, 58, 0)})/` }, 'E', 'U');
  assert.equal(a.row.source_key, b.row.source_key);
  // 2026-11-10T04:58:00Z = 23:58 del 09 en Perú
  assert.equal(a.row.source_key, c.row.source_key);
});

test('fila: rechaza lo mismo que el importador web', () => {
  assert.equal(
    armarFilaZonar({ Unit: 'X', Event: '', LastEventDate: 'Nov 09 2026 11:58 PM', Latitude: 1, Longitude: 1 }, 'E', 'U').error,
    'faltan unidad, fecha o evento',
  );
  assert.equal(
    armarFilaZonar({ Unit: 'X', Event: 'Alto', LastEventDate: 'Nov 09 2026 11:58 PM', Latitude: '', Longitude: 1 }, 'E', 'U').error,
    'coordenadas inválidas',
  );
  assert.equal(
    armarFilaZonar({ Unit: 'X', Event: 'Alto', LastEventDate: 'Nov 09 2026 11:58 PM', Latitude: 91, Longitude: 1 }, 'E', 'U').error,
    'coordenadas inválidas',
  );
});

test('fila: sin creado_por cuando no hay usuario', () => {
  const { row } = armarFilaZonar(
    { Unit: 'P01-1K', Event: 'Alto', LastEventDate: 'Nov 09 2026 11:58 PM', Latitude: -6.6, Longitude: -79.6 },
    'E',
    null,
  );
  assert.equal(row.creado_por, null);
});
