import shp from 'shpjs';
import { supabase } from './supabase';

const GEOCERCAS_TABLE = 'agrotrack_geocercas';
const EXPECTED_FEATURE_COUNT = 129;
const IMPORT_BATCH_SIZE = 25;

function collectionEntries(parsed) {
  if (parsed?.type === 'FeatureCollection') {
    return [{ name: '', collection: parsed }];
  }

  if (Array.isArray(parsed)) {
    return parsed.map((collection, index) => ({
      name: String(collection?.fileName || index),
      collection,
    }));
  }

  if (parsed && typeof parsed === 'object') {
    return Object.entries(parsed).map(([name, collection]) => ({ name, collection }));
  }

  return [];
}

function normalizedKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function property(properties, ...names) {
  const keys = Object.keys(properties || {});
  const key = keys.find((candidate) =>
    names.some((name) => candidate.toLowerCase() === name.toLowerCase()),
  );
  return key ? properties[key] : null;
}

function isValidCoordinates(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) return false;
  if (typeof coordinates[0] === 'number') {
    const [longitude, latitude] = coordinates;
    return (
      coordinates.length >= 2 &&
      Number.isFinite(longitude) &&
      Number.isFinite(latitude) &&
      longitude >= -180 &&
      longitude <= 180 &&
      latitude >= -90 &&
      latitude <= 90
    );
  }
  return coordinates.every(isValidCoordinates);
}

function toRow(feature, empresaId, userId) {
  const geometry = feature?.geometry;
  const properties = feature?.properties || {};
  const nombre = String(property(properties, 'Name', 'nombre') || '').trim();
  const division = String(property(properties, 'Division', 'division') || '').trim();
  const anexo = String(property(properties, 'Anexo', 'anexo') || '').trim();
  const distrito = String(property(properties, 'Distrito', 'distrito') || '').trim();
  const provincia = String(property(properties, 'Provincia', 'provincia') || '').trim();
  const areaValue = property(properties, 'Area', 'area');
  const areaDeclarada = areaValue == null || String(areaValue).trim() === '' ? null : Number(areaValue);

  if (!nombre) throw new Error('La capa linderos contiene un polígono sin nombre.');
  if (!['Polygon', 'MultiPolygon'].includes(geometry?.type) || !isValidCoordinates(geometry.coordinates)) {
    throw new Error(`El polígono "${nombre}" no tiene una geometría válida en WGS84.`);
  }
  if (areaDeclarada !== null && !Number.isFinite(areaDeclarada)) {
    throw new Error(`El área declarada del polígono "${nombre}" no es válida.`);
  }

  const sourceKey = [division, anexo, nombre].map(normalizedKey).filter(Boolean).join('|');
  if (!sourceKey) throw new Error(`No se pudo identificar el polígono "${nombre}".`);

  return {
    empresa_id: empresaId,
    source_key: sourceKey,
    nombre,
    division: division || null,
    anexo: anexo || null,
    distrito: distrito || null,
    provincia: provincia || null,
    area_declarada: areaDeclarada,
    geometria: geometry,
    atributos_fuente: properties,
    activa: true,
    creado_por: userId,
    updated_at: new Date().toISOString(),
  };
}

export async function listarGeocercas(empresaId) {
  if (!empresaId) return [];

  const { data, error } = await supabase
    .from(GEOCERCAS_TABLE)
    .select('id, empresa_id, nombre, division, anexo, distrito, provincia, geometria, activa')
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

export async function importarGeocercasZip(file, empresaId, userId) {
  if (!file || !empresaId || !userId) {
    throw new Error('Se requiere el archivo ZIP, una empresa activa y una sesión iniciada.');
  }

  const parsed = await shp(await file.arrayBuffer());
  const layers = collectionEntries(parsed).filter(({ collection }) => collection?.type === 'FeatureCollection');
  const linderos = layers.filter(({ name }) => name.toLowerCase().includes('linderos'));
  const expectedLayers = layers.filter(
    ({ collection }) => collection.features?.length === EXPECTED_FEATURE_COUNT,
  );
  const selected =
    linderos.length === 1 && linderos[0].collection.features?.length === EXPECTED_FEATURE_COUNT
      ? linderos[0]
      : expectedLayers.length === 1
        ? expectedLayers[0]
        : null;

  if (!selected) {
    throw new Error(`El ZIP debe contener una única capa linderos con ${EXPECTED_FEATURE_COUNT} polígonos.`);
  }

  const features = selected.collection.features || [];
  if (features.length !== EXPECTED_FEATURE_COUNT) {
    throw new Error(`La capa seleccionada contiene ${features.length} polígonos; se esperaban ${EXPECTED_FEATURE_COUNT}.`);
  }

  const rows = features.map((feature) => toRow(feature, empresaId, userId));
  const sourceKeys = new Set(rows.map((row) => row.source_key));
  if (sourceKeys.size !== rows.length) {
    throw new Error('La capa tiene nombres/divisiones repetidos; no se importó para evitar sobrescribir geocercas ambiguas.');
  }

  let saved = 0;
  for (let index = 0; index < rows.length; index += IMPORT_BATCH_SIZE) {
    const batch = rows.slice(index, index + IMPORT_BATCH_SIZE);
    const { data, error } = await supabase
      .from(GEOCERCAS_TABLE)
      .upsert(batch, { onConflict: 'empresa_id,source_key' })
      .select('id');

    if (error) {
      throw new Error(
        `La importación se detuvo después de guardar ${saved} de ${rows.length} polígonos: ${error.message}. ` +
        'Puedes repetirla; las filas ya procesadas se actualizan de forma idempotente.',
      );
    }
    saved += data?.length ?? batch.length;
  }

  return saved;
}
