import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, AlertTriangle, RotateCw, Database, FileChartColumn, ArrowUpDown, CalendarClock, FileSpreadsheet, Sparkles } from 'lucide-react';
import {
  obtenerActividadFlota,
  rangoDiaLima,
  rangoMesLima,
  rangoLibreLima,
  formatearDuracion,
  formatearRango,
  etiquetaPeriodoReporte,
  ultimoDiaLima,
  LIMITE_FILAS_ACTIVIDAD,
} from '../../../lib/agrotrackFlota';
import { generarResumenFlota } from '../../../lib/agrotrackInsights';
import { useLimiteFilas, BotonVerMas } from './reportesComunes';

/**
 * Reporte de actividad de flota (FASE 3).
 * Réplica de lo pedido por Zonar: por día y por mes, con recorrido, encendido,
 * hora de viaje y ralentí por separado. Todo sale de una RPC (SQL), nunca de
 * 103 mil filas descargadas al navegador.
 */
const MODOS = [
  { id: 'dia', label: 'Por día' },
  { id: 'mes', label: 'Por mes' },
  { id: 'total', label: 'Todo el periodo' },
  { id: 'libre', label: 'Desde / hasta' },
];

const COLUMNAS = [
  { id: 'periodo', label: 'Período', numerica: false },
  { id: 'unidad', label: 'Unidad', numerica: false },
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
  const [modo, setModo] = useState('dia');
  const [dia, setDia] = useState('');
  const [mes, setMes] = useState('');
  // Rango libre con fecha Y hora (pedido por el Ing. Carlos Perez): dos
  // buscadores datetime-local en hora de Perú.
  const [desdeHora, setDesdeHora] = useState('');
  const [hastaHora, setHastaHora] = useState('');
  const [placa, setPlaca] = useState('');
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
  const [orden, setOrden] = useState({ campo: 'unidad', dir: 'asc' });

  // Precarga con el último día (o mes) que trae datos reales.
  useEffect(() => {
    if (!periodo?.hasta) return;
    const ultimo = ultimoDiaLima(periodo.hasta);
    if (!ultimo) return;
    setDia((prev) => prev || ultimo);
    setMes((prev) => prev || ultimo.slice(0, 7));
    setDesdeHora((prev) => prev || `${ultimo}T00:00`);
    setHastaHora((prev) => prev || `${ultimo}T23:59`);
  }, [periodo?.hasta]);

  // Unidades reales para el selector (si no hay datos, no hay qué elegir).
  const unidades = useMemo(
    () => vehicles.map((v) => ({ placa: v.placa, descripcion: v.descripcion || '' })),
    [vehicles]
  );

  const consulta = useMemo(() => {
    if (modo === 'dia') return { ...rangoDiaLima(dia), agrupar: 'dia', texto: dia };
    if (modo === 'mes') return { ...rangoMesLima(mes), agrupar: 'mes', texto: mes };
    if (modo === 'libre') {
      // Rango libre con hora: se agrupa por día dentro de ese rango exacto.
      const { desde, hasta, texto } = rangoLibreLima(desdeHora, hastaHora);
      return { desde, hasta, agrupar: 'dia', texto };
    }
    return {
      desde: periodo?.desde || null,
      hasta: periodo?.hasta || null,
      agrupar: 'unidad',
      texto: periodo?.desde ? formatearRango(periodo.desde, periodo.hasta) : '',
    };
  }, [modo, dia, mes, desdeHora, hastaHora, periodo]);

  const pendienteDeFecha = (modo === 'dia' && !dia) || (modo === 'mes' && !mes)
    || (modo === 'libre' && (!desdeHora || !hastaHora))
    || (modo === 'total' && !periodo?.desde);

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

  // Orden por columna (los encabezados son botones).
  const filasOrdenadas = useMemo(() => {
    const { campo, dir } = orden;
    const col = COLUMNAS.find((c) => c.id === campo);
    const signo = dir === 'asc' ? 1 : -1;
    return [...filas].sort((a, b) => {
      if (campo === 'placa' || campo === 'unidad' || campo === 'periodo') {
        const av = String(a[campo] ?? a.unidad ?? '');
        const bv = String(b[campo] ?? b.unidad ?? '');
        return av.localeCompare(bv, 'es') * signo;
      }
      if (col?.numerica) return (Number(a[campo] || 0) - Number(b[campo] || 0)) * signo;
      return 0;
    });
  }, [filas, orden]);

  // Tabla limitada a 15 filas; el pie y el Excel usan el total completo.
  const { filasVistas: filasTabla, expandido, alternar, total } = useLimiteFilas(filasOrdenadas);

  const totales = useMemo(() => {
    const sum = (campo) => filas.reduce((s, f) => s + Number(f[campo] || 0), 0);
    return {
      km: sum('km_recorridos'),
      prendido: sum('prendido_segundos'),
      viaje: sum('viaje_segundos'),
      ralenti: sum('ralenti_segundos'),
      alertas: sum('alertas'),
    };
  }, [filas]);

  const alternarOrden = (campo) =>
    setOrden((prev) => (prev.campo === campo ? { campo, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { campo, dir: 'desc' }));

  const cargando = estado === 'cargando';
  const puedeExportar = estado === 'ok' && filas.length > 0;

  // El XLSX se importa bajo demanda: la librería xlsx pesa ~430 kB y solo se
  // necesita cuando el usuario pide el archivo.
  const descargarExcel = async () => {
    setDescargaError(null);
    try {
      const { exportarActividadExcel } = await import('../../../lib/exportExcel');
      exportarActividadExcel(filas, { modo, rangoTexto, placa });
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
        agrupacion: MODOS.find((m) => m.id === modo)?.label || modo,
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
              Recorrido, horas prendido, hora de viaje y ralentí por unidad, por día o por mes.
            </p>
            {generadoEn ? (
              <p className="text-[11px] text-slate-400 mt-0.5">
                Generado: {generadoEn.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            ) : null}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {fuente === 'real' && rangoTexto ? (
              <span className="hidden lg:inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Database size={12} /> Datos reales: {rangoTexto}
              </span>
            ) : null}
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-forest hover:text-forest disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <FileSpreadsheet size={13} /> Descargar Excel
            </button>
          </div>
        </div>
        {descargaError ? <p className="text-[10px] text-red-600">{descargaError}</p> : null}

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Agrupación</p>
            <div className="flex gap-1.5">
              {MODOS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setModo(m.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                    modo === m.id ? 'bg-forest text-white' : 'bg-slate-50 text-slate-500 hover:text-forest'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {modo === 'dia' ? (
            <label className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Día</span>
              <input
                type="date"
                value={dia}
                onChange={(e) => setDia(e.target.value)}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          ) : null}

          {modo === 'mes' ? (
            <label className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Mes</span>
              <input
                type="month"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          ) : null}

          {modo === 'libre' ? (
            <>
              <label className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Desde · hora de Perú</span>
                <input
                  type="datetime-local"
                  value={desdeHora}
                  onChange={(e) => setDesdeHora(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="min-w-0">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Hasta · hora de Perú</span>
                <input
                  type="datetime-local"
                  value={hastaHora}
                  onChange={(e) => setHastaHora(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
            </>
          ) : null}

          <label className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Unidad</span>
            <select
              value={placa}
              onChange={(e) => setPlaca(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">Todas las unidades</option>
              {unidades.map((u) => (
                <option key={u.placa} value={u.placa}>
                  {u.descripcion ? `${u.placa} · ${u.descripcion}` : u.placa}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {pendienteDeFecha ? (
        <div className="p-8 flex flex-col items-center gap-2 text-slate-400">
          <CalendarClock size={18} />
          <p className="text-xs text-center leading-relaxed max-w-md">
            {modo === 'total'
              ? 'Esta empresa todavía no tiene periodo cargado en agrotrack_posiciones, así que no hay totales que mostrar.'
              : 'Esperando el periodo cargado para precargar el selector…'}
          </p>
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
          <div className="mx-auto w-9 h-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
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

      {!pendienteDeFecha && estado === 'vacio' ? (
        <div className="p-8 text-center">
          <p className="text-sm font-semibold text-slate-600">Sin datos para ese rango</p>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            No hay filas en agrotrack_posiciones para {rangoTexto || 'el rango elegido'}
            {placa ? ` y la unidad ${placa}` : ''}. Prueba con otro día/mes o con “Todas las unidades”.
          </p>
        </div>
      ) : null}

      {!pendienteDeFecha && estado === 'ok' ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-slate-700">
              <thead>
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
                    <td className="px-3 py-2 whitespace-nowrap font-semibold text-slate-600">{etiquetaPeriodoReporte(fila, modo)}</td>
                    <td className="px-3 py-2">
                      <span className="font-bold text-slate-800">{fila.placa}</span>
                      {fila.unidad && fila.unidad !== fila.placa ? (
                        <span className="block text-[10px] text-slate-400 truncate max-w-[240px]">{fila.unidad}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">{numero(fila.km_recorridos, 1)}</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-800">{formatearDuracion(fila.prendido_segundos)}</td>
                    <td className="px-3 py-2 text-right">{formatearDuracion(fila.viaje_segundos)}</td>
                    <td className="px-3 py-2 text-right">{formatearDuracion(fila.ralenti_segundos)}</td>
                    <td className="px-3 py-2 text-right">{numero(fila.vel_max_kmh, 0)} km/h</td>
                    <td className="px-3 py-2 text-right">
                      {Number(fila.alertas) > 0 ? (
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
                  <td className="px-3 py-2.5" colSpan={2}>
                    Totales de {filas.length} fila{filas.length === 1 ? '' : 's'}
                  </td>
                  <td className="px-3 py-2.5 text-right">{numero(totales.km, 1)}</td>
                  <td className="px-3 py-2.5 text-right">{formatearDuracion(totales.prendido)}</td>
                  <td className="px-3 py-2.5 text-right">{formatearDuracion(totales.viaje)}</td>
                  <td className="px-3 py-2.5 text-right">{formatearDuracion(totales.ralenti)}</td>
                  <td className="px-3 py-2.5 text-right">—</td>
                  <td className="px-3 py-2.5 text-right">{totales.alertas}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <BotonVerMas expandido={expandido} onAlternar={alternar} total={total} />

          {filas.length >= LIMITE_FILAS_ACTIVIDAD ? (
            <p className="px-4 py-2 text-[10px] text-amber-600 border-t border-slate-50">
              Se alcanzó el tope de {LIMITE_FILAS_ACTIVIDAD} filas (límite de PostgREST). Reduce el rango o agrupa por mes.
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
