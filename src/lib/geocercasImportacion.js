// src/lib/geocercasImportacion.js
// Lógica PURA de la importación de geocercas por grupos (FASE 3.7):
// clasificar las capas del ZIP, leer el nombre y construir las filas.
// Sin supabase ni DOM: se puede probar con node sobre el ZIP real.
import { cleanGeofence } from './geofenceCleaner.js';
import { conBbox } from './geocercasGeometria.js';

const ZONAR_MAX_VERTICES = 200; // Valor supuesto: confirmar el límite real con el ingeniero.

// ---------------------------------------------------------------------------
// Grupos importables. El NOMBRE DE LA CAPA del ZIP decide el grupo (shpjs
// devuelve el nombre base del .shp, p. ej. "oficinas_otros_geo").
//   * linderos   -> solo se insertan los que falten: los 129 ya están cargados
//                   y el archivo de topografía trae huecos, así que NO se
//                   sobrescriben (pedido del Ing. Carlos Perez).
//   * oficinas   -> se ven en el mapa Y entran en los reportes de geocercas
//                   (incluir_reportes = true): decisión 13/11/2026 del Ing.
//                   Carlos Perez, igual que en Zonar.
//   * distritos  -> igual que oficinas. Un distrito contiene varios lotes,
//                   así que su tiempo puede "duplicarse" contra el lote de
//                   adentro: es el mismo comportamiento de Zonar.
//   * divisiones -> se ignora a pedido del Ing. Carlos Perez.
// ---------------------------------------------------------------------------
export const GRUPOS_IMPORT = [
  {
    id: 'linderos',
    etiqueta: 'Campos',
    test: (nombre) => nombre.includes('lindero'),
    tipo: 'autorizada',
    incluirReportes: true,
    soloNuevos: true,
  },
  {
    id: 'oficinas',
    etiqueta: 'Oficinas',
    test: (nombre) => nombre.includes('oficina'),
    tipo: 'oficina',
    incluirReportes: true,
    soloNuevos: false,
  },
  {
    id: 'distritos',
    etiqueta: 'Distritos',
    test: (nombre) => nombre.includes('distrito'),
    tipo: 'distrito',
    incluirReportes: true,
    soloNuevos: false,
  },
];

export const CAPAS_EXCLUIDAS = [
  { etiqueta: 'Divisiones', test: (nombre) => nombre.includes('division') },
];

// Solo se usa UN campo por polígono: el nombre (pedido del Ing. Carlos Perez).
// Los shapefiles no usan siempre el mismo nombre de campo: linderos trae
// "Name", oficinas "Nombre" y distritos "NOMBDIST".
export const CAMPOS_NOMBRE = ['name', 'nombre', 'nombdist', 'nomdist', 'etiqueta', 'label'];

/** Devuelve [{ name, collection }] para cualquier forma que entregue shpjs. */
export function collectionEntries(parsed) {
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

export function normalizedKey(value) {
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

/** Único campo que se importa: el nombre del polígono. */
export function nombreDePropiedades(properties) {
  for (const campo of CAMPOS_NOMBRE) {
    const valor = property(properties, campo);
    if (valor != null && String(valor).trim()) return String(valor).trim();
  }
  return '';
}

function texto(valor) {
  return valor == null ? '' : String(valor).trim();
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

// Diagnóstico para Zonar. Nunca debe hacer fallar la importación.
function zonarDiagnostico(geometry) {
  try {
    const { report } = cleanGeofence(geometry);
    const requiereLimpieza =
      report.huecosRellenados > 0 ||
      report.partesOriginales > 1 ||
      report.verticesAntes > ZONAR_MAX_VERTICES ||
      report.autointersecciones > 0;
    return { ...report, requiereLimpieza };
  } catch {
    return null;
  }
}

/**
 * Clasifica las capas del ZIP. Devuelve:
 *   { seleccionadas: [{ capa, grupo }], excluidas: [nombres], ignoradas: [nombres] }
 * `capa` es { name, collection }.
 */
export function clasificarCapas(capas) {
  const seleccionadas = [];
  const excluidas = [];
  const ignoradas = [];

  for (const capa of capas) {
    const nombreCapa = normalizedKey(capa.name);
    const excluida = CAPAS_EXCLUIDAS.find((entrada) => entrada.test(nombreCapa));
    if (excluida) {
      excluidas.push(capa.name);
      continue;
    }
    const grupo = GRUPOS_IMPORT.find((entrada) => entrada.test(nombreCapa));
    if (grupo) {
      seleccionadas.push({ capa, grupo });
      continue;
    }
    // Un .shp suelto llega sin nombre de capa: se identifica por sus campos.
    if (!capa.name && capas.length === 1) {
      const inferido = inferirGrupo(capa.collection);
      const grupoInferido = GRUPOS_IMPORT.find((entrada) => entrada.id === inferido);
      if (grupoInferido) {
        seleccionadas.push({ capa, grupo: grupoInferido });
        continue;
      }
    }
    ignoradas.push(capa.name || '(sin nombre)');
  }

  return { seleccionadas, excluidas, ignoradas };
}

/** Identifica la capa por sus campos cuando el ZIP trae un solo .shp suelto. */
export function inferirGrupo(collection) {
  const campos = Object.keys(collection?.features?.[0]?.properties || {}).map((clave) =>
    clave.toLowerCase(),
  );
  if (campos.includes('nombdist')) return 'distritos';
  if (campos.includes('nombre') && !campos.includes('division')) return 'oficinas';
  if (campos.includes('name') && campos.includes('division')) return 'linderos';
  return null;
}

/**
 * Fila para guardar. Solo usa el campo nombre del shapefile; el resto de
 * atributos_fuente queda mínimo ({ grupo, capa }) para no arrastrar los ~80
 * campos del censo de distritos.
 */
export function toRow(feature, empresaId, grupo, nombreCapa) {
  const geometry = feature?.geometry;
  const properties = feature?.properties || {};
  const nombre = nombreDePropiedades(properties);

  if (!nombre) {
    throw new Error(
      `La capa ${nombreCapa || grupo.etiqueta} tiene un polígono sin nombre ` +
      `(buscando los campos ${CAMPOS_NOMBRE.join(', ')}).`,
    );
  }
  if (!['Polygon', 'MultiPolygon'].includes(geometry?.type) || !isValidCoordinates(geometry.coordinates)) {
    throw new Error(`El polígono "${nombre}" no tiene una geometría válida en WGS84.`);
  }

  // Los linderos conservan la ruta original (división | anexo | nombre), que
  // es exactamente el source_key de las 129 geocercas ya cargadas: así un
  // reimportar usa ON CONFLICT DO NOTHING y no las pisa. Los grupos nuevos
  // llevan prefijo para no chocar nunca con ellas.
  const esLindero = grupo.id === 'linderos';
  const division = esLindero ? texto(property(properties, 'Division', 'division')) : '';
  const anexo = esLindero ? texto(property(properties, 'Anexo', 'anexo')) : '';
  const distrito = esLindero ? texto(property(properties, 'Distrito', 'distrito')) : '';
  const provincia = esLindero ? texto(property(properties, 'Provincia', 'provincia')) : '';
  const areaValue = esLindero ? property(properties, 'Area', 'area') : null;
  const areaDeclarada = areaValue == null || String(areaValue).trim() === '' ? null : Number(areaValue);

  const sourceKey = esLindero
    ? [division, anexo, nombre].map(normalizedKey).filter(Boolean).join('|')
    : `${grupo.id}|${normalizedKey(nombre)}`;
  if (!sourceKey) throw new Error(`No se pudo identificar el polígono "${nombre}".`);
  if (areaDeclarada !== null && !Number.isFinite(areaDeclarada)) {
    throw new Error(`El área declarada del polígono "${nombre}" no es válida.`);
  }

  const geometria = conBbox(geometry); // los reportes leen geometria->'bbox'
  const zonar = zonarDiagnostico(geometria);

  return {
    empresa_id: empresaId,
    source_key: sourceKey,
    nombre,
    tipo: grupo.tipo,
    forma: geometry.type === 'MultiPolygon' ? 'multipoligono' : 'irregular',
    geometria,
    division: division || null,
    anexo: anexo || null,
    distrito: distrito || null,
    provincia: provincia || null,
    area_declarada: areaDeclarada,
    atributos_fuente: { grupo: grupo.id, capa: nombreCapa || grupo.id, ...(zonar ? { _zonar: zonar } : {}) },
    incluir_reportes: grupo.incluirReportes,
    activa: true,
    updated_at: new Date().toISOString(),
  };
}

/** Convierte una capa completa en filas, validando nombres repetidos. */
export function filasDeCapa(coleccion, empresaId, grupo, nombreCapa) {
  const features = coleccion?.features || [];
  if (!features.length) {
    throw new Error(`La capa ${nombreCapa || grupo.etiqueta} está vacía.`);
  }
  const rows = features.map((feature) => toRow(feature, empresaId, grupo, nombreCapa));
  const claves = new Set(rows.map((row) => row.source_key));
  if (claves.size !== rows.length) {
    throw new Error(
      `La capa ${nombreCapa || grupo.etiqueta} tiene nombres repetidos; no se importó ` +
      'para no sobrescribir geocercas ambiguas.',
    );
  }
  return rows;
}
