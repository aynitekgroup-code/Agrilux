/**
 * src/lib/agrotrackGrupos.js
 * Grupos editables de las unidades del localizador (observación VI).
 *
 * Contrato SQL (lo crea scripts/agrotrack-geocercas-reportes.sql en Supabase):
 *   agrotrack_grupos_unidades(p_empresa_id)               -> { placa, grupo }
 *   agrotrack_guardar_grupo_unidad(p_empresa_id, p_placa, p_grupo)
 *       grupo vacío ("") = quitar la unidad de su grupo
 * El nombre de empresa sigue la convención de todas las RPC vecinas
 * (`p_empresa_id`); si una instalación vieja lo trae como `p_empresa`, se
 * reintenta UNA vez con ese nombre antes de degradar.
 *
 * Compatibilidad mientras esas funciones todavía no existan (PGRST202):
 * la lectura devuelve `disponible: false` con un aviso amable y la UI
 * agrupa por la `descripcion` de la unidad (p. ej. "SEGURIDAD"), sin romper
 * ni dejar la tarjeta en error.
 */
import { supabase } from './supabase';

/** Mensaje único que ve el usuario cuando falta el SQL de grupos. */
export const AVISO_SQL_GRUPOS =
  'Ejecuta scripts/agrotrack-geocercas-reportes.sql en el SQL Editor de Supabase para poder crear y editar grupos de unidades.';

/** Etiqueta del grupo de las unidades sin grupo asignado. */
export const GRUPO_SIN_GRUPO = 'Sin grupo';

/** Tope por llamada RPC (ms): evita el "Cargando..." eterno. */
const TIMEOUT_RPC_MS = 15000;

function mensajeDeError(error, contexto) {
  const detalle = error?.message || String(error);
  if (/failed to fetch|networkerror|network request failed/i.test(detalle)) {
    return `${contexto}: sin conexión con Supabase. Revisa tu red y reintenta.`;
  }
  if (
    error?.code === 'PGRST202' ||
    /could not find the function|function .* does not exist|does not exist/i.test(detalle)
  ) {
    return AVISO_SQL_GRUPOS;
  }
  if (error?.code === '42P01' || /schema cache|relation .* does not exist/i.test(detalle)) {
    return 'Falta la tabla de grupos de unidades. Ejecuta scripts/agrotrack-geocercas-reportes.sql en Supabase.';
  }
  if (/permission denied|row-level security/i.test(detalle)) {
    return 'Sin permiso sobre los grupos de unidades para esta empresa activa.';
  }
  return `${contexto}: ${detalle}`;
}

function crearError(error, contexto) {
  const mensaje = mensajeDeError(error, contexto);
  const faltoSql =
    error?.code === 'PGRST202' ||
    /could not find the function|function .* does not exist|does not exist/i.test(error?.message || '') ||
    mensaje === AVISO_SQL_GRUPOS;
  const err = new Error(mensaje);
  err.rpcFalta = faltoSql;
  return err;
}

async function llamarRpc(nombre, params, contexto) {
  const controller = new AbortController();
  const reloj = setTimeout(() => controller.abort(), TIMEOUT_RPC_MS);
  let data = null;
  let error = null;
  try {
    ({ data, error } = await supabase.rpc(nombre, params).abortSignal(controller.signal));
  } catch (e) {
    error = controller.signal.aborted
      ? { message: `sin respuesta en ${TIMEOUT_RPC_MS / 1000} s; revisa tu conexión` }
      : e;
  } finally {
    clearTimeout(reloj);
  }
  if (error) throw crearError(error, contexto);
  return data || [];
}

/**
 * Llama una RPC con el nombre de parámetro de empresa correcto: el SQL del
 * repo usa `p_empresa_id`; si esa firma no existe (contrato con `p_empresa`),
 * se reintenta UNA vez con ese nombre. Cualquier otro error se propaga.
 */
async function llamarRpcEmpresa(nombre, paramsSinEmpresa, empresaId, contexto) {
  try {
    return await llamarRpc(nombre, { ...paramsSinEmpresa, p_empresa_id: empresaId }, contexto);
  } catch (e) {
    if (!e?.rpcFalta) throw e;
    return llamarRpc(nombre, { ...paramsSinEmpresa, p_empresa: empresaId }, contexto);
  }
}

/** Filas { placa, grupo } de la empresa. Lanza Error con `rpcFalta` si no existe la RPC. */
export async function obtenerGruposUnidades(empresaId) {
  if (!empresaId) return [];
  return llamarRpcEmpresa(
    'agrotrack_grupos_unidades',
    {},
    empresaId,
    'No se pudieron cargar los grupos de unidades',
  );
}

/**
 * Guarda (o quita, con grupo vacío) el grupo de una placa.
 * Lanza Error si falla: la UI hace rollback del cambio optimista.
 */
export async function guardarGrupoUnidad(empresaId, placa, grupo) {
  if (!empresaId || !placa) throw new Error('Falta la empresa o la placa para guardar el grupo.');
  await llamarRpcEmpresa(
    'agrotrack_guardar_grupo_unidad',
    { p_placa: placa, p_grupo: String(grupo ?? '').trim() },
    empresaId,
    'No se pudo guardar el grupo de la unidad',
  );
  return true;
}

/**
 * Carga los grupos con degradación amable:
 *   { grupos: {placa: grupo}, disponible, aviso, cargando }
 * `disponible` solo es true si la RPC respondió; si no, la UI agrupa por la
 * descripción de la unidad y oculta la edición mostrando `aviso`.
 */
export async function cargarGruposUnidades(empresaId) {
  if (!empresaId) {
    return { grupos: {}, disponible: false, aviso: null };
  }
  try {
    const filas = await obtenerGruposUnidades(empresaId);
    const grupos = {};
    filas.forEach((fila) => {
      const placa = String(fila?.placa || '').trim();
      if (!placa) return;
      grupos[placa] = String(fila?.grupo || '').trim();
    });
    return { grupos, disponible: true, aviso: null };
  } catch (error) {
    // RPC ausente (PGRST202) o cualquier fallo de lectura: degradamos, nunca
    // rompemos el mapa. El aviso explica qué script falta ejecutar.
    return { grupos: {}, disponible: false, aviso: error?.message || AVISO_SQL_GRUPOS };
  }
}

/**
 * Sugerencia de grupo a partir de la descripción de la unidad
 * ("BPH-767/SEGURIDAD" -> "Seguridad"). SOLO se usa como placeholder del
 * input: no inventa grupos oficiales ni escribe en la base.
 */
const SUGERENCIAS_DESCRIPCION = [
  [/segur/i, 'Seguridad'],
  [/vigil/i, 'Vigilancia'],
  [/adm|ofic|admin/i, 'Administración'],
  [/mant/i, 'Mantenimiento'],
  [/agr|agro|campo/i, 'Agrícola'],
  [/trans|camion|flota/i, 'Transporte'],
  [/pza|pieza/i, 'Piezas'],
  [/lab/i, 'Laboratorio'],
  [/irri|riego/i, 'Riego'],
  [/cose/i, 'Cosecha'],
  [/cons|obra|constr/i, 'Construcción'],
  [/vial|carret|transporte vial/i, 'Vial'],
];

export function grupoSugerido(descripcion) {
  const texto = String(descripcion || '');
  if (!texto) return '';
  const encontrado = SUGERENCIAS_DESCRIPCION.find(([patron]) => patron.test(texto));
  return encontrado ? encontrado[1] : '';
}

/**
 * Agrupa las unidades del localizador.
 * @param {Array} unidades         unidades del mapa (con placa y descripción)
 * @param {Object} gruposPorPlaca  { placa: grupo } leído de la RPC
 * @param {boolean} modoDescripcion true = sin RPC de grupos: agrupar por la
 *                                  descripción de la unidad (fallback)
 * @returns {{clave: string, etiqueta: string, unidades: Array}[]} ordenado,
 *          con "Sin grupo" al final.
 */
export function agruparUnidades(unidades, gruposPorPlaca = {}, modoDescripcion = false) {
  const buckets = new Map();
  (unidades || []).forEach((unidad) => {
    const placa = String(unidad?.placa || unidad?.id || '').trim();
    if (!placa) return;
    let clave;
    if (modoDescripcion) {
      clave = String(unidad?.descripcion || '').trim();
    } else {
      // Sin grupo asignado: se lista bajo su descripción actual (el código
      // que ya trae la unidad) en vez de acumular todo en "Sin grupo"; al
      // asignar un grupo, la unidad se mueve a ese grupo.
      clave = String(gruposPorPlaca?.[placa] ?? '').trim()
        || String(unidad?.descripcion || '').trim();
    }
    const bucket = clave || GRUPO_SIN_GRUPO;
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket).push(unidad);
  });

  return [...buckets.entries()]
    .map(([clave, lista]) => ({
      clave,
      etiqueta: clave || GRUPO_SIN_GRUPO,
      unidades: lista.sort((a, b) =>
        String(a.placa || a.id).localeCompare(String(b.placa || b.id), 'es')),
    }))
    .sort((a, b) => {
      if (a.clave === '') return 1;
      if (b.clave === '') return -1;
      return a.etiqueta.localeCompare(b.etiqueta, 'es');
    });
}

/** Valores distintos de grupo (para el datalist del input de asignación). */
export function listaGruposConocidos(gruposPorPlaca = {}) {
  const valores = new Set();
  Object.values(gruposPorPlaca).forEach((grupo) => {
    const limpio = String(grupo || '').trim();
    if (limpio) valores.add(limpio);
  });
  return [...valores].sort((a, b) => a.localeCompare(b, 'es'));
}
