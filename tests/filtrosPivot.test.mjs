import test from 'node:test';
import assert from 'node:assert/strict';
import {
  crearSeleccion,
  todosMarcados,
  alternarValor,
  alternarTodos,
  seleccionAAplicar,
  pasaFiltro,
} from '../src/lib/filtrosPivot.js';

const opciones = [
  { valor: 'Base Pomalca' },
  { valor: 'Distrito Chiclayo' },
  { valor: 'Distrito Pomalca' },
];
const todos = opciones.map((o) => o.valor);

test('sin filtro, el panel abre con todos los nombres marcados', () => {
  assert.deepEqual(crearSeleccion(null, opciones), todos);
  assert.equal(todosMarcados(crearSeleccion(null, opciones), opciones), true);
});

test('con filtro aplicado, el panel abre con esa selección', () => {
  assert.deepEqual(crearSeleccion(['Distrito Chiclayo'], opciones), ['Distrito Chiclayo']);
  assert.equal(todosMarcados(['Distrito Chiclayo'], opciones), false);
});

test('desmarcar (Todos) desmarca todos los nombres', () => {
  const borrador = crearSeleccion(null, opciones);
  const despues = alternarTodos(borrador, opciones);
  assert.deepEqual(despues, []);
  assert.equal(todosMarcados(despues, opciones), false);
});

test('volver a marcar (Todos) marca todos los nombres', () => {
  assert.deepEqual(alternarTodos([], opciones), todos);
});

test('desmarcar un nombre lo quita y deja el resto', () => {
  const despues = alternarValor(todos, 'Distrito Chiclayo');
  assert.deepEqual(despues, ['Base Pomalca', 'Distrito Pomalca']);
  assert.equal(todosMarcados(despues, opciones), false);
});

test('marcar de nuevo un nombre lo agrega sin duplicados', () => {
  const despues = alternarValor(['Base Pomalca'], 'Distrito Chiclayo');
  assert.deepEqual(despues, ['Base Pomalca', 'Distrito Chiclayo']);
});

test('si están todos marcados, aplicar equivale a quitar el filtro', () => {
  assert.equal(seleccionAAplicar(todos, opciones), null);
});

test('si no hay ninguno marcado, se aplica una selección vacía', () => {
  assert.deepEqual(seleccionAAplicar([], opciones), []);
});

test('un subconjunto se aplica tal cual', () => {
  assert.deepEqual(seleccionAAplicar(['Base Pomalca'], opciones), ['Base Pomalca']);
});

test('pasaFiltro: sin filtro pasa todo; sin selección no pasa nada', () => {
  assert.equal(pasaFiltro(null, 'Base Pomalca'), true);
  assert.equal(pasaFiltro([], 'Base Pomalca'), false);
  assert.equal(pasaFiltro(['Base Pomalca'], 'Base Pomalca'), true);
  assert.equal(pasaFiltro(['Base Pomalca'], 'Distrito Pomalca'), false);
});
