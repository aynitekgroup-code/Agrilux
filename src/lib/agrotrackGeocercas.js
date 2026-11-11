import shp from 'shpjs';
import { supabase } from './supabase';
import { splitForExport } from './geofenceCleaner';
import { clasificarCapas, collectionEntries, filasDeCapa } from './geocercasImportacion';
import { conBbox, validarGeometria } from './geocercasGeometria';

// La lógica pura de la importación (clasificar capas, leer el nombre y armar
// las filas) vive en geocercasImportacion.js para poder probarla con node.
// Aquí solo está el acceso a Supabase.

const GEOCERCAS_TABLE = 'agrotrack_geocercas';
const IMPORT_BATCH_SIZE = 25;

export async function listarGeocercas(empresaId) {
  if (!empresaId) return [];

  const { data, error } = await supabase
    .from(GEOCERCAS_TABLE)
    .select('id, empresa_id, nombre, tipo, division, anexo, distrito, provincia, geometria, activa')
    .eq('empresa_id', empresaId)
    .eq('activa', true)
    .order('division', { ascending: true })
    .order('nombre', { ascending: true });

  if (error) {
    if (error.code === '42P01' || /schema cache|does not exist/i.test(error.message || '')) {
      throw new Error('Falta crear agrotrack_geocercas. Ejecuta scripts/agrotrack-geocercas.sql en Supabase.');
    }
    throw error;
  }
  return data || [];
}

function errorDeBase(error, contexto) {
  const mensaje = error?.message || '';
  if (error?.code === 'PGRST204' && /incluir_reportes/i.test(mensaje)) {
    return new Error(
      'Falta la columna incluir_reportes: ejecuta scripts/agrotrack-geocercas-reportes.sql ' +
      'en el SQL Editor de Supabase y vuelve a importar.',
    );
  }
  if (error?.code === '42P01' || /schema cache|does not exist/i.test(mensaje)) {
    return new Error('Falta crear agrotrack_geocercas. Ejecuta scripts/agrotrack-geocercas.sql en Supabase.');
  }
  return new Error(`${contexto}${contexto ? ': ' : ''}${mensaje}`);
}

/**
 * Importa un ZIP con shapefiles agrupados por el nombre de la capa
 * (linderos / oficinas / distritos). "divisiones" se ignora.
 *
 * Devuelve un resumen por grupo:
 *   { grupos: [{ id, etiqueta, capa, procesadas, guardadas, omitidas }],
 *     excluidas: [...], ignoradas: [...], guardadas, omitidas }
 */
export async function importarGeocercasZip(file, empresaId, userId) {
  if (!file || !empresaId || !userId) {
    throw new Error('Se requiere el archivo ZIP, una empresa activa y una sesión iniciada.');
  }

  const parsed = await shp(await file.arrayBuffer());
  const capas = collectionEntries(parsed).filter(({ collection }) => collection?.type === 'FeatureCollection');
  if (!capas.length) {
    throw new Error('El ZIP no contiene shapefiles legibles (.shp + .dbf).');
  }

  // 1) Clasificar cada capa por su nombre (linderos / oficinas / distritos).
  const { seleccionadas, excluidas, ignoradas } = clasificarCapas(capas);
  const resumen = { grupos: [], excluidas, ignoradas };

  if (!seleccionadas.length) {
    const encontradas = capas.map((capa) => capa.name || '(sin nombre)').join(', ');
    const partes = [];
    if (excluidas.length) partes.push(`se ignoró ${excluidas.join(', ')} (a pedido)`);
    throw new Error(
      'El ZIP debe traer una capa llamada linderos, oficinas o distritos. ' +
      `Capas encontradas: ${encontradas}${partes.length ? ` · ${partes.join(' · ')}` : ''}.`,
    );
  }

  // 2) Convertir cada capa en filas (solo el campo nombre).
  const porGrupo = seleccionadas.map(({ capa, grupo }) => ({
    grupo,
    capa: capa.name,
    rows: filasDeCapa(capa.collection, empresaId, grupo, capa.name),
  }));

  // 3) Guardar por lotes. Los linderos usan ON CONFLICT DO NOTHING: los 129
  //    ya cargados no se tocan (el archivo de topografía trae huecos).
  for (const { grupo, capa, rows } of porGrupo) {
    let guardadas = 0;
    for (let index = 0; index < rows.length; index += IMPORT_BATCH_SIZE) {
      const batch = rows.slice(index, index + IMPORT_BATCH_SIZE);
      const opciones = { onConflict: 'empresa_id,source_key' };
      if (grupo.soloNuevos) opciones.ignoreDuplicates = true;

      const { data, error } = await supabase
        .from(GEOCERCAS_TABLE)
        .upsert(batch, opciones)
        .select('id');

      if (error) {
        throw errorDeBase(
          error,
          `La importación de ${grupo.etiqueta} se detuvo después de guardar ${guardadas} de ${rows.length}`,
        );
      }
      guardadas += data?.length ?? batch.length;
    }
    resumen.grupos.push({
      id: grupo.id,
      etiqueta: grupo.etiqueta,
      capa,
      procesadas: rows.length,
      guardadas,
      omitidas: rows.length - guardadas, // linderos que ya existían
    });
  }

  resumen.guardadas = resumen.grupos.reduce((suma, g) => suma + g.guardadas, 0);
  resumen.omitidas = resumen.grupos.reduce((suma, g) => suma + g.omitidas, 0);
  return resumen;
}

/* -------------------------------------------------------------------------
 * Edición de geocercas (FASE 3.7): renombrar, cambiar la geometría, crear y
 * eliminar. La RLS decide quién puede: INSERT/UPDATE para administrador e
 * ingeniero, DELETE solo para administrador (no se tocan políticas).
 * ------------------------------------------------------------------------- */

function filaEditada({ nombre, geometria }, contexto) {
  const patch = { updated_at: new Date().toISOString() };

  if (nombre !== undefined) {
    const limpio = String(nombre || '').trim();
    if (!limpio) throw new Error(`${contexto}: el nombre no puede quedar vacío.`);
    patch.nombre = limpio;
  }

  if (geometria !== undefined) {
    const validacion = validarGeometria(geometria);
    if (!validacion.ok) throw new Error(`${contexto}: ${validacion.errores.join(' ')}`);
    // bbox recalculado: los reportes leen geometria->'bbox'.
    patch.geometria = conBbox(geometria);
  }

  if (!('nombre' in patch) && !('geometria' in patch)) {
    throw new Error(`${contexto}: no hay cambios para guardar.`);
  }
  return patch;
}

/** Guarda nombre y/o geometría de una geocerca existente. */
export async function guardarGeocerca(empresaId, { id, nombre, geometria }) {
  if (!empresaId || !id) throw new Error('Falta la empresa o la geocerca por guardar.');
  const patch = filaEditada({ nombre, geometria }, 'No se pudo guardar la geocerca');

  const { data, error } = await supabase
    .from(GEOCERCAS_TABLE)
    .update(patch)
    .eq('empresa_id', empresaId)
    .eq('id', id)
    .select('id, nombre');

  if (error) throw errorDeBase(error, 'No se pudo guardar la geocerca');
  // Con RLS el update sin permiso no da error: devuelve 0 filas.
  if (!data?.length) {
    throw new Error(
      'No se pudo guardar la geocerca: tu rol no tiene permiso de edición ' +
      '(se requiere administrador o ingeniero) o la geocerca ya no existe.',
    );
  }
  return data[0];
}

/** Crea una geocerca nueva (dibujada en el mapa). */
export async function crearGeocerca(empresaId, { nombre, geometria, tipo = 'poligono' }) {
  if (!empresaId) throw new Error('Falta la empresa activa para crear la geocerca.');
  const patch = filaEditada({ nombre, geometria }, 'No se pudo crear la geocerca');

  const { data, error } = await supabase
    .from(GEOCERCAS_TABLE)
    .insert({
      empresa_id: empresaId,
      // source_key NULL a propósito: las importaciones nunca chocan con una
      // geocerca dibujada a mano (el índice único admite varios NULL).
      source_key: null,
      tipo,
      forma: geometria.type === 'MultiPolygon' ? 'multipoligono' : 'irregular',
      atributos_fuente: { grupo: 'manual', capa: 'editor' },
      incluir_reportes: true,
      activa: true,
      ...patch,
    })
    .select('id, nombre');

  if (error) throw errorDeBase(error, 'No se pudo crear la geocerca');
  if (!data?.length) {
    throw new Error(
      'No se pudo crear la geocerca: tu rol no tiene permiso de edición ' +
      '(se requiere administrador o ingeniero).',
    );
  }
  return data[0];
}

/** Elimina una geocerca (solo administrador: la RLS lo exige). */
export async function quitarGeocerca(empresaId, id) {
  if (!empresaId || !id) throw new Error('Falta la empresa o la geocerca por eliminar.');

  const { data, error } = await supabase
    .from(GEOCERCAS_TABLE)
    .delete()
    .eq('empresa_id', empresaId)
    .eq('id', id)
    .select('id');

  if (error) throw errorDeBase(error, 'No se pudo eliminar la geocerca');
  if (!data?.length) {
    throw new Error(
      'No se pudo eliminar la geocerca: la eliminación es solo para administradores ' +
      'o la geocerca ya no existe.',
    );
  }
  return true;
}

// Exporta las geocercas limpias para Zonar: sin huecos, sin vértices excesivos
// y con cada parte de un MultiPolygon como polígono independiente.
// Solo las geocercas de campo: oficinas y distritos quedan fuera de la
// exportación (incluir_reportes).
export async function exportarGeocercasZonar(empresaId) {
  let { data, error } = await supabase
    .from(GEOCERCAS_TABLE)
    .select('nombre, division, anexo, geometria, incluir_reportes')
    .eq('empresa_id', empresaId)
    .eq('activa', true)
    .eq('incluir_reportes', true);

  // Si todavía no se corrió scripts/agrotrack-geocercas-reportes.sql no existe
  // la columna: en ese caso tampoco hay oficinas/distritos cargados (el
  // importador exige la columna), así que se repite sin el filtro.
  if (error && error.code === 'PGRST204' && /incluir_reportes/i.test(error.message || '')) {
    ({ data, error } = await supabase
      .from(GEOCERCAS_TABLE)
      .select('nombre, division, anexo, geometria')
      .eq('empresa_id', empresaId)
      .eq('activa', true));
  }
  if (error) throw errorDeBase(error, 'No se pudieron leer las geocercas');

  const rows = data || [];
  const features = [];
  const resumen = {
    geocercas: rows.length,
    poligonosExportados: 0,
    huecosRellenados: 0,
    partesDescartadas: 0,
    conAdvertencia: [],
  };
  for (const row of rows) {
    const { items, report } = splitForExport(row.nombre, row.geometria);
    resumen.huecosRellenados += report.huecosRellenados;
    resumen.partesDescartadas += report.partesDescartadas;
    if (report.advertencias.length) resumen.conAdvertencia.push(row.nombre);
    for (const it of items) {
      features.push({
        type: 'Feature',
        properties: { nombre: it.nombre, grupo: it.grupo, division: row.division, anexo: row.anexo },
        geometry: it.geometry,
      });
      resumen.poligonosExportados++;
    }
  }
  return { collection: { type: 'FeatureCollection', features }, resumen };
}
