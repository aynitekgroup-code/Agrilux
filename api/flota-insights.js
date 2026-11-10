/**
 * api/flota-insights.js
 * Resumen de IA para el reporte de actividad de flota (FASE 3).
 *
 * Recibe SOLO lo agregado por la RPC agrotrack_actividad_flota (nunca las
 * +103 mil posiciones), calcula los rankings en el servidor y le pide al
 * modelo un resumen ejecutivo en español con hallazgos y acciones.
 *
 * POST body: {
 *   empresa?: string, rango?: string, agrupacion?: string,
 *   filas: Array<{ periodo?, placa, unidad?, km_recorridos, encendido_segundos,
 *                  viaje_segundos, ralenti_segundos, vel_max_kmh?, alertas?, posiciones? }>
 * }
 * Returns: { resumen: string, modelo_usado: string }
 */

const LIMITE_FILAS = 80;

const systemPrompt = `Eres el analista de flota de Agrilux, una plataforma agrícola peruana.
Recibes el reporte de actividad de vehículos (ya agregado en la base de datos)
y debes entregar un resumen ejecutivo para el jefe de operaciones.

REGLAS:
- Responde SIEMPRE en español, tono profesional y directo.
- Máximo 280 palabras, con viñetas (•).
- Usa EXCLUSIVAMENTE las cifras que se te entregan: no inventes placas, fechas ni números.
- Escribe los números con 1 decimal y las horas como "8 h 15 min".
- Cita siempre el periodo y el rango consultado.
- NO repitas la tabla: interpreta.

ESTRUCTURA EXACTA:
1. Una línea de contexto: qué se analizó (rango, unidades).
2. "• Hallazgos" con 4 a 6 viñetas (recorrido, encendido, viaje, ralentí, alertas).
3. "• Lo que preocupa" con 2 a 3 viñetas de riesgo o pérdida de eficiencia.
4. "• Qué hacer" con 3 acciones concretas y medibles.

Si algún dato falta, dilo con "sin datos" y no lo deduzcas.`;

const h = (segundos) => Math.round((Number(segundos || 0) / 3600) * 10) / 10;
const pct = (num, den) => (Number(den) > 0 ? Math.round((Number(num) / Number(den)) * 1000) / 10 : 0);

function aFilaNormalizada(f) {
  const encendido = Number(f.encendido_segundos || 0);
  const ralenti = Number(f.ralenti_segundos || 0);
  return {
    periodo: f.periodo || 'total',
    placa: String(f.placa || ''),
    unidad: String(f.unidad || f.placa || ''),
    km: Math.round(Number(f.km_recorridos || 0) * 10) / 10,
    encendido_h: h(encendido),
    viaje_h: h(f.viaje_segundos),
    ralenti_h: h(ralenti),
    pct_ralenti: pct(ralenti, encendido),
    vel_max: f.vel_max_kmh == null ? null : Number(f.vel_max_kmh),
    alertas: Number(f.alertas || 0),
    posiciones: Number(f.posiciones || 0),
  };
}

function armarContexto({ empresa, rango, agrupacion, filas }) {
  const norm = filas.map(aFilaNormalizada);

  const total = (campo) => norm.reduce((s, f) => s + Number(f[campo] || 0), 0);
  const encendidoTotal = norm.reduce((s, f) => s + Number(f.encendido_h || 0), 0);
  const ralentiTotal = norm.reduce((s, f) => s + Number(f.ralenti_h || 0), 0);

  const totales = {
    unidades: norm.length,
    km: Math.round(total('km') * 10) / 10,
    encendido_h: Math.round(encendidoTotal * 10) / 10,
    viaje_h: Math.round(total('viaje_h') * 10) / 10,
    ralenti_h: Math.round(ralentiTotal * 10) / 10,
    pct_ralenti: pct(ralentiTotal, encendidoTotal),
    alertas: total('alertas'),
    posiciones: total('posiciones'),
  };

  const por = (campo, n = 5) => [...norm].sort((a, b) => Number(b[campo] || 0) - Number(a[campo] || 0)).slice(0, n);
  const masRalenti = [...norm].sort((a, b) => b.pct_ralenti - a.pct_ralenti).slice(0, 5);
  const sinEncendido = norm.filter((f) => Number(f.encendido_h) <= 0);

  const linea = (f) =>
    `${f.periodo} | ${f.placa} | km ${f.km} | encendido ${f.encendido_h} h | viaje ${f.viaje_h} h | ralentí ${f.ralenti_h} h (${f.pct_ralenti} %) | vel.máx ${f.vel_max ?? 's/d'} km/h | alertas ${f.alertas}`;

  // Filas detalladas: tope para no pasarse de tokens.
  const detalladas = [...norm].sort((a, b) => b.km - a.km).slice(0, LIMITE_FILAS);

  return `DATOS DEL REPORTE
Empresa: ${empresa || 'no indicada'}
Rango consultado: ${rango || 'todo el histórico cargado'}
Agrupación: ${agrupacion || 'no indicada'}
Unidades con filas: ${totales.unidades}

TOTALES
Recorrido total: ${totales.km} km
Encendido total: ${totales.encendido_h} h
Hora de viaje total: ${totales.viaje_h} h
Ralentí total: ${totales.ralenti_h} h (${totales.pct_ralenti} % del encendido)
Alertas (alta velocidad + pánico): ${totales.alertas}
Posiciones leídas: ${totales.posiciones}

TOP 5 POR RECORRIDO
${por('km').map(linea).join('\n')}

TOP 5 POR RALENTÍ (mayor % de encendido parado)
${masRalenti.map(linea).join('\n')}

TOP 5 POR ALERTAS
${por('alertas').map((f) => `${f.placa} (${f.periodo}): ${f.alertas} alertas`).join('\n') || 'ninguna'}

TOP 5 POR VELOCIDAD MÁXIMA
${por('vel_max').map((f) => `${f.placa}: ${f.vel_max ?? 's/d'} km/h`).join('\n') || 'sin datos'}

UNIDADES SIN ENCENDIDO EN EL RANGO: ${sinEncendido.length ? sinEncendido.map((f) => f.placa).join(', ') : 'ninguna'}

DETALLE (máximo ${LIMITE_FILAS} filas, por recorrido)
${detalladas.map(linea).join('\n')}`;
}

export default async function handler(req, res) {
  // CORS para APK Capacitor (origen capacitor:// / https://localhost) y web
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

  const { empresa, rango, agrupacion, filas } = req.body || {};
  if (!Array.isArray(filas) || filas.length === 0) {
    return res.status(400).json({ error: 'Faltan las filas del reporte de actividad.' });
  }

  const contexto = armarContexto({
    empresa: typeof empresa === 'string' ? empresa.slice(0, 120) : '',
    rango: typeof rango === 'string' ? rango.slice(0, 80) : '',
    agrupacion: typeof agrupacion === 'string' ? agrupacion.slice(0, 20) : '',
    filas: filas.slice(0, 400),
  });

  const mensajes = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: contexto },
  ];

  // ── Cadena de proveedores (mismo orden que api/ciclo-recomendaciones.js) ──

  // 1. OpenRouter — Gemini 2.5 Flash
  if (OPENROUTER_API_KEY) {
    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://www.vitalfarmbright.store',
          'X-Title': 'Agrilux Flota',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: mensajes,
          max_tokens: 900,
          temperature: 0.3,
        }),
      });
      const data = await r.json();
      if (r.ok && data.choices?.[0]?.message?.content) {
        return res.status(200).json({
          resumen: data.choices[0].message.content,
          modelo_usado: 'openrouter-gemini-2.5-flash',
        });
      }
    } catch (e) { console.warn('OpenRouter flota error:', e.message); }
  }

  // 2. DeepSeek Chat
  if (DEEPSEEK_API_KEY) {
    try {
      const r = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: mensajes,
          max_tokens: 900,
          temperature: 0.3,
        }),
      });
      const data = await r.json();
      if (r.ok && data.choices?.[0]?.message?.content) {
        return res.status(200).json({
          resumen: data.choices[0].message.content,
          modelo_usado: 'deepseek-chat',
        });
      }
    } catch (e) { console.warn('DeepSeek flota error:', e.message); }
  }

  // 3. GitHub Phi-4
  if (GITHUB_TOKEN) {
    try {
      const r = await fetch('https://models.inference.ai.azure.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GITHUB_TOKEN}`,
        },
        body: JSON.stringify({
          model: 'Phi-4-multimodal-instruct',
          messages: mensajes,
          max_tokens: 900,
          temperature: 0.3,
        }),
      });
      const data = await r.json();
      if (r.ok && data.choices?.[0]?.message?.content) {
        return res.status(200).json({
          resumen: data.choices[0].message.content,
          modelo_usado: 'github-phi-4',
        });
      }
    } catch (e) { console.warn('GitHub flota error:', e.message); }
  }

  return res.status(500).json({
    error: 'No se pudo generar el resumen. Verifica tu configuración de IA.',
    modelo_usado: 'ninguno',
  });
}
