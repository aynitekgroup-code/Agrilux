import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizar,
  clavePlaca,
  formatearFechaPeru,
  detectarIntencion,
  resolverPregunta,
  sugerencias,
  armarContextoIa,
  TEXTO_AYUDA,
  LIMITE_FILAS_IA,
} from '../src/lib/preguntarAgrilux.js';

/* ── Fixture: mismas formas que agrotrack_estado_unidades_flota ──────────── */

const f = (extra) => ({
  placa: 'P01-1K',
  ultima_fecha: '2026-11-04T19:40:00-05:00',
  ultimo_evento: 'Conduciendo',
  ultima_velocidad: '40',
  direccion: null,
  latitud: -6.6,
  longitud: -79.6,
  geocerca: null,
  geocerca_division: null,
  geocerca_ultima: null,
  geocerca_ultima_fecha: null,
  ...extra,
});

const estado = [
  f({
    placa: 'P01-1K',
    geocerca: 'Lote Norte',
    geocerca_division: 'Pomalca 1',
    direccion: 'Panamericana Norte Km 5',
  }),
  f({
    placa: 'BPH-767',
    unidad: 'BPH-767/SEGURIDAD',
    ultima_fecha: '2026-11-04T18:00:00-05:00',
    ultimo_evento: 'Estacionado',
    ultima_velocidad: '0',
    geocerca: 'Lote Sur',
    geocerca_division: 'Pomalca 2',
  }),
  f({
    placa: 'C-09',
    ultima_fecha: '2026-11-04T17:30:00-05:00',
    ultimo_evento: 'Alto',
    ultima_velocidad: '0',
    geocerca: null,
    geocerca_ultima: 'Oficina Central',
    geocerca_ultima_fecha: '2026-11-04T15:00:00-05:00',
  }),
  f({
    placa: 'X-99',
    ultima_fecha: '2026-11-03T09:00:00-05:00',
    ultimo_evento: 'Estacionado',
    geocerca: null,
    geocerca_ultima: null,
    geocerca_ultima_fecha: null,
  }),
];

const grupos = {
  'P01-1K': 'Camiones',
  'BPH-767': 'Camiones',
  'C-09': 'Cosechadoras',
  'X-99': '',
};

const linea = (r, i) => r.lineas[i] ?? '';
const todo = (r) => r.lineas.join('\n');

/* ── utilidades ──────────────────────────────────────────────────────────── */

test('normalizar: minúsculas, sin acentos y sin espacios dobles', () => {
  assert.equal(normalizar('  ¿DÓNDE  está la unidad? '), '¿donde esta la unidad?');
});

test('clavePlaca ignora guiones y espacios', () => {
  assert.equal(clavePlaca('P01-1K'), 'p011k');
  assert.equal(clavePlaca(' p01 1k '), 'p011k');
});

test('formatearFechaPeru: hora de Perú (UTC-5)', () => {
  assert.equal(formatearFechaPeru('2026-11-04T19:40:00-05:00'), '04/11 19:40');
  assert.equal(formatearFechaPeru('2026-11-04T19:40:00.000Z'), '04/11 14:40');
  assert.equal(formatearFechaPeru(null), '—');
  assert.equal(formatearFechaPeru('no es fecha'), '—');
});

/* ── detección de intención ──────────────────────────────────────────────── */

test('intención: placa exacta, aunque venga con pregunta de geocerca', () => {
  const i = detectarIntencion('¿En qué geocerca está P01-1K?', { estado, grupos });
  assert.equal(i.tipo, 'placa');
  assert.equal(i.valor.fila.placa, 'P01-1K');
});

test('intención: prefijo único de placa', () => {
  const i = detectarIntencion('como esta p01', { estado, grupos });
  assert.equal(i.tipo, 'placa');
  assert.equal(i.valor.fila.placa, 'P01-1K');
});

test('intención: placa desconocida con forma de placa', () => {
  const i = detectarIntencion('¿dónde está la P99-9Z?', { estado, grupos });
  assert.equal(i.tipo, 'placa');
  assert.equal(i.valor.fila, null);
  assert.equal(i.valor.token, 'p99-9z');
});

test('intención: grupo, geocerca, resumen, ayuda e IA', () => {
  assert.equal(detectarIntencion('grupo de camiones', { estado, grupos }).tipo, 'grupo');
  assert.equal(detectarIntencion('¿quién está en Lote Norte?', { estado, grupos }).tipo, 'geocerca');
  assert.equal(detectarIntencion('estado de la flota', { estado, grupos }).tipo, 'resumen');
  assert.equal(detectarIntencion('ayuda', { estado, grupos }).tipo, 'ayuda');
  assert.equal(detectarIntencion('hola', { estado, grupos }).tipo, 'ayuda');
  assert.equal(detectarIntencion('', { estado, grupos }).tipo, 'ayuda');
  assert.equal(detectarIntencion('¿cuál es el pronóstico del tiempo?', { estado, grupos }).tipo, 'ia');
});

test('intención: "hola, ¿dónde está P01-1K?" NO es solo un saludo', () => {
  assert.equal(detectarIntencion('hola, ¿dónde está P01-1K?', { estado, grupos }).tipo, 'placa');
});

test('intención: "grupos de unidades" lista, no busca un grupo llamado "unidades"', () => {
  const i = detectarIntencion('¿grupos de unidades?', { estado, grupos });
  assert.equal(i.tipo, 'grupo');
  assert.equal(i.valor, '');
});

/* ── respuesta: placa ────────────────────────────────────────────────────── */

test('placa dentro de geocerca: geocerca con división, evento, fecha, dirección y grupo', () => {
  const r = resolverPregunta('¿dónde está p01-1k?', { estado, grupos });
  assert.equal(r.fuente, 'datos');
  assert.equal(r.tipo, 'placa');
  assert.equal(r.titulo, 'P01-1K');
  assert.match(linea(r, 0), /Geocerca actual: Lote Norte \(Pomalca 1\)/);
  assert.match(todo(r), /Último evento: Conduciendo · 40 km\/h/);
  assert.match(todo(r), /Última posición: 04\/11 19:40/);
  assert.match(todo(r), /Dirección: Panamericana Norte Km 5/);
  assert.match(todo(r), /Grupo: Camiones/);
});

test('placa fuera: fallback geocerca_ultima con su fecha', () => {
  const r = resolverPregunta('estado de c-09', { estado, grupos });
  assert.equal(r.tipo, 'placa');
  assert.match(linea(r, 0), /Fuera de geocerca — última conocida: Oficina Central \(04\/11 15:00\)/);
  assert.match(todo(r), /Grupo: Cosechadoras/);
});

test('placa sin grupo asignado lo dice', () => {
  const r = resolverPregunta('x-99', { estado, grupos });
  assert.match(todo(r), /Sin grupo asignado/);
  assert.match(linea(r, 0), /Sin geocerca actual ni eventos previos/);
});

test('placa con unidad distinta de la placa la muestra', () => {
  const r = resolverPregunta('BPH-767', { estado, grupos });
  assert.match(todo(r), /Unidad: BPH-767\/SEGURIDAD/);
  assert.match(todo(r), /Geocerca actual: Lote Sur/);
});

test('placa desconocida: explica que no está entre las N unidades', () => {
  const r = resolverPregunta('¿dónde está la P99-9Z?', { estado, grupos });
  assert.equal(r.fuente, 'datos');
  assert.match(linea(r, 0), /No encontré la placa "p99-9z" entre las 4 unidades/);
});

test('placa sin datos (empresa sin posiciones): mensaje claro', () => {
  const r = resolverPregunta('¿dónde está P01-1K?', { estado: [], grupos: {} });
  assert.equal(r.tipo, 'placa');
  assert.match(linea(r, 0), /Todavía no hay posiciones cargadas/);
});

/* ── respuesta: grupos ───────────────────────────────────────────────────── */

test('lista de grupos con conteo', () => {
  const r = resolverPregunta('¿qué grupos hay?', { estado, grupos });
  assert.equal(r.tipo, 'grupo');
  assert.equal(r.titulo, 'Grupos de unidades');
  assert.match(todo(r), /· Camiones: 2 \(P01-1K, BPH-767\)/);
  assert.match(todo(r), /· Cosechadoras: 1 \(C-09\)/);
  assert.match(todo(r), /1 unidades sin grupo asignado/);
});

test('grupo concreto: unidades con su geocerca y evento', () => {
  const r = resolverPregunta('grupo de camiones', { estado, grupos });
  assert.equal(r.titulo, 'Grupo Camiones');
  assert.match(linea(r, 0), /2 unidades en el grupo Camiones/);
  assert.match(todo(r), /· P01-1K — Lote Norte · Conduciendo/);
  assert.match(todo(r), /· BPH-767 — Lote Sur · Estacionado/);
});

test('grupo desconocido: lista los disponibles', () => {
  const r = resolverPregunta('grupo de trenes', { estado, grupos });
  assert.match(linea(r, 0), /No encontré el grupo "trenes"/);
  assert.match(todo(r), /Camiones, Cosechadoras/);
});

test('sin grupos asignados: aviso con qué hacer', () => {
  const r = resolverPregunta('grupos', { estado, grupos: {} });
  assert.match(linea(r, 0), /Todavía no hay grupos de unidades asignados/);
});

test('unidad del grupo sin posición en el periodo', () => {
  const r = resolverPregunta('grupo de camiones', {
    estado,
    grupos: { 'P01-1K': 'Camiones', ZZZ: 'Camiones' },
  });
  assert.match(todo(r), /· P01-1K — Lote Norte/);
  assert.match(todo(r), /· ZZZ — sin posición en el periodo/);
});

/* ── respuesta: geocercas ────────────────────────────────────────────────── */

test('geocerca por nombre: quién está dentro ahora', () => {
  const r = resolverPregunta('¿quién está en Lote Norte?', { estado, grupos });
  assert.equal(r.tipo, 'geocerca');
  assert.equal(r.titulo, 'Lote Norte');
  assert.match(linea(r, 0), /1 unidad en Lote Norte ahora/);
  assert.match(todo(r), /· P01-1K \(Camiones\) · Conduciendo/);
});

test('geocerca por token del nombre ("el norte")', () => {
  const r = resolverPregunta('¿quién está en el norte?', { estado, grupos });
  assert.equal(r.titulo, 'Lote Norte');
});

test('geocerca sin unidades dentro: cae en geocerca_ultima', () => {
  const r = resolverPregunta('¿quién está en Oficina Central?', { estado, grupos });
  assert.match(linea(r, 0), /Ninguna unidad está ahora en Oficina Central/);
  assert.match(todo(r), /Última en estar: C-09 \(04\/11 15:00\)/);
});

test('listado de geocercas ocupadas con el conteo y las que están fuera', () => {
  const r = resolverPregunta('¿qué geocercas hay ocupadas?', { estado, grupos });
  assert.equal(r.titulo, 'Geocercas ocupadas');
  assert.match(todo(r), /· Lote Norte: 1 unidad/);
  assert.match(todo(r), /· Lote Sur: 1 unidad/);
  assert.match(todo(r), /· Sin geocerca actual: 2 unidades/);
});

test('geocerca por división', () => {
  const r = resolverPregunta('¿quién está en Pomalca 1?', { estado, grupos });
  assert.equal(r.titulo, 'División Pomalca 1');
  assert.match(linea(r, 0), /1 unidad en la división Pomalca 1/);
  assert.match(todo(r), /· P01-1K — Lote Norte/);
});

/* ── respuesta: resumen y ayuda ──────────────────────────────────────────── */

test('resumen de la flota: totales, geocercas y fallback', () => {
  const r = resolverPregunta('estado de la flota', { estado, grupos });
  assert.equal(r.tipo, 'resumen');
  assert.match(linea(r, 0), /4 unidades con posición · última actualización 04\/11 19:40/);
  assert.match(linea(r, 1), /2 dentro de una geocerca · 2 fuera/);
  assert.match(todo(r), /· Lote Norte: 1/);
  assert.match(todo(r), /Fuera con última geocerca conocida: C-09 \(Oficina Central\)/);
});

test('resumen sin datos', () => {
  const r = resolverPregunta('resumen', { estado: [], grupos: {} });
  assert.match(linea(r, 0), /No hay posiciones en el periodo/);
});

test('ayuda: devuelve los ejemplos', () => {
  const r = resolverPregunta('ayuda', { estado, grupos });
  assert.equal(r.fuente, 'ayuda');
  assert.deepEqual(r.lineas, TEXTO_AYUDA);
  assert.match(todo(r), /Estado de la flota/);
});

/* ── fallback IA ─────────────────────────────────────────────────────────── */

test('pregunta fuera del parser -> fuente ia', () => {
  const r = resolverPregunta('¿cuál es el pronóstico para mañana?', { estado, grupos });
  assert.equal(r.fuente, 'ia');
  assert.equal(r.tipo, 'ia');
  assert.deepEqual(r.lineas, []);
});

test('armarContextoIa: pregunta + estado agregado + reglas, sin filas crudas', () => {
  const contexto = armarContextoIa('¿y los camiones?', { estado, grupos });
  assert.match(contexto, /Pregunta del usuario: "\¿y los camiones\?"/);
  assert.match(contexto, /P01-1K \| Lote Norte \| Conduciendo \| 04\/11 19:40 \| 40 km\/h \| Camiones/);
  assert.match(contexto, /C-09 \| fuera \(ultima: Oficina Central\)/);
  assert.match(contexto, /no inventes placas/);
  assert.ok(contexto.length < 7000, `contexto demasiado largo: ${contexto.length}`);
});

test('armarContextoIa recorta a LIMITE_FILAS_IA', () => {
  const muchas = Array.from({ length: 90 }, (_, i) => f({ placa: `U-${String(i).padStart(3, '0')}` }));
  const contexto = armarContextoIa('x', { estado: muchas, grupos: {} });
  assert.match(contexto, /… y 30 unidades más/);
  assert.ok(!contexto.includes('U-060'), 'no debe incluir la fila 61');
  assert.ok(contexto.includes('U-059'), 'debe incluir hasta la fila 60');
  assert.equal(LIMITE_FILAS_IA, 60);
});

/* ── sugerencias (chips) ─────────────────────────────────────────────────── */

test('sugerencias: la primera usa una placa real del estado', () => {
  const chips = sugerencias({ estado });
  assert.equal(chips.length, 4);
  assert.equal(chips[0], '¿En qué geocerca está P01-1K?');
  assert.ok(chips.includes('Estado de la flota'));
});

test('sugerencias sin datos: no inventa placas', () => {
  const chips = sugerencias({ estado: [] });
  assert.equal(chips[0], 'Estado de la flota');
  assert.ok(!chips.some((c) => /P01/.test(c)));
});
