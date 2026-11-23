import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

// Ejecuta los handlers reales con red/DB simuladas. Ninguna credencial ni
// llamada a Zonar/Supabase: se verifica la reutilización del isolate.
function cargarHandler(nombre) {
  let handler;
  let ahora = Date.parse('2026-11-23T10:00:00Z');
  const llamadas = [];
  const cliente = {
    auth: { signInWithPassword: async () => ({ data: { session: {
      access_token: 'token-de-prueba', expires_at: Math.floor(ahora / 1000) + 3600,
    } } }) },
    rpc: async (rpc, params) => { llamadas.push({ rpc, params }); return { data: [], error: null }; },
  };
  const fuente = readFileSync(new URL(`../supabase/functions/${nombre}/index.ts`, import.meta.url), 'utf8');
  const codigo = transformSync(fuente, { loader: 'ts', format: 'cjs' }).code;
  class Reloj extends Date { static now() { return ahora; } }
  vm.runInNewContext(codigo, {
    require: (id) => {
      if (id.startsWith('npm:')) return { createClient: () => cliente };
      if (id.endsWith('zonar.js')) return {
        loginZonar: async () => ({ token: 'prueba' }), crudoUnidades: async () => [],
        listarUnidades: async () => [], historialUnidad: async () => [],
        hoyPeru: () => '2026-11-23', restarDias: () => '2026-11-22',
      };
      if (id.endsWith('localizador.js')) return { filasDesdeLocalizador: () => ({ filas: [] }) };
      if (id.endsWith('parse.js')) return { armarFilaZonar: () => ({ row: null }) };
      throw new Error(`Import inesperado: ${id}`);
    },
    Deno: { env: { get: (key) => key === 'CRON_SECRET' ? 'secreto-de-prueba' : 'prueba' }, serve: (fn) => { handler = fn; } },
    Date: Reloj, Response, console: { log() {}, warn() {}, error() {} },
    setTimeout, clearTimeout,
  });
  return { handler, llamadas, avanzar: (ms) => { ahora += ms; } };
}

for (const nombre of ['envivo', 'envivo-rapido']) {
  test(`${nombre}: una segunda invocación reutilizada tiene presupuesto nuevo`, async () => {
    const { handler, llamadas, avanzar } = cargarHandler(nombre);
    const solicitud = () => new Request('https://ejemplo.test', { headers: { 'x-cron-secret': 'secreto-de-prueba' } });
    const primera = await (await handler(solicitud())).json();
    avanzar(600000);
    const segunda = await (await handler(solicitud())).json();
    assert.equal(primera.ok, true);
    assert.equal(segunda.ok, true);
    assert.equal(segunda.ms, 0, 'No debe acumular la edad del isolate');
    if (nombre === 'envivo') {
      assert.ok(llamadas.filter((c) => c.rpc === 'agrotrack_visitas_dia_pendientes').length >= 4);
      const primeraConsulta = llamadas.find((c) => c.rpc === 'agrotrack_visitas_dia_pendientes');
      assert.equal(primeraConsulta.params.p_hasta_dia, '2026-11-22', 'Ayer debe tener prioridad');
    }
  });
  test(`${nombre}: rechaza un cron no autorizado`, async () => {
    const { handler } = cargarHandler(nombre);
    assert.equal((await handler(new Request('https://ejemplo.test'))).status, 401);
  });
}
