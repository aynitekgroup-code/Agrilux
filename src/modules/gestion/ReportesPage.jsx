import React, { useEffect, useMemo, useState } from 'react';
import { Download, Library, Radio } from 'lucide-react';
import {
  obtenerActividadFlota,
  obtenerAlertasFlota,
  obtenerConteoEventos,
  obtenerRecorridoFlota,
  formatearFechaHora,
  etiquetaPeriodoReporte,
} from '../../lib/agrotrackFlota';
import { obtenerEventosGeocerca, obtenerEstadoUnidadesFlota } from '../../lib/agrotrackReportesGeocerca';
import {
  segundosDelRango,
  calcularEventosResumidos,
  formatearHMS,
} from '../../lib/agrotrackEventosResumidos';
import {
  useRango,
  ControlesRango,
  CuerpoEstado,
  PanelSinDatos,
  numero,
} from '../../components/gestion/fleet/reportesComunes';

/**
 * src/modules/gestion/ReportesPage.jsx
 *
 * Catálogo de reportes del esquema de módulos (pedido por el Ing. Carlos
 * Perez: "Esquema de módulos" vive dentro de Reportes). Cada reporte declara
 * su fuente REAL: una RPC que agrupa en SQL, nunca las +100 mil filas de
 * agrotrack_posiciones (PostgREST corta en 1000).
 *
 * - fuente 'actividad'  -> agrotrack_actividad_flota (km, encendido, viaje, ralentí)
 * - fuente 'alertas'    -> agrotrack_alertas_flota (alta velocidad / pánico)
 * - fuente 'geocerca'   -> agrotrack_eventos_geocerca_flota (entradas y salidas)
 * - fuente 'estado'     -> agrotrack_estado_unidades_flota (última posición + geocerca)
 * - fuente 'conteo'     -> agrotrack_conteo_eventos (conteo por texto de evento)
 * - fuente 'recorrido'  -> agrotrack_recorrido_flota (puntos GPS de UNA placa)
 * - fuente null         -> sin fuente real: se explica con PanelSinDatos y NO
 *                          se muestran cifras inventadas (antes: datos demo).
 */

const REPORTS = [
  { id: 'rendimiento', label: 'Rendimiento del vehículo', group: 'Rendimientos', fuente: 'actividad', agrupar: 'unidad' },
  { id: 'basico', label: 'Reporte básico', group: 'Alertas y eventos', fuente: 'estado' },
  { id: 'uso-motor', label: 'Tiempo de uso del motor', group: 'Rendimientos', fuente: 'actividad', agrupar: 'unidad' },
  { id: 'horas-motor', label: 'Horas totales de motor', group: 'Rendimientos', fuente: 'actividad', agrupar: 'unidad' },
  { id: 'actividades-sumarizado', label: 'Actividades (sumarizado)', group: 'Actividades', fuente: 'actividad', agrupar: 'unidad' },
  { id: 'actividades', label: 'Actividades', group: 'Actividades', fuente: 'actividad' },
  { id: 'actividades-latlon', label: 'Actividades - LatLon', group: 'Actividades', fuente: 'recorrido' },
  { id: 'actividades-detalladas', label: 'Actividades detalladas', group: 'Actividades', fuente: 'recorrido' },
  { id: 'dot-horas', label: 'DOT - Horas de servicio', group: 'Alertas y eventos', fuente: null },
  { id: 'log-conductores', label: 'Log de conductores', group: 'Conductores', fuente: null },
  { id: 'conductores', label: 'Conductores', group: 'Conductores', fuente: null },
  { id: 'estados-conductores', label: 'Estados - Conductores', group: 'Conductores', fuente: null },
  { id: 'tiempos-conductor', label: 'Tarjeta de tiempos conductor', group: 'Conductores', fuente: null },
  { id: 'geocercas-entradas', label: 'Geocercas: entradas y salidas', group: 'Geocercas y rutas', fuente: 'geocerca' },
  { id: 'limite-velocidad', label: 'Geocercas: límite de velocidad', group: 'Geocercas y rutas', fuente: 'alertas' },
  { id: 'rutas-historicas', label: 'Rutas históricas', group: 'Geocercas y rutas', fuente: null },
  { id: 'ralenti-eventos', label: 'Ralentí: entradas y salidas', group: 'Geocercas y rutas', fuente: null },
  { id: 'ralenti', label: 'Ralentí', group: 'Geocercas y rutas', fuente: 'actividad', agrupar: 'unidad' },
  { id: 'alertas', label: 'Alertas', group: 'Alertas y eventos', fuente: 'alertas' },
  { id: 'eventos', label: 'Eventos', group: 'Alertas y eventos', fuente: 'conteo' },
  { id: 'eventos-resumidos', label: 'Eventos resumidos', group: 'Alertas y eventos', fuente: 'actividad', agrupar: 'unidad' },
];

const MODULE_REPORT_GROUPS = {
  flota: ['Rendimientos', 'Actividades', 'Conductores'],
  geocercas: ['Geocercas y rutas'],
  alertas: ['Alertas y eventos'],
};

/** Reportes sin fuente real: explicación honesta en lugar de datos demo. */
const SIN_FUENTES = {
  'dot-horas': {
    titulo: 'DOT - Horas de servicio',
    descripcion: 'Las horas DOT (fuera de servicio, descanso y conducción) dependen de la tabla de conductores y sus turnos, que todavía no existe en la base de datos.',
    puntos: [
      'El archivo importado de Zonar trae placas y posiciones, no conductores ni turnos.',
      'Con la tabla de conductores este reporte puede calcularse en SQL sin bajar filas crudas.',
    ],
  },
  'log-conductores': {
    titulo: 'Log de conductores',
    descripcion: 'Este reporte lista entradas y salidas por conductor. La base actual no tiene una tabla de conductores: solo hay placas y unidades.',
    puntos: [
      'Se habilita al crear agrotrack_conductores y su asignación a vehículos.',
      'Mientras tanto, la actividad por unidad está en "Actividades" y "Eventos resumidos".',
    ],
  },
  conductores: {
    titulo: 'Conductores',
    descripcion: 'El padrón de conductores (nombre, licencia, estado) no existe como tabla en Supabase; el import de posiciones no trae ese dato.',
    puntos: [
      'Se habilita al crear agrotrack_conductores.',
      'El estado operativo de cada unidad sí está en el reporte "Reporte básico".',
    ],
  },
  'estados-conductores': {
    titulo: 'Estados - Conductores',
    descripcion: 'Los estados por conductor requieren la tabla de conductores, que todavía no está cargada en la base.',
    puntos: [
      'Se habilita al crear agrotrack_conductores.',
      'El equivalente por unidad (detenida / en viaje / sin conexión) está en "Reporte básico".',
    ],
  },
  'tiempos-conductor': {
    titulo: 'Tarjeta de tiempos conductor',
    descripcion: 'La tarjeta de tiempos cruza posición con turnos y descansos por conductor; sin tabla de conductores no hay cruces que calcular.',
    puntos: [
      'Se habilita al crear agrotrack_conductores con sus horarios.',
      'El tiempo por unidad sí está disponible en "Actividades (sumarizado)".',
    ],
  },
  'rutas-historicas': {
    titulo: 'Rutas históricas',
    descripcion: 'Las rutas históricas comparan rutas definidas (origen → destino) entre sí; todavía no hay rutas configuradas en la base.',
    puntos: [
      'El recorrido puntual de una unidad sí se puede ver en "Actividades - LatLon" (elige una placa).',
      'El mapa de la consola muestra el rastro de cualquier unidad sobre las geocercas reales.',
    ],
  },
  'ralenti-eventos': {
    titulo: 'Ralentí: entradas y salidas',
    descripcion: 'Este reporte necesitaría cada evento de entrada y salida de ralentí; el import trae posiciones, no eventos de ralentí individuales.',
    puntos: [
      'El tiempo total en ralentí por unidad sí está en el reporte "Ralentí".',
      'También está desglosado en "Eventos resumidos" (Stop / Idle / Drive).',
    ],
  },
};

const AGROUPS_GEOCERCA = [
  { id: 'geocerca', label: 'Por geocerca', primeraColumna: 'Geocerca' },
  { id: 'dia', label: 'Por día', primeraColumna: 'Día' },
  { id: 'mes', label: 'Por mes', primeraColumna: 'Mes' },
];

/** Encabezados [clave, etiqueta, numérica?] de cada reporte. */
function columnasPara(report, agruparGeocerca) {
  switch (report.id) {
    case 'basico':
      return [['unidad', 'Unidad'], ['fecha', 'Últ. fecha'], ['evento', 'Últ. evento'], ['direccion', 'Dirección'], ['velocidad', 'Vel. (km/h)', true], ['geocerca', 'Geocerca']];
    case 'rendimiento':
      return [['unidad', 'Unidad'], ['km', 'Recorrido (km)', true], ['velocidad', 'Vel. máx (km/h)', true], ['motor_h', 'H. motor', true], ['viaje_h', 'H. viaje', true], ['ralenti_h', 'H. ralentí', true], ['rendimiento', 'Km / h motor', true]];
    case 'uso-motor':
      return [['unidad', 'Unidad'], ['motor_h', 'Encendido (h)', true], ['ralenti_h', 'Ralentí (h)', true], ['viaje_h', 'Viaje (h)', true], ['pct_encendido', '% del rango', true]];
    case 'horas-motor':
      return [['unidad', 'Unidad'], ['motor_h', 'Horas de motor', true], ['viaje_h', 'H. viaje', true], ['ralenti_h', 'H. ralentí', true]];
    case 'actividades-sumarizado':
      return [['unidad', 'Unidad'], ['velocidad', 'Vel. máx (km/h)', true], ['km', 'Recorrido (km)', true], ['viaje_h', 'H. viaje', true], ['ralenti_h', 'H. ralentí', true], ['motor_h', 'H. motor', true], ['alertas', 'Alertas', true]];
    case 'actividades':
      return [['periodo', 'Período'], ['unidad', 'Unidad'], ['km', 'Recorrido (km)', true], ['motor_h', 'H. motor', true], ['viaje_h', 'H. viaje', true], ['ralenti_h', 'H. ralentí', true], ['velocidad', 'Vel. máx (km/h)', true], ['alertas', 'Alertas', true]];
    case 'actividades-latlon':
      return [['fecha', 'Fecha'], ['unidad', 'Unidad'], ['latitud', 'Latitud', true], ['longitud', 'Longitud', true], ['velocidad', 'Velocidad (km/h)', true], ['evento', 'Evento']];
    case 'actividades-detalladas':
      return [['fecha', 'Fecha'], ['unidad', 'Unidad'], ['evento', 'Evento'], ['direccion', 'Dirección'], ['velocidad', 'Velocidad (km/h)', true]];
    case 'geocercas-entradas': {
      const primera = AGROUPS_GEOCERCA.find((g) => g.id === agruparGeocerca)?.primeraColumna || 'Geocerca';
      return [['grupo', primera], ['unidades', 'Unidades', true], ['entradas', 'Entradas', true], ['salidas', 'Salidas', true], ['ultima_entrada', 'Última entrada']];
    }
    case 'limite-velocidad':
    case 'alertas':
      return [['fecha', 'Fecha y hora'], ['unidad', 'Unidad'], ['evento', 'Evento'], ['velocidad', 'Velocidad (km/h)', true], ['direccion', 'Dirección']];
    case 'ralenti':
      return [['unidad', 'Unidad'], ['ralenti_h', 'H. ralentí', true], ['motor_h', 'H. motor', true], ['pct_ralenti', '% ralentí', true]];
    case 'eventos':
      return [['evento', 'Evento'], ['total', 'Total', true]];
    case 'eventos-resumidos':
      return [['unidad', 'Unidad'], ['stop', 'Stop'], ['pct_stop', '%', true], ['idle', 'Idle'], ['pct_idle', '%', true], ['drive', 'Drive'], ['pct_drive', '%', true], ['total', 'Total']];
    default:
      return [['unidad', 'Unidad'], ['km', 'Recorrido (km)', true], ['motor_h', 'H. motor', true], ['viaje_h', 'H. viaje', true], ['ralenti_h', 'H. ralentí', true]];
  }
}

const num = (valor, decimales = 1) => numero(valor, decimales);
const horasDe = (segundos) => num(Number(segundos || 0) / 3600, 1);
const pctDe = (parte, total) => {
  const t = Number(total || 0);
  if (t <= 0) return '—';
  return `${Math.round((Number(parte || 0) / t) * 1000) / 10}%`;
};

/** Convierte las filas crudas de la RPC en la fila visible del reporte. */
function mapearFilas(report, crudas, ctx) {
  switch (report.id) {
    case 'basico':
      return crudas.map((f) => ({
        unidad: f.placa,
        fecha: f.ultima_fecha ? formatearFechaHora(f.ultima_fecha) : '—',
        evento: f.ultimo_evento || '—',
        direccion: f.direccion || '—',
        velocidad: num(f.ultima_velocidad, 0),
        geocerca: f.geocerca || 'Fuera de geocercas',
      }));
    case 'rendimiento':
      return crudas.map((f) => {
        const motor = Number(f.encendido_segundos || 0);
        const km = Number(f.km_recorridos || 0);
        return {
          unidad: f.unidad || f.placa,
          km: num(km, 1),
          velocidad: num(f.vel_max_kmh, 0),
          motor_h: horasDe(motor),
          viaje_h: horasDe(f.viaje_segundos),
          ralenti_h: horasDe(f.ralenti_segundos),
          rendimiento: motor > 0 ? num(km / (motor / 3600), 2) : '—',
        };
      });
    case 'uso-motor':
      return crudas.map((f) => ({
        unidad: f.unidad || f.placa,
        motor_h: horasDe(f.encendido_segundos),
        ralenti_h: horasDe(f.ralenti_segundos),
        viaje_h: horasDe(f.viaje_segundos),
        pct_encendido: pctDe(f.encendido_segundos, ctx.totalSegundos),
      }));
    case 'horas-motor':
      return crudas.map((f) => ({
        unidad: f.unidad || f.placa,
        motor_h: horasDe(f.encendido_segundos),
        viaje_h: horasDe(f.viaje_segundos),
        ralenti_h: horasDe(f.ralenti_segundos),
      }));
    case 'actividades-sumarizado':
      return crudas.map((f) => ({
        unidad: f.unidad || f.placa,
        velocidad: num(f.vel_max_kmh, 0),
        km: num(f.km_recorridos, 1),
        viaje_h: horasDe(f.viaje_segundos),
        ralenti_h: horasDe(f.ralenti_segundos),
        motor_h: horasDe(f.encendido_segundos),
        alertas: num(f.alertas, 0),
      }));
    case 'actividades':
      return crudas.map((f) => ({
        periodo: etiquetaPeriodoReporte(f, ctx.agrupar),
        unidad: f.unidad || f.placa,
        km: num(f.km_recorridos, 1),
        motor_h: horasDe(f.encendido_segundos),
        viaje_h: horasDe(f.viaje_segundos),
        ralenti_h: horasDe(f.ralenti_segundos),
        velocidad: num(f.vel_max_kmh, 0),
        alertas: num(f.alertas, 0),
      }));
    case 'ralenti':
      return crudas.map((f) => ({
        unidad: f.unidad || f.placa,
        ralenti_h: horasDe(f.ralenti_segundos),
        motor_h: horasDe(f.encendido_segundos),
        pct_ralenti: pctDe(f.ralenti_segundos, f.encendido_segundos),
      }));
    case 'actividades-latlon':
      return crudas.map((f) => ({
        fecha: formatearFechaHora(f.fecha),
        unidad: ctx.placa,
        latitud: num(f.latitud, 6),
        longitud: num(f.longitud, 6),
        velocidad: num(f.velocidad, 0),
        evento: f.evento || '—',
      }));
    case 'actividades-detalladas':
      return crudas.map((f) => ({
        fecha: formatearFechaHora(f.fecha),
        unidad: ctx.placa,
        evento: f.evento || '—',
        direccion: f.direccion || '—',
        velocidad: num(f.velocidad, 0),
      }));
    case 'geocercas-entradas':
      return crudas.map((f) => ({
        grupo: f.grupo,
        unidades: num(f.unidades, 0),
        entradas: num(f.entradas, 0),
        salidas: num(f.salidas, 0),
        ultima_entrada: f.ultima_entrada ? formatearFechaHora(f.ultima_entrada) : '—',
      }));
    case 'limite-velocidad':
    case 'alertas':
      return crudas.map((f) => ({
        fecha: formatearFechaHora(f.fecha),
        unidad: f.unidad || f.placa,
        evento: f.evento || '—',
        velocidad: num(f.velocidad, 0),
        direccion: f.direccion || '—',
      }));
    case 'eventos':
      return crudas.map((f) => ({
        evento: f.evento || '—',
        total: num(f.total, 0),
      }));
    case 'eventos-resumidos':
      return calcularEventosResumidos(crudas, ctx.totalSegundos).map((f) => ({
        unidad: f.unidad,
        stop: formatearHMS(f.stop),
        pct_stop: f.pct_stop != null ? `${f.pct_stop}%` : '—',
        idle: formatearHMS(f.idle),
        pct_idle: f.pct_idle != null ? `${f.pct_idle}%` : '—',
        drive: formatearHMS(f.drive),
        pct_drive: f.pct_drive != null ? `${f.pct_drive}%` : '—',
        total: f.total != null ? formatearHMS(f.total) : '—',
      }));
    default:
      return crudas;
  }
}

function csvEscape(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export default function ReportesPage({
  selectedModuleId,
  empresaId = null,
  periodo = null,
  fuente = 'demo',
  vehicles = [],
}) {
  const [selectedReportId, setSelectedReportId] = useState('actividades-sumarizado');
  const [placa, setPlaca] = useState('');
  const [agruparGeocerca, setAgruparGeocerca] = useState('geocerca');
  const [estado, setEstado] = useState('cargando');
  const [intento, setIntento] = useState(0);
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState(null);
  const [rangoTexto, setRangoTexto] = useState('');

  const { rango, setRango, dia, setDia, mes, setMes, desdeHora, setDesdeHora, hastaHora, setHastaHora, consulta, pendienteDeFecha } = useRango(periodo);

  const availableGroups = MODULE_REPORT_GROUPS[selectedModuleId] || [];
  const availableReports = useMemo(
    () => REPORTS.filter((item) => availableGroups.includes(item.group)),
    [availableGroups],
  );
  const report = availableReports.find((item) => item.id === selectedReportId) || availableReports[0];
  const groups = [...new Set(availableReports.map((item) => item.group))];

  const requierePlaca = report?.fuente === 'recorrido';
  const sinRango = report?.fuente === 'conteo';
  const pendientePlaca = Boolean(requierePlaca && !placa);
  const pendiente = pendientePlaca || (!sinRango && pendienteDeFecha);
  const mensajePendiente = pendientePlaca
    ? 'Este reporte consulta el recorrido GPS de UNA unidad: elige una placa en el selector para poder calcularlo.'
    : rango === 'todo' && !periodo?.desde
      ? 'Esta empresa todavía no tiene periodo cargado en agrotrack_posiciones, así que no hay cifras que mostrar.'
      : 'Esperando el periodo cargado para precargar el selector…';

  // Carga única por reporte: la RPC agrupa en SQL y el navegador solo recibe
  // filas agregadas (una por unidad / periodo / geocerca).
  useEffect(() => {
    if (!report?.fuente || !empresaId) {
      setFilas([]);
      setEstado('inactivo');
      return undefined;
    }
    if (pendientePlaca || (!sinRango && pendienteDeFecha)) {
      // Nunca dejar "Calculando..." colgado: si el rango aún no está listo,
      // volvemos a inactivo y CuerpoEstado muestra el mensaje de espera.
      setFilas([]);
      setEstado((prev) => (prev === 'cargando' ? 'inactivo' : prev));
      return undefined;
    }
    let cancelado = false;
    setEstado('cargando');
    setError(null);

    const cargar = () => {
      const { desde, hasta } = consulta;
      switch (report.fuente) {
        case 'actividad': {
          const agrupar = report.agrupar || (rango === 'dia' ? 'dia' : rango === 'mes' ? 'mes' : 'unidad');
          return obtenerActividadFlota(empresaId, { desde, hasta, agrupar });
        }
        case 'alertas':
          return obtenerAlertasFlota(empresaId, { desde, hasta, limite: 500 });
        case 'geocerca':
          return obtenerEventosGeocerca(empresaId, { desde, hasta, agrupar: agruparGeocerca, limite: 500 });
        case 'estado':
          return obtenerEstadoUnidadesFlota(empresaId, { desde, hasta });
        case 'conteo':
          return obtenerConteoEventos(empresaId);
        case 'recorrido':
          return obtenerRecorridoFlota(empresaId, { placa, desde, hasta });
        default:
          return Promise.resolve([]);
      }
    };

    cargar()
      .then((resultado) => {
        if (cancelado) return;
        setFilas(resultado || []);
        setEstado((resultado || []).length ? 'ok' : 'vacio');
        setRangoTexto(consulta.texto || '');
      })
      .catch((e) => {
        if (cancelado) return;
        setFilas([]);
        setError(e?.message || 'No se pudo cargar el reporte.');
        setEstado('error');
      });

    return () => {
      cancelado = true;
    };
  }, [
    empresaId,
    report,
    consulta,
    rango,
    placa,
    agruparGeocerca,
    pendientePlaca,
    sinRango,
    pendienteDeFecha,
    intento,
  ]);

  // Duración real del rango (limitada al periodo cargado): denominador de los
  // porcentajes de "Tiempo de uso del motor" y "Eventos resumidos".
  const totalSegundos = useMemo(() => segundosDelRango(consulta, periodo), [consulta, periodo]);

  const columnas = report ? columnasPara(report, agruparGeocerca) : [];
  const filasVisibles = useMemo(() => {
    if (!report || estado !== 'ok') return [];
    const agrupar = report.agrupar || (rango === 'dia' ? 'dia' : rango === 'mes' ? 'mes' : 'unidad');
    return mapearFilas(report, filas, { agrupar, totalSegundos, placa });
  }, [report, estado, filas, agruparGeocerca, rango, totalSegundos, placa]);

  const exportCsv = () => {
    if (!filasVisibles.length) return;
    const content = [
      columnas.map(([, label]) => csvEscape(label)).join(','),
      ...filasVisibles.map((row) => columnas.map(([key]) => csvEscape(row[key])).join(',')),
    ].join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte-${report.id}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const unidades = useMemo(
    () => (vehicles || []).map((v) => ({ placa: v.placa, descripcion: v.descripcion || v.modelo || '' })),
    [vehicles],
  );

  return (
    <section className="space-y-4" aria-labelledby="fleet-reports-heading">
      <header className="bg-white rounded-2xl border border-slate-200/80 shadow-subtle px-4 py-3 flex flex-wrap items-center gap-3">
        <Library size={20} className="text-emerald-600" />
        <div className="min-w-0">
          <h2 id="fleet-reports-heading" className="text-lg font-bold text-slate-900">Reportes del catálogo</h2>
          <p className="text-sm text-slate-500">
            Cada reporte se calcula en la base de datos (RPC en SQL): el navegador nunca descarga las posiciones crudas.
          </p>
        </div>
        <span
          className={`ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border ${
            fuente === 'real'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}
        >
          <Radio size={12} /> {fuente === 'real' ? 'Datos reales' : 'Sin datos reales'}
        </span>
      </header>

      <div className="fleet-reports-layout">
        <nav className="bg-white rounded-2xl border border-slate-200/80 shadow-subtle p-3" aria-label="Reportes disponibles">
          <h3 className="px-2 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">Reportes disponibles</h3>
          <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
            {groups.map((group) => (
              <div key={group}>
                <h4 className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{group}</h4>
                <div className="space-y-0.5">
                  {availableReports.filter((item) => item.group === group).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedReportId(item.id)}
                      aria-current={report?.id === item.id ? 'page' : undefined}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors ${
                        report?.id === item.id ? 'bg-forest text-white font-semibold' : 'text-slate-600 hover:bg-emerald-50 hover:text-forest'
                      }`}
                    >
                      {item.label}
                      {!item.fuente ? (
                        <span className="block text-[9px] font-medium text-slate-400">sin fuente real aún</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {report ? (
          <div className="min-w-0 space-y-4">
            {!report.fuente ? (
              <PanelSinDatos
                titulo={SIN_FUENTES[report.id]?.titulo || report.label}
                descripcion={SIN_FUENTES[report.id]?.descripcion || 'Este reporte todavía no tiene una fuente real de datos en la base.'}
                puntos={SIN_FUENTES[report.id]?.puntos || []}
                nota="No se muestran cifras de demostración: si no hay dato real en Supabase, no hay reporte."
              />
            ) : (
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-subtle">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{report.group}</p>
                    <h3 className="text-base font-bold text-slate-900">{report.label}</h3>
                    {rangoTexto && !sinRango ? (
                      <p className="text-[11px] text-slate-400 mt-0.5">Rango: {rangoTexto}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={exportCsv}
                    disabled={estado !== 'ok' || !filasVisibles.length}
                    className="inline-flex items-center gap-2 rounded-lg bg-forest px-3 py-2 text-xs font-semibold text-white hover:bg-forest-dark disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download size={14} /> Exportar CSV
                  </button>
                </div>

                <div className="flex flex-wrap items-end gap-3 mb-4">
                  {!sinRango ? (
                    <ControlesRango rango={rango} setRango={setRango} dia={dia} setDia={setDia} mes={mes} setMes={setMes} desdeHora={desdeHora} setDesdeHora={setDesdeHora} hastaHora={hastaHora} setHastaHora={setHastaHora} />
                  ) : (
                    <p className="text-[11px] text-slate-400">Este reporte se calcula sobre todo el periodo cargado.</p>
                  )}

                  {requierePlaca ? (
                    <label className="min-w-0">
                      <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Unidad</span>
                      <select
                        value={placa}
                        onChange={(e) => setPlaca(e.target.value)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      >
                        <option value="">Elige una placa…</option>
                        {unidades.map((u) => (
                          <option key={u.placa} value={u.placa}>
                            {u.placa}{u.descripcion ? ` · ${u.descripcion}` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {report.fuente === 'geocerca' ? (
                    <label className="min-w-0">
                      <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Agrupar</span>
                      <select
                        value={agruparGeocerca}
                        onChange={(e) => setAgruparGeocerca(e.target.value)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      >
                        {AGROUPS_GEOCERCA.map((g) => (
                          <option key={g.id} value={g.id}>{g.label}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>

                <CuerpoEstado
                  pendienteDeFecha={pendiente}
                  mensajePendiente={mensajePendiente}
                  estado={estado}
                  error={error}
                  onReintentar={() => setIntento((n) => n + 1)}
                  mensajeVacio={`No hay datos de "${report.label}" en ${rangoTexto || 'ese rango'}. Prueba con otro día/mes o con "Todo el periodo".`}
                >
                  {estado === 'ok' && filasVisibles.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-slate-700">
                        <thead>
                          <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                            {columnas.map(([key, label, numerica]) => (
                              <th key={key} className={`px-3 py-2.5 font-bold ${numerica ? 'text-right' : 'text-left'}`}>
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filasVisibles.map((row, index) => (
                            <tr
                              key={`${row.unidad || row.grupo || row.evento || 'fila'}-${index}`}
                              className="border-b border-slate-50 hover:bg-slate-50/60"
                            >
                              {columnas.map(([key, , numerica]) => (
                                <td
                                  key={key}
                                  className={`px-3 py-2.5 ${numerica ? 'text-right tabular-nums' : 'text-left'} ${
                                    key === 'unidad' || key === 'grupo' || key === 'evento' ? 'font-semibold text-slate-800' : ''
                                  }`}
                                >
                                  {row[key] ?? '—'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : estado === 'inactivo' ? (
                    <p className="py-6 text-center text-xs text-slate-400">
                      Esperando parámetros para calcular el reporte…
                    </p>
                  ) : null}
                </CuerpoEstado>
              </div>
            )}
          </div>
        ) : (
          <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-6 text-sm text-slate-500 shadow-subtle">
            Este módulo no tiene reportes disponibles.
          </div>
        )}
      </div>
    </section>
  );
}
