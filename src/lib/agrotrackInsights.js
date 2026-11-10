/**
 * src/lib/agrotrackInsights.js
 * Resumen de IA para el reporte de actividad de flota (FASE 3).
 *
 * IMPORTANTE: aquí NO se crea una función serverless nueva. El plan Hobby de
 * Vercel admite máximo 12 funciones por despliegue y el proyecto ya usaba 12
 * (la 13ª rompió el build del 10/11/2026). Se reutiliza el endpoint existente
 * /api/analizar-imagen en modo SOLO TEXTO, que es el mismo que usa
 * src/lib/gemini.js para el diagnóstico de cultivos.
 *
 * El servidor rechaza prompts de más de 4000 caracteres, así que el contexto
 * se arma en el cliente y se recorta solo (detalles) hasta caber.
 *
 * Se envía ÚNICAMENTE lo agregado por la RPC agrotrack_actividad_flota,
 * nunca las +103 mil posiciones.
 */
import { invokeGemini } from './gemini';

export const systemPromptFlota = `Eres el analista de flota de Agrilux, una plataforma agrícola peruana.
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

/** Límite del endpoint /api/analizar-imagen (rechaza prompts > 4000). */
export const LIMITE_PROMPT = 3900;
const LIMITE_DETALLE = 40;

const h = (segundos) => Math.round((Number(segundos || 0) / 3600) * 10) / 10;
const pct = (num, den) => (Number(den) > 0 ? Math.round((Number(num) / Number(den)) * 1000) / 10 : 0);

function normalizar(f) {
  const encendido = Number(f.encendido_segundos || 0);
  const ralenti = Number(f.ralenti_segundos || 0);
  return {
    periodo: f.periodo || 'total',
    placa: String(f.placa || ''),
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

/** Fila de detalle en formato compacto (numérico, sin etiquetas). */
const linea = (f) =>
  `${f.placa} ${f.periodo} ${f.km} ${f.encendido_h} ${f.viaje_h} ${f.ralenti_h} ${f.pct_ralenti} ${f.vel_max ?? 's/d'} ${f.alertas}`;

/**
 * Arma el texto que viaja al modelo a partir de las filas agregadas.
 * Formato compacto (una línea numérica por unidad) para que quepan todas las
 * filas del día dentro del límite de 4000 caracteres del endpoint.
 * @returns {{ texto: string, detalleEnviado: number, totalFilas: number }}
 */
export function armarContextoFlota({ empresa = '', rango = '', agrupacion = '', filas = [] } = {}) {
  const norm = filas.map(normalizar);
  const totalFilas = norm.length;

  const sum = (campo) => norm.reduce((s, f) => s + Number(f[campo] || 0), 0);
  const encendidoTotal = sum('encendido_h');
  const ralentiTotal = sum('ralenti_h');

  const totales = {
    unidades: totalFilas,
    km: Math.round(sum('km') * 10) / 10,
    encendido_h: Math.round(encendidoTotal * 10) / 10,
    viaje_h: Math.round(sum('viaje_h') * 10) / 10,
    ralenti_h: Math.round(ralentiTotal * 10) / 10,
    pct_ralenti: pct(ralentiTotal, encendidoTotal),
    alertas: sum('alertas'),
    posiciones: sum('posiciones'),
  };

  const por = (campo, n = 5) => [...norm].sort((a, b) => Number(b[campo] || 0) - Number(a[campo] || 0)).slice(0, n);
  const masRalenti = [...norm].sort((a, b) => b.pct_ralenti - a.pct_ralenti).slice(0, 5);
  const sinEncendido = norm.filter((f) => Number(f.encendido_h) <= 0);

  const top = (lista, formato) => (lista.length ? lista.map(formato).join(', ') : 'ninguno');

  const cabecera = `DATOS DEL REPORTE
Empresa: ${empresa || 'no indicada'}
Rango consultado: ${rango || 'todo el histórico cargado'}
Agrupación: ${agrupacion || 'no indicada'}
Unidades con filas: ${totales.unidades}

TOTALES
Recorrido total: ${totales.km} km · Encendido: ${totales.encendido_h} h · Viaje: ${totales.viaje_h} h · Ralentí: ${totales.ralenti_h} h (${totales.pct_ralenti} % del encendido)
Alertas (alta velocidad + pánico): ${totales.alertas} · Posiciones leídas: ${totales.posiciones}

DESTACADOS
Mayores recorridos: ${top(por('km'), (f) => `${f.placa} ${f.km} km`)}
Más ralentí: ${top(masRalenti, (f) => `${f.placa} ${f.pct_ralenti} %`)}
Más alertas: ${top(por('alertas'), (f) => `${f.placa} ${f.alertas}`)}
Velocidad máxima: ${top(por('vel_max'), (f) => `${f.placa} ${f.vel_max ?? 's/d'} km/h`)}
Unidades sin encendido en el rango: ${sinEncendido.length ? sinEncendido.map((f) => f.placa).join(', ') : 'ninguna'}`;

  const ordenado = [...norm].sort((a, b) => b.km - a.km);
  const columnas = 'DETALLE (placa periodo km encendido_h viaje_h ralenti_h %ralenti velmax alertas)';
  const componer = (n) => `${cabecera}

${columnas}
${ordenado.slice(0, n).map(linea).join('\n')}`;

  // El servidor corta en 4000: se manda el máximo detalle que quepa.
  let detalle = Math.min(ordenado.length, LIMITE_DETALLE);
  let texto = componer(detalle);
  while (texto.length > LIMITE_PROMPT && detalle > 5) {
    detalle = Math.floor(detalle / 2);
    texto = componer(detalle);
  }
  if (texto.length > LIMITE_PROMPT) texto = cabecera; // último recurso: solo totales y tops

  return { texto, detalleEnviado: Math.min(detalle, ordenado.length), totalFilas };
}

/**
 * Genera el resumen ejecutivo. Lanza Error con mensaje en español si falla
 * (sin API key, sin red, etc.) para que la UI lo muestre tal cual.
 * @returns {Promise<{resumen: string, detalleEnviado: number, totalFilas: number}>}
 */
export async function generarResumenFlota({ empresa = '', rango = '', agrupacion = '', filas = [] } = {}) {
  const { texto, detalleEnviado, totalFilas } = armarContextoFlota({ empresa, rango, agrupacion, filas });
  const resumen = await invokeGemini({ prompt: texto, systemPrompt: systemPromptFlota });
  if (!resumen || !String(resumen).trim()) throw new Error('El modelo no devolvió texto.');
  return { resumen: String(resumen), detalleEnviado, totalFilas };
}

export default generarResumenFlota;
