/**
 * src/lib/agrotrackPosiciones.js
 * Carga los "Reporte por placa" de Zonar (un Excel por unidad, un punto GPS cada ~2 min)
 * en la tabla agrotrack_posiciones. Acepta un ZIP con Excel o varios .xlsx sueltos.
 * Requiere: npm install xlsx   (jszip ya está instalado en el proyecto)
 */
import JSZip from 'jszip';
import { supabase } from './supabase';
import {
  normalizeHeader,
  parseFechaZonar,
  separarUnidad,
  cleanText,
  numberOrNull,
  armarSourceKey,
} from './agrotrackParse.js';

// Reexportados para no romper a quien los importe de este módulo.
export { parseFechaZonar, separarUnidad };

const POSICIONES_TABLE = 'agrotrack_posiciones';
const BATCH_SIZE = 1000;

function buildRow(raw, columns, empresaId, userId) {
  const get = (name) => raw[columns[name]];
  const unidad = String(get('unidad') ?? '').trim();
  const { placa, descripcion } = separarUnidad(unidad);
  const fecha = parseFechaZonar(get('fecha'));
  const latitud = numberOrNull(get('latitud'));
  const longitud = numberOrNull(get('longitud'));
  const evento = cleanText(get('eventos'));

  if (!placa || !fecha || !evento) return { error: 'faltan unidad, fecha o evento' };
  if (latitud === null || longitud === null || Math.abs(latitud) > 90 || Math.abs(longitud) > 180) {
    return { error: 'coordenadas inválidas' };
  }

  const sourceKey = armarSourceKey(placa, fecha, evento, latitud, longitud);
  return {
    row: {
      empresa_id: empresaId,
      placa,
      unidad,
      descripcion,
      fecha,
      secuencia: numberOrNull(get('secuencia')),
      evento,
      pt_referencia: cleanText(get('pt. referencia')),
      direccion: cleanText(get('direccion')),
      velocidad: numberOrNull(get('velocidad')),
      latitud,
      longitud,
      source_key: sourceKey,
      creado_por: userId || null,
    },
  };
}

const REQUIRED_COLUMNS = ['unidad', 'eventos', 'fecha', 'latitud', 'longitud'];
const OPTIONAL_COLUMNS = ['secuencia', 'pt. referencia', 'direccion', 'velocidad'];

async function leerLibroExcel(buffer, nombreArchivo, XLSX, empresaId, userId, acumulado) {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) {
    acumulado.archivosConError.push(`${nombreArchivo}: no tiene hojas`);
    return;
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
  if (!rows.length) {
    acumulado.archivosConError.push(`${nombreArchivo}: está vacío`);
    return;
  }

  const headerIndex = new Map(rows[0].map((header, index) => [normalizeHeader(header), index]));
  const missing = REQUIRED_COLUMNS.filter((name) => !headerIndex.has(name));
  if (missing.length) {
    acumulado.archivosConError.push(`${nombreArchivo}: faltan las columnas ${missing.join(', ')}`);
    return;
  }
  const columns = {};
  [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS].forEach((name) => {
    if (headerIndex.has(name)) columns[name] = headerIndex.get(name);
  });

  acumulado.archivos += 1;
  for (let i = 1; i < rows.length; i += 1) {
    const raw = rows[i];
    if (!raw || raw.every((cell) => String(cell ?? '').trim() === '')) continue;
    acumulado.filasLeidas += 1;
    const { row, error } = buildRow(raw, columns, empresaId, userId);
    if (error) {
      acumulado.invalidas += 1;
      if (acumulado.ejemplosInvalidas.length < 5) {
        acumulado.ejemplosInvalidas.push(`${nombreArchivo}, fila ${i + 1}: ${error}`);
      }
      continue;
    }
    if (acumulado.filas.has(row.source_key)) {
      acumulado.duplicadasEnArchivo += 1;
    } else {
      acumulado.filas.set(row.source_key, row);
    }
  }
}

async function expandirArchivos(files) {
  const excels = [];
  for (const file of files) {
    const name = file.name || '';
    const lower = name.toLowerCase();
    if (lower.endsWith('.zip')) {
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const entries = Object.values(zip.files).filter((entry) => {
        const base = entry.name.split('/').pop();
        return (
          !entry.dir &&
          /\.xlsx$/i.test(entry.name) &&
          !entry.name.startsWith('__MACOSX') &&
          !base.startsWith('~$')
        );
      });
      for (const entry of entries) {
        excels.push({ nombre: entry.name.split('/').pop(), leer: () => entry.async('arraybuffer') });
      }
    } else if (lower.endsWith('.xlsx')) {
      if (!name.startsWith('~$')) excels.push({ nombre: name, leer: () => file.arrayBuffer() });
    }
  }
  return excels;
}

/**
 * @param {File[]|FileList} files   ZIP y/o .xlsx de "Reporte por placa"
 * @param {string} empresaId
 * @param {string} userId
 * @param {(p:{fase:string,actual:number,total:number})=>void} [onProgress]
 */
export async function cargarPosicionesZonar(files, empresaId, userId, onProgress) {
  if (!empresaId || !userId) {
    throw new Error('Se requiere una empresa activa y una sesión iniciada.');
  }
  const lista = Array.from(files || []);
  if (!lista.length) throw new Error('Selecciona un ZIP o archivos .xlsx.');

  const XLSX = await import('xlsx');
  const excels = await expandirArchivos(lista);
  if (!excels.length) throw new Error('No se encontraron archivos .xlsx en la selección.');

  const acumulado = {
    archivos: 0,
    archivosConError: [],
    filasLeidas: 0,
    invalidas: 0,
    ejemplosInvalidas: [],
    duplicadasEnArchivo: 0,
    filas: new Map(),
  };

  for (let i = 0; i < excels.length; i += 1) {
    onProgress?.({ fase: 'Leyendo archivos', actual: i + 1, total: excels.length });
    const buffer = await excels[i].leer();
    await leerLibroExcel(buffer, excels[i].nombre, XLSX, empresaId, userId, acumulado);
  }

  const filas = [...acumulado.filas.values()];
  if (!filas.length) {
    throw new Error(
      acumulado.archivosConError.length
        ? `No se pudo leer ningún archivo. ${acumulado.archivosConError[0]}`
        : 'Los archivos no contienen posiciones válidas.',
    );
  }

  let nuevas = 0;
  for (let index = 0; index < filas.length; index += BATCH_SIZE) {
    const lote = filas.slice(index, index + BATCH_SIZE);
    onProgress?.({ fase: 'Guardando posiciones', actual: Math.min(index + lote.length, filas.length), total: filas.length });
    const { data, error } = await supabase
      .from(POSICIONES_TABLE)
      .upsert(lote, { onConflict: 'empresa_id,source_key', ignoreDuplicates: true })
      .select('id');
    if (error) {
      if (error.code === '42P01' || /schema cache|does not exist/i.test(error.message || '')) {
        throw new Error('Falta crear agrotrack_posiciones. Ejecuta agrotrack-posiciones.sql en Supabase.');
      }
      throw new Error(
        `La carga se detuvo después de guardar ${nuevas} posiciones nuevas: ${error.message}. ` +
        'Puedes repetirla; las posiciones ya guardadas se omiten.',
      );
    }
    nuevas += data?.length ?? 0;
  }

  const unidades = new Set(filas.map((fila) => fila.placa));
  return {
    archivos: acumulado.archivos,
    archivosConError: acumulado.archivosConError,
    unidades: unidades.size,
    filasLeidas: acumulado.filasLeidas,
    invalidas: acumulado.invalidas,
    ejemplosInvalidas: acumulado.ejemplosInvalidas,
    duplicadasEnArchivo: acumulado.duplicadasEnArchivo,
    nuevas,
    yaExistentes: filas.length - nuevas,
  };
}