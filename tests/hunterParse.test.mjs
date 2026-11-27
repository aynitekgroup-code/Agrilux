import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepararRecorrido } from '../agentes/hunter/parse.mjs';
import { generarReportesCsv } from '../agentes/hunter/reportes.mjs';
import { prepararRecorrido as prepararWeb } from '../agentes/hunter/parse-core.mjs';

const punto = { id: '1', fecha: '2026-11-20', hora: '18:41:39', velocidad: '9', ignicion: '1',
  latitud: '-6.773954', longitud: '-79.774499', nombre_vehiculo: 'CASE 2', name_tipo_dato_gps: 'Reporte Por Tiempo Móvil Encendido' };
const captura = (data) => ({ fuente: 'hunter360', equipo: '4764426102', desde: '2026-11-20T00:00:00-05:00', hasta: '2026-11-20T23:59:59-05:00', recorrido: { data, distance: '49.95 km' } });

test('Hunter: normaliza un punto realista y conserva ignición y fuente', () => {
  const r = prepararRecorrido(captura([punto]));
  assert.equal(r.puntos[0].fecha, '2026-11-20T18:41:39-05:00');
  assert.equal(r.puntos[0].velocidad_kmh, 9);
  assert.equal(r.puntos[0].ignicion, true);
  assert.match(r.puntos[0].clave_fuente, /^hunter:[a-f0-9]{64}$/);
  assert.equal(r.resumen_hunter.distancia, null);
  assert.equal(r.resumen_agrupado_disponible, false);
});
test('Hunter usa solo el resumen agrupado, no el resumen distinto de puntos sin agrupar', () => {
  const c = captura([punto]);
  c.agrupado = { data: [], distance: '10.91 km', time_stop: '23h 6m 37s' };
  c.recorrido.distance = '26.26 km';
  const r = prepararRecorrido(c);
  assert.equal(r.resumen_agrupado_disponible, true);
  assert.equal(r.resumen_hunter.distancia, '10.91 km');
  assert.equal(r.resumen_hunter.detenido, '23h 6m 37s');
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
test('Hunter: conserva viajes y paradas del proveedor sin inventar datos', () => {
  const c = captura([punto]);
  c.recorrido.data_trips = [{ type: 'stop', start: '2026-11-20 10:00:00', end: '2026-11-20 11:00:00', time: '01:00:00' }, { type: 'trip', time: '00:20:00' }];
  const r = prepararRecorrido(c);
  assert.equal(r.viajes_disponibles, true);
  assert.deepEqual(r.viajes.map((x) => x.tipo), ['Parada', 'Viaje']);
  assert.equal(r.viajes[0].duracion, '01:00:00');
});
test('Hunter: el reporte CSV neutraliza fórmulas sin alterar coordenadas', () => {
  const r = prepararRecorrido(captura([{ ...punto, domicilio: '=CMD()' }]));
  const archivos = generarReportesCsv(r);
  assert.match(archivos['hunter-puntos.csv'], /"'=CMD\(\)"/);
  assert.match(archivos['hunter-puntos.csv'], /"-6\.773954"/);
  assert.ok(archivos['hunter-resumen.csv'].startsWith('\ufeff'));
});
test('Hunter: rechaza un rango con fecha inválida', () => {
  assert.throws(() => prepararRecorrido({ ...captura([punto]), desde: 'invalido' }), /rango válido/);
});
test('Hunter: web y agente coinciden salvo la clave de persistencia', () => {
  const c = captura([punto]);
  const web = prepararWeb(c);
  const agente = prepararRecorrido(c);
  assert.equal(web.puntos[0].clave_fuente, null);
  web.puntos[0].clave_fuente = agente.puntos[0].clave_fuente;
  assert.deepEqual(web, agente);
});
