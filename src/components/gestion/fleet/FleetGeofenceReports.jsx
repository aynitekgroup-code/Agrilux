import React, { useEffect, useMemo, useState } from 'react';
import {
  Database,
  FileSpreadsheet,
  LogIn,
  LogOut,
} from 'lucide-react';
import {
  obtenerEventosGeocerca,
  obtenerLotesFlota,
  LIMITE_EVENTOS_GEOCERCA,
  LIMITE_LOTES,
} from '../../../lib/agrotrackReportesGeocerca';
import {
  formatearDuracion,
  formatearFechaHora,
  etiquetaPeriodoReporte,
} from '../../../lib/agrotrackFlota';
import { useRango, ControlesRango, CuerpoEstado, numero } from './reportesComunes';

/**
 * Reportes de geocercas (FASE 3.5): los dos reportes pedidos por el Ing.
 * Carlos Perez, calculados en SQL (RPC) sobre public.agrotrack_posiciones y
 * public.agrotrack_geocercas:
 *   1) Entradas y salidas: los eventos de Zonar ("Entrada a Geocerca" /
 *      "Salida de Geocerca") agrupados por geocerca, por día o por mes.
 *   2) Tiempo en cada lote: punto dentro del polígono con PostGIS.
 * Nada se descarga al navegador: PostgREST corta en 1000 filas y el cruce son
 * +100 mil posiciones x 129 polígonos.
 */

const AGRUPACIONES = [
  { id: 'geocerca', label: 'Por geocerca' },
  { id: 'dia', label: 'Por día' },
  { id: 'mes', label: 'Por mes' },
];

/** Tarjeta 1: entradas y salidas de geocerca (eventos de Zonar). */
function CardEventos({ empresaId, periodo, fuente }) {
  const { rango, setRango, dia, setDia, mes, setMes, consulta, pendienteDeFecha } = useRango(periodo);
  const [agrupar, setAgrupar] = useState('geocerca');
  const [estado, setEstado] = useState('inactivo');
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState(null);
  const [rangoTexto, setRangoTexto] = useState('');
  const [intento, setIntento] = useState(0);
  const [descargaError, setDescargaError] = useState(null);

  useEffect(() => {
    if (!empresaId || pendienteDeFecha) return undefined;
    let cancelado = false;
    setEstado('cargando');
    setError(null);
    obtenerEventosGeocerca(empresaId, {
      desde: consulta.desde,
      hasta: consulta.hasta,
      agrupar,
    })
      .then((resultado) => {
        if (cancelado) return;
        setFilas(resultado);
        setEstado(resultado.length ? 'ok' : 'vacio');
        setRangoTexto(consulta.texto);
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
  }, [empresaId, consulta, agrupar, pendienteDeFecha, intento]);

  const totales = useMemo(() => {
    const sum = (campo) => filas.reduce((s, f) => s + Number(f[campo] || 0), 0);
    return { entradas: sum('entradas'), salidas: sum('salidas') };
  }, [filas]);

  const puedeExportar = estado === 'ok' && filas.length > 0;
  const mensajePendiente =
    rango === 'todo' && !periodo?.desde
      ? 'Esta empresa todavía no tiene periodo cargado en agrotrack_posiciones, así que no hay cifras que mostrar.'
      : 'Esperando el periodo cargado para precargar el selector…';

  // El XLSX se importa bajo demanda: la librería pesa ~430 kB y solo se
  // necesita cuando el usuario pide el archivo.
  const descargarExcel = async () => {
    setDescargaError(null);
    try {
      const { exportarEventosGeocercaExcel } = await import('../../../lib/exportExcel');
      exportarEventosGeocercaExcel(filas, { agrupar, rangoTexto });
    } catch (e) {
      setDescargaError(e?.message || 'No se pudo generar el archivo de Excel.');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm min-w-0">
      <div className="p-4 sm:p-5 border-b border-slate-50 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <LogIn size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">Entradas y salidas de geocerca</h2>
            <p className="text-xs text-slate-500">
              Eventos de Zonar por geocerca, por día o por mes: entradas, salidas y unidades que entraron.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {fuente === 'real' && rangoTexto ? (
              <span className="hidden lg:inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Database size={12} /> Datos reales: {rangoTexto}
              </span>
            ) : null}
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
          <ControlesRango rango={rango} setRango={setRango} dia={dia} setDia={setDia} mes={mes} setMes={setMes} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Agrupación</p>
            <div className="flex gap-1.5">
              {AGRUPACIONES.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAgrupar(a.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                    agrupar === a.id ? 'bg-forest text-white' : 'bg-slate-50 text-slate-500 hover:text-forest'
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <CuerpoEstado
        pendienteDeFecha={pendienteDeFecha}
        mensajePendiente={mensajePendiente}
        estado={estado}
        error={error}
        onReintentar={() => setIntento((n) => n + 1)}
        mensajeVacio={`No hay eventos de geocerca en ${rangoTexto || 'el rango elegido'}. Prueba con otro día/mes o con “Todo el periodo”.`}
      >
        {estado === 'ok' ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-slate-700">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2.5 font-bold text-left">
                      {agrupar === 'geocerca' ? 'Geocerca' : 'Período'}
                    </th>
                    <th className="px-3 py-2.5 font-bold text-right">Entradas</th>
                    <th className="px-3 py-2.5 font-bold text-right">Salidas</th>
                    <th className="px-3 py-2.5 font-bold text-right">Unidades</th>
                    <th className="px-3 py-2.5 font-bold text-right">Última entrada</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((fila, i) => (
                    <tr key={`${fila.grupo}-${i}`} className="border-b border-slate-50 hover:bg-slate-50/60">
                      <td className="px-3 py-2 font-semibold text-slate-800">
                        {etiquetaPeriodoReporte({ periodo: fila.grupo }, agrupar)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <LogIn size={11} className="opacity-60" />
                          {numero(fila.entradas, 0)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-600">
                          <LogOut size={11} className="opacity-60" />
                          {numero(fila.salidas, 0)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">{numero(fila.unidades, 0)}</td>
                      <td className="px-3 py-2 text-right text-slate-500">
                        {fila.ultima_entrada ? formatearFechaHora(fila.ultima_entrada) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 text-slate-700 font-bold">
                    <td className="px-3 py-2.5">Totales de {filas.length} fila{filas.length === 1 ? '' : 's'}</td>
                    <td className="px-3 py-2.5 text-right text-emerald-700">{numero(totales.entradas, 0)}</td>
                    <td className="px-3 py-2.5 text-right">{numero(totales.salidas, 0)}</td>
                    <td className="px-3 py-2.5 text-right" colSpan={2}>
                      Unidades no sumables (una placa puede estar en varios grupos)
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {filas.length >= LIMITE_EVENTOS_GEOCERCA ? (
              <p className="px-4 py-2 text-[10px] text-amber-600 border-t border-slate-50">
                Se alcanzó el tope de {LIMITE_EVENTOS_GEOCERCA} filas (límite de PostgREST). Agrupa por día o por mes.
              </p>
            ) : null}
          </>
        ) : null}
      </CuerpoEstado>

      <p className="px-4 py-2.5 text-[10px] text-slate-400 border-t border-slate-50 leading-relaxed">
        {fuente === 'real' ? (
          <span className="inline-flex items-center gap-1">
            <Database size={10} /> Cálculo en SQL sobre public.agrotrack_posiciones (agrotrack_eventos_geocerca_flota).
          </span>
        ) : (
          'Aún no hay datos reales para esta empresa.'
        )}
        <span className="block mt-0.5">
          Eventos de Zonar con pt_referencia (nombre de la geocerca) · salidas pueden no cuadrar con entradas · hora de Perú.
        </span>
      </p>
    </div>
  );
}

/** Tarjeta 2: tiempo dentro de cada lote (punto dentro del polígono, PostGIS). */
function CardLotes({ empresaId, periodo, fuente }) {
  const { rango, setRango, dia, setDia, mes, setMes, consulta, pendienteDeFecha } = useRango(periodo);
  const [estado, setEstado] = useState('inactivo');
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState(null);
  const [rangoTexto, setRangoTexto] = useState('');
  const [intento, setIntento] = useState(0);
  const [descargaError, setDescargaError] = useState(null);

  useEffect(() => {
    if (!empresaId || pendienteDeFecha) return undefined;
    let cancelado = false;
    setEstado('cargando');
    setError(null);
    obtenerLotesFlota(empresaId, { desde: consulta.desde, hasta: consulta.hasta })
      .then((resultado) => {
        if (cancelado) return;
        setFilas(resultado);
        setEstado(resultado.length ? 'ok' : 'vacio');
        setRangoTexto(consulta.texto);
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
  }, [empresaId, consulta, pendienteDeFecha, intento]);

  const totales = useMemo(() => {
    const sum = (campo) => filas.reduce((s, f) => s + Number(f[campo] || 0), 0);
    return {
      visitas: sum('visitas'),
      permanencia: sum('permanencia_segundos'),
      km: sum('km_recorridos'),
      puntos: sum('puntos'),
    };
  }, [filas]);

  const puedeExportar = estado === 'ok' && filas.length > 0;
  const mensajePendiente =
    rango === 'todo' && !periodo?.desde
      ? 'Esta empresa todavía no tiene periodo cargado en agrotrack_posiciones, así que no hay cifras que mostrar.'
      : 'Esperando el periodo cargado para precargar el selector…';

  const descargarExcel = async () => {
    setDescargaError(null);
    try {
      const { exportarLotesExcel } = await import('../../../lib/exportExcel');
      exportarLotesExcel(filas, { rangoTexto });
    } catch (e) {
      setDescargaError(e?.message || 'No se pudo generar el archivo de Excel.');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm min-w-0">
      <div className="p-4 sm:p-5 border-b border-slate-50 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <LogOut size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">Tiempo en cada lote</h2>
            <p className="text-xs text-slate-500">
              Permanencia, visitas y recorrido dentro de cada polígono (PostGIS), por lote con actividad.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {fuente === 'real' && rangoTexto ? (
              <span className="hidden lg:inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Database size={12} /> Datos reales: {rangoTexto}
              </span>
            ) : null}
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

        <ControlesRango rango={rango} setRango={setRango} dia={dia} setDia={setDia} mes={mes} setMes={setMes} />
      </div>

      <CuerpoEstado
        pendienteDeFecha={pendienteDeFecha}
        mensajePendiente={mensajePendiente}
        estado={estado}
        error={error}
        onReintentar={() => setIntento((n) => n + 1)}
        mensajeVacio={`Ningún lote tuvo posiciones dentro de su polígono en ${rangoTexto || 'el rango elegido'}. Prueba con otro día/mes o con “Todo el periodo”.`}
      >
        {estado === 'ok' ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-slate-700">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2.5 font-bold text-left">Lote</th>
                    <th className="px-3 py-2.5 font-bold text-left">División</th>
                    <th className="px-3 py-2.5 font-bold text-right">Unidades</th>
                    <th className="px-3 py-2.5 font-bold text-right">Visitas</th>
                    <th className="px-3 py-2.5 font-bold text-right">Permanencia</th>
                    <th className="px-3 py-2.5 font-bold text-right">Recorrido (km)</th>
                    <th className="px-3 py-2.5 font-bold text-right">Puntos</th>
                    <th className="px-3 py-2.5 font-bold text-right">Vel. máx.</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((fila) => (
                    <tr key={fila.geocerca_id} className="border-b border-slate-50 hover:bg-slate-50/60">
                      <td className="px-3 py-2">
                        <span className="font-bold text-slate-800">{fila.lote}</span>
                        {fila.anexo ? (
                          <span className="block text-[10px] text-slate-400">Anexo {fila.anexo}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-slate-500">{fila.division || '—'}</td>
                      <td className="px-3 py-2 text-right">{numero(fila.unidades, 0)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{numero(fila.visitas, 0)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                        {formatearDuracion(fila.permanencia_segundos)}
                      </td>
                      <td className="px-3 py-2 text-right">{numero(fila.km_recorridos, 1)}</td>
                      <td className="px-3 py-2 text-right text-slate-500">{numero(fila.puntos, 0)}</td>
                      <td className="px-3 py-2 text-right">
                        {fila.vel_max_kmh == null ? '—' : `${numero(fila.vel_max_kmh, 0)} km/h`}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 text-slate-700 font-bold">
                    <td className="px-3 py-2.5" colSpan={3}>
                      Totales de {filas.length} lote{filas.length === 1 ? '' : 's'} con actividad
                    </td>
                    <td className="px-3 py-2.5 text-right">{numero(totales.visitas, 0)}</td>
                    <td className="px-3 py-2.5 text-right">{formatearDuracion(totales.permanencia)}</td>
                    <td className="px-3 py-2.5 text-right">{numero(totales.km, 1)}</td>
                    <td className="px-3 py-2.5 text-right">{numero(totales.puntos, 0)}</td>
                    <td className="px-3 py-2.5 text-right">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {filas.length >= LIMITE_LOTES ? (
              <p className="px-4 py-2 text-[10px] text-amber-600 border-t border-slate-50">
                Se alcanzó el tope de {LIMITE_LOTES} lotes (límite de PostgREST). Reduce el rango.
              </p>
            ) : null}
          </>
        ) : null}
      </CuerpoEstado>

      <p className="px-4 py-2.5 text-[10px] text-slate-400 border-t border-slate-50 leading-relaxed">
        {fuente === 'real' ? (
          <span className="inline-flex items-center gap-1">
            <Database size={10} /> Cálculo en SQL con PostGIS sobre public.agrotrack_geocercas + public.agrotrack_posiciones (agrotrack_lotes_flota).
          </span>
        ) : (
          'Aún no hay datos reales para esta empresa.'
        )}
        <span className="block mt-0.5">
          Punto dentro del polígono (ST_Contains) · tramos ≤ 10 min · haversine con salto ≥ 5 km descartado · hora de Perú · orden: más tiempo primero.
        </span>
      </p>
    </div>
  );
}

export default function FleetGeofenceReports({ empresaId, periodo = null, fuente = 'real' }) {
  return (
    <div className="space-y-4">
      <CardEventos empresaId={empresaId} periodo={periodo} fuente={fuente} />
      <CardLotes empresaId={empresaId} periodo={periodo} fuente={fuente} />
    </div>
  );
}
