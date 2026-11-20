/**
 * src/lib/rpcReportes.js
 * Cola GLOBAL de las RPC pesadas de reportes.
 *
 * La sección Geocercas monta varias tarjetas a la vez (resumen, eventos,
 * lotes, visitas, tabla diaria). Si cada una dispara sus RPC en paralelo se
 * pasan de 6 consultas PostGIS simultáneas y Supabase corta TODAS por
 * statement_timeout (8 s), aunque cada una por separado tarde <1 s.
 *
 * Dos reglas para todas las rutinas de reportes:
 *   1) deduplicar llamadas idénticas que ya están en vuelo;
 *   2) una sola RPC pesada a la vez, el resto espera en cola.
 */

const RPC_PESADAS = new Set([
  'agrotrack_eventos_geocerca_flota',
  'agrotrack_lotes_flota',
  'agrotrack_estado_unidades_flota',
  'agrotrack_visitas_geocerca_flota',
  'agrotrack_visitas_dia_flota',
  'agrotrack_tabla_geocercas_dia',
  'agrotrack_permanencias_lote_excel',
  'agrotrack_visitas_dia_pendientes',
  'agrotrack_calcular_visitas_dia',
  // 18/11/2026: el resumen de flota también barre agrotrack_posiciones (314 k
  // filas). Sin cola, 3 tarjetas de "Reportes" lo disparaban en paralelo y
  // agrotrack_periodo_flota caía con 500 por statement_timeout de 8 s.
  'agrotrack_periodo_flota',
  'agrotrack_resumen_flota',
  'agrotrack_alertas_flota',
  'agrotrack_conteo_eventos',
  'agrotrack_recorrido_flota',
  'agrotrack_actividad_flota',
]);

const EN_VUELO = new Map();
const COLA = [];
// Una sola RPC pesada a la vez: con 2 en paralelo seguían apareciendo 500
// intermitentes en Geocercas (eventos/lotes/visitas compiten por el mismo pool
// de conexiones de Supabase y una sola consulta que pase de 8 s baja a todas).
const MAX_SIMULTANEAS = 1;
let activas = 0;

function desencolar() {
  while (activas < MAX_SIMULTANEAS && COLA.length) {
    const { tarea, resolver, rechazar } = COLA.shift();
    activas += 1;
    Promise.resolve()
      .then(tarea)
      .then(resolver, rechazar)
      .finally(() => {
        activas -= 1;
        desencolar();
      });
  }
}

// 18/11/2026: el primer render de Geocercas/RReportes dispara varias lecturas
// de usuario, vehículos y grupos al mismo tiempo. Aunque estas RPC ya van en
// cola, el pool de Supabase puede estar ocupado y PostgREST cortar una con
// 57014 / statement_timeout cuando tarda 8 s (medido: la misma función responde
// en 0,6-1,6 s cuando no hay esa competencia). Reintentar UNA vez, ya dentro de
// la cola y con la carga bajando, elimina el 500 intermitente sin subir timeouts.
const REINTENTOS_POR_TIMEOUT = 1;
const ESPERA_REINTENTO_MS = 600;

function esTimeoutDeStatement(error) {
  const texto = String(error?.message || error || '');
  return /57014|statement[_ ]timeout|tardó más de 8 s|canceling statement/i.test(texto);
}

async function ejecutarConReintento(nombre, params, contexto, ejecutar) {
  for (let intento = 0; ; intento += 1) {
    try {
      return await ejecutar(nombre, params, contexto);
    } catch (error) {
      if (intento >= REINTENTOS_POR_TIMEOUT || !esTimeoutDeStatement(error)) throw error;
      await new Promise((resolver) => setTimeout(resolver, ESPERA_REINTENTO_MS * (intento + 1)));
    }
  }
}

/**
 * @param {string} nombre nombre de la RPC
 * @param {object} params parámetros PostgREST
 * @param {string} contexto mensaje amable en caso de error
 * @param {(nombre:string, params:object, contexto:string)=>Promise<any>} ejecutar
 *        función que hace la llamada real (define el timeout y el formato
 *        de error de cada módulo).
 */
export function llamarRpcReporte(nombre, params, contexto, ejecutar) {
  if (!RPC_PESADAS.has(nombre)) return ejecutar(nombre, params, contexto);
  const clave = `${nombre}|${JSON.stringify(params)}`;
  const compartida = EN_VUELO.get(clave);
  if (compartida) return compartida;

  const promesa = new Promise((resolver, rechazar) => {
    COLA.push({
      tarea: () => ejecutarConReintento(nombre, params, contexto, ejecutar),
      resolver,
      rechazar,
    });
    desencolar();
  }).finally(() => {
    EN_VUELO.delete(clave);
  });
  EN_VUELO.set(clave, promesa);
  return promesa;
}
