import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partesLima, duracionTexto, horasDecimal, codigoArea, armarMatriz } from '../src/lib/agrotrackVisitasDia.js';

test('partesLima convierte a hora de Perú', () => {
  assert.deepEqual(partesLima('2026-11-11T04:57:19Z'), { fecha: '2026-11-10', hora: '23:57:19' });
  assert.deepEqual(partesLima('2026-11-11T00:09:31-05:00'), { fecha: '2026-11-11', hora: '00:09:31' });
  assert.deepEqual(partesLima(null), { fecha: '', hora: '' });
});

test('duración con el formato de Zonar', () => {
  assert.equal(duracionTexto(170), '00h:02m:50s');
  assert.equal(duracionTexto(10661), '02h:57m:41s');
  assert.equal(horasDecimal(4663), 1.3);
});

test('código de área desde la unidad de Zonar', () => {
  assert.equal(codigoArea('T8F-909/APLI.DRON', 'T8F-909'), 'APLI.DRON');
  assert.equal(codigoArea('BVO-945', 'BVO-945'), '');
});

test('matriz placa x geocerca con totales', () => {
  const tabla = [
    { placa: 'A', geocerca: 'Fabrica', duracion_segundos: 3600, apagado_segundos: 1800 },
    { placa: 'A', geocerca: 'Division Pamp', duracion_segundos: 1800, apagado_segundos: 0 },
    { placa: 'B', geocerca: 'Fabrica', duracion_segundos: 900, apagado_segundos: 900 },
  ];
  const m = armarMatriz(tabla, { A: { grupo: 'Seguridad' }, B: { area: 'SEG.IM.' } });
  assert.deepEqual(m.geocercas, ['Division Pamp', 'Fabrica']);
  assert.equal(m.totales.Fabrica, 4500);
  assert.equal(m.totalGeneral, 6300);
  assert.equal(m.filas.find((f) => f.placa === 'A').total, 5400);
  const ap = armarMatriz(tabla, {}, 'apagado_segundos');
  assert.equal(ap.totalGeneral, 2700);
});
