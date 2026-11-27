import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerEstadoHunter, leerRecorridoHunter } from '../agentes/hunter/cliente.mjs';
import { prepararRecorrido } from '../agentes/hunter/parse-core.mjs';

function respuesta(status, cookies, json) {
  return { status, ok: status >= 200 && status < 300, headers: { getSetCookie: () => cookies }, json: async () => json };
}
test('Hunter: inicio de sesión y lectura usan cookies sin exponer credenciales', async () => {
  const llamadas = [];
  const fetchFn = async (url, opts) => {
    llamadas.push({ url, opts });
    if (llamadas.length === 1) return respuesta(200, ['sid=antes; Path=/'], null);
    if (llamadas.length === 2) return respuesta(302, ['sid=despues; Path=/'], null);
    return respuesta(200, [], { 123: { Nombre: 'Equipo' } });
  };
  const datos = await leerEstadoHunter('usuario', 'clave', fetchFn);
  assert.equal(datos['123'].Nombre, 'Equipo');
  assert.equal(llamadas[2].opts.headers.cookie, 'sid=despues');
  assert.equal(llamadas[2].opts.headers.cookie.includes('clave'), false);
});
test('Hunter: no acepta respuesta vacía ni errores', async () => {
  const respuestas = [respuesta(200, [], null), respuesta(302, [], null), respuesta(200, [], {})];
  await assert.rejects(() => leerEstadoHunter('u', 'p', async () => respuestas.shift()), /unidades válidas/);
});

test('Hunter: consulta un día por equipo y conserva el recorrido separado', async () => {
  const llamadas = [];
  const fetchFn = async (url, opts) => {
    llamadas.push({ url, opts });
    if (llamadas.length === 1) return respuesta(200, ['sid=a; Path=/'], null);
    if (llamadas.length === 2) return respuesta(302, ['sid=b; Path=/'], null);
    return respuesta(200, [], { 123: { data: [] } });
  };
  const captura = await leerRecorridoHunter('u', 'p', { equipo: '123', dia: '2026-11-25' }, fetchFn);
  assert.match(llamadas[2].url, /Recorridos\/trazarRecorridos$/);
  assert.equal(llamadas[2].opts.body.get('IdVehiculos'), '123');
  assert.equal(llamadas[2].opts.body.get('AllowCreateStops'), 'denied');
  assert.equal(llamadas[3].opts.body.get('AllowCreateStops'), 'allow');
  assert.equal(prepararRecorrido(captura).equipo_id, '123');
  await assert.rejects(() => leerRecorridoHunter('u', 'p', { equipo: '123', dia: '2026-02-30' }, fetchFn), /inválidos/);
});

test('Hunter conserva puntos sin agrupar si falla el resumen agrupado', async () => {
  let n = 0;
  const datos = await leerRecorridoHunter('u', 'p', { equipo: '123', dia: '2026-11-25' }, async () => {
    n++;
    if (n === 1) return respuesta(200, [], null);
    if (n === 2) return respuesta(302, [], null);
    if (n === 3) return respuesta(200, [], { 123: { data: [] } });
    return respuesta(503, [], null);
  });
  assert.equal(datos.agrupado, null);
  assert.deepEqual(datos.recorrido.data, []);
});
