import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  priorizarAlertas,
  armarContextoAlertas,
  mapaAccionesPorClave,
  claveAlerta,
  PESO_SEVERIDAD,
} from '../src/lib/priorizarAlertas.js';
import { armarContextoBriefing, LIMITE_BRIEFING } from '../src/lib/briefingFlota.js';
import { armarContextoReporte, LIMITE_FILAS_REPORTE, LIMITE_REPORTE } from '../src/lib/reportesIa.js';
import {
  validarPropuestaGeocerca,
  armarContextoGeocerca,
  bboxDeCentros,
  areaPoligono,
} from '../src/lib/geocercaIa.js';
import { validarEvaluacionCorte, armarContextoCorte, VEREDICTOS } from '../src/lib/corteIa.js';

const alerta = (id, extra = {}) => ({
  id,
  vehiculo_id: 'ABC123',
  placa: 'ABC123',
  tipo: 'Alta velocidad',
  mensaje: '102 km/h · Panamericana Norte',
  severidad: 'alta',
  fecha: '12/11/2026 08:10',
  fecha_iso: '2026-11-12T08:10:00-05:00',
  ...extra,
});

/* ── priorizarAlertas ─────────────────────────────────────────────────── */

test('agrupa las alertas repetidas de distintas unidades en UN grupo', () => {
  const alertas = [
    alerta('a1'),
    alerta('a2', { placa: 'XYZ789', vehiculo_id: 'XYZ789' }),
    alerta('a3', { placa: 'DEF456', vehiculo_id: 'DEF456' }),
  ];
  const grupos = priorizarAlertas(alertas, { ahora: Date.parse('2026-11-12T12:00:00-05:00') });
  assert.equal(grupos.length, 1, 'tres alertas iguales deben ser UN grupo');
  assert.equal(grupos[0].total, 3);
  assert.equal(grupos[0].unidades.length, 3);
  assert.deepEqual(grupos[0].ids, ['a1', 'a2', 'a3']);
});

test('la clave de agrupación ignora números y acentos (velocidades distintas = mismo grupo)', () => {
  assert.equal(claveAlerta(alerta('a')), claveAlerta(alerta('b', { mensaje: '88 km/h · Panamericana Norte' })));
  assert.notEqual(claveAlerta(alerta('a')), claveAlerta(alerta('c', { tipo: 'Botón de pánico' })));
});

test('ordena por severidad y puntúa más alto lo crítico que lo informativo', () => {
  const grupos = priorizarAlertas([
    alerta('i1', { tipo: 'Info', severidad: 'info', mensaje: 'Sin señal GPS' }),
    alerta('c1', { tipo: 'Botón de pánico', severidad: 'critica', mensaje: 'Activado' }),
    alerta('m1', { tipo: 'Ralentí', severidad: 'media', mensaje: '35 % del encendido' }),
  ], { ahora: Date.parse('2026-11-12T12:00:00-05:00') });

  assert.equal(grupos[0].severidad, 'critica');
  assert.ok(grupos[0].puntuacion > grupos[1].puntuacion);
  assert.ok(grupos[1].puntuacion > grupos[2].puntuacion);
  assert.equal(grupos[0].puntuacion, PESO_SEVERIDAD.critica + 3 + 15);
});

test('un banco de alertas vacío o malformado devuelve lista vacía', () => {
  assert.deepEqual(priorizarAlertas([]), []);
  assert.deepEqual(priorizarAlertas(null), []);
  assert.deepEqual(priorizarAlertas([null, undefined]), []);
});

test('el contexto para la IA solo lleva lo agregado y las claves exactas', () => {
  const grupos = priorizarAlertas([alerta('a1'), alerta('a2', { placa: 'XYZ789' })]);
  const texto = armarContextoAlertas(grupos, { empresa: 'Pomalca', rango: '12/11' });
  assert.match(texto, /Empresa: Pomalca/);
  assert.match(texto, /alta \| 2 \| 2 \|/);
  assert.ok(texto.length < 7000, 'el contexto no debe pasar el tope del servidor');
});

test('las acciones de la IA se pintan solo si la clave existe de verdad', () => {
  const grupos = priorizarAlertas([alerta('a1')]);
  const mapa = mapaAccionesPorClave(
    { resumen: 'ok', grupos: [{ clave: grupos[0].clave, accion: 'Llamar al conductor' }, { clave: 'inventada', accion: 'x' }] },
    grupos,
  );
  assert.deepEqual(Object.keys(mapa), [grupos[0].clave]);
  assert.equal(mapa[grupos[0].clave], 'Llamar al conductor');
});

/* ── briefingFlota ────────────────────────────────────────────────────── */

test('el briefing resume totales, estados y alertas sin filas crudas', () => {
  const texto = armarContextoBriefing({
    empresa: 'Agrilux',
    periodo: { desde: '2026-11-01', hasta: '2026-11-12', unidades: 42, registros: 103000 },
    unidades: [
      { placa: 'A1', estado: 'en viaje', km_recorridos: 120.4, velocidad_kmh: 62, eventos_alta_velocidad: 1 },
      { placa: 'B2', estado: 'detenida', km_recorridos: 0, velocidad_kmh: 0, eventos_alta_velocidad: 0 },
    ],
    alertas: [alerta('a1'), alerta('a2', { severidad: 'critica' })],
    cortesPendientes: 1,
    cortesAplicados: 2,
  });

  assert.match(texto, /Empresa: Agrilux/);
  assert.match(texto, /Unidades: 2/);
  assert.match(texto, /en viaje: 1/);
  assert.match(texto, /Órdenes de corte: 2 aplicadas · 1 pendientes/);
  assert.match(texto, /ÚLTIMAS ALERTAS/);
  assert.ok(texto.length <= LIMITE_BRIEFING);
});

test('el briefing con datos vacíos sigue devolviendo un contexto usable', () => {
  const texto = armarContextoBriefing({});
  assert.match(texto, /sin periodo cargado/);
  assert.match(texto, /ninguna/);
  assert.ok(texto.length <= LIMITE_BRIEFING);
});

/* ── reportesIa ───────────────────────────────────────────────────────── */

test('el contexto del reporte trae columnas, filas y recorta el exceso', () => {
  const filas = Array.from({ length: 120 }, (_, i) => ({
    unidad: `UNI-${i}`,
    km: (i * 3.5).toFixed(1),
    motor_h: '8 h 15 min',
  }));
  const texto = armarContextoReporte({
    reporte: 'Rendimiento del vehículo',
    grupo: 'Rendimientos',
    rango: 'noviembre',
    columnas: ['unidad', 'km', 'motor_h'],
    filas,
  });

  assert.match(texto, /Nombre: Rendimiento del vehículo/);
  assert.match(texto, /Columnas: unidad \| km \| motor_h/);
  assert.match(texto, /UNI-0/);
  assert.ok(!texto.includes(`UNI-${LIMITE_FILAS_REPORTE}`), 'no debe mandar más de 40 filas');
  assert.ok(texto.includes('no enviadas'));
  assert.ok(texto.length <= LIMITE_REPORTE);
});

test('un reporte sin filas se explica en lugar de mandar nada', () => {
  const texto = armarContextoReporte({ reporte: 'Alertas', columnas: ['fecha'], filas: [] });
  assert.match(texto, /Sin filas en ese rango/);
});

/* ── geocercaIa ───────────────────────────────────────────────────────── */

const propuestaValida = {
  nombre: 'Bodega Chongoyape',
  puntos: [
    [-6.85, -79.80],
    [-6.85, -79.78],
    [-6.83, -79.78],
    [-6.83, -79.80],
  ],
  advertencia: 'Verifica que no invada el lindero del vecino.',
};

test('una propuesta correcta se acepta con sus 4 puntos', () => {
  const res = validarPropuestaGeocerca(propuestaValida);
  assert.equal(res.valido, true);
  assert.equal(res.errores.length, 0);
  assert.equal(res.puntos.length, 4);
  assert.equal(res.nombre, 'Bodega Chongoyape');
});

test('se rechazan polígonos con menos de 3 puntos o coordenadas imposibles', () => {
  assert.equal(validarPropuestaGeocerca({ ...propuestaValida, puntos: [[-6.8, -79.8], [-6.7, -79.7]] }).valido, false);
  assert.equal(
    validarPropuestaGeocerca({ ...propuestaValida, puntos: [[999, -79.8], [-6.85, -79.78], [-6.83, -79.78]] }).valido,
    false,
  );
  assert.equal(validarPropuestaGeocerca({ ...propuestaValida, nombre: '' }).valido, false);
  assert.equal(validarPropuestaGeocerca(null).valido, false);
});

test('una propuesta fuera de la zona de la empresa se rechaza', () => {
  const bbox = bboxDeCentros([{ lat: -6.81, lon: -79.77 }, { lat: -6.9, lon: -79.6 }]);
  const lejos = {
    ...propuestaValida,
    puntos: [
      [-12.05, -77.05],
      [-12.05, -77.0],
      [-12.0, -77.0],
      [-12.0, -77.05],
    ],
  };
  const res = validarPropuestaGeocerca(lejos, { bbox });
  assert.equal(res.valido, false);
  assert.match(res.errores.join(' '), /zona de la empresa/);
});

test('un polígono degenerado (todos los puntos iguales) se rechaza', () => {
  const res = validarPropuestaGeocerca({
    ...propuestaValida,
    puntos: [[-6.8, -79.8], [-6.8, -79.8], [-6.8, -79.8], [-6.8, -79.8]],
  });
  assert.equal(res.valido, false);
  assert.ok(areaPoligono(propuestaValida.puntos) > 0);
});

test('el contexto de geocercas solo incluye nombre, grupo y centro', () => {
  const texto = armarContextoGeocerca({
    instruccion: 'un cuadrado de 200 m alrededor de la oficina',
    geocercas: [{ nombre: 'Oficina central', grupo: 'Oficinas', vertices: 12, centro: { lat: -6.81, lon: -79.77 } }],
  });
  assert.match(texto, /INSTRUCCIÓN DEL USUARIO/);
  assert.match(texto, /Oficina central/);
  assert.match(texto, /centro -6.81, -79.77/);
  assert.ok(texto.length < 7000);
});

/* ── corteIa ──────────────────────────────────────────────────────────── */

test('la evaluación del corte se valida y el veredicto desconocido cae en precaución', () => {
  const ok = validarEvaluacionCorte({
    veredicto: 'no_apto',
    justificacion: 'La unidad reporta 45 km/h y sin conexión.',
    riesgos: ['Cortar en movimiento', 'Perder telemetría'],
  });
  assert.equal(ok.valido, true);
  assert.equal(ok.veredicto, 'no_apto');
  assert.equal(ok.riesgos.length, 2);

  const raro = validarEvaluacionCorte({ veredicto: 'autorizado', justificacion: 'x' });
  assert.equal(raro.veredicto, 'precaucion', 'ante la duda siempre el veredicto más cauteloso');

  assert.equal(validarEvaluacionCorte({ veredicto: 'apto' }).valido, false, 'sin justificación no vale');
  assert.equal(validarEvaluacionCorte(null).valido, false);
});

test('todos los veredictos aceptados son los declarados', () => {
  assert.deepEqual(VEREDICTOS, ['apto', 'precaucion', 'no_apto']);
});

test('el contexto del corte trae solo el estado de UNA unidad y recuerda quién decide', () => {
  const texto = armarContextoCorte({
    vehiculo: {
      placa: 'ABC123',
      modelo: 'JCB 3DX',
      conectado: true,
      velocidad_kmh: 0,
      ignicion: false,
      odometro_km: 12000,
      estado: 'detenida',
      ultima_ubicacion: 'Chongoyape',
    },
    motivo: 'Sospecha de extracción de combustible',
    responsable: 'Carlos Perez',
    hora: '12/11/2026 09:15',
  });

  assert.match(texto, /ABC123/);
  assert.match(texto, /velocidad 0 km\/h/);
  assert.match(texto, /Motivo escrito por el supervisor: Sospecha de extracción/);
  assert.match(texto, /el supervisor confirma con PIN/);
  assert.ok(texto.length < 7000);
});
