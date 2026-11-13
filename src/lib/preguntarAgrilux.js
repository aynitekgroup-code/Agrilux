/**
 * src/lib/preguntarAgrilux.js
 * Motor determinista del chat "Preguntar a Agrilux" (decisión 13/11/2026).
 *
 * Objetivo: un asistente tipo Alexa/Siri para la flota. La mayoría de las
 * preguntas frecuentes se resuelven GRATIS y al instante (sin IA) contra las
 * filas que el widget ya cargó:
 *   * agrotrack_estado_unidades_flota -> estado (geocerca actual con división,
 *     evento, última fecha, velocidad, dirección y el fallback
 *     geocerca_ultima pedido por el Ing. Carlos Perez);
 *   * agrotrack_grupos_unidades       -> grupos por placa (observación VI).
 *
 * Si el parser no entiende la pregunta, `resolverPregunta` devuelve
 * `fuente: 'ia'` y el componente llama a llamarIaGestion({ modo: 'preguntar' })
 * como ÚLTIMO recurso (una llamada de pago, no la norma).
 *
 * Archivo PURO (sin supabase ni fetch): probado con node:test en
 * tests/preguntarAgrilux.test.mjs.
 */

/** Tope de filas de estado que se mandan a la IA (contexto del servidor: 7000). */
export const LIMITE_FILAS_IA = 60;

/** Texto de ayuda (bienvenida y respuesta a "ayuda"). */
export const TEXTO_AYUDA = [
  'Pregúntame en español sobre la flota; respondo al instante con los datos de la base:',
  '· "¿En qué geocerca está P01-1K?"',
  '· "Estado de la flota"',
  '· "¿Quién está en Lote Norte?"',
  '· "¿Qué grupos hay?"',
  'Si no entiendo la pregunta, la paso por IA (una llamada).',
];

/** Palabras que no nombran una geocerca concreta (solo el tipo). */
const GENERICOS = new Set([
  'lotes', 'oficina', 'oficinas', 'distrito', 'distritos', 'geocerca',
  'geocercas', 'campos', 'campo', 'zonas', 'division', 'divisiones',
]);

/** Valores de "grupo" que significan "lista los grupos". */
const VALORES_LISTA_GRUPOS = new Set(['unidades', 'unidad', 'todos', 'todas', 'existentes', 'todos los']);

const RE_GRUPO = /\bgrupos?\b/;
const RE_AYUDA = /^(?:ayuda|help|que puedes hacer|que sabes hacer|como funciona)\b/;
const RE_SALUDO = /^(?:hola|buenas|buenos dias|buenas tardes|que tal|hey)[.!?]*\s*$/;
const RE_RESUMEN = /\bresumen\b|\bcomo esta (?:la )?flota\b|\bestado (?:de la )?flota\b|\bestado general\b|\bcuantas unidades\b|\bdonde (?:esta|estan) (?:las )?unidades\b|\bstatus\b/;
const RE_LISTA_GEOCERCA = /\bgeocercas?\b|\blotes?\b|\boficinas?\b|\bdistritos?\b/;

/** Minúsculas, sin acentos y con espacios colapsados (comparaciones). */
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** "P01-1K" y "p01 1k" -> "p011k" (para comparar placas sin formato). */
export function clavePlaca(placa) {
  return normalizar(placa).replace(/[\s-]/g, '');
}

/** "2026-11-04T19:40:00Z" -> "04/11 14:40" (hora de Perú, UTC-5). */
export function formatearFechaPeru(iso) {
  if (!iso) return '—';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '—';
  const peru = new Date(fecha.getTime() - 5 * 3600 * 1000);
  const dd = String(peru.getUTCDate()).padStart(2, '0');
  const mm = String(peru.getUTCMonth() + 1).padStart(2, '0');
  const hh = String(peru.getUTCHours()).padStart(2, '0');
  const min = String(peru.getUTCMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${min}`;
}

/** Token de placa: al menos una letra, un dígito y 3+ caracteres ("p01-1k"). */
function esPlacaTipo(token) {
  return token.length >= 3 && /[a-z]/.test(token) && /\d/.test(token);
}

/**
 * Busca la placa de la pregunta en las filas de estado:
 * 1) coincidencia EXACTA de clave (t-01 == T-01);
 * 2) prefijo ÚNICO de 3+ caracteres ("p01" -> P01-1K);
 * 3) token con forma de placa desconocida (para responder "no la encontré").
 * @returns {{fila: object|null, token: string}|null}
 */
function buscarPlaca(q, estado) {
  const tokens = q.match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) || [];

  for (const token of tokens) {
    const clave = clavePlaca(token);
    if (clave.length < 2) continue;
    const exacta = estado.find((f) => clavePlaca(f.placa) === clave);
    if (exacta) return { fila: exacta, token };
  }

  for (const token of tokens) {
    const clave = clavePlaca(token);
    if (clave.length < 3 || !/\d/.test(clave)) continue;
    const coincidencias = estado.filter((f) => clavePlaca(f.placa).startsWith(clave));
    if (coincidencias.length === 1) return { fila: coincidencias[0], token };
  }

  for (const token of tokens) {
    if (esPlacaTipo(token)) return { fila: null, token };
  }
  return null;
}

/** Mapa normalizado -> { original, tipo } de todas las geocercas del estado. */
function mapaGeocercas(estado) {
  const mapa = new Map();
  for (const fila of estado) {
    const fuentes = [
      [fila.geocerca, 'geocerca'],
      [fila.geocerca_ultima, 'geocerca'],
      [fila.geocerca_division, 'division'],
    ];
    for (const [valor, tipo] of fuentes) {
      const original = String(valor ?? '').trim();
      if (!original) continue;
      const clave = normalizar(original);
      if (!mapa.has(clave)) mapa.set(clave, { original, tipo });
    }
  }
  return mapa;
}

/**
 * ¿La pregunta nombra una geocerca/división conocida?
 * 1) el nombre completo (con límites de palabra); 2) un token significativo
 * del nombre ("norte" -> "Lote Norte"), ignorando palabras genéricas.
 * @returns {{valor: string, original: string, tipo: string}|null}
 */
function buscarGeocerca(q, estado) {
  const mapa = mapaGeocercas(estado);
  const entradas = [...mapa.entries()].sort((a, b) => b[0].length - a[0].length);
  const texto = ` ${q.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()} `;

  const aRegex = (valor) => new RegExp(`\\b${valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);

  for (const [clave, meta] of entradas) {
    if (aRegex(clave).test(texto)) return { valor: clave, ...meta };
  }
  for (const [clave, meta] of entradas) {
    const tokens = clave.split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 5 && !GENERICOS.has(t));
    if (tokens.some((t) => aRegex(t).test(texto))) return { valor: clave, ...meta };
  }
  return null;
}

/** Extrae el nombre del grupo después de la palabra "grupo(s)". */
function extraerValorGrupo(q) {
  const m = RE_GRUPO.exec(q);
  if (!m) return '';
  return q.slice((m.index ?? 0) + m[0].length)
    .replace(/[^a-z0-9 ]+/g, ' ') // puntuación -> espacio ("camiones?" -> "camiones ")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:(?:de|del|las|los|el|la|un|una|que|tiene|hay|en|a)(?:\s+|$))+/, '')
    .trim();
}

/**
 * Detecta la intención de una pregunta (parser puro).
 * @returns {{tipo: 'ayuda'|'placa'|'grupo'|'geocerca'|'resumen'|'ia', valor?: any}}
 */
export function detectarIntencion(pregunta, { estado = [], grupos = {} } = {}) {
  const q = normalizar(pregunta);
  if (!q) return { tipo: 'ayuda' };
  if (RE_AYUDA.test(q) || RE_SALUDO.test(q)) return { tipo: 'ayuda' };

  // La placa manda: "¿en qué geocerca está P01-1K?" es una pregunta de placa.
  const placa = buscarPlaca(q, estado);
  if (placa) return { tipo: 'placa', valor: placa };

  if (RE_GRUPO.test(q)) {
    const valor = extraerValorGrupo(q);
    return { tipo: 'grupo', valor: VALORES_LISTA_GRUPOS.has(valor) ? '' : valor };
  }

  const geocerca = buscarGeocerca(q, estado);
  if (geocerca) return { tipo: 'geocerca', valor: geocerca };

  if (RE_LISTA_GEOCERCA.test(q)) {
    return { tipo: 'geocerca', valor: { valor: '', tipo: 'lista', original: '' } };
  }
  if (RE_RESUMEN.test(q)) return { tipo: 'resumen' };
  return { tipo: 'ia' };
}

/** Lista de placas corta para las respuestas ("A, B, C … y 4 más"). */
function listaPlacas(filas, max = 10) {
  const placas = filas.map((f) => f.placa);
  const visibles = placas.slice(0, max).join(', ');
  return placas.length > max ? `${visibles} … y ${placas.length - max} más` : visibles;
}

function filaDe(estado, placa) {
  const clave = clavePlaca(placa);
  return estado.find((f) => clavePlaca(f.placa) === clave) || null;
}

/* ── Respuestas deterministas ────────────────────────────────────────────── */

function responderPlaca({ fila, token }, { estado, grupos }) {
  if (!fila) {
    const titulo = token.toUpperCase();
    if (!estado.length) {
      return {
        fuente: 'datos',
        tipo: 'placa',
        titulo,
        lineas: [
          'Todavía no hay posiciones cargadas para esta empresa.',
          'Carga un reporte de Zonar y vuelve a preguntar.',
        ],
      };
    }
    return {
      fuente: 'datos',
      tipo: 'placa',
      titulo,
      lineas: [
        `No encontré la placa "${token}" entre las ${estado.length} unidades con posición en el periodo.`,
        'Escribe la placa exacta (p. ej. P01-1K) o pregunta "estado de la flota".',
      ],
    };
  }

  const lineas = [];
  if (fila.geocerca) {
    lineas.push(fila.geocerca_division
      ? `Geocerca actual: ${fila.geocerca} (${fila.geocerca_division})`
      : `Geocerca actual: ${fila.geocerca}`);
  } else if (fila.geocerca_ultima) {
    lineas.push(`Fuera de geocerca — última conocida: ${fila.geocerca_ultima} (${formatearFechaPeru(fila.geocerca_ultima_fecha)})`);
  } else {
    lineas.push('Sin geocerca actual ni eventos previos en el periodo.');
  }

  const velocidad = fila.ultima_velocidad === null || fila.ultima_velocidad === undefined || fila.ultima_velocidad === ''
    ? '' : ` · ${fila.ultima_velocidad} km/h`;
  lineas.push(`Último evento: ${fila.ultimo_evento || '—'}${velocidad}`);
  lineas.push(`Última posición: ${formatearFechaPeru(fila.ultima_fecha)}`);
  if (String(fila.direccion ?? '').trim()) lineas.push(`Dirección: ${fila.direccion}`);
  if (String(fila.unidad ?? '').trim() && normalizar(fila.unidad) !== normalizar(fila.placa)) {
    lineas.push(`Unidad: ${fila.unidad}`);
  }
  const grupo = grupos?.[fila.placa];
  lineas.push(grupo ? `Grupo: ${grupo}` : 'Sin grupo asignado.');

  return { fuente: 'datos', tipo: 'placa', titulo: fila.placa, lineas };
}

function responderGrupo(valor, { estado, grupos }) {
  const originales = new Map();
  Object.values(grupos || {}).forEach((grupo) => {
    const limpio = String(grupo ?? '').trim();
    if (limpio && !originales.has(normalizar(limpio))) originales.set(normalizar(limpio), limpio);
  });

  if (!originales.size) {
    return {
      fuente: 'datos',
      tipo: 'grupo',
      titulo: 'Grupos de unidades',
      lineas: [
        'Todavía no hay grupos de unidades asignados.',
        'Asigna grupos desde el mapa (el control de grupo de cada unidad) y vuelve a preguntar.',
      ],
    };
  }

  if (!valor) {
    const lineas = [...originales.entries()].map(([clave, original]) => {
      const placas = Object.entries(grupos)
        .filter(([, g]) => normalizar(g) === clave)
        .map(([placa]) => placa);
      return `· ${original}: ${placas.length} (${listaPlacas(placas.map((placa) => ({ placa })), 6)})`;
    });
    const sinGrupo = Object.entries(grupos).filter(([, g]) => !String(g ?? '').trim()).length;
    if (sinGrupo) lineas.push(`· ${sinGrupo} unidades sin grupo asignado.`);
    return { fuente: 'datos', tipo: 'grupo', titulo: 'Grupos de unidades', lineas };
  }

  const objetivo = originales.get(valor)
    || [...originales.entries()].find(([clave, original]) => clave.includes(valor) || valor.includes(clave))?.[1];

  if (!objetivo) {
    return {
      fuente: 'datos',
      tipo: 'grupo',
      titulo: `Grupo "${valor}"`,
      lineas: [
        `No encontré el grupo "${valor}".`,
        `Grupos disponibles: ${[...originales.values()].join(', ')}.`,
      ],
    };
  }

  const placas = Object.entries(grupos)
    .filter(([, g]) => normalizar(g) === normalizar(objetivo))
    .map(([placa]) => placa);
  const lineas = [`${placas.length} unidad${placas.length === 1 ? '' : 'es'} en el grupo ${objetivo}.`];
  placas.slice(0, 12).forEach((placa) => {
    const fila = filaDe(estado, placa);
    if (!fila) {
      lineas.push(`· ${placa} — sin posición en el periodo`);
    } else {
      const donde = fila.geocerca
        || (fila.geocerca_ultima ? `fuera (última: ${fila.geocerca_ultima})` : 'fuera de geocerca');
      lineas.push(`· ${placa} — ${donde} · ${fila.ultimo_evento || '—'}`);
    }
  });
  if (placas.length > 12) lineas.push(`… y ${placas.length - 12} unidades más del grupo.`);
  return { fuente: 'datos', tipo: 'grupo', titulo: `Grupo ${objetivo}`, lineas };
}

function responderGeocerca(meta, { estado, grupos }) {
  // Listado de lo que hay ocupado ahora.
  if (!meta?.valor) {
    if (!estado.length) {
      return {
        fuente: 'datos',
        tipo: 'geocerca',
        titulo: 'Geocercas',
        lineas: ['No hay posiciones en el periodo: no puedo ver geocercas ocupadas.'],
      };
    }
    const conteo = new Map();
    estado.forEach((f) => {
      if (f.geocerca) conteo.set(f.geocerca, (conteo.get(f.geocerca) || 0) + 1);
    });
    const ordenadas = [...conteo.entries()].sort((a, b) => b[1] - a[1]);
    const fuera = estado.filter((f) => !f.geocerca).length;
    const lineas = ordenadas.map(([nombre, total]) => `· ${nombre}: ${total} unidad${total === 1 ? '' : 'es'}`);
    if (fuera) lineas.push(`· Sin geocerca actual: ${fuera} unidad${fuera === 1 ? '' : 'es'}`);
    return {
      fuente: 'datos',
      tipo: 'geocerca',
      titulo: 'Geocercas ocupadas',
      lineas: lineas.length ? lineas : ['Ninguna unidad tiene geocerca actual en el periodo.'],
    };
  }

  // División (p. ej. "Pomalca 1"): agrupa por la división de la geocerca.
  if (meta.tipo === 'division') {
    const filas = estado.filter((f) => normalizar(f.geocerca_division) === meta.valor);
    if (!filas.length) {
      return {
        fuente: 'datos',
        tipo: 'geocerca',
        titulo: `División ${meta.original}`,
        lineas: [`Ninguna unidad registrada en la división ${meta.original} en el periodo.`],
      };
    }
    const lineas = [`${filas.length} unidad${filas.length === 1 ? '' : 'es'} en la división ${meta.original}.`];
    filas.slice(0, 12).forEach((f) => {
      lineas.push(`· ${f.placa} — ${f.geocerca || 'fuera de geocerca'} · ${f.ultimo_evento || '—'}`);
    });
    if (filas.length > 12) lineas.push(`… y ${filas.length - 12} unidades más.`);
    return { fuente: 'datos', tipo: 'geocerca', titulo: `División ${meta.original}`, lineas };
  }

  const dentro = estado.filter((f) => normalizar(f.geocerca) === meta.valor);
  const ultima = estado.filter((f) => normalizar(f.geocerca_ultima ?? '') === meta.valor
    && normalizar(f.geocerca ?? '') !== meta.valor);

  const lineas = [];
  if (dentro.length) {
    lineas.push(`${dentro.length} unidad${dentro.length === 1 ? '' : 'es'} en ${meta.original} ahora:`);
    dentro.slice(0, 12).forEach((f) => {
      const grupo = grupos?.[f.placa];
      lineas.push(`· ${f.placa}${grupo ? ` (${grupo})` : ''} · ${f.ultimo_evento || '—'} · ${formatearFechaPeru(f.ultima_fecha)}`);
    });
    if (dentro.length > 12) lineas.push(`… y ${dentro.length - 12} unidades más.`);
    if (ultima.length) lineas.push(`Además, ${ultima.length} con esa como última geocerca: ${listaPlacas(ultima)}.`);
  } else if (ultima.length) {
    lineas.push(`Ninguna unidad está ahora en ${meta.original}.`);
    lineas.push(`Última en estar: ${listaPlacas(ultima)} (${formatearFechaPeru(ultima[0].geocerca_ultima_fecha)}).`);
  } else {
    lineas.push(`Ninguna unidad registrada en ${meta.original} en el periodo.`);
  }
  return { fuente: 'datos', tipo: 'geocerca', titulo: meta.original, lineas };
}

function responderResumen({ estado }) {
  if (!estado.length) {
    return {
      fuente: 'datos',
      tipo: 'resumen',
      titulo: 'Estado de la flota',
      lineas: ['No hay posiciones en el periodo para esta empresa (aún sin datos o rango vacío).'],
    };
  }

  const conGeocerca = estado.filter((f) => f.geocerca);
  const conteo = new Map();
  conGeocerca.forEach((f) => conteo.set(f.geocerca, (conteo.get(f.geocerca) || 0) + 1));
  const ordenadas = [...conteo.entries()].sort((a, b) => b[1] - a[1]);

  const fechas = estado.map((f) => f.ultima_fecha).filter(Boolean)
    .map((f) => ({ iso: f, ms: new Date(f).getTime() }))
    .filter((f) => !Number.isNaN(f.ms))
    .sort((a, b) => b.ms - a.ms);

  const lineas = [
    `${estado.length} unidades con posición · última actualización ${fechas[0] ? formatearFechaPeru(fechas[0].iso) : '—'}.`,
    `${conGeocerca.length} dentro de una geocerca · ${estado.length - conGeocerca.length} fuera.`,
    ...ordenadas.slice(0, 8).map(([nombre, total]) => `· ${nombre}: ${total}`),
  ];
  if (ordenadas.length > 8) lineas.push(`… y ${ordenadas.length - 8} geocercas más.`);

  const fueraConHistorial = estado.filter((f) => !f.geocerca && f.geocerca_ultima).slice(0, 3);
  if (fueraConHistorial.length) {
    lineas.push(`Fuera con última geocerca conocida: ${fueraConHistorial.map((f) => `${f.placa} (${f.geocerca_ultima})`).join(', ')}.`);
  }
  return { fuente: 'datos', tipo: 'resumen', titulo: 'Estado de la flota', lineas };
}

/* ── API pública ─────────────────────────────────────────────────────────── */

/**
 * Resuelve una pregunta del chat contra el estado + grupos ya cargados.
 * @returns {{fuente: 'datos'|'ayuda'|'ia', tipo: string, titulo: string, lineas: string[]}}
 *   fuente 'ia' = el parser no entendió; el componente debe llamar a la IA.
 */
export function resolverPregunta(pregunta, { estado = [], grupos = {} } = {}) {
  const intencion = detectarIntencion(pregunta, { estado, grupos });
  switch (intencion.tipo) {
    case 'ayuda':
      return { fuente: 'ayuda', tipo: 'ayuda', titulo: 'Preguntar a Agrilux', lineas: [...TEXTO_AYUDA] };
    case 'placa':
      return { ...responderPlaca(intencion.valor, { estado, grupos }) };
    case 'grupo':
      return { ...responderGrupo(intencion.valor, { estado, grupos }) };
    case 'geocerca':
      return { ...responderGeocerca(intencion.valor, { estado, grupos }) };
    case 'resumen':
      return { ...responderResumen({ estado, grupos }) };
    default:
      return { fuente: 'ia', tipo: 'ia', titulo: '', lineas: [] };
  }
}

/** Sugerencias (chips) del chat a partir del estado cargado. */
export function sugerencias({ estado = [] } = {}) {
  const chips = [];
  if (estado[0]?.placa) chips.push(`¿En qué geocerca está ${estado[0].placa}?`);
  chips.push('Estado de la flota', '¿Qué geocercas están ocupadas?', '¿Qué grupos hay?');
  return chips.slice(0, 4);
}

/**
 * Contexto que se le pasa a la IA (modo 'preguntar') cuando el parser no
 * entiende la pregunta: la pregunta + el estado ya agregado, nunca filas
 * crudas de posiciones. El cliente recorta a LIMITE_CONTEXTO_IA (7000).
 */
export function armarContextoIa(pregunta, { estado = [], grupos = {} } = {}) {
  const filas = estado.slice(0, LIMITE_FILAS_IA).map((f) => [
    f.placa,
    f.geocerca || (f.geocerca_ultima ? `fuera (ultima: ${f.geocerca_ultima})` : 'fuera'),
    f.ultimo_evento || '—',
    formatearFechaPeru(f.ultima_fecha),
    f.ultima_velocidad === null || f.ultima_velocidad === undefined || f.ultima_velocidad === '' ? '—' : `${f.ultima_velocidad} km/h`,
    grupos?.[f.placa] || 'sin grupo',
  ].join(' | '));

  const partes = [
    'Asistente "Preguntar a Agrilux" de AgroTrack (flota agrícola peruana).',
    `Pregunta del usuario: "${String(pregunta ?? '').slice(0, 300)}"`,
    '',
    'Estado actual (placa | geocerca | evento | fecha Perú | velocidad | grupo):',
    ...filas,
  ];
  if (estado.length > LIMITE_FILAS_IA) partes.push(`… y ${estado.length - LIMITE_FILAS_IA} unidades más.`);
  partes.push('');
  partes.push('Responde en español, directo, máximo 120 palabras. SOLO con estos datos: no inventes placas, geocercas ni cifras.');
  return partes.join('\n');
}
