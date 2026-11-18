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
  'agrotrack_visitas_dia_pendientes',
  'agrotrack_calcular_visitas_dia',
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
    COLA.push({ tarea: () => ejecutar(nombre, params, contexto), resolver, rechazar });
    desencolar();
  }).finally(() => {
    EN_VUELO.delete(clave);
  });
  EN_VUELO.set(clave, promesa);
  return promesa;
}
