import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/voice-assistant.js';

function respuesta() {
  return { statusCode: 200, setHeader() {}, status(codigo) { this.statusCode = codigo; return this; }, json(data) { this.data = data; return this; }, end() { return this; } };
}

test('Gestión y mapa usan solo OpenRouter gratuito y no cambian a proveedores de pago', async () => {
  const anterior = globalThis.fetch;
  process.env.OPENROUTER_API_KEY = 'clave-de-prueba';
  process.env.DEEPSEEK_API_KEY = 'clave-de-prueba';
  const llamadas = [];
  globalThis.fetch = async (url, opciones) => {
    llamadas.push({ url, modelo: JSON.parse(opciones.body).model });
    return { ok: false, status: 429, json: async () => ({ error: { message: 'sin cuota' } }) };
  };
  try {
    for (const body of [{ modo: 'briefing', contexto: 'datos ficticios' }, { modo: 'mapa', mensaje: 'prueba', geocercas: [], unidades: [] }]) {
      await handler({ method: 'POST', body }, respuesta());
    }
    assert.equal(llamadas.length, 2);
    for (const llamada of llamadas) {
      assert.equal(llamada.url, 'https://openrouter.ai/api/v1/chat/completions');
      assert.equal(llamada.modelo, 'openrouter/free');
    }
  } finally {
    globalThis.fetch = anterior;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
  }
});
