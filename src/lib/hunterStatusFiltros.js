import { geocercaHunter } from './hunterStatusExport.js';

function gruposOperativosHunter(fila) {
  return fila.grupos_operativos?.length ? fila.grupos_operativos : ['Sin grupo asignado'];
}

function opcionesUnicas(filas, etiqueta) {
  return [...new Set(filas.flatMap(etiqueta))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
}

export function opcionesFiltrosHunter(filas) {
  return {
    grupos: opcionesUnicas(filas, gruposOperativosHunter),
    geocercas: opcionesUnicas(filas, geocercaHunter),
    areas: opcionesUnicas(filas, (fila) => fila.area_operativa ? [fila.area_operativa] : []),
    unidades: filas.map((fila) => ({
      valor: String(fila.equipo_id),
      etiqueta: fila.unidad || String(fila.equipo_id),
    })),
  };
}

export function filtrarUnidadesHunter(filas, { mostrar, opcionFiltro, filtroGeocerca, filtroArea }) {
  return filas.filter((fila) => (
    (!opcionFiltro || (mostrar === 'grupos'
      ? gruposOperativosHunter(fila).includes(opcionFiltro)
      : String(fila.equipo_id) === opcionFiltro))
    && (!filtroGeocerca || geocercaHunter(fila) === filtroGeocerca)
    && (!filtroArea || fila.area_operativa === filtroArea)
  ));
}

export function agruparUnidadesHunter(filas, modo, grupoSeleccionado = '') {
  if (modo === 'ninguno') return [['', filas]];
  const mapa = new Map();
  for (const fila of filas) {
    const nombres = modo === 'grupo' ? gruposOperativosHunter(fila) : [geocercaHunter(fila)];
    for (const nombre of nombres) {
      if (modo === 'grupo' && grupoSeleccionado && nombre !== grupoSeleccionado) continue;
      if (!mapa.has(nombre)) mapa.set(nombre, []);
      mapa.get(nombre).push(fila);
    }
  }
  return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'));
}
