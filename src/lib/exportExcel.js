/**
 * src/lib/exportExcel.js
 * Exporta datos de parcelas y diagnósticos a Excel
 */
import * as XLSX from 'xlsx';
import { etiquetaPeriodoReporte, formatearFechaLarga, clasificarEstado } from './agrotrackFlota';
import { calcularEventosResumidos, totalesEventosResumidos, formatearHMS } from './agrotrackEventosResumidos';
import { STATUS_META } from '../components/gestion/fleet/fleetTokens';

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
      // "Encendido" se quitó (7:47 a. m.): duplicaba "Horas prendido"
      // (encendido = viaje + ralentí, criterio único del reporte).
      'Horas prendido (h)': horas(Number(f.viaje_segundos || 0) + Number(f.ralenti_segundos || 0)),
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
    'Horas prendido (h)': horas(suma('viaje_segundos') + suma('ralenti_segundos')),
    'Hora de viaje (h)': horas(suma('viaje_segundos')),
    'Ralentí (h)': horas(totalRalenti),
    '% ralentí': totalEncendido > 0 ? Math.round((totalRalenti / totalEncendido) * 1000) / 10 : 0,
    'Vel. máx. (km/h)': '',
    'Alertas': suma('alertas'),
    'Posiciones': suma('posiciones'),
  });

  const ws = XLSX.utils.json_to_sheet(datos);
  ws['!cols'] = [
    { wch: 14 }, { wch: 12 }, { wch: 30 }, { wch: 14 }, { wch: 17 },
    { wch: 16 }, { wch: 12 }, { wch: 11 }, { wch: 15 }, { wch: 9 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Actividades');

  const criterio = [
    { Concepto: 'Reporte', Detalle: 'Actividades de flota (Agrilux · réplica de Zonar)' },
    { Concepto: 'Agrupación', Detalle: modo === 'dia' ? 'Por día' : modo === 'mes' ? 'Por mes' : modo === 'libre' ? 'Por día dentro del rango Desde / hasta' : 'Todo el periodo' },
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

/**
 * Reporte de entradas y salidas de geocerca (FASE 3.5) a Excel: los eventos de
 * Zonar agrupados por geocerca, por día o por mes, con la hoja de criterio
 * para que el archivo se entienda solo.
 * @param {Array} filas  filas de agrotrack_eventos_geocerca_flota
 * @param {{agrupar?: string, rangoTexto?: string}} opciones
 */
export function exportarEventosGeocercaExcel(filas, { agrupar = 'geocerca', rangoTexto = '' } = {}) {
  const wb = XLSX.utils.book_new();

  // En 'geocerca' el grupo es el nombre tal cual; en día/mes se etiqueta como
  // en el reporte de actividad (mismo texto en pantalla y en el archivo).
  const etiquetaGrupo = (fila) => etiquetaPeriodoReporte({ periodo: fila.grupo }, agrupar);

  const datos = (filas || []).map((f) => ({
    'Grupo': etiquetaGrupo(f),
    'Entradas': Number(f.entradas || 0),
    'Salidas': Number(f.salidas || 0),
    'Unidades': Number(f.unidades || 0),
    'Última entrada': f.ultima_entrada ? formatearFechaLarga(f.ultima_entrada) : '—',
  }));

  // Totales al pie. Unidades no se suman: una placa puede aparecer en varios
  // grupos y sumarla duplicaría el conteo.
  const suma = (campo) => (filas || []).reduce((s, f) => s + Number(f[campo] || 0), 0);
  datos.push({
    'Grupo': 'TOTALES',
    'Entradas': suma('entradas'),
    'Salidas': suma('salidas'),
    'Unidades': '',
    'Última entrada': '',
  });

  const ws = XLSX.utils.json_to_sheet(datos);
  ws['!cols'] = [{ wch: 26 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Eventos');

  const criterio = [
    { Concepto: 'Reporte', Detalle: 'Entradas y salidas de geocerca (Agrilux · réplica de Zonar)' },
    { Concepto: 'Agrupación', Detalle: agrupar === 'dia' ? 'Por día' : agrupar === 'mes' ? 'Por mes' : 'Por geocerca' },
    { Concepto: 'Rango', Detalle: rangoTexto || 'Todo el periodo cargado' },
    { Concepto: 'Fuente', Detalle: 'public.agrotrack_posiciones (agrotrack_eventos_geocerca_flota)' },
    { Concepto: 'Eventos', Detalle: "Zonar: 'Entrada a Geocerca' / 'Salida de Geocerca' con pt_referencia (nombre de la geocerca)" },
    { Concepto: 'Unidades', Detalle: 'Placas distintas que registraron una entrada' },
    { Concepto: 'Salidas', Detalle: 'Pueden no cuadrar con las entradas: una unidad aún dentro deja la última entrada sin salida' },
    { Concepto: 'Horario', Detalle: 'Hora de Perú (UTC-5)' },
    { Concepto: 'Generado', Detalle: new Date().toLocaleString('es-PE') },
  ];
  const wsCriterio = XLSX.utils.json_to_sheet(criterio);
  wsCriterio['!cols'] = [{ wch: 16 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(wb, wsCriterio, 'Criterio');

  const etiquetaRango = (rangoTexto || 'todo').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
  XLSX.writeFile(wb, `Agrilux_Geocercas_Eventos_${etiquetaRango || 'rango'}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Reporte de tiempo en cada lote (FASE 3.5) a Excel: permanencia, visitas y
 * recorrido dentro de cada polígono (PostGIS), con la hoja de criterio.
 * @param {Array} filas  filas de agrotrack_lotes_flota
 * @param {{rangoTexto?: string}} opciones
 */
export function exportarLotesExcel(filas, { rangoTexto = '', placa = '', horaDesde = '', horaHasta = '' } = {}) {
  const wb = XLSX.utils.book_new();

  const datos = (filas || []).map((f) => ({
    'Lote': f.lote,
    'División': f.division || '—',
    'Anexo': f.anexo || '—',
    'Área (ha)': f.area_ha == null ? '' : Number(f.area_ha),
    'Unidades': Number(f.unidades || 0),
    'Visitas': Number(f.visitas || 0),
    'Apagado (h)': f.apagado_segundos == null ? '' : horas(f.apagado_segundos),
    'Ralentí (h)': f.ralenti_segundos == null ? '' : horas(f.ralenti_segundos),
    'Viajando (h)': f.viaje_segundos == null ? '' : horas(f.viaje_segundos),
    'Total en geocerca (h)': horas(f.permanencia_segundos),
    'Recorrido (km)': Number(f.km_recorridos || 0),
    'Puntos': Number(f.puntos || 0),
    'Vel. máx. (km/h)': f.vel_max_kmh == null ? '' : Number(f.vel_max_kmh),
    'Primera visita': f.primera_visita ? formatearFechaLarga(f.primera_visita) : '—',
    'Última visita': f.ultima_visita ? formatearFechaLarga(f.ultima_visita) : '—',
  }));

  const suma = (campo) => (filas || []).reduce((s, f) => s + Number(f[campo] || 0), 0);
  datos.push({
    'Lote': 'TOTALES',
    'División': `${filas.length} lote(s) con actividad`,
    'Anexo': '',
    'Área (ha)': '',
    'Unidades': '',
    'Visitas': suma('visitas'),
    'Apagado (h)': horas(suma('apagado_segundos')),
    'Ralentí (h)': horas(suma('ralenti_segundos')),
    'Viajando (h)': horas(suma('viaje_segundos')),
    'Total en geocerca (h)': horas(suma('permanencia_segundos')),
    'Recorrido (km)': Number(suma('km_recorridos').toFixed(2)),
    'Puntos': suma('puntos'),
    'Vel. máx. (km/h)': '',
    'Primera visita': '',
    'Última visita': '',
  });

  const ws = XLSX.utils.json_to_sheet(datos);
  ws['!cols'] = [
    { wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 11 }, { wch: 10 }, { wch: 9 },
    { wch: 12 }, { wch: 11 }, { wch: 12 }, { wch: 19 }, { wch: 15 }, { wch: 9 },
    { wch: 15 }, { wch: 22 }, { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Lotes');

  const criterio = [
    { Concepto: 'Reporte', Detalle: 'Tiempo en cada lote (Agrilux · réplica de Zonar)' },
    { Concepto: 'Rango', Detalle: rangoTexto || 'Todo el periodo cargado' },
    { Concepto: 'Unidad', Detalle: placa || 'Todas las unidades' },
    { Concepto: 'Franja horaria', Detalle: (horaDesde || horaHasta) ? `${horaDesde || '00:00'} a ${horaHasta || '23:59'} (hora de Perú)` : 'Todo el día' },
    { Concepto: 'Fuente', Detalle: 'public.agrotrack_geocercas + public.agrotrack_posiciones (agrotrack_lotes_flota)' },
    { Concepto: 'Motor', Detalle: 'PostGIS: punto dentro del polígono (ST_Contains, EPSG:4326)' },
    { Concepto: 'Visita', Detalle: 'Tramo de permanencia; un hueco de más de 10 minutos corta la visita' },
    { Concepto: 'Desglose', Detalle: 'Apagado + Ralentí + Viajando = Total en geocerca (estado según el evento del punto final de cada tramo)' },
    { Concepto: 'Recorrido', Detalle: 'Haversine entre puntos consecutivos, tramos <= 10 min, saltos >= 5 km descartados' },
    { Concepto: 'Duplicados', Detalle: 'Puntos repetidos (misma fecha + secuencia) no cuentan dos veces' },
    { Concepto: 'Horario', Detalle: 'Hora de Perú (UTC-5)' },
    { Concepto: 'Generado', Detalle: new Date().toLocaleString('es-PE') },
  ];
  const wsCriterio = XLSX.utils.json_to_sheet(criterio);
  wsCriterio['!cols'] = [{ wch: 16 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(wb, wsCriterio, 'Criterio');

  const etiquetaRango = (rangoTexto || 'todo').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
  XLSX.writeFile(wb, `Agrilux_Geocercas_Lotes_${etiquetaRango || 'rango'}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Reporte 15 de Zonar "Eventos resumidos" a Excel: Stop / Idle / Drive por
 * unidad con su porcentaje, mismas cifras que la pantalla y hoja de criterio.
 * @param {Array} filas  filas de agrotrack_actividad_flota (agrupar 'unidad')
 * @param {{totalSegundos?: number|null, rangoTexto?: string, placa?: string}} opciones
 */
export function exportarEventosResumidosExcel(filas, { totalSegundos = null, rangoTexto = '', placa = '' } = {}) {
  const wb = XLSX.utils.book_new();

  const calculadas = calcularEventosResumidos(filas, totalSegundos);
  const datos = calculadas.map((f) => ({
    'Placa': f.placa,
    'Unidad': f.unidad,
    'Total Stop': f.total == null ? '' : formatearHMS(f.stop),
    'Stop %': f.pct_stop,
    'Total Idle': f.total == null ? '' : formatearHMS(f.idle),
    'Idle %': f.pct_idle,
    'Total Drive': f.total == null ? '' : formatearHMS(f.drive),
    'Drive %': f.pct_drive,
    'Total': f.total == null ? '' : formatearHMS(f.total),
  }));

  // Totales al pie (la flota completa), igual que en la consola.
  const totales = totalesEventosResumidos(calculadas);
  datos.push({
    'Placa': 'TOTALES',
    'Unidad': `${calculadas.length} unidad(es)`,
    'Total Stop': formatearHMS(totales.stop),
    'Stop %': totales.pct_stop,
    'Total Idle': formatearHMS(totales.idle),
    'Idle %': totales.pct_idle,
    'Total Drive': formatearHMS(totales.drive),
    'Drive %': totales.pct_drive,
    'Total': formatearHMS(totales.total),
  });

  const ws = XLSX.utils.json_to_sheet(datos);
  ws['!cols'] = [
    { wch: 12 }, { wch: 30 }, { wch: 13 }, { wch: 9 },
    { wch: 13 }, { wch: 9 }, { wch: 13 }, { wch: 10 }, { wch: 13 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Eventos resumidos');

  const criterio = [
    { Concepto: 'Reporte', Detalle: 'Eventos resumidos Stop/Idle/Drive (Agrilux · réplica de Zonar, reporte 15)' },
    { Concepto: 'Rango', Detalle: rangoTexto || 'Todo el periodo cargado' },
    { Concepto: 'Unidad', Detalle: placa || 'Todas las unidades' },
    { Concepto: 'Fuente', Detalle: 'public.agrotrack_posiciones (agrotrack_actividad_flota); Stop/Idle/Drive derivados de esas filas agregadas' },
    { Concepto: 'Drive', Detalle: 'Motor encendido y velocidad > 5 km/h' },
    { Concepto: 'Idle', Detalle: 'Motor encendido y velocidad <= 5 km/h' },
    { Concepto: 'Stop', Detalle: 'Tiempo del rango sin motor encendido (total del rango − encendido)' },
    { Concepto: 'Total', Detalle: `Duración del rango${totalSegundos ? ` (${formatearHMS(totalSegundos)})` : ''}, limitada al periodo realmente cargado` },
    { Concepto: 'Porcentajes', Detalle: 'Stop + Idle + Drive = 100% en cada fila (Stop se cierra por resta)' },
    { Concepto: 'Recorrido', Detalle: 'Haversine entre puntos consecutivos, tramos <= 10 min, saltos >= 5 km descartados' },
    { Concepto: 'Horario', Detalle: 'Hora de Perú (UTC-5)' },
    { Concepto: 'Generado', Detalle: new Date().toLocaleString('es-PE') },
  ];
  const wsCriterio = XLSX.utils.json_to_sheet(criterio);
  wsCriterio['!cols'] = [{ wch: 16 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(wb, wsCriterio, 'Criterio');

  const etiquetaRango = (rangoTexto || 'todo').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
  XLSX.writeFile(wb, `Agrilux_Eventos_Resumidos_${etiquetaRango || 'rango'}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Reporte 34 de Zonar "Estado de unidades" a Excel, con la columna extra de
 * geocerca actual y la hoja de criterio.
 * @param {Array} filas  filas de agrotrack_estado_unidades_flota
 * @param {{rangoTexto?: string, periodo?: {hasta: string|null}|null, filtro?: string}} opciones
 */
export function exportarEstadoUnidadesExcel(filas, { rangoTexto = '', periodo = null, filtro = '' } = {}) {
  const wb = XLSX.utils.book_new();

  const datos = (filas || []).map((f) => {
    const estado = clasificarEstado(f, periodo?.hasta);
    return {
      'Placa': f.placa,
      'Unidad': f.unidad || f.placa,
      'Últ. fecha': f.ultima_fecha ? formatearFechaLarga(f.ultima_fecha) : '—',
      'Estado': STATUS_META[estado]?.label || estado,
      'Dirección': f.direccion || '—',
      'Últ. evento': f.ultimo_evento || '—',
      'Vel. (km/h)': f.ultima_velocidad == null ? '' : Number(f.ultima_velocidad),
      'Odómetro actual': '—',
      'Geocerca': f.geocerca || 'Fuera de geocercas',
      'División': f.geocerca_division || '—',
      // Fallback pedido por el Ing. Carlos Perez: si la última posición está
      // fuera, la última geocerca de campo en la que estuvo y cuándo.
      'Últ. geocerca (si está fuera)': f.geocerca ? '' : (f.geocerca_ultima || ''),
      'Últ. geocerca fecha': (!f.geocerca && f.geocerca_ultima_fecha) ? formatearFechaLarga(f.geocerca_ultima_fecha) : '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(datos);
  ws['!cols'] = [
    { wch: 12 }, { wch: 30 }, { wch: 22 }, { wch: 15 }, { wch: 45 },
    { wch: 22 }, { wch: 11 }, { wch: 17 }, { wch: 26 }, { wch: 18 },
    { wch: 28 }, { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Estado unidades');

  const criterio = [
    { Concepto: 'Reporte', Detalle: 'Estado de unidades + geocerca (Agrilux · réplica de Zonar, reporte 34)' },
    { Concepto: 'Rango', Detalle: rangoTexto || 'Todo el periodo cargado' },
    { Concepto: 'Filtros', Detalle: filtro || 'Sin filtros: todas las unidades y geocercas' },
    { Concepto: 'Fuente', Detalle: 'public.agrotrack_posiciones + public.agrotrack_geocercas (agrotrack_estado_unidades_flota)' },
    { Concepto: 'Motor', Detalle: 'PostGIS: polígono que contiene la última posición (ST_Contains, EPSG:4326) con prefilter de bbox' },
    { Concepto: 'Geocerca', Detalle: 'Nombre del polígono que contiene la última posición; si está fuera, "Últ. geocerca" trae la última geocerca de campo en la que estuvo la unidad (evento pt_referencia); "Fuera de geocercas" solo si no hay ninguna' },
    { Concepto: 'Estado', Detalle: 'En ruta / Detenido / Sin conexión contra max(fecha) del periodo cargado (umbral 30 min), nunca contra la fecha de hoy' },
    { Concepto: 'Odómetro', Detalle: 'Sin dato: el archivo "Reporte por placa" de Zonar que importamos no incluye la columna de odómetro' },
    { Concepto: 'Orden', Detalle: 'Última posición más reciente primero' },
    { Concepto: 'Horario', Detalle: 'Hora de Perú (UTC-5)' },
    { Concepto: 'Generado', Detalle: new Date().toLocaleString('es-PE') },
  ];
  const wsCriterio = XLSX.utils.json_to_sheet(criterio);
  wsCriterio['!cols'] = [{ wch: 16 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(wb, wsCriterio, 'Criterio');

  const etiquetaRango = (rangoTexto || 'todo').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
  XLSX.writeFile(wb, `Agrilux_Estado_Unidades_${etiquetaRango || 'rango'}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
