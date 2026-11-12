// api/asistente-mapa.js
// Asistente JARVIS del mapa de flota (FASE 3.8): recibe la pregunta del
// usuario + un resumen COMPACTO de las geocercas (id, nombre, grupo, centro)
// y devuelve { respuesta, acciones } donde las acciones las ejecuta el mapa:
//   enfocar / seleccionar / filtrar_grupo / limpiar / ajustar_todo
// Cadena de proveedores igual que voice-assistant: OpenRouter → DeepSeek → GitHub.
// Autocontenido (sin imports) al estilo del resto de api/.

const ACCIONES_PERMITIDAS = ['enfocar', 'seleccionar', 'filtrar_grupo', 'limpiar', 'ajustar_todo'];
const GRUPOS_PERMITIDOS = ['autorizada', 'oficina', 'distrito', 'poligono'];

const SYSTEM_PROMPT = `Eres JARVIS, el asistente inteligente del mapa de flota de Agrilux (AgroTrack).
Trabajas con las GEOCERCAS de la empresa que te paso en el contexto: linderos (campos), oficinas y distritos.
Responde SIEMPRE en español, breve (máximo 3 frases), con tono técnico y cercano.

REGLAS DE ACCIÓN:
- Si el usuario quiere IR a una geocerca, VERLA o LLEVARSE hasta ella: acción {"tipo":"enfocar","geocerca_id":"<id>"}.
- Si quiere seleccionarla (ver su ficha): {"tipo":"seleccionar","geocerca_id":"<id>"}.
- Si quiere ver SOLO un grupo (solo oficinas, solo distritos, solo linderos): {"tipo":"filtrar_grupo","grupo":"oficina"|"distrito"|"autorizada"}.
- Si quiere ver todo de nuevo o quitar filtros: {"tipo":"limpiar"}.
- Si quiere encuadrar todas las geocercas: {"tipo":"ajustar_todo"}.
- Usa el id EXACTO del contexto. Si dudas entre varias, elige la más probable y di cuál elegiste.
- Si la pregunta no necesita acción (conteo, comparación, cuántas hay), responde con "acciones": [].
- NUNCA inventes ids ni nombres: usa solo los del contexto.

RESPUESTA OBLIGATORIA (solo JSON, sin markdown):
{"respuesta":"<texto para el usuario>","acciones":[{"tipo":"..."}]}`;

/** Extrae el primer objeto JSON balanceado de un texto. */
function extraerObjetoJSON(texto) {
  if (!texto) return null;
  const limpio = String(texto).replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const intentar = (c) => {
    try {
      const v = JSON.parse(c);
      return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
    } catch {
      return null;
    }
  };
  const directo = intentar(limpio);
  if (directo) return directo;
  const inicio = limpio.indexOf('{');
  if (inicio < 0) return null;
  let nivel = 0, dentro = false, escape = false;
  for (let i = inicio; i < limpio.length; i++) {
    const c = limpio[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { dentro = !dentro; continue; }
    if (dentro) continue;
    if (c === '{') nivel += 1;
    else if (c === '}') {
      nivel -= 1;
      if (nivel === 0) return intentar(limpio.slice(inicio, i + 1));
    }
  }
  return null;
}

/** Valida y recorta las acciones que la IA pidió (modo seguro). */
function validarAcciones(acciones) {
  if (!Array.isArray(acciones)) return [];
  return acciones
    .filter((a) => a && typeof a === 'object' && ACCIONES_PERMITIDAS.includes(a.tipo))
    .map((a) => {
      if (a.tipo === 'enfocar' || a.tipo === 'seleccionar') {
        return { tipo: a.tipo, geocerca_id: String(a.geocerca_id || a.id || '') };
      }
      if (a.tipo === 'filtrar_grupo') {
        return { tipo: a.tipo, grupo: String(a.grupo || '') };
      }
      return { tipo: a.tipo };
    })
    .filter((a) => (a.tipo === 'enfocar' || a.tipo === 'seleccionar' ? Boolean(a.geocerca_id) : true))
    .filter((a) => (a.tipo === 'filtrar_grupo' ? GRUPOS_PERMITIDOS.includes(a.grupo) : true))
    .slice(0, 4);
}

function armarContexto(geocercas, seleccion) {
  const porGrupo = {};
  for (const g of geocercas) porGrupo[g.grupo] = (porGrupo[g.grupo] || 0) + 1;
  const resumen = Object.entries(porGrupo)
    .map(([grupo, n]) => `${grupo}: ${n}`)
    .join(' · ');

  const lineas = (geocercas || [])
    .slice(0, 220)
    .map((g) => {
      const centro = g.centro ? ` (${g.centro.lat}, ${g.centro.lon})` : '';
      const div = g.division ? ` | división ${g.division}` : '';
      return `${g.id} | ${g.nombre} | ${g.grupo}${div} | ${g.vertices} vértices${centro}`;
    })
    .join('\n');

  const sel = seleccion?.id
    ? `\nGEOCERCA SELECCIONADA AHORA: ${seleccion.nombre} (id ${seleccion.id})`
    : '';

  return `GEOCERCAS DE LA EMPRESA (${geocercas?.length || 0}): ${resumen}\n\nFORMATO id | nombre | grupo | división | vértices | centro\n${lineas}${sel}`;
}

async function llamarProvider(url, apiKey, headersExtra, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, ...headersExtra },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error?.message || `HTTP ${r.status}`);
  const texto = data?.choices?.[0]?.message?.content;
  if (!texto) throw new Error('respuesta vacía');
  return texto;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { mensaje, historial = [], geocercas = [], seleccion = null } = req.body || {};
  if (!mensaje || typeof mensaje !== 'string') {
    return res.status(400).json({ error: 'Falta el campo mensaje' });
  }

  const contexto = armarContexto(geocercas, seleccion);
  const messages = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\nCONTEXTO:\n${contexto}` },
    ...historial
      .filter((h) => h?.texto)
      .slice(-6)
      .map((h) => ({ role: h.rol === 'usuario' ? 'user' : 'assistant', content: String(h.texto).slice(0, 400) })),
    { role: 'user', content: mensaje.slice(0, 600) },
  ];

  const OPENROUTER = process.env.OPENROUTER_API_KEY;
  const DEEPSEEK = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  const GITHUB = process.env.GITHUB_TOKEN;

  const intentos = [];
  if (OPENROUTER) {
    intentos.push(['openrouter', () => llamarProvider(
      'https://openrouter.ai/api/v1/chat/completions',
      OPENROUTER,
      { 'HTTP-Referer': 'https://www.vitalfarmbright.store', 'X-Title': 'Agrilux-Map-JARVIS' },
      { model: 'google/gemini-2.5-flash', messages, max_tokens: 700, temperature: 0.4 },
    )]);
  }
  if (DEEPSEEK) {
    intentos.push(['deepseek', () => llamarProvider(
      'https://api.deepseek.com/chat/completions',
      DEEPSEEK,
      {},
      { model: 'deepseek-chat', messages, max_tokens: 700, temperature: 0.4 },
    )]);
  }
  if (GITHUB) {
    intentos.push(['github', () => llamarProvider(
      'https://models.inference.ai.azure.com/chat/completions',
      GITHUB,
      {},
      { model: 'Phi-4-multimodal-instruct', messages, max_tokens: 700, temperature: 0.4 },
    )]);
  }

  for (const [provider, llamada] of intentos) {
    try {
      const texto = await llamada();
      const obj = extraerObjetoJSON(texto);
      if (obj) {
        const respuesta = String(obj.respuesta || obj.texto || '').replace(/\s+/g, ' ').trim().slice(0, 600);
        return res.status(200).json({
          respuesta: respuesta || 'Listo.',
          acciones: validarAcciones(obj.acciones),
          provider,
        });
      }
      // Sin JSON: se usa el texto plano y no se ejecuta ninguna acción.
      return res.status(200).json({
        respuesta: String(texto).replace(/\s+/g, ' ').trim().slice(0, 600),
        acciones: [],
        provider,
      });
    } catch (e) {
      console.warn(`asistente-mapa ${provider} falló:`, e.message);
    }
  }

  return res.status(200).json({
    respuesta: 'No pude conectar con la IA en este momento. Intenta de nuevo en unos segundos.',
    acciones: [],
    provider: null,
  });
}
