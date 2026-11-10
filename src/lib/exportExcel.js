/**
 * src/lib/exportExcel.js
 * Exporta datos de parcelas y diagnósticos a Excel
 */
import * as XLSX from 'xlsx';
import { etiquetaPeriodoReporte } from './agrotrackFlota';

export function exportarParcelasExcel(parcelas, registros) {
  const wb = XLSX.utils.book_new();

  // Hoja de parcelas
  const datosParcelas = parcelas.map(p => ({
    'Nombre': p.nombre,
    'Cultivo': p.cultivo_nombre || p.cultivo,
    'Variedad': p.variedad || '-',
    'Área (ha)': p.area || '-',
    'Fecha siembra': p.fecha_siembra || '-',
    'Días desde siembra': p.fecha_siembra
      ? Math.floor((new Date() - new Date(p.fecha_siembra)) / (1000 * 60 * 60 * 24))
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

function horas(segundos) {
  return Math.round((Number(segundos || 0) / 3600) * 100) / 100;
}

/**
 * Reporte de actividad de flota (FASE 3) a Excel, con las mismas columnas de
 * la consola y una hoja de criterio para que el archivo se entienda solo.
 * @param {Array} filas  filas de agrotrack_actividad_flota
 * @param {{modo?: string, rangoTexto?: string, placa?: string}} opciones
 */
export function exportarActividadExcel(filas, { modo = 'dia', rangoTexto = '', placa = '' } = {}) {
  const wb = XLSX.utils.book_new();

  const datos = (filas || []).map((f) => {
    const encendido = Number(f.encendido_segundos || 0);
    const ralenti = Number(f.ralenti_segundos || 0);
    return {
      'Período': etiquetaPeriodoReporte(f, modo),
      'Placa': f.placa,
      'Unidad': f.unidad || f.placa,
      'Recorrido (km)': Number(f.km_recorridos || 0),
      'Encendido (h)': horas(encendido),
      'Hora de viaje (h)': horas(f.viaje_segundos),
      'Ralentí (h)': horas(ralenti),
      '% ralentí': encendido > 0 ? Math.round((ralenti / encendido) * 1000) / 10 : 0,
      'Vel. máx. (km/h)': f.vel_max_kmh == null ? '' : Number(f.vel_max_kmh),
      'Alertas': Number(f.alertas || 0),
      'Posiciones': Number(f.posiciones || 0),
    };
  });

  // Totales al pie, igual que en la consola.
  const suma = (campo) => (filas || []).reduce((s, f) => s + Number(f[campo] || 0), 0);
  const totalEncendido = suma('encendido_segundos');
  const totalRalenti = suma('ralenti_segundos');
  datos.push({
    'Período': 'TOTALES',
    'Placa': '',
    'Unidad': `${filas.length} fila(s)`,
    'Recorrido (km)': Number(suma('km_recorridos').toFixed(2)),
    'Encendido (h)': horas(totalEncendido),
    'Hora de viaje (h)': horas(suma('viaje_segundos')),
    'Ralentí (h)': horas(totalRalenti),
    '% ralentí': totalEncendido > 0 ? Math.round((totalRalenti / totalEncendido) * 1000) / 10 : 0,
    'Vel. máx. (km/h)': '',
    'Alertas': suma('alertas'),
    'Posiciones': suma('posiciones'),
  });

  const ws = XLSX.utils.json_to_sheet(datos);
  ws['!cols'] = [
    { wch: 14 }, { wch: 12 }, { wch: 30 }, { wch: 14 }, { wch: 14 },
    { wch: 16 }, { wch: 12 }, { wch: 11 }, { wch: 15 }, { wch: 9 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Actividades');

  const criterio = [
    { Concepto: 'Reporte', Detalle: 'Actividades de flota (Agrilux · réplica de Zonar)' },
    { Concepto: 'Agrupación', Detalle: modo === 'dia' ? 'Por día' : modo === 'mes' ? 'Por mes' : 'Todo el periodo' },
    { Concepto: 'Rango', Detalle: rangoTexto || 'Todo el histórico cargado' },
    { Concepto: 'Unidad', Detalle: placa || 'Todas las unidades' },
    { Concepto: 'Fuente', Detalle: 'public.agrotrack_posiciones (agrotrack_actividad_flota)' },
    { Concepto: 'Viaje', Detalle: 'Encendido y velocidad > 5 km/h' },
    { Concepto: 'Ralentí', Detalle: 'Encendido y velocidad <= 5 km/h' },
    { Concepto: 'Encendido', Detalle: 'Viaje + Ralentí (evento no indica estacionado/apagado)' },
    { Concepto: 'Recorrido', Detalle: 'Haversine entre puntos consecutivos, tramos <= 10 min, saltos >= 5 km descartados' },
    { Concepto: 'Horario', Detalle: 'Hora de Perú (UTC-5)' },
    { Concepto: 'Generado', Detalle: new Date().toLocaleString('es-PE') },
  ];
  const wsCriterio = XLSX.utils.json_to_sheet(criterio);
  wsCriterio['!cols'] = [{ wch: 16 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(wb, wsCriterio, 'Criterio');

  const etiquetaRango = (rangoTexto || 'todo').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
  XLSX.writeFile(wb, `Agrilux_Actividades_${etiquetaRango || 'rango'}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
