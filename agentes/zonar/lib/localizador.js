/**
 * agentes/zonar/lib/localizador.js
 * Convierte cada marcador de GetUnitsLocator (la "foto" de TODAS las unidades
 * que muestra el mapa de Zonar) en un marcador con los MISMOS nombres de
 * campo que GetUnitsHistory, para reutilizar armarFilaZonar() y producir el
 * mismo source_key que la carga diaria y la manual (nunca se duplica).
 *
 * Zonar no publica la forma exacta de este JSON; por eso se aceptan varios
 * nombres por campo. Si "node agente.mjs descubrir" muestra otros nombres,
 * basta con agregarlos a las listas de abajo.
 */
import { armarFilaZonar } from './parse.js';

const CAMPOS = {
  Unit: ['Unit', 'MarkerName', 'UnitName', 'Name', 'Description'],
  LastEventDate: ['LastEventDate', 'EventDate', 'GPSDate', 'LastReport', 'LastReportDate', 'Date', 'DateTime', 'LastGPSDate'],
  Latitude: ['Latitude', 'Lat', 'latitude', 'lat'],
  Longitude: ['Longitude', 'Lng', 'Lon', 'Long', 'longitude', 'lng'],
  Event: ['Event', 'LastEvent', 'EventName', 'EventDescription', 'Status'],
  Speed: ['Speed', 'LastSpeed', 'Velocity', 'speed'],
  Address: ['Address', 'Location', 'LastAddress', 'address'],
  Landmark: ['Landmark', 'LandMark', 'Geofence', 'PointOfReference'],
  Sequence: ['Sequence', 'Seq'],
};

function primero(obj, nombres) {
  for (const n of nombres) {
    const v = obj?.[n];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return null;
}

/** Marcador del localizador -> marcador "tipo historial". */
export function normalizarMarcadorLocalizador(marca) {
  const salida = {};
  for (const [campo, nombres] of Object.entries(CAMPOS)) salida[campo] = primero(marca, nombres);
  return salida;
}

/**
 * Filas de agrotrack_posiciones desde la respuesta de GetUnitsLocator.
 * @returns {{filas: object[], invalidas: number, ejemplos: string[]}}
 */
export function filasDesdeLocalizador(marcas, empresaId, userId, { fechaModo = 'auto' } = {}) {
  const filas = [];
  const ejemplos = [];
  let invalidas = 0;
  for (const marca of marcas || []) {
    const normal = normalizarMarcadorLocalizador(marca);
    const { row, error } = armarFilaZonar(normal, empresaId, userId, { fechaModo });
    if (row) filas.push(row);
    else {
      invalidas += 1;
      if (ejemplos.length < 3) ejemplos.push(`${error}: ${JSON.stringify(marca).slice(0, 160)}`);
    }
  }
  return { filas, invalidas, ejemplos };
}
