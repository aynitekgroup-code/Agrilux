import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepararRecorrido } from '../agentes/hunter/parse.mjs';

const punto = { id: '1', fecha: '2026-11-20', hora: '18:41:39', velocidad: '9', ignicion: '1',
  latitud: '-6.773954', longitud: '-79.774499', nombre_vehiculo: 'CASE 2', name_tipo_dato_gps: 'Reporte Por Tiempo Móvil Encendido' };
const captura = (data) => ({ fuente: 'hunter360', equipo: '4764426102', desde: '2026-11-20T00:00:00-05:00', hasta: '2026-11-20T23:59:59-05:00', recorrido: { data, distance: '49.95 km' } });

test('Hunter: normaliza un punto realista y conserva ignición y fuente', () => {
  const r = prepararRecorrido(captura([punto]));
  assert.equal(r.puntos[0].fecha, '2026-11-20T18:41:39-05:00');
  assert.equal(r.puntos[0].velocidad_kmh, 9);
  assert.equal(r.puntos[0].ignicion, true);
  assert.match(r.puntos[0].clave_fuente, /^hunter:[a-f0-9]{64}$/);
  assert.equal(r.resumen_hunter.distancia, '49.95 km');
});
test('Hunter: descarta paradas agrupadas, duplicados y datos inválidos', () => {
  const r = prepararRecorrido(captura([punto, punto, { ...punto, id: '2', stopNum: 1 }, { ...punto, id: '3', velocidad: 'parado' }]));
  assert.deepEqual(r.descartes, { paradas_agrupadas: 1, invalidos: 1, duplicados: 1 });
  assert.equal(r.puntos.length, 1);
});
test('Hunter: rechaza fechas inválidas y conserva ignición desconocida', () => {
  const r = prepararRecorrido(captura([{ ...punto, ignicion: '' }, { ...punto, id: '2', fecha: '2026-02-30' }]));
  assert.equal(r.puntos[0].ignicion, null);
  assert.equal(r.descartes.invalidos, 1);
});
test('Hunter: exige origen y estructura, no acepta un informe inventado', () => {
  assert.throws(() => prepararRecorrido({}), /Captura Hunter inválida/);
});
