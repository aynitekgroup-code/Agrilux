import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, AlertTriangle, RotateCw, Database, FileChartColumn, ArrowUpDown, CalendarClock, FileSpreadsheet, Sparkles, Radio } from 'lucide-react';
import {
  obtenerActividadFlota,
  rangoLibreLima,
  rangoHoyLima,
  formatearDuracion,
  rangoFueraDelPeriodo,
  etiquetaPeriodoReporte,
  ultimoDiaLima,
  LIMITE_FILAS_ACTIVIDAD,
} from '../../../lib/agrotrackFlota';
import { generarResumenFlota } from '../../../lib/agrotrackInsights';
import { rangoRapido, useLimiteFilas, BotonVerMas, BotonActualizarAhora, useFiltroUnidadGrupo, ControlesFiltroUnidadGrupo, filtrarFilasPorPlaca, RelojEnVivo } from './reportesComunes';
import { completarUnidadesReporte, recorridoEsCero } from '../../../lib/agrotrackReporteFilas.js';
import { codigoArea } from '../../../lib/agrotrackVisitasDia';

/**
 * Reporte de actividad de flota (FASE 3).
 * Réplica de lo pedido por Zonar: por día y por mes, con recorrido, encendido,
 * hora de viaje y ralentí por separado. Todo sale de una RPC (SQL), nunca de
 * 103 mil filas descargadas al navegador.
 */
const COLUMNAS = [
  { id: 'placa', label: 'Placa', numerica: false },
  { id: 'area', label: 'Área', numerica: false },
  { id: 'periodo', label: 'Período', numerica: false },
  { id: 'km_recorridos', label: 'Recorrido (km)', numerica: true },
  { id: 'prendido_segundos', label: 'Horas prendido', numerica: true },
  { id: 'viaje_segundos', label: 'Hora de viaje', numerica: true },
  { id: 'ralenti_segundos', label: 'Ralentí', numerica: true },
  { id: 'vel_max_kmh', label: 'Vel. máx.', numerica: true },
  { id: 'alertas', label: 'Alertas', numerica: true },
];

function numero(valor, decimales = 1) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('es-PE', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

export default function FleetReports({ empresaId, empresaNombre = '', periodo = null, vehicles = [], fuente = 'real' }) {
  // Rango libre con fecha Y hora (pedido por el Ing. Carlos Perez): dos
  // buscadores datetime-local en hora de Perú.
  const [desdeHora, setDesdeHora] = useState('');
  const [hastaHora, setHastaHora] = useState('');
  const [estado, setEstado] = useState('inactivo');
  const [intento, setIntento] = useState(0);
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState(null);
  const [rangoTexto, setRangoTexto] = useState('');
  const [descargaError, setDescargaError] = useState(null);
  const [generadoEn, setGeneradoEn] = useState(null);
  const [resumenIA, setResumenIA] = useState(null);
  const [resumenCargando, setResumenCargando] = useState(false);
  const [resumenError, setResumenError] = useState(null);
  const [orden, setOrden] = useState({ campo: 'placa', dir: 'asc' });
  const [modoReporte, setModoReporte] = useState('historico');
  const [ahora, setAhora] = useState(() => new Date());

  // Precarga con el último día (o mes) que trae datos reales.
  useEffect(() => {
    if (!periodo?.hasta) return;
    const ultimo = ultimoDiaLima(periodo.hasta);
    if (!ultimo) return;
    setDesdeHora((prev) => prev || `${ultimo}T00:00`);
    setHastaHora((prev) => prev || `${ultimo}T23:59`);
  }, [periodo?.hasta]);

  // Tiempo real: el rango no se elige, es el día en curso. `ahora` avanza
  // cada minuto, así que la consulta y el refresco de la tabla se rearman
  // solos con la ventana 00:00 → hora actual (igual que Status de maquinaria).
  useEffect(() => {
    if (modoReporte !== 'tiempo-real') return undefined;
    setAhora(new Date());
    const reloj = setInterval(() => setAhora(new Date()), 60 * 1000);
    return () => clearInterval(reloj);
  }, [modoReporte]);

  const {
    mostrar,
    setMostrar,
    opcionFiltro,
    setOpcionFiltro,
    gruposInfo,
    unidades,
    placasFiltro,
    opcionesGrupos,
  } = useFiltroUnidadGrupo({ vehicles, empresaId });
  const placa = mostrar === 'unidades' ? opcionFiltro : '';

  const consulta = useMemo(
    () => (modoReporte === 'tiempo-real' ? rangoHoyLima(ahora) : rangoLibreLima(desdeHora, hastaHora)),
    [modoReporte, ahora, desdeHora, hastaHora],
  );

  const avisoFueraDePeriodo = useMemo(
    () => (modoReporte === 'tiempo-real' ? null : rangoFueraDelPeriodo(consulta, periodo)),
    [consulta, periodo, modoReporte],
  );

  // En tiempo real siempre hay día que leer (hoy); en histórico se espera
  // a que el usuario elija desde y hasta.
  const pendienteDeFecha = modoReporte === 'tiempo-real' ? !consulta.desde : (!desdeHora || !hastaHora);

  // "23/11/2026" para el contador del día que se está leyendo.
  const fechaLecturaTexto = useMemo(() => {
    const [anio, mes, dia] = String(consulta?.fecha || '').split('-');
    return dia && mes && anio ? `${dia}/${mes}/${anio}` : 'Hoy';
  }, [consulta?.fecha]);

  const textoActualizacion = modoReporte === 'tiempo-real'
    ? 'se actualiza solo cada minuto'
    : 'se actualiza al cambiar el rango o con Actualizar';

  // Horario efectivo de cada fila del período: el rango elegido se recorta
  // al día de la fila (el primer día arranca en "desde" y el último termina
  // en "hasta"; los días intermedios van completos).
  const horarioPeriodo = useMemo(() => {
    const desde = String(consulta?.desde || '');
    const hasta = String(consulta?.hasta || '');
    if (!desde || !hasta) return () => '';
    const diaDesde = desde.slice(0, 10);
    const diaHasta = hasta.slice(0, 10);
    const horaDesde = desde.slice(11, 16);
    const horaHasta = hasta.slice(11, 16);
    return (periodo) => {
      const p = String(periodo || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p)) return '';
      return `${p === diaDesde ? horaDesde : '00:00'} – ${p === diaHasta ? horaHasta : '23:59'}`;
    };
  }, [consulta?.desde, consulta?.hasta]);

  useEffect(() => {
    if (!empresaId || pendienteDeFecha) {
      // Nunca dejar "Calculando..." colgado (ver FleetEventsSummary).
      setEstado((prev) => (prev === 'cargando' ? 'inactivo' : prev));
      return undefined;
    }
    let cancelado = false;
    setEstado('cargando');
    setError(null);
    // Un rango nuevo invalida el resumen anterior de IA.
    setResumenIA(null);
    setResumenError(null);
    obtenerActividadFlota(empresaId, {
      desde: consulta.desde,
      hasta: consulta.hasta,
      placa: placa || null,
      agrupar: consulta.agrupar,
    })
      .then((resultado) => {
        if (cancelado) return;
        // Horas totales de prendido = ralentí + viaje (pedido por el
        // Ing. Carlos Perez). La RPC ya garantiza encendido = viaje + ralentí,
        // pero lo derivamos explícito para mostrarlo como columna propia.
        setFilas(resultado.map((f) => ({
          ...f,
          prendido_segundos: Number(f.viaje_segundos || 0) + Number(f.ralenti_segundos || 0),
        })));
        setEstado(resultado.length ? 'ok' : 'vacio');
        setRangoTexto(consulta.texto);
        // Hora de generación del reporte (pedido por el Ing. Carlos Perez).
        setGeneradoEn(new Date());
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
  }, [empresaId, consulta, placa, pendienteDeFecha, intento]);

  const filasFiltradas = useMemo(
    () => filtrarFilasPorPlaca(filas, placasFiltro, (fila) => fila?.placa),
    [filas, placasFiltro],
  );

  const periodoPlaceholder = useMemo(() => consulta?.texto || null, [consulta]);

  const filasConSinTelemetria = useMemo(() => completarUnidadesReporte(
    filasFiltradas,
    filtrarFilasPorPlaca(unidades, placasFiltro),
    periodoPlaceholder,
  ), [filasFiltradas, unidades, placasFiltro, periodoPlaceholder]);

  // Orden por columna (los encabezados son botones).
  const filasOrdenadas = useMemo(() => {
    const { campo, dir } = orden;
    const col = COLUMNAS.find((c) => c.id === campo);
    const signo = dir === 'asc' ? 1 : -1;
    return [...filasConSinTelemetria].sort((a, b) => {
      if (campo === 'placa' || campo === 'area' || campo === 'unidad' || campo === 'periodo') {
        const valor = (f) => campo === 'area' ? codigoArea(f.unidad, f.placa) : f[campo];
        const av = String(valor(a) ?? '');
        const bv = String(valor(b) ?? '');
        return av.localeCompare(bv, 'es') * signo;
      }
      if (col?.numerica) return (Number(a[campo] || 0) - Number(b[campo] || 0)) * signo;
      return 0;
    });
  }, [filasConSinTelemetria, orden]);

  // Tabla limitada a 15 filas; el pie y el Excel usan el total completo.
  const { filasVistas: filasTabla, expandido, alternar, total } = useLimiteFilas(filasOrdenadas);

  const totales = useMemo(() => {
    const sum = (campo) => filasConSinTelemetria.reduce((s, f) => s + Number(f[campo] || 0), 0);
    return {
      medidos: filasConSinTelemetria.filter((f) => !f.sin_datos_rango).length,
      km: sum('km_recorridos'),
      prendido: sum('prendido_segundos'),
      viaje: sum('viaje_segundos'),
      ralenti: sum('ralenti_segundos'),
      alertas: sum('alertas'),
    };
  }, [filasConSinTelemetria]);

  const alternarOrden = (campo) =>
    setOrden((prev) => (prev.campo === campo ? { campo, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { campo, dir: 'desc' }));

  const cargando = estado === 'cargando';
  const hayTabla = (estado === 'ok' || estado === 'vacio') && filasConSinTelemetria.length > 0;
  const puedeExportar = (estado === 'ok' || estado === 'vacio') && filasOrdenadas.length > 0;

  // El XLSX se importa bajo demanda: la librería xlsx pesa ~430 kB y solo se
  // necesita cuando el usuario pide el archivo.
  const descargarExcel = async () => {
    setDescargaError(null);
    try {
      const { exportarActividadExcel } = await import('../../../lib/exportExcel');
      exportarActividadExcel(filasOrdenadas, { modo: 'libre', rangoTexto, placa });
    } catch (e) {
      setDescargaError(e?.message || 'No se pudo generar el archivo de Excel.');
    }
  };

  // Resumen ejecutivo con IA sobre las filas ya agregadas por SQL.
  // Va por /api/analizar-imagen en modo texto (mismo endpoint del diagnóstico):
  // el plan Hobby de Vercel no admite más de 12 funciones serverless.
  const generarResumen = async () => {
    setResumenCargando(true);
    setResumenError(null);
    try {
      const { resumen, detalleEnviado, totalFilas } = await generarResumenFlota({
        empresa: empresaNombre,
        rango: rangoTexto,
        agrupacion: 'Desde / hasta',
        filas,
      });
      setResumenIA({ texto: resumen, detalleEnviado, totalFilas });
    } catch (e) {
      setResumenError(e?.message || 'No se pudo generar el resumen con IA.');
    } finally {
      setResumenCargando(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm min-w-0">
      <div className="p-4 sm:p-5 border-b border-slate-50 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <FileChartColumn size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">Reporte de actividad</h2>
            <p className="text-xs text-slate-500">
              {modoReporte === 'tiempo-real'
                ? 'Recorrido, horas prendido, hora de viaje y ralentí por unidad del día en curso.'
                : 'Recorrido, horas prendido, hora de viaje y ralentí por unidad dentro del rango elegido.'}
            </p>
            {generadoEn ? (
              <p className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  title="Reloj de Perú. No indica la antigüedad del dato: para eso mira «leído hace instantes»"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                  Hora Perú <RelojEnVivo />
                </span>
                <span>
                  Generado: {generadoEn.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
                  {modoReporte === 'tiempo-real' ? ` · Día en lectura: ${fechaLecturaTexto}` : ''}
                  {' · '}{textoActualizacion}
                </span>
              </p>
            ) : null}
          </div>
          {avisoFueraDePeriodo ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800" role="status">
              <AlertTriangle size={12} /> {avisoFueraDePeriodo}
            </span>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            {fuente === 'real' && rangoTexto ? (
              <span className="hidden lg:inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Database size={12} /> Datos reales: {rangoTexto}
              </span>
            ) : null}
            <BotonActualizarAhora onClick={() => setIntento((n) => n + 1)} disabled={cargando || pendienteDeFecha} cargando={cargando} />
            <button
              type="button"
              onClick={generarResumen}
              disabled={!puedeExportar || resumenCargando}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {resumenCargando ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {resumenCargando ? 'Generando…' : 'Resumen IA'}
            </button>
            <button
              type="button"
              onClick={descargarExcel}
              disabled={!puedeExportar}
              className="inline-flex items-center gap-1.5 rounded-lg border border-forest bg-forest px-2.5 py-1.5 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <FileSpreadsheet size={13} /> Descargar Excel
            </button>
          </div>
        </div>
        {descargaError ? <p className="text-[10px] text-red-600">{descargaError}</p> : null}

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-slate-50 p-0.5" role="group" aria-label="Modo del reporte">
            <button
              type="button"
              onClick={() => setModoReporte('tiempo-real')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                modoReporte === 'tiempo-real' ? 'bg-forest text-white' : 'text-slate-500 hover:text-forest'
              }`}
              title="Última posición de cada unidad, tal como la envía Zonar"
            >
              <Radio size={13} className={modoReporte === 'tiempo-real' ? 'animate-pulse' : ''} /> Tiempo real (Zonar)
            </button>
            <button
              type="button"
              onClick={() => setModoReporte('historico')}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                modoReporte === 'historico' ? 'bg-forest text-white' : 'text-slate-500 hover:text-forest'
              }`}
            >
              Histórico por rango
            </button>
          </div>
          {modoReporte === 'tiempo-real' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
              {generadoEn ? 'Consulta actualizada · ver hora de generación' : 'Esperando primera lectura'}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {modoReporte !== 'tiempo-real' ? (
            <>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Atajos</p>
                <div className="flex gap-1.5">
                  {[
                    { id: 'hoy', label: 'Hoy' },
                    { id: 'ayer', label: 'Ayer' },
                    { id: 'semana', label: 'Esta semana' },
                    { id: 'semana-anterior', label: 'Semana anterior' },
                  ].map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        const r = rangoRapido(a.id);
                        if (!r) return;
                        setDesdeHora(r.desde);
                        setHastaHora(r.hasta);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-slate-200 bg-white text-slate-600 hover:border-forest hover:text-forest transition-colors"
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Desde</span>
                <input
                  type="datetime-local"
                  step="60"
                  value={desdeHora}
                  onChange={(e) => setDesdeHora(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Hasta</span>
                <input
                  type="datetime-local"
                  step="60"
                  value={hastaHora}
                  onChange={(e) => setHastaHora(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
            </>
          ) : null}

          <ControlesFiltroUnidadGrupo
            mostrar={mostrar}
            setMostrar={setMostrar}
            opcionFiltro={opcionFiltro}
            setOpcionFiltro={setOpcionFiltro}
            unidades={unidades}
            opcionesGrupos={opcionesGrupos}
            gruposInfo={gruposInfo}
          />
        </div>
      </div>

      {pendienteDeFecha ? (
        <div className="p-8 flex flex-col items-center gap-2 text-slate-400">
          <CalendarClock size={18} />
          <p className="text-xs text-center leading-relaxed max-w-md">
            'Esperando el periodo cargado para precargar el selector…'</p>
        </div>
      ) : null}

      {!pendienteDeFecha && cargando ? (
        <div className="p-8 flex flex-col items-center gap-2 text-slate-500">
          <Loader2 size={18} className="animate-spin" />
          <p className="text-xs">Calculando el reporte en la base de datos…</p>
        </div>
      ) : null}

      {!pendienteDeFecha && estado === 'error' ? (
        <div className="p-8 text-center">
          <div className="mx-auto w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <AlertTriangle size={17} />
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-700">No se pudo cargar el reporte</p>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">{error}</p>
          <button
            type="button"
            onClick={() => setIntento((n) => n + 1)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-forest hover:text-forest transition-colors"
          >
            <RotateCw size={12} /> Reintentar
          </button>
        </div>
      ) : null}

      {!pendienteDeFecha && estado === 'vacio' && !hayTabla ? (
        <div className="p-8 text-center">
          <p className="text-sm font-semibold text-slate-600">Sin datos para ese rango</p>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            No hay filas en agrotrack_posiciones para {rangoTexto || 'el rango elegido'}
            {placa ? ` y la unidad ${placa}` : ''}. Prueba con otro rango o con “Todas las unidades”.
          </p>
        </div>
      ) : null}

      {!pendienteDeFecha && hayTabla ? (
        <>
          <div className="max-h-[65vh] overflow-auto">
            <table className="w-full text-xs text-slate-700">
              <thead className="sticky top-0 z-10 bg-white shadow-sm">
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                  {COLUMNAS.map((col) => (
                    <th key={col.id} className={`px-3 py-2.5 font-bold ${col.numerica ? 'text-right' : 'text-left'}`}>
                      <button
                        type="button"
                        onClick={() => alternarOrden(col.id)}
                        className={`inline-flex items-center gap-1 hover:text-forest transition-colors ${
                          orden.campo === col.id ? 'text-forest' : ''
                        }`}
                      >
                        {col.label}
                        <ArrowUpDown size={10} className={orden.campo === col.id ? 'opacity-100' : 'opacity-40'} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filasTabla.map((fila, i) => (
                  <tr key={`${fila.placa}-${fila.periodo || 'total'}-${i}`} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="px-3 py-2">
                      <span className="font-bold text-slate-800">{fila.placa}</span>
                      {fila.sin_datos_rango ? <span className="block text-[10px] text-amber-700">Sin datos en el rango · horas no disponibles</span> : null}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{codigoArea(fila.unidad, fila.placa) || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-semibold text-slate-600">
                      {etiquetaPeriodoReporte(fila, 'libre')}
                      {modoReporte !== 'tiempo-real' && horarioPeriodo(fila.periodo) ? (
                        <span className="block text-[10px] font-normal text-slate-400">{horarioPeriodo(fila.periodo)}</span>
                      ) : null}
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold tabular-nums ${recorridoEsCero(fila) ? 'bg-red-100 text-red-800' : ''}`} title={fila.sin_datos_rango ? 'No hay datos en el rango' : recorridoEsCero(fila) ? 'Recorrido medido igual a cero' : undefined}>{fila.sin_datos_rango || fila.km_recorridos == null || String(fila.km_recorridos).trim() === '' ? '—' : numero(fila.km_recorridos, 1)}</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-800">{fila.sin_datos_rango ? '—' : formatearDuracion(fila.prendido_segundos)}</td>
                    <td className="px-3 py-2 text-right">{fila.sin_datos_rango ? '—' : formatearDuracion(fila.viaje_segundos)}</td>
                    <td className="px-3 py-2 text-right">{fila.sin_datos_rango ? '—' : formatearDuracion(fila.ralenti_segundos)}</td>
                    <td className="px-3 py-2 text-right">{fila.vel_max_kmh == null ? '—' : `${numero(fila.vel_max_kmh, 0)} km/h`}</td>
                    <td className="px-3 py-2 text-right">
                      {fila.sin_datos_rango ? '—' : Number(fila.alertas) > 0 ? (
                        <span className="font-bold text-red-600">{fila.alertas}</span>
                      ) : (
                        <span className="text-slate-300">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 text-slate-700 font-bold">
                  <td className="px-3 py-2.5" colSpan={3}>
                    Totales de {filasConSinTelemetria.length} fila{filasConSinTelemetria.length === 1 ? '' : 's'}
                  </td>
                  <td className="px-3 py-2.5 text-right">{numero(totales.km, 1)}</td>
                  <td className="px-3 py-2.5 text-right">{totales.medidos ? formatearDuracion(totales.prendido) : '—'}</td>
                  <td className="px-3 py-2.5 text-right">{totales.medidos ? formatearDuracion(totales.viaje) : '—'}</td>
                  <td className="px-3 py-2.5 text-right">{totales.medidos ? formatearDuracion(totales.ralenti) : '—'}</td>
                  <td className="px-3 py-2.5 text-right">—</td>
                  <td className="px-3 py-2.5 text-right">{totales.medidos ? totales.alertas : '—'}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <BotonVerMas expandido={expandido} onAlternar={alternar} total={total} />
          <p className="px-4 py-2 text-[11px] text-slate-500"><span className="rounded bg-red-100 px-1.5 py-0.5 font-semibold text-red-800">Rojo: recorrido medido = 0 km</span> · Sin datos se muestra como «—». Un recorrido cero no demuestra que la máquina no haya trabajado.</p>

          {filasConSinTelemetria.length >= LIMITE_FILAS_ACTIVIDAD ? (
            <p className="px-4 py-2 text-[10px] text-amber-600 border-t border-slate-50">
              Se alcanzó el tope de {LIMITE_FILAS_ACTIVIDAD} filas (límite de PostgREST). Reduce el rango o prueba con un día específico.
            </p>
          ) : null}

          {resumenError ? (
            <div className="px-4 py-3 border-t border-slate-50 flex items-start gap-2 text-xs text-red-600">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <p>No se pudo generar el resumen con IA: {resumenError}</p>
            </div>
          ) : null}

          {resumenIA ? (
            <div className="border-t border-slate-100 bg-slate-50/70 p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-emerald-600" />
                <p className="text-xs font-bold text-slate-700">Resumen con IA del reporte</p>
                {resumenIA.modelo ? (
                  <span className="ml-auto text-[10px] text-slate-400 font-mono">{resumenIA.modelo}</span>
                ) : null}
              </div>
              <div className="space-y-1 text-xs text-slate-600 leading-relaxed">
                {resumenIA.texto
                  .split('\n')
                  .map((linea) => linea.trim())
                  .filter(Boolean)
                  .map((linea, i) => (
                    <p key={i} className={/^(•|-|\*|\d+[.)])/.test(linea) ? 'pl-3' : ''}>
                      {linea}
                    </p>
                  ))}
              </div>
              <p className="mt-2 text-[10px] text-slate-400">
                Generado con las cifras del reporte
                {resumenIA.totalFilas && resumenIA.detalleEnviado < resumenIA.totalFilas
                  ? ` (detalle de ${resumenIA.detalleEnviado} de ${resumenIA.totalFilas} filas; totales y tops siempre completos)`
                  : ''}
                ; no sustituye la revisión del responsable de flota.
              </p>
            </div>
          ) : null}
        </>
      ) : null}

      <p className="px-4 py-2.5 text-[10px] text-slate-400 border-t border-slate-50 leading-relaxed">
        {fuente === 'real' ? (
          <span className="inline-flex items-center gap-1">
            <Database size={10} /> Cálculo en SQL sobre public.agrotrack_posiciones (agrotrack_actividad_flota).
          </span>
        ) : (
          'Aún no hay datos reales para esta empresa.'
        )}
        <span className="block mt-0.5">
          Criterio único: viaje &gt; 5 km/h · ralentí ≤ 5 km/h · encendido = viaje + ralentí · tramos ≤ 10 minutos · hora de Perú.
        </span>
      </p>
    </div>
  );
}
