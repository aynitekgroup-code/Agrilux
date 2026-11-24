import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completarUnidadesReporte, calcularSinReportar, describirPosicion, recorridoEsCero, compararUnidades } from '../src/lib/agrotrackReporteFilas.js';

test('recorrido cero distingue cero medido de ausencia de datos', () => {
  assert.equal(recorridoEsCero({ km_recorridos: 0 }), true);
  assert.equal(recorridoEsCero({ km_recorridos: '0' }), true);
  assert.equal(recorridoEsCero({ km_recorridos: 0, sin_datos_rango: true }), false);
  assert.equal(recorridoEsCero({ km_recorridos: null }), false);
  assert.equal(recorridoEsCero({ km_recorridos: '' }), false);
  assert.equal(recorridoEsCero({ km_recorridos: 0.01 }), false);
});

test('unidades Hunter se ordenan por nombre con números naturales', () => {
  const filas = [{ unidad: 'CASE 10', equipo_id: '2' }, { unidad: 'CASE 2', equipo_id: '1' }];
  assert.deepEqual(filas.sort(compararUnidades).map((f) => f.unidad), ['CASE 2', 'CASE 10']);
});
import { calcularEventosResumidos } from '../src/lib/agrotrackEventosResumidos.js';
import { recortarVisitasConSql } from '../src/lib/agrotrackVisitasDia.js';
import { readFileSync } from 'node:fs';

test('actividad incluye las 44 unidades aunque solo 36 tengan datos del rango', () => {
  const unidades = Array.from({ length: 44 }, (_, i) => ({ placa: `U${i}` }));
  const datos = unidades.slice(0, 36).map((u) => ({ ...u, km_recorridos: 0, viaje_segundos: 0 }));
  const filas = completarUnidadesReporte(datos, unidades);
  assert.equal(filas.length, 44);
  assert.equal(filas[35].sin_datos_rango, undefined);
  assert.equal(filas[36].km_recorridos, 0);
  assert.equal(filas[36].viaje_segundos, null);
  assert.equal(filas[36].sin_datos_rango, true);
});

test('completar no duplica placas y respeta el padrón ya filtrado', () => {
  const filas = completarUnidadesReporte([{ placa: ' a ' }], [{ placa: 'A' }, { placa: 'B' }, { placa: 'B' }]);
  assert.equal(filas.length, 2);
  assert.deepEqual(completarUnidadesReporte([], []), []);
});

test('sin datos NO se convierte en 100% Stop ni inventa horas apagada', () => {
  const filas = calcularEventosResumidos(completarUnidadesReporte([], [{ placa: 'TALLER' }]), 86400);
  assert.equal(filas[0].stop, null);
  assert.equal(filas[0].pct_stop, null);
  assert.equal(filas[0].total, null);
});

test('sin reportar aplica 8/16/24/48 h y conserva estados para Excel', () => {
  const ahora = new Date('2026-11-23T12:00:00Z');
  const filas = [
    { placa: 'VIEJA', ultima_fecha: '2026-11-22T11:00:00Z' },
    { placa: 'NUEVA', ultima_fecha: '2026-11-23T11:00:00Z' },
    { placa: 'NUNCA', ultima_fecha: null },
  ];
  for (const h of [8, 16, 24]) {
    const resultado = calcularSinReportar(filas, ahora, h);
    assert.deepEqual(resultado.map((f) => f.placa), ['NUNCA', 'VIEJA']);
    assert.ok(resultado.every((f) => f.sinReportar && f.transcurrido));
  }
  assert.deepEqual(calcularSinReportar(filas, ahora, 48).map((f) => f.placa), ['NUNCA']);
});

test('posiciones antiguas y sin fecha nunca se anuncian como actuales', () => {
  const ahora = new Date('2026-11-23T12:00:00Z');
  assert.equal(describirPosicion('2026-05-15T12:00:00Z', ahora).reciente, false);
  assert.equal(describirPosicion(null, ahora).reciente, false);
  assert.equal(describirPosicion('2026-11-23T11:59:00Z', ahora).reciente, true);
});

const visita = { dia: '2026-11-22', placa: 'A', geocerca: 'Lote', unidad: 'A/MAQUINA',
  entrada: '2026-11-22T08:00:00-05:00', salida: '2026-11-22T12:00:00-05:00',
  duracion_segundos: 14400, apagado_segundos: 7200, ralenti_segundos: 3600, viaje_segundos: 3600 };

test('visita 08–12 consultada 10–11 usa 1 h SQL, no las 4 h ni reparto proporcional', async () => {
  const filas = await recortarVisitasConSql([visita], '2026-11-22T10:00:00-05:00', '2026-11-22T11:00:00-05:00', async (tarea) => {
    assert.equal(tarea.placa, 'A');
    assert.equal(tarea.desde, '2026-11-22T15:00:00.000Z');
    return [{ ...visita, entrada: tarea.desde, salida: tarea.hasta,
      duracion_segundos: 3600, apagado_segundos: 0, ralenti_segundos: 0, viaje_segundos: 3600 }];
  });
  assert.equal(filas[0].duracion_segundos, 3600);
  assert.equal(filas[0].viaje_segundos, 3600);
  assert.equal(filas[0].apagado_segundos, 0);
});

test('días completos reutilizan el respaldo sin ejecutar PostGIS', async () => {
  const filas = await recortarVisitasConSql([visita], '2026-11-22T00:00:00-05:00', '2026-11-22T23:59:59-05:00', () => assert.fail('No debe recalcular'));
  assert.equal(filas[0], visita);
});

test('cambiar de rango detiene las consultas horarias pendientes', async () => {
  let llamadas = 0;
  await assert.rejects(recortarVisitasConSql([visita], visita.entrada, visita.salida,
    async () => { llamadas++; return []; }, () => true), /cancelada/);
  assert.equal(llamadas, 0);
});

test('un timeout de corte horario no se disfraza de cifras aproximadas', async () => {
  await assert.rejects(recortarVisitasConSql([visita], visita.entrada, visita.salida, () => { throw new Error('timeout'); }), /timeout/);
});

test('corte horario bloquea respuestas potencialmente truncadas por PostgREST', async () => {
  await assert.rejects(recortarVisitasConSql([visita], visita.entrada, visita.salida, async () => Array(1000).fill(visita)), /1000/);
});

test('páginas históricas conservan el último instante y no duplican los cortes', () => {
  // Cargar el planificador real sin inicializar el cliente Supabase de Vite.
  const fuente = readFileSync(new URL('../src/lib/agrotrackMapaHistorico.js', import.meta.url), 'utf8');
  const inicio = fuente.indexOf('export function planearPaginas');
  const fin = fuente.indexOf('\n}', inicio) + 2;
  const planear = new Function('MAX_PAGINAS_RECORRIDO', 'VENTANA_OBJETIVO_MS', 'isoDe',
    fuente.slice(inicio, fin).replace('export ', '') + '; return planearPaginas;')(20, 16 * 3600000, (ms) => new Date(ms).toISOString());
  for (const horas of [1, 16, 24, 72]) {
    const desde = Date.parse('2026-11-22T00:00:00-05:00');
    const hasta = desde + horas * 3600000;
    const p = planear(new Date(desde).toISOString(), new Date(hasta).toISOString());
    assert.equal(p.paginas[0].desdeMs, desde);
    assert.equal(p.paginas.at(-1).hastaMs, hasta);
    for (let i = 1; i < p.paginas.length; i++) assert.equal(p.paginas[i].desdeMs, p.paginas[i - 1].hastaMs + 1);
  }
});
