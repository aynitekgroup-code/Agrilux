// La geocerca operativa tiene prioridad sobre el departamento administrativo.
export function geocercaHunter(fila) {
  const geocerca = String(fila?.geocerca || '').trim();
  if (geocerca) return geocerca;
  const departamento = String(fila?.departamento || '').trim();
  return departamento ? `Dpto. ${departamento}` : 'Sin coincidencia';
}

// La exportación conserva exactamente los filtros aplicados en pantalla.
export function filasStatusHunterExcel(filas, { fecha, clasificar }) {
  return filas.map((f) => ({
    'Unidad': f.unidad || f.equipo_id || '',
    'ID equipo Hunter': String(f.equipo_id || ''),
    'Área operativa': f.area_operativa || '',
    'Grupo operativo': (f.grupos_operativos || []).join(', '),
    'Última posición (hora Perú)': fecha(f.fecha),
    'Estado orientativo': clasificar(f),
    'Velocidad (km/h)': f.velocidad_kmh == null ? '' : Number(f.velocidad_kmh),
    'Geocerca': geocercaHunter(f),
    'Dirección': f.direccion || '',
    'Última sincronización (hora Perú)': fecha(f.actualizado_en),
  }));
}

export async function exportarStatusHunterExcel(filas, opciones) {
  const XLSX = await import('xlsx');
  const datos = filasStatusHunterExcel(filas, opciones);
  const libro = XLSX.utils.book_new();
  const hoja = XLSX.utils.json_to_sheet(datos);
  hoja['!cols'] = [22, 22, 22, 25, 25, 24, 19, 24, 55, 29].map((wch) => ({ wch }));
  hoja['!autofilter'] = { ref: hoja['!ref'] };
  XLSX.utils.book_append_sheet(libro, hoja, 'Status Hunter');
  const criterios = XLSX.utils.aoa_to_sheet([
    ['Status Hunter 360'],
    ['El archivo contiene las unidades visibles según los filtros de la pantalla.'],
    ['Última posición y última sincronización son horas de Perú.'],
    ['Sin reporte reciente: posición mayor a 30 minutos o fecha no válida.'],
    ['El estado es orientativo; velocidad e ignición no determinan trabajo efectivo.'],
    ['Geocerca muestra la zona operativa coincidente; si no hay una, muestra el departamento.'],
    ['El área operativa procede de las asignaciones Hunter guardadas para la empresa; no se deduce de la geocerca.'],
  ]);
  criterios['!cols'] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(libro, criterios, 'Criterios');
  XLSX.writeFile(libro, 'Agrilux-status-Hunter.xlsx');
}
