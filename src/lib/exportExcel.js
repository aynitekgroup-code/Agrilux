/**
 * src/lib/exportExcel.js
 * Exporta datos de parcelas y diagnósticos a Excel
 */
import * as XLSX from 'xlsx';

export function exportarParcelasExcel(parcelas, registros) {
  const wb = XLSX.utils.book_new();

  // Hoja de parcelas
  const datosParcelas = parcelas.map(p => ({
    'Nombre': p.nombre,
    'Cultivo': p.cultivoNombre || p.cultivo,
    'Variedad': p.variedad || '-',
    'Área (ha)': p.area || '-',
    'Fecha siembra': p.fechaSiembra || '-',
    'Días desde siembra': p.fechaSiembra
      ? Math.floor((new Date() - new Date(p.fechaSiembra)) / (1000 * 60 * 60 * 24))
      : '-',
    'Puntos mapeados': p.coordenadas?.length || 0,
    'Estado': 'Activa',
  }));
  const wsParcelas = XLSX.utils.json_to_sheet(datosParcelas);
  wsParcelas['!cols'] = [
    { wch: 25 }, { wch: 18 }, { wch: 15 }, { wch: 12 },
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, wsParcelas, 'Parcelas');

  // Hoja de registros de monitoreo
  if (registros?.length > 0) {
    const datosRegistros = registros.map(r => ({
      'Fecha': r.fecha ? new Date(r.fecha).toLocaleDateString('es-PE') : '-',
      'Parcela ID': r.parcelaId,
      'Días desde siembra': r.diasDesdeSiembra || '-',
      'Recomendación': r.recomendacion || '-',
    }));
    const wsRegistros = XLSX.utils.json_to_sheet(datosRegistros);
    wsRegistros['!cols'] = [
      { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 60 },
    ];
    XLSX.utils.book_append_sheet(wb, wsRegistros, 'Monitoreos');
  }

  XLSX.writeFile(wb, `Agrilux_Parcelas_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportarDiagnosticoExcel(diagnosticos) {
  const wb = XLSX.utils.book_new();

  const datos = diagnosticos.map(d => ({
    'Fecha': d.fecha ? new Date(d.fecha).toLocaleDateString('es-PE') : '-',
    'Cultivo': d.cultivo || '-',
    'Plaga/Enfermedad': d.plaga || d.diagnostico?.split('\n')[0] || '-',
    'Diagnóstico completo': d.diagnostico || '-',
    'Recomendación': d.recomendacion || '-',
    'Ubicación': d.ubicacion || '-',
  }));

  const ws = XLSX.utils.json_to_sheet(datos);
  ws['!cols'] = [
    { wch: 15 }, { wch: 18 }, { wch: 25 }, { wch: 60 }, { wch: 60 }, { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Diagnósticos');

  XLSX.writeFile(wb, `Agrilux_Diagnosticos_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
