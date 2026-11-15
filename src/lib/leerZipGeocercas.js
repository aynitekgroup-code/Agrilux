/**
 * src/lib/leerZipGeocercas.js
 * Lectura ROBUSTA del ZIP de geocercas (14/11/2026).
 *
 * Arregla el error "no layers founds" que mostraba "Importar ZIP": la
 * librería shpjs solo busca los .shp en la raíz del ZIP con la extensión en
 * minúscula y se rinde con ese mensaje (en inglés) cuando:
 *   - el ZIP trae otro ZIP adentro (pasa al comprimir una carpeta que ya
 *     tenía los .zip de topografía),
 *   - las extensiones vienen en mayúscula (LINDEROS.SHP, .DBF),
 *   - los archivos están dentro de subcarpetas o junto a basura de macOS
 *     (__MACOSX/, ._archivo.shp),
 *   - o el ZIP no trae shapefiles sino otra cosa (.kml, .gdb, .dwg…).
 *
 * Aquí abrimos el ZIP con JSZip (ya es dependencia del proyecto), entramos a
 * los ZIP internos y armamos cada capa con los lectores de bajo nivel de
 * shpjs (parseShp + parseDbf + combine). La salida es la misma que daba
 * shp(): una lista de FeatureCollection con fileName = nombre de la capa,
 * así que clasificarCapas() y el resto de la importación no cambian.
 */
import JSZip from 'jszip';
import * as shpjs from 'shpjs';

const MAX_PROFUNDIDAD_ZIP = 3;

function lector(nombre) {
  const fn = shpjs[nombre] || shpjs.default?.[nombre];
  if (typeof fn !== 'function') {
    throw new Error(`La librería shpjs no expone ${nombre}.`);
  }
  return fn;
}

function esBasura(ruta) {
  const partes = ruta.split('/');
  const archivo = partes[partes.length - 1];
  return partes.includes('__MACOSX') || archivo.startsWith('._') || archivo === '.DS_Store' || archivo === 'Thumbs.db';
}

function extension(ruta) {
  const m = /\.([^./\\]+)$/.exec(ruta);
  return m ? m[1].toLowerCase() : '';
}

function sinExtension(ruta) {
  return ruta.replace(/\.[^./\\]+$/, '');
}

function nombreBase(ruta) {
  const partes = sinExtension(ruta).split('/');
  return partes[partes.length - 1];
}

/** Recorre el ZIP (y los ZIP internos) y devuelve { ruta, ext, archivo }. */
async function listarArchivos(zip, prefijo = '', profundidad = 0, salida = []) {
  const entradas = Object.values(zip.files).filter((f) => !f.dir && !esBasura(f.name));
  for (const entrada of entradas) {
    const ruta = `${prefijo}${entrada.name}`;
    const ext = extension(entrada.name);
    if (ext === 'zip' && profundidad < MAX_PROFUNDIDAD_ZIP) {
      try {
        const interno = await JSZip.loadAsync(await entrada.async('arraybuffer'));
        await listarArchivos(interno, `${sinExtension(ruta)}/`, profundidad + 1, salida);
      } catch {
        salida.push({ ruta, ext, archivo: entrada, ilegible: true });
      }
      continue;
    }
    salida.push({ ruta, ext, archivo: entrada });
  }
  return salida;
}

function mensajeSinShapefiles(archivos) {
  const exts = [...new Set(archivos.map((a) => a.ext).filter(Boolean))];
  const lista = exts.length ? exts.map((e) => `.${e}`).join(', ') : 'ningún archivo';
  const pistas = [];
  if (exts.includes('kml') || exts.includes('kmz')) {
    pistas.push('Los .kml/.kmz se importan desde Google Earth exportándolos como Shapefile, o con el botón de KMZ si está disponible.');
  }
  if (archivos.some((a) => /\.gdb\//i.test(a.ruta))) {
    pistas.push('Es una File Geodatabase (.gdb): en ArcGIS/QGIS expórtala a Shapefile.');
  }
  if (exts.includes('dwg') || exts.includes('dxf')) {
    pistas.push('Es un plano de AutoCAD: expórtalo a Shapefile (polígonos) desde QGIS o AutoCAD Map.');
  }
  if (exts.includes('shp') === false && (exts.includes('dbf') || exts.includes('shx'))) {
    pistas.push('Faltan los .shp (solo vienen .dbf/.shx): vuelve a comprimir la carpeta completa.');
  }
  return `El ZIP no trae shapefiles (.shp). Contiene: ${lista}. ${pistas.join(' ')}`.trim()
    + ' Debe traer, por cada capa, los archivos .shp, .shx, .dbf y .prj con el mismo nombre (p. ej. linderos.shp, linderos.dbf, linderos.prj).';
}

/**
 * Lee un ZIP de geocercas y devuelve [FeatureCollection con fileName].
 * @param {ArrayBuffer} buffer
 */
export async function leerCapasZip(buffer) {
  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (e) {
    throw new Error(
      'No se pudo abrir el ZIP (' + (e?.message || 'formato no soportado') + '). '
      + 'Vuelve a comprimirlo con clic derecho > Enviar a > Carpeta comprimida (zip) o con 7-Zip en formato ZIP normal.',
    );
  }

  const archivos = await listarArchivos(zip);

  // GeoJSON sueltos dentro del ZIP también se aceptan.
  const capas = [];
  for (const a of archivos.filter((x) => x.ext === 'geojson' || x.ext === 'json')) {
    try {
      const json = JSON.parse(await a.archivo.async('string'));
      if (json?.type === 'FeatureCollection') capas.push({ ...json, fileName: nombreBase(a.ruta) });
    } catch {
      /* no es un GeoJSON válido: se ignora */
    }
  }

  // Agrupa .shp/.dbf/.prj/.cpg por ruta base (sin distinguir mayúsculas).
  const grupos = new Map();
  for (const a of archivos) {
    if (!['shp', 'dbf', 'prj', 'cpg'].includes(a.ext) || a.ilegible) continue;
    const clave = sinExtension(a.ruta).toLowerCase();
    const g = grupos.get(clave) || { nombre: nombreBase(a.ruta) };
    g[a.ext] = a.archivo;
    grupos.set(clave, g);
  }

  const parseShp = lector('parseShp');
  const parseDbf = lector('parseDbf');
  const combine = lector('combine');
  const errores = [];

  for (const g of grupos.values()) {
    if (!g.shp) continue;
    try {
      const prj = g.prj ? await g.prj.async('string') : undefined;
      const cpg = g.cpg ? await g.cpg.async('string') : undefined;
      const geometrias = await parseShp(await g.shp.async('arraybuffer'), prj);
      const propiedades = g.dbf ? await parseDbf(await g.dbf.async('arraybuffer'), cpg) : undefined;
      const coleccion = await combine([geometrias, propiedades]);
      coleccion.fileName = g.nombre;
      capas.push(coleccion);
    } catch (e) {
      errores.push(`${g.nombre}: ${e?.message || e}`);
    }
  }

  if (!capas.length) {
    if (errores.length) {
      throw new Error(`Los shapefiles del ZIP no se pudieron leer: ${errores.join(' · ')}`);
    }
    throw new Error(mensajeSinShapefiles(archivos));
  }
  return capas;
}
