/**
 * src/lib/priorizarAlertas.js
 * Priorización y AGRUPACIÓN de las alertas de operación (FASE: IA en Gestión).
 *
 * El panel llega con cientos de alertas casi idénticas ("Alta velocidad ·
 * 102 km/h" repetida en 28 unidades). Aquí se agrupan y puntuan de forma
 * DETERMINISTA (gratis, sin IA) y solo después se le pide a la IA una frase
 * de "qué hacer" por grupo.
 *
 * Puro, sin fetch ni DOM: apto para node:test.
 */

export const PESO_SEVERIDAD = { critica: 100, alta: 60, media: 30, info: 10 };
/** Grupos máximos que se le mandan a la IA (y que se muestran priorizados). */
export const LIMITE_GRUPOS_IA = 15;

const normalizar = (valor) => String(valor || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

/**
 * Clave de agrupación: mismo tipo + mismo mensaje (los números se vuelven '#'
 * para que "102 km/h" y "88 km/h" caigan en el mismo grupo "Alta velocidad").
 */
export function claveAlerta(alerta) {
  const tipo = normalizar(alerta?.tipo).replace(/\d+(?:[.,]\d+)?/g, '#');
  const mensaje = normalizar(alerta?.mensaje).replace(/\d+(?:[..]\d+)?/g, '#');
  return `${tipo}|${mensaje}`;
}

const esReciente = (iso, ahora, ms) => {
  const t = Date.parse(iso || '');
  return Number.isFinite(t) && ahora - t <= ms;
};

/**
 * Agrupa las alertas repetidas y las puntúa.
 * @param {Array} alertas
 * @param {{ahora?: number}} [opciones] `ahora` (ms) para el bonus de recencia.
 * @returns {Array<{clave, tipo, mensaje, severidad, total, unidades: string[],
 *   ids: string[], ultimaFecha, puntuacion}>} ordenado de mayor a menor.
 */
export function priorizarAlertas(alertas, { ahora = Date.now() } = {}) {
  const porClave = new Map();

  (Array.isArray(alertas) ? alertas : []).forEach((alerta) => {
    if (!alerta) return;
    const clave = claveAlerta(alerta);
    let grupo = porClave.get(clave);
    if (!grupo) {
      grupo = {
        clave,
        tipo: String(alerta.tipo || 'Sin tipo'),
        mensaje: String(alerta.mensaje || ''),
        severidad: String(alerta.severidad || 'info'),
        total: 0,
        unidades: [],
        ids: [],
        ultimaFecha: '',
        ultimaFechaIso: '',
      };
      porClave.set(clave, grupo);
    }
    grupo.total += 1;
    const placa = String(alerta.placa || alerta.vehiculo_id || '');
    if (placa && !grupo.unidades.includes(placa)) grupo.unidades.push(placa);
    if (alerta.id && !grupo.ids.includes(alerta.id)) grupo.ids.push(alerta.id);

    const fecha = String(alerta.fecha || '');
    const fechaIso = String(alerta.fecha_iso || '');
    if (fecha && fecha >= grupo.ultimaFecha) {
      grupo.ultimaFecha = fecha;
      grupo.ultimaFechaIso = fechaIso;
    }
    // La severidad más alta del grupo manda.
    if ((PESO_SEVERIDAD[alerta.severidad] || 0) > (PESO_SEVERIDAD[grupo.severidad] || 0)) {
      grupo.severidad = String(alerta.severidad);
    }
  });

  return [...porClave.values()]
    .map((grupo) => {
      const peso = PESO_SEVERIDAD[grupo.severidad] ?? PESO_SEVERIDAD.info;
      const bonusTotal = Math.min(40, grupo.total * 3);
      const referencia = Date.parse(grupo.ultimaFechaIso || '') || ahora;
      const bonusReciente = esReciente(new Date(referencia).toISOString(), ahora, 24 * 3600 * 1000)
        ? 15
        : esReciente(new Date(referencia).toISOString(), ahora, 7 * 24 * 3600 * 1000) ? 5 : 0;
      return { ...grupo, puntuacion: peso + bonusTotal + bonusReciente };
    })
    .sort((a, b) => b.puntuacion - a.puntuacion || b.total - a.total);
}

/**
 * Texto compacto de los grupos para mandarlo a la IA (solo lo agregado).
 * @returns {string}
 */
export function armarContextoAlertas(grupos, { empresa = '', rango = '' } = {}) {
  const lista = (Array.isArray(grupos) ? grupos : []).slice(0, LIMITE_GRUPOS_IA);
  const cabecera = `ALERTAS AGRUPADAS DEL PERIODO
Empresa: ${empresa || 'no indicada'}
Rango: ${rango || 'periodo cargado'}
Grupos totales: ${Array.isArray(grupos) ? grupos.length : 0} (se envían ${lista.length})
Formato: clave | severidad | total | unidades | última fecha | tipo | mensaje`;

  if (!lista.length) return `${cabecera}\n\nSin alertas en el periodo.`;

  return `${cabecera}

${lista
  .map((g) => `${g.clave} | ${g.severidad} | ${g.total} | ${g.unidades.length} | ${g.ultimaFecha || 's/f'} | ${g.tipo} | ${g.mensaje}`)
  .join('\n')}`;
}

/**
 * Convierte la respuesta de la IA ({grupos:[{clave, accion}]}) en un mapa
 * clave → acción. Las claves que no existen se descartan (la IA puede
 * alucinar): el mapa resultante solo se usa para pintar.
 * @returns {Record<string, string>}
 */
export function mapaAccionesPorClave(datos, grupos = []) {
  const validas = new Set((Array.isArray(grupos) ? grupos : []).map((g) => g.clave));
  const salida = {};
  (datos?.grupos || []).forEach((g) => {
    const clave = String(g?.clave || '');
    const accion = String(g?.accion || '').trim();
    if (clave && accion && validas.has(clave)) salida[clave] = accion;
  });
  return salida;
}

export default priorizarAlertas;
