import test from 'node:test';
import assert from 'node:assert/strict';
import { soloModuloGestion } from '../src/lib/alcanceNavegacion.js';

const EMPRESAS = [
  { id: 'e-pomalca', nombre: 'Pomalca' },
  { id: 'e-otra', nombre: 'Agrícola El Sol' },
];

test('Pomalca como empresa activa habilita solo Gestión', () => {
  assert.equal(
    soloModuloGestion({
      empresa_activa_id: 'e-pomalca',
      empresas_disponibles: EMPRESAS,
      email: 'carlos@ejemplo.com',
    }),
    true,
  );
});

test('Otras empresas conservan la navegación completa', () => {
  assert.equal(
    soloModuloGestion({
      empresa_activa_id: 'e-otra',
      empresas_disponibles: EMPRESAS,
      email: 'carlos@ejemplo.com',
    }),
    false,
  );
});

test('Sin empresa activa no se restringe nada', () => {
  assert.equal(
    soloModuloGestion({ empresa_activa_id: null, empresas_disponibles: EMPRESAS, email: 'x@y.z' }),
    false,
  );
  assert.equal(soloModuloGestion({}), false);
});

test('El nombre se compara sin importar mayúsculas ni espacios', () => {
  assert.equal(
    soloModuloGestion({
      empresa_activa_id: 'e-otra',
      empresas_disponibles: [{ id: 'e-otra', nombre: '  POMALCA ' }],
      email: 'x@y.z',
    }),
    true,
  );
});

test('El administrador del sistema conserva todos los módulos', () => {
  assert.equal(
    soloModuloGestion({
      empresa_activa_id: 'e-pomalca',
      empresas_disponibles: EMPRESAS,
      email: 'aynitek.group@gmail.com',
    }),
    false,
  );
});
