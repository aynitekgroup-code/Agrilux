/**
 * src/lib/exportExcelReportes.js
 * Exportadores NUEVOS de los reportes agregados en FASE 4:
 *   1) exportarVisitasGeocercaExcel : detalle de visitas por geocerca.
 *   2) exportarTablaDiaExcel        : "tabla del día" (resumen por geocerca
 *      estilo tabla dinámica de las 6:30 a. m. + detalle de visitas).
 *   3) exportarSinReportarExcel     : unidades sin reportar (ventana 8/16/24/48 h).
 *
 * NO toca src/lib/exportExcel.js (archivo con otro propietario): sigue su
 * patrón (hoja de datos + hoja "Criterio" con Reporte / Rango / Filtros y
 * XLSX.writeFile bajo demanda) y reutiliza los formadores de fecha de
 * src/lib/agrotrackFlota.js. Se importa bajo demanda desde los componentes
 * (la librería xlsx pesa ~430 kB y solo hace falta al pedir el archivo).
 */
import * as XLSX from 'xlsx';
import { formatearFechaLarga } from './agrotrackFlota';
import { codigoArea } from './agrotrackVisitasDia';
import { ETIQUETAS_ESTADO_GEO } from './estadoGeocerca';

/** Geocerca asignada de la unidad: la actual (RPC, PostGIS) o la última
 *  conocida si está fuera de todas. */
function geocercaAsignada(f) {
  if (f.geocerca) return f.geocerca;
  if (f.geocerca_ultima) return `${f.geocerca_ultima} (última conocida)`;
  return '—';
}

/** Segundos -> horas con dos decimales (celdas numéricas del Excel). */
function horas(segundos) {
  if (segundos == null) return '';
  return Math.round((Number(segundos || 0) / 3600) * 100) / 100;
}

/** "Todo el periodo" -> "todo" para el nombre del archivo. */
function etiquetaArchivo(texto) {
  return (texto || 'todo').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'rango';
}

function agregarCriterio(wb, filas) {
  const ws = XLSX.utils.json_to_sheet(filas);
  ws['!cols'] = [{ wch: 16 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Criterio');
}

/** ¿La visita sigue abierta (unidad aún dentro de la geocerca)? */
function visitaAbierta(f) {
  if (f.abierta === true || f.abierta === 'true') return true;
  if (f.abierta == null) return !f.salida;
  return false;
}

function filaVisita(f) {
  return {
    'Placa': f.placa || '—',
    'Geocerca': f.geocerca || '—',
    'Entrada': f.entrada ? formatearFechaLarga(f.entrada) : '—',
    'Salida': visitaAbierta(f) ? 'En curso' : (f.salida ? formatearFechaLarga(f.salida) : '—'),
    'Estado': visitaAbierta(f) ? 'En curso' : 'Cerrada',
    'Duración (h)': f.duracion_segundos == null ? '' : horas(f.duracion_segundos),
    'Apagado (h)': f.apagado_segundos == null ? '' : horas(f.apagado_segundos),
    'Ralentí (h)': f.ralenti_segundos == null ? '' : horas(f.ralenti_segundos),
    'Viajando (h)': f.viaje_segundos == null ? '' : horas(f.viaje_segundos),
  };
}

/**
 * Detalle de visitas por geocerca (una fila por visita) a Excel.
 * @param {Array} filas  filas de agrotrack_visitas_geocerca_flota
 * @param {{rangoTexto?: string, geocerca?: string, placa?: string}} opciones
 */
export function exportarVisitasGeocercaExcel(filas, { rangoTexto = '', geocerca = '', placa = '' } = {}) {
  const wb = XLSX.utils.book_new();
  const filasVisitas = filas || [];

  const datos = filasVisitas.map(filaVisita);

  // Totales al pie, igual que en la consola.
  const suma = (campo) => filasVisitas.reduce((s, f) => s + Number(f[campo] || 0), 0);
  const abiertas = filasVisitas.filter(visitaAbierta).length;
  datos.push({
    'Placa': 'TOTALES',
    'Geocerca': `${filasVisitas.length} visita(s)${abiertas ? ` · ${abiertas} en curso` : ''}`,
    'Entrada': '',
    'Salida': '',
    'Estado': '',
    'Duración (h)': horas(suma('duracion_segundos')),
    'Apagado (h)': horas(suma('apagado_segundos')),
    'Ralentí (h)': horas(suma('ralenti_segundos')),
    'Viajando (h)': horas(suma('viaje_segundos')),
  });

  const ws = XLSX.utils.json_to_sheet(datos);
  ws['!cols'] = [
    { wch: 12 }, { wch: 26 }, { wch: 22 }, { wch: 22 }, { wch: 11 },
    { wch: 13 }, { wch: 12 }, { wch: 12 }, { wch: 13 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Visitas');

  agregarCriterio(wb, [
    { Concepto: 'Reporte', Detalle: 'Visitas por geocerca, detalle (Agrilux · réplica de Zonar)' },
    { Concepto: 'Rango', Detalle: rangoTexto || 'Todo el periodo cargado' },
    { Concepto: 'Geocerca', Detalle: geocerca || 'Todas las geocercas' },
    { Concepto: 'Unidad', Detalle: placa || 'Todas las unidades' },
    { Concepto: 'Fuente', Detalle: 'public.agrotrack_posiciones + public.agrotrack_geocercas (agrotrack_visitas_geocerca_flota)' },
    { Concepto: 'Visita', Detalle: 'Tramo de permanencia dentro del polígono; una unidad que sigue dentro se muestra como "En curso"' },
    { Concepto: 'Desglose', Detalle: 'Apagado + Ralentí + Viajando = Duración (según el evento del punto de cada tramo)' },
    { Concepto: 'Horario', Detalle: 'Hora de Perú (UTC-5)' },
    { Concepto: 'Generado', Detalle: new Date().toLocaleString('es-PE') },
  ]);

  XLSX.writeFile(wb, `Agrilux_Visitas_Geocerca_${etiquetaArchivo(rangoTexto)}.xlsx`);
}

/**
 * "Tabla del día" (la tabla dinámica de geocercas de las 6:30 a. m.):
 * una fila por geocerca con total de visitas y duración, más el detalle de
 * visitas del día en otra hoja. La hoja de criterio anota QUÉ día se exportó.
 * @param {Array} filas  visitas de UN día calendario (ya filtradas)
 * @param {{dia: string, rangoTexto?: string, geocerca?: string, placa?: string}} opciones
 */
export function exportarTablaDiaExcel(filas, { dia = '', rangoTexto = '', geocerca = '', placa = '' } = {}) {
  const wb = XLSX.utils.book_new();
  const filasVisitas = filas || [];

  // Resumen por geocerca (una fila por geocerca, orden: más visitas primero).
  const grupos = new Map();
  filasVisitas.forEach((f) => {
    const clave = f.geocerca || 'Sin geocerca';
    const g = grupos.get(clave) || {
      visitas: 0, duracion: 0, apagado: 0, ralenti: 0, viaje: 0,
      placas: new Set(), primera: null, ultima: null,
    };
    g.visitas += 1;
    g.duracion += Number(f.duracion_segundos || 0);
    g.apagado += Number(f.apagado_segundos || 0);
    g.ralenti += Number(f.ralenti_segundos || 0);
    g.viaje += Number(f.viaje_segundos || 0);
    if (f.placa) g.placas.add(f.placa);
    if (f.entrada && (!g.primera || f.entrada < g.primera)) g.primera = f.entrada;
    if (f.salida && (!g.ultima || f.salida > g.ultima)) g.ultima = f.salida;
    grupos.set(clave, g);
  });

  const resumen = [...grupos.entries()]
    .map(([nombre, g]) => ({
      'Geocerca': nombre,
      'Visitas': g.visitas,
      'Unidades': g.placas.size,
      'Duración total (h)': horas(g.duracion),
      'Apagado (h)': horas(g.apagado),
      'Ralentí (h)': horas(g.ralenti),
      'Viajando (h)': horas(g.viaje),
      'Primera entrada': g.primera ? formatearFechaLarga(g.primera) : '—',
      'Última salida': g.ultima ? formatearFechaLarga(g.ultima) : '—',
    }))
    .sort((a, b) => b.Visitas - a.Visitas || String(a.Geocerca).localeCompare(String(b.Geocerca), 'es'));

  const suma = (campo) => filasVisitas.reduce((s, f) => s + Number(f[campo] || 0), 0);
  resumen.push({
    'Geocerca': 'TOTALES',
    'Visitas': filasVisitas.length,
    'Unidades': new Set(filasVisitas.map((f) => f.placa).filter(Boolean)).size,
    'Duración total (h)': horas(suma('duracion_segundos')),
    'Apagado (h)': horas(suma('apagado_segundos')),
    'Ralentí (h)': horas(suma('ralenti_segundos')),
    'Viajando (h)': horas(suma('viaje_segundos')),
    'Primera entrada': '',
    'Última salida': '',
  });

  const wsResumen = XLSX.utils.json_to_sheet(resumen);
  wsResumen['!cols'] = [
    { wch: 28 }, { wch: 9 }, { wch: 10 }, { wch: 18 }, { wch: 12 },
    { wch: 12 }, { wch: 13 }, { wch: 22 }, { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen por geocerca');

  // Detalle: una fila por visita del día.
  const detalle = filasVisitas.map(filaVisita);
  const wsDetalle = XLSX.utils.json_to_sheet(detalle);
  wsDetalle['!cols'] = [
    { wch: 12 }, { wch: 26 }, { wch: 22 }, { wch: 22 }, { wch: 11 },
    { wch: 13 }, { wch: 12 }, { wch: 12 }, { wch: 13 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle de visitas');

  agregarCriterio(wb, [
    { Concepto: 'Reporte', Detalle: 'Tabla diaria de geocercas (visitas del día · Agrilux · réplica de Zonar)' },
    { Concepto: 'Día exportado', Detalle: dia ? `${dia} (día calendario completo en hora de Perú)` : '—' },
    { Concepto: 'Rango cargado', Detalle: rangoTexto || 'Todo el periodo cargado' },
    { Concepto: 'Geocerca', Detalle: geocerca || 'Todas las geocercas' },
    { Concepto: 'Unidad', Detalle: placa || 'Todas las unidades' },
    { Concepto: 'Fuente', Detalle: 'public.agrotrack_posiciones + public.agrotrack_geocercas (agrotrack_visitas_geocerca_flota)' },
    { Concepto: 'Criterio del día', Detalle: 'Último día calendario completo (hora de Perú) presente en las visitas ya cargadas; las visitas se agrupan por la fecha de su entrada' },
    { Concepto: 'Horario', Detalle: 'Hora de Perú (UTC-5)' },
    { Concepto: 'Generado', Detalle: new Date().toLocaleString('es-PE') },
  ]);

  XLSX.writeFile(wb, `Agrilux_Tabla_Dia_${dia || 'rango'}.xlsx`);
}

/**
 * Exporta una tabla genérica (filas planas ya mapeadas por quien llama) a un
 * libro Excel con hoja "Criterio". Un punto de entrada único para que toda
 * tabla muestre "Descargar Excel" y descargue un .xlsx de verdad.
 * @param {string} nombreBase  nombre del archivo (sin extensión)
 * @param {Array<Object>} filas  filas planas con las columnas visibles de la tabla
 * @param {{columnas: Array<[string, string]>, modelo?: string, criterio?: Array<object>}} opciones
 *        columnas: [[clave, etiqueta], ...] alineadas a las de la tabla.
 */
export function exportarTablaExcel(nombreBase, filas, { columnas, modelo = '', criterio = [] } = {}) {
  if (!filas?.length) throw new Error('No hay filas para exportar.');
  const wb = XLSX.utils.book_new();
  const datos = columnas.map(([, etiqueta]) => etiqueta);
  const ws = XLSX.utils.json_to_sheet(
    filas.map((row) => Object.fromEntries(columnas.map(([key, etiqueta]) => [etiqueta, row[key] ?? ''])))
  );
  ws['!cols'] = datos.map((etiqueta) => ({ wch: Math.max(16, String(etiqueta).length + 4) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
  agregarCriterio(wb, [
    { Concepto: 'Reporte', Detalle: modelo || nombreBase },
    { Concepto: 'Fuente', Detalle: 'Agrilux · datos agregados en SQL (RPC) o filas visibles de la tabla' },
    { Concepto: 'Horario', Detalle: 'Hora de Perú (UTC-5)' },
    { Concepto: 'Generado', Detalle: new Date().toLocaleString('es-PE') },
    ...criterio,
  ]);
  XLSX.writeFile(wb, `${etiquetaArchivo(nombreBase)}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Reporte "Unidades sin reportar" (Zonar: Unidades - Sin Reportar) a Excel.
 * @param {Array} filas  filas enriquecidas del componente (con `transcurrido`
 *                       y `sinReportar` ya calculados, para que el texto del
 *                       archivo sea idéntico al de la pantalla)
 * @param {{ventanaHoras: number, generado?: Date|string|null}} opciones
 */
export function exportarSinReportarExcel(filas, { ventanaHoras = 24, generado = null } = {}) {
  const wb = XLSX.utils.book_new();

  const datos = (filas || []).map((f) => ({
    'Placa': f.placa || '—',
    'Área': codigoArea(f.unidad || f.descripcion, f.placa) || '—',
    'Últ. dirección': f.direccion || '—',
    'Últ. evento': f.ultimo_evento || '—',
    'Últ. fecha GPRS': f.ultima_fecha ? formatearFechaLarga(f.ultima_fecha) : 'sin reporte',
    'Geocerca asignada': geocercaAsignada(f),
    'Tiempo transcurrido': f.transcurrido || '—',
    'Estado': f.sinReportar ? 'Sin reportar' : 'Reportando',
  }));

  const ws = XLSX.utils.json_to_sheet(datos);
  ws['!cols'] = [
    { wch: 30 }, { wch: 12 }, { wch: 45 }, { wch: 24 },
    { wch: 22 }, { wch: 26 }, { wch: 20 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Sin reportar');

  const sinReportar = (filas || []).filter((f) => f.sinReportar).length;
  agregarCriterio(wb, [
    { Concepto: 'Reporte', Detalle: 'Unidades sin reportar (Agrilux · réplica de Zonar: Unidades - Sin Reportar)' },
    { Concepto: 'Ventana', Detalle: `${ventanaHoras} horas` },
    { Concepto: 'Criterio', Detalle: `Sin reportar = última fecha GPRS anterior a (ahora − ${ventanaHoras} h); dentro de la ventana = reportando` },
    { Concepto: 'Orden', Detalle: 'Mayor antigüedad primero (las que llevan más tiempo sin reportar arriba)' },
    { Concepto: 'Total', Detalle: `${(filas || []).length} unidad(es); ${sinReportar} sin reportar` },
    { Concepto: 'Fuente', Detalle: 'public.agrotrack_posiciones + public.agrotrack_geocercas (agrotrack_estado_unidades_flota con p_desde = null y p_hasta = null: última posición conocida de cada placa)' },
    { Concepto: 'Geocerca asignada', Detalle: 'Geocerca que contiene la última posición conocida (PostGIS); si está fuera de todas, se muestra la última geocerca de campo con el sufijo "(última conocida)"' },
    { Concepto: 'Tiempo transcurrido', Detalle: 'Diferencia entre la última fecha GPRS y el momento en que se cargó el reporte' },
    { Concepto: 'Horario', Detalle: 'Hora de Perú (UTC-5)' },
    { Concepto: 'Generado', Detalle: (generado ? new Date(generado) : new Date()).toLocaleString('es-PE') },
  ]);

  const fecha = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Agrilux_Unidades_Sin_Reportar_${ventanaHoras}h_${fecha}.xlsx`);
}

/* -------------------------------------------------------------------------
 * 14/11/2026 · Tabla dinámica diaria de geocercas (TODAS las unidades)
 * Mismo formato que el Excel de las 6:30 a. m.: hoja "Data" con las columnas
 * Placa · Area · Area Cod · Grupo · Geocerca · Hora de entrada · Hora de
 * salida · Fecha de entrada · Fecha de salida · Duración · Duración2 ·
 * Duración3, con FECHAS y HORAS reales de Excel (la tabla dinámica y las
 * segmentaciones por mes/día funcionan igual que hoy), y la hoja
 * "Resumen Geocer" (placa x geocerca, horas con 2 decimales y totales).
 * ---------------------------------------------------------------------- */

/** Fecha 'YYYY-MM-DD' -> número de serie de Excel (fecha sin hora). */
function serialFecha(fecha) {
  if (!fecha) return null;
  const [y, m, d] = fecha.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000 + 25569;
}

/** 'HH:mm:ss' -> fracción del día. */
function serialHora(hora) {
  if (!hora) return null;
  const [h, m, s] = hora.split(':').map(Number);
  return (h * 3600 + m * 60 + (s || 0)) / 86400;
}

function partesPeru(iso) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return { fecha: '', hora: '' };
  const d = new Date(t - 5 * 3600 * 1000);
  const dd = (n) => String(n).padStart(2, '0');
  return {
    fecha: `${d.getUTCFullYear()}-${dd(d.getUTCMonth() + 1)}-${dd(d.getUTCDate())}`,
    hora: `${dd(d.getUTCHours())}:${dd(d.getUTCMinutes())}:${dd(d.getUTCSeconds())}`,
  };
}

function textoDuracion(seg) {
  const s = Math.max(0, Math.round(Number(seg || 0)));
  const dd = (n) => String(n).padStart(2, '0');
  return `${dd(Math.floor(s / 3600))}h:${dd(Math.floor((s % 3600) / 60))}m:${dd(s % 60)}s`;
}

/**
 * @param {Array} visitas  filas de agrotrack_visitas_dia_flota
 * @param {{ matriz: object, infoPlaca: object, desdeDia: string, hastaDia: string,
 *           metricaLabel?: string }} opciones
 */
export function exportarTablaDinamicaGeocercasExcel(visitas, {
  matriz, infoPlaca = {}, desdeDia = '', hastaDia = '', metricaLabel = 'Total en geocerca',
} = {}) {
  const wb = XLSX.utils.book_new();

  // ---- Hoja Data (una fila por visita) ----
  const encabezado = [
    'Placa', 'Area', 'Area Cod', 'Grupo', 'Geocerca',
    'Hora de entrada', 'Hora de salida', 'Fecha de entrada', 'Fecha de salida',
    'Duración', 'Duración2', 'Duración3',
    'Apagado (h)', 'Ralentí (h)', 'Viajando (h)', 'Estado',
  ];
  const aoa = [encabezado];
  (visitas || []).forEach((v) => {
    const e = partesPeru(v.entrada);
    const s = partesPeru(v.salida);
    const info = infoPlaca[v.placa] || {};
    const seg = Number(v.duracion_segundos || 0);
    aoa.push([
      v.placa,
      info.areaNombre || '',
      info.area || '',
      info.grupo || '',
      v.geocerca,
      serialHora(e.hora),
      serialHora(s.hora),
      serialFecha(e.fecha),
      serialFecha(s.fecha),
      textoDuracion(seg),
      seg / 86400,
      Math.round((seg / 3600) * 100) / 100,
      Math.round((Number(v.apagado_segundos || 0) / 3600) * 100) / 100,
      Math.round((Number(v.ralenti_segundos || 0) / 3600) * 100) / 100,
      Math.round((Number(v.viaje_segundos || 0) / 3600) * 100) / 100,
      v.abierta ? 'Sigue dentro al cierre del día'
        : v.continua_dia_anterior ? 'Venía del día anterior' : 'Cerrada',
    ]);
  });
  const wsData = XLSX.utils.aoa_to_sheet(aoa);
  const formatos = { 5: 'hh:mm:ss', 6: 'hh:mm:ss', 7: 'dd/mm/yyyy', 8: 'dd/mm/yyyy', 10: '[h]:mm:ss', 11: '0.00' };
  for (let r = 1; r < aoa.length; r += 1) {
    Object.entries(formatos).forEach(([c, z]) => {
      const ref = XLSX.utils.encode_cell({ r, c: Number(c) });
      if (wsData[ref] && wsData[ref].t === 'n') wsData[ref].z = z;
    });
  }
  wsData['!cols'] = [
    { wch: 11 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 24 },
    { wch: 11 }, { wch: 11 }, { wch: 12 }, { wch: 12 }, { wch: 13 },
    { wch: 11 }, { wch: 10 }, { wch: 11 }, { wch: 10 }, { wch: 11 }, { wch: 26 },
  ];
  wsData['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(aoa.length - 1, 1), c: encabezado.length - 1 } }) };
  XLSX.utils.book_append_sheet(wb, wsData, 'Data');

  // ---- Hoja Resumen Geocer (matriz placa x geocerca) ----
  if (matriz) {
    const filasM = [['Area Cod', 'Grupo', 'Placa', ...matriz.geocercas, 'Total general']];
    matriz.filas.forEach((f) => {
      filasM.push([
        f.area, f.grupo, f.placa,
        ...matriz.geocercas.map((g) => Math.round(((f.valores[g] || 0) / 3600) * 100) / 100),
        Math.round((f.total / 3600) * 100) / 100,
      ]);
    });
    filasM.push([
      'Total general', '', '',
      ...matriz.geocercas.map((g) => Math.round(((matriz.totales[g] || 0) / 3600) * 100) / 100),
      Math.round((matriz.totalGeneral / 3600) * 100) / 100,
    ]);
    const wsM = XLSX.utils.aoa_to_sheet(filasM);
    for (let r = 1; r < filasM.length; r += 1) {
      for (let c = 3; c < filasM[0].length; c += 1) {
        const ref = XLSX.utils.encode_cell({ r, c });
        if (wsM[ref]) wsM[ref].z = '0.00';
      }
    }
    wsM['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 11 }, ...matriz.geocercas.map(() => ({ wch: 12 })), { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsM, 'Resumen Geocer');
  }

  agregarCriterio(wb, [
    { Concepto: 'Reporte', Detalle: 'Tabla dinámica de geocercas · todas las unidades (Agrilux)' },
    { Concepto: 'Días', Detalle: desdeDia === hastaDia ? desdeDia : `${desdeDia} a ${hastaDia}` },
    { Concepto: 'Valores', Detalle: `${metricaLabel} en horas (Duración3 / Resumen Geocer)` },
    { Concepto: 'Corte', Detalle: 'Cada día de 00:00:00 a 23:59:59 hora de Perú. Una visita que cruza la medianoche se parte en dos (sale a las 23:59:59 y vuelve a entrar a las 00:00:00).' },
    { Concepto: 'Area / Area Cod', Detalle: 'Area Cod = texto después de la "/" de la unidad en Zonar; Grupo = grupo asignado en Agrilux (Mapa > Grupos).' },
    { Concepto: 'Fuente', Detalle: 'public.agrotrack_visitas_dia (respaldo diario de horas por máquina y geocerca)' },
    { Concepto: 'Generado', Detalle: new Date().toLocaleString('es-PE') },
  ]);

  const nombre = desdeDia === hastaDia ? desdeDia : `${desdeDia}_a_${hastaDia}`;
  XLSX.writeFile(wb, `Agrilux_Geocercas_Todas_Unidades_${nombre}.xlsx`);
}

/** "hace 12 h 30 min" para la hoja de detalle del estado por geocerca. */
function haceDesde(iso, ahora = new Date()) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return 'sin reporte';
  const seg = Math.max(0, Math.floor((ahora.getTime() - t) / 1000));
  const dias = Math.floor(seg / 86400);
  const horas = Math.floor((seg % 86400) / 3600);
  const minutos = Math.floor((seg % 3600) / 60);
  if (dias > 0) return `hace ${dias} d ${horas} h`;
  if (horas > 0) return `hace ${horas} h ${minutos} min`;
  if (minutos > 0) return `hace ${minutos} min`;
  return 'hace instantes';
}

/**
 * Reporte "Estado por geocerca" con 3 estados a Excel.
 * @param {Array} grupos  salida de agruparPorGeocerca() (con `unidades` y
 *                        conteos ya calculados, para que el archivo coincida
 *                        con la pantalla)
 * @param {{generado?: Date|string|null, ahora?: Date, filtro?: string, sinTelemetria?: number}} opciones
 */
export function exportarEstadoPorGeocercaExcel(grupos, {
  generado = null,
  ahora = new Date(),
  filtro = '',
  sinTelemetria = 0,
} = {}) {
  const wb = XLSX.utils.book_new();
  const lista = grupos || [];

  const totales = lista.reduce(
    (acc, g) => ({
      apagado: acc.apagado + (g.apagado || 0),
      ralenti: acc.ralenti + (g.ralenti || 0),
      conduciendo: acc.conduciendo + (g.conduciendo || 0),
      sinDato: acc.sinDato + (g.sinDato || 0),
      total: acc.total + (g.total || 0),
    }),
    { apagado: 0, ralenti: 0, conduciendo: 0, sinDato: 0, total: 0 },
  );

  const resumen = [
    ['Geocerca', 'Apagado', 'Ralentí', 'Conduciendo', 'Sin dato', 'Total unidades'],
    ...lista.map((g) => [g.geocerca, g.apagado || 0, g.ralenti || 0, g.conduciendo || 0, g.sinDato || 0, g.total || 0]),
    ['Total general', totales.apagado, totales.ralenti, totales.conduciendo, totales.sinDato, totales.total],
  ];
  const ws = XLSX.utils.aoa_to_sheet(resumen);
  ws['!cols'] = [{ wch: 34 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Por geocerca');

  const detalle = [];
  lista.forEach((g) => {
    (g.unidades || []).forEach((u) => {
      detalle.push({
        'Geocerca': g.geocerca,
        'Placa': u.placa || '—',
        'Área': codigoArea(u.unidad, u.placa) || (u.descripcion && u.descripcion !== u.placa ? u.descripcion : '—'),
        'Estado': ETIQUETAS_ESTADO_GEO[u.estado] || 'Sin dato',
        'Velocidad (km/h)': u.ultima_velocidad == null ? '' : Math.round(Number(u.ultima_velocidad)),
        'Últ. posición': u.ultima_fecha ? formatearFechaLarga(u.ultima_fecha) : 'sin reporte',
        'Hace': haceDesde(u.ultima_fecha, ahora),
      });
    });
  });
  const wsDetalle = XLSX.utils.json_to_sheet(detalle);
  wsDetalle['!cols'] = [
    { wch: 34 }, { wch: 14 }, { wch: 24 }, { wch: 14 }, { wch: 16 }, { wch: 26 }, { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle');

  agregarCriterio(wb, [
    { Concepto: 'Reporte', Detalle: 'Estado por geocerca · 3 estados (Agrilux)' },
    { Concepto: 'Estados', Detalle: 'Apagado = motor apagado/estacionado · Ralentí = encendido y 0 a 5 km/h · Conduciendo = más de 5 km/h' },
    { Concepto: 'Sin dato', Detalle: 'Última posición mayor a 30 min o fecha inválida. No se suma a los 3 estados (columna aparte).' },
    { Concepto: 'Agrupación', Detalle: 'Por la geocerca que contiene la última posición (PostGIS). Fuera de todas: "Sin geocerca".' },
    { Concepto: 'Conteos', Detalle: 'Son unidades en cada estado en este momento, no horas.' },
    { Concepto: 'Filtro', Detalle: filtro || 'Sin filtro de búsqueda' },
    { Concepto: 'Sin telemetría', Detalle: `${sinTelemetria} unidad(es) sin posición cargada, excluidas del reporte` },
    { Concepto: 'Fuente', Detalle: 'agrotrack_estado_vivo_flota (Zonar en vivo) o agrotrack_estado_unidades_flota (histórico) + agrotrack_geocercas_reportes' },
    { Concepto: 'Horario', Detalle: 'Hora de Perú (UTC-5)' },
    { Concepto: 'Generado', Detalle: (generado ? new Date(generado) : new Date()).toLocaleString('es-PE') },
  ]);

  const fecha = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Agrilux_Estado_por_Geocerca_${fecha}.xlsx`);
}
