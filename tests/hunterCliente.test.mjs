import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leerEstadoHunter } from '../agentes/hunter/cliente.mjs';

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
