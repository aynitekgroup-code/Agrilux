import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Database,
  FileSpreadsheet,
  Loader2,
  LogIn,
  LogOut,
  MapPinned,
  Save,
  Sparkles,
} from 'lucide-react';
import {
  obtenerEventosGeocerca,
  obtenerLotesFlota,
  obtenerVisitasGeocerca,
  guardarRespaldoVisitas,
  LIMITE_EVENTOS_GEOCERCA,
  LIMITE_LOTES,
  LIMITE_VISITAS_GEOCERCA,
} from '../../../lib/agrotrackReportesGeocerca';
import {
  formatearDuracion,
  formatearFechaHora,
  etiquetaPeriodoReporte,
  ultimoDiaLima,
} from '../../../lib/agrotrackFlota';
import { useRango, ControlesRango, CuerpoEstado, numero } from './reportesComunes';
import { armarContextoReporte } from '../../../lib/reportesIa';
import { llamarIaGestion } from '../../../lib/agrotrackIa';

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
  const { rango, setRango, dia, setDia, mes, setMes, desdeHora, setDesdeHora, hastaHora, setHastaHora, consulta, pendienteDeFecha } = useRango(periodo);
  const [agrupar, setAgrupar] = useState('geocerca');
  const [estado, setEstado] = useState('inactivo');
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState(null);
  const [rangoTexto, setRangoTexto] = useState('');
  const [intento, setIntento] = useState(0);
  const [descargaError, setDescargaError] = useState(null);

  useEffect(() => {
    if (!empresaId || pendienteDeFecha) {
      // Nunca dejar "Calculando..." colgado (ver FleetEventsSummary).
      setEstado((prev) => (prev === 'cargando' ? 'inactivo' : prev));
      return undefined;
    }
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
          <ControlesRango rango={rango} setRango={setRango} dia={dia} setDia={setDia} mes={mes} setMes={setMes} desdeHora={desdeHora} setDesdeHora={setDesdeHora} hastaHora={hastaHora} setHastaHora={setHastaHora} />
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
function CardLotes({ empresaId, periodo, fuente, vehicles = [] }) {
  const { rango, setRango, dia, setDia, mes, setMes, desdeHora, setDesdeHora, hastaHora, setHastaHora, consulta, pendienteDeFecha } = useRango(periodo);
  const [placa, setPlaca] = useState('');
  const [horaDesde, setHoraDesde] = useState('');
  const [horaHasta, setHoraHasta] = useState('');
  const [estado, setEstado] = useState('inactivo');
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState(null);
  const [rangoTexto, setRangoTexto] = useState('');
  const [intento, setIntento] = useState(0);
  const [descargaError, setDescargaError] = useState(null);

  // Unidades reales para el selector (si no hay datos, no hay qué elegir).
  const unidades = useMemo(
    () => vehicles.map((v) => ({ placa: v.placa, descripcion: v.descripcion || '' })),
    [vehicles]
  );

  useEffect(() => {
    if (!empresaId || pendienteDeFecha) {
      // Nunca dejar "Calculando..." colgado (ver FleetEventsSummary).
      setEstado((prev) => (prev === 'cargando' ? 'inactivo' : prev));
      return undefined;
    }
    let cancelado = false;
    setEstado('cargando');
    setError(null);
    obtenerLotesFlota(empresaId, {
      desde: consulta.desde,
      hasta: consulta.hasta,
      placa,
      horaDesde,
      horaHasta,
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
  }, [empresaId, consulta, placa, horaDesde, horaHasta, pendienteDeFecha, intento]);

  const totales = useMemo(() => {
    const sum = (campo) => filas.reduce((s, f) => s + Number(f[campo] || 0), 0);
    return {
      visitas: sum('visitas'),
      permanencia: sum('permanencia_segundos'),
      apagado: sum('apagado_segundos'),
      ralenti: sum('ralenti_segundos'),
      viaje: sum('viaje_segundos'),
      km: sum('km_recorridos'),
      puntos: sum('puntos'),
    };
  }, [filas]);

  const puedeExportar = estado === 'ok' && filas.length > 0;
  // Si la RPC en Supabase todavía no tiene las columnas del desglose (script
  // sin actualizar), se muestran «—» con un aviso en vez de un 0 engañoso.
  const conDesglose = filas.some((f) => f.apagado_segundos != null || f.ralenti_segundos != null || f.viaje_segundos != null);
  const mensajePendiente =
    rango === 'todo' && !periodo?.desde
      ? 'Esta empresa todavía no tiene periodo cargado en agrotrack_posiciones, así que no hay cifras que mostrar.'
      : 'Esperando el periodo cargado para precargar el selector…';

  const descargarExcel = async () => {
    setDescargaError(null);
    try {
      const { exportarLotesExcel } = await import('../../../lib/exportExcel');
      exportarLotesExcel(filas, { rangoTexto, placa, horaDesde, horaHasta });
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

        <div className="flex flex-wrap items-end gap-3">
          <ControlesRango rango={rango} setRango={setRango} dia={dia} setDia={setDia} mes={mes} setMes={setMes} desdeHora={desdeHora} setDesdeHora={setDesdeHora} hastaHora={hastaHora} setHastaHora={setHastaHora} />
          <label className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Máquina</span>
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
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Horas del día</span>
            <div className="flex items-center gap-1.5">
              <input
                type="time"
                value={horaDesde}
                onChange={(e) => setHoraDesde(e.target.value)}
                aria-label="Hora desde"
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
              <span className="text-[10px] text-slate-400">a</span>
              <input
                type="time"
                value={horaHasta}
                onChange={(e) => setHoraHasta(e.target.value)}
                aria-label="Hora hasta"
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
              {horaDesde || horaHasta ? (
                <button
                  type="button"
                  onClick={() => { setHoraDesde(''); setHoraHasta(''); }}
                  className="px-2 py-1.5 rounded-lg text-[10px] font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                  title="Quitar franja horaria"
                >
                  Quitar
                </button>
              ) : null}
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
        mensajeVacio={`Ningún lote tuvo posiciones dentro de su polígono en ${rangoTexto || 'el rango elegido'}${placa ? ` para la unidad ${placa}` : ''}${horaDesde || horaHasta ? ` entre las ${horaDesde || '00:00'} y las ${horaHasta || '23:59'}` : ''}. Prueba con otro día/mes, con “Todo el periodo” o quitando los filtros.`}
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
                    <th className="px-3 py-2.5 font-bold text-right">Apagado</th>
                    <th className="px-3 py-2.5 font-bold text-right">Ralentí</th>
                    <th className="px-3 py-2.5 font-bold text-right">Viajando</th>
                    <th className="px-3 py-2.5 font-bold text-right">Total en geocerca</th>
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
                      <td className="px-3 py-2 text-right text-slate-500">
                        {conDesglose ? formatearDuracion(fila.apagado_segundos) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-amber-700">
                        {conDesglose ? formatearDuracion(fila.ralenti_segundos) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-700">
                        {conDesglose ? formatearDuracion(fila.viaje_segundos) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-slate-800">
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
                    <td className="px-3 py-2.5 text-right text-slate-500">
                      {conDesglose ? formatearDuracion(totales.apagado) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-amber-700">
                      {conDesglose ? formatearDuracion(totales.ralenti) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-emerald-700">
                      {conDesglose ? formatearDuracion(totales.viaje) : '—'}
                    </td>
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
            {!conDesglose ? (
              <p className="px-4 py-2 text-[10px] text-amber-600 border-t border-slate-50">
                El desglose apagado / ralentí / viajando no está disponible todavía: ejecuta la versión
                actualizada de scripts/agrotrack-geocercas-reportes.sql en el SQL Editor de Supabase.
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
          Punto dentro del polígono (ST_Contains) · tramos ≤ 10 min · haversine con salto ≥ 5 km descartado ·
          apagado + ralentí + viajando = total en la geocerca · hora de Perú · orden: más tiempo primero.
        </span>
      </p>
    </div>
  );
}

/** ¿La visita sigue abierta (la unidad aún está dentro de la geocerca)? */
function visitaAbierta(f) {
  if (f.abierta === true || f.abierta === 'true') return true;
  // Compatibilidad: si la RPC vieja no trae la columna `abierta`, se deduce
  // de que no tiene salida.
  if (f.abierta == null) return !f.salida;
  return false;
}

/**
 * Tarjeta 3 (FASE 4): "Visitas (detalle)" — una fila por visita dentro de
 * cada geocerca, al estilo del reporte de visitas de Zonar: entrada, salida
 * (o "En curso"), duración y el desglose apagado / ralentí / viajando, con
 * totales al pie. Incluye el respaldo del rango en la base y la "tabla del
 * día" (resumen por geocerca + detalle) para Excel.
 */
function CardVisitas({ empresaId, periodo, fuente, vehicles = [] }) {
  const { rango, setRango, dia, setDia, mes, setMes, desdeHora, setDesdeHora, hastaHora, setHastaHora, consulta, pendienteDeFecha } = useRango(periodo);
  const [placa, setPlaca] = useState('');
  const [geocerca, setGeocerca] = useState('');
  const [estado, setEstado] = useState('inactivo');
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState(null);
  const [rangoTexto, setRangoTexto] = useState('');
  const [intento, setIntento] = useState(0);
  const [descargaError, setDescargaError] = useState(null);
  // Geocercas vistas en cualquier carga: el selector NO pierde las opciones
  // al filtrar (no hay RPC de listado; se arma con los datos reales).
  const [geocercasVistas, setGeocercasVistas] = useState([]);
  // Respaldo de las visitas del rango (agrotrack_guardar_respaldo_visitas).
  const [guardando, setGuardando] = useState(false);
  const [respaldo, setRespaldo] = useState(null); // { ok, n } | { ok: false, mensaje }
  // Análisis con IA de las visitas ya calculadas en SQL (solo lectura).
  const [explicando, setExplicando] = useState(false);
  const [explicacion, setExplicacion] = useState(null);
  const [errorExplicacion, setErrorExplicacion] = useState(null);

  const unidades = useMemo(
    () => vehicles.map((v) => ({ placa: v.placa, descripcion: v.descripcion || '' })),
    [vehicles]
  );

  useEffect(() => {
    if (!empresaId || pendienteDeFecha) {
      // Nunca dejar "Calculando..." colgado (ver FleetEventsSummary).
      setEstado((prev) => (prev === 'cargando' ? 'inactivo' : prev));
      return undefined;
    }
    let cancelado = false;
    setEstado('cargando');
    setError(null);
    setRespaldo(null);
    obtenerVisitasGeocerca(empresaId, {
      desde: consulta.desde,
      hasta: consulta.hasta,
      placa,
      geocerca,
    })
      .then((resultado) => {
        if (cancelado) return;
        setFilas(resultado);
        setEstado(resultado.length ? 'ok' : 'vacio');
        setRangoTexto(consulta.texto);
        // Acumula las geocercas vistas para que el selector no se vacíe al
        // filtrar (la RPC con p_geocerca solo devuelve esa geocerca).
        setGeocercasVistas((prev) => {
          const conjunto = new Set(prev);
          resultado.forEach((f) => { if (f?.geocerca) conjunto.add(f.geocerca); });
          return [...conjunto].sort((a, b) => String(a).localeCompare(String(b), 'es'));
        });
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
  }, [empresaId, consulta, placa, geocerca, pendienteDeFecha, intento]);

  const totales = useMemo(() => {
    const sum = (campo) => filas.reduce((s, f) => s + Number(f[campo] || 0), 0);
    return {
      duracion: sum('duracion_segundos'),
      apagado: sum('apagado_segundos'),
      ralenti: sum('ralenti_segundos'),
      viaje: sum('viaje_segundos'),
    };
  }, [filas]);

  const abiertas = useMemo(() => filas.filter(visitaAbierta).length, [filas]);

  // Si la RPC todavía no trae el desglose, se muestran «—» con un aviso en
  // vez de un 0 engañoso (mismo criterio que la tarjeta de lotes).
  const conDesglose = filas.some(
    (f) => f.apagado_segundos != null || f.ralenti_segundos != null || f.viaje_segundos != null
  );

  // Último día calendario completo (hora de Perú) presente en las visitas
  // cargadas: es el que exporta "Tabla del día" (más robusto que depender de
  // que el rango elegido coincida exactamente con "ayer").
  const diaExportado = useMemo(() => {
    const hoy = ultimoDiaLima(new Date().toISOString());
    const dias = new Set();
    filas.forEach((f) => {
      const d = ultimoDiaLima(f.entrada);
      if (d && hoy && d < hoy) dias.add(d);
    });
    if (!dias.size) return null;
    return [...dias].sort().pop();
  }, [filas]);

  const ayerLima = useMemo(() => {
    const hoy = ultimoDiaLima(new Date().toISOString());
    if (!hoy) return '';
    const d = new Date(`${hoy}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const diaEsAyer = Boolean(diaExportado && diaExportado === ayerLima);

  const puedeExportar = estado === 'ok' && filas.length > 0;
  const mensajePendiente =
    rango === 'todo' && !periodo?.desde
      ? 'Esta empresa todavía no tiene periodo cargado en agrotrack_posiciones, así que no hay visitas que mostrar.'
      : 'Esperando el periodo cargado para precargar el selector…';

  // El XLSX se importa bajo demanda: la librería pesa ~430 kB y solo se
  // necesita cuando el usuario pide el archivo.
  const descargarExcel = async () => {
    setDescargaError(null);
    try {
      const { exportarVisitasGeocercaExcel } = await import('../../../lib/exportExcelReportes');
      exportarVisitasGeocercaExcel(filas, { rangoTexto, geocerca, placa });
    } catch (e) {
      setDescargaError(e?.message || 'No se pudo generar el archivo de Excel.');
    }
  };

  const descargarTablaDia = async () => {
    setDescargaError(null);
    if (!diaExportado) return;
    try {
      const { exportarTablaDiaExcel } = await import('../../../lib/exportExcelReportes');
      const visitasDelDia = filas.filter((f) => ultimoDiaLima(f.entrada) === diaExportado);
      exportarTablaDiaExcel(visitasDelDia, { dia: diaExportado, rangoTexto, geocerca, placa });
    } catch (e) {
      setDescargaError(e?.message || 'No se pudo generar el archivo de Excel.');
    }
  };

  // Guarda en la base las visitas visibles del rango cargado (las que la RPC
  // devolvió con estos filtros). Si la RPC todavía no existe, el error amable
  // de "ejecuta scripts/agrotrack-geocercas-reportes.sql" se muestra aquí.
  const guardarRespaldo = async () => {
    if (guardando || !filas.length) return;
    setGuardando(true);
    setRespaldo(null);
    setDescargaError(null);
    try {
      const n = await guardarRespaldoVisitas(empresaId, {
        desde: consulta.desde,
        hasta: consulta.hasta,
        filas,
      });
      setRespaldo({ ok: true, n: Number(n) || 0 });
    } catch (e) {
      setRespaldo({ ok: false, mensaje: e?.message || 'No se pudo guardar el respaldo.' });
    } finally {
      setGuardando(false);
    }
  };

  // Análisis con IA de las visitas ya calculadas en SQL: manda solo las filas
  // visibles comprimidas; la IA interpreta (permanencias, anomalías), no
  // recalcula ni vuelve a tocar la base.
  const explicarVisitasIa = async () => {
    if (explicando || !filas.length) return;
    setExplicando(true);
    setErrorExplicacion(null);
    try {
      const enCurso = filas.filter((f) => f.abierta || !f.salida).length;
      const contexto = armarContextoReporte({
        reporte: 'Visitas a geocercas (detalle por visita: entrada, salida, duración y desglose apagado/ralentí/viajando)',
        rango: `${rangoTexto || 'todo el periodo cargado'}${geocerca ? ` · geocerca: ${geocerca}` : ''}${placa ? ` · máquina: ${placa}` : ''}${
          enCurso ? ` · ${enCurso} visita(s) en curso` : ''
        }`,
        columnas: ['Placa', 'Geocerca', 'Entrada', 'Salida', 'Duración', 'Apagado', 'Ralentí', 'Viajando'],
        filas: filas.map((f) => ({
          Placa: f.placa,
          Geocerca: f.geocerca,
          Entrada: f.entrada ? formatearFechaHora(f.entrada) : '—',
          Salida: f.salida ? formatearFechaHora(f.salida) : 'en curso',
          Duración: f.duracion_segundos != null ? formatearDuracion(f.duracion_segundos) : '—',
          Apagado: f.apagado_segundos != null ? formatearDuracion(f.apagado_segundos) : '—',
          Ralentí: f.ralenti_segundos != null ? formatearDuracion(f.ralenti_segundos) : '—',
          Viajando: f.viaje_segundos != null ? formatearDuracion(f.viaje_segundos) : '—',
        })),
        totalFilas: filas.length,
      });
      const data = await llamarIaGestion({ modo: 'reporte', contexto });
      if (!data.texto) throw new Error('La IA no devolvió texto para este reporte.');
      setExplicacion({ texto: data.texto, provider: data.provider });
    } catch (e) {
      setErrorExplicacion(e?.message || 'No se pudo explicar las visitas.');
    } finally {
      setExplicando(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm min-w-0">
      <div className="p-4 sm:p-5 border-b border-slate-50 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <MapPinned size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">Visitas (detalle)</h2>
            <p className="text-xs text-slate-500">
              Una fila por visita dentro de cada geocerca: entrada, salida, duración y el desglose apagado / ralentí / viajando.
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {fuente === 'real' && rangoTexto ? (
              <span className="hidden lg:inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Database size={12} /> Datos reales: {rangoTexto}
              </span>
            ) : null}
            <button
              type="button"
              onClick={guardarRespaldo}
              disabled={!puedeExportar || guardando}
              title="Guarda estas visitas del rango en una tabla de respaldo (auditoría) usando agrotrack_guardar_respaldo_visitas"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-forest hover:text-forest disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {guardando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {guardando ? 'Guardando…' : 'Guardar respaldo del rango'}
            </button>
            <button
              type="button"
              onClick={descargarTablaDia}
              disabled={!diaExportado}
              title={
                diaExportado
                  ? `Exporta a Excel las visitas del ${diaExportado} (resumen por geocerca + detalle)`
                  : 'No hay un día calendario completo con visitas en el rango cargado: amplíalo para poder exportar la tabla de un día'
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-forest hover:text-forest disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <CalendarDays size={13} /> {diaEsAyer ? 'Tabla del día anterior' : 'Tabla del día'}
            </button>
            <button
              type="button"
              onClick={explicarVisitasIa}
              disabled={!puedeExportar || explicando}
              title="Interpretar estas visitas con IA (solo lectura)"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {explicando ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {explicando ? 'Explicando…' : 'Explicar con IA'}
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
        {respaldo ? (
          <p className={`text-[11px] font-semibold ${respaldo.ok ? 'text-emerald-700' : 'text-red-600'}`}>
            {respaldo.ok
              ? `Respaldo guardado: ${respaldo.n} visita${respaldo.n === 1 ? '' : 's'}`
              : respaldo.mensaje}
          </p>
        ) : null}
        {descargaError ? <p className="text-[10px] text-red-600">{descargaError}</p> : null}
        {errorExplicacion ? <p className="text-[10px] text-red-600">{errorExplicacion}</p> : null}
        {explicacion ? (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 mb-1 flex items-center gap-1">
              <Sparkles size={11} /> Análisis de la IA
            </p>
            <div className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-line">{explicacion.texto}</div>
            <p className="mt-2 text-[10px] text-slate-400">
              Interpretación de las {filas.length} visitas visibles ya calculadas en SQL; no sustituye la revisión del responsable de flota.
            </p>
          </div>
        ) : null}
        {estado === 'ok' && !diaExportado ? (
          <p className="text-[10px] text-slate-400 leading-relaxed">
            No hay un día calendario completo con visitas en el rango cargado: amplíalo (por ejemplo a “Todo el periodo”)
            para poder exportar la “Tabla del día anterior”.
          </p>
        ) : null}

        <div className="flex flex-wrap items-end gap-3">
          <ControlesRango rango={rango} setRango={setRango} dia={dia} setDia={setDia} mes={mes} setMes={setMes} desdeHora={desdeHora} setDesdeHora={setDesdeHora} hastaHora={hastaHora} setHastaHora={setHastaHora} />
          <label className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Máquina</span>
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
          {geocercasVistas.length ? (
            <label className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Geocerca</span>
              <select
                value={geocerca}
                onChange={(e) => setGeocerca(e.target.value)}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Todas</option>
                {geocercasVistas.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </label>
          ) : null}
          {geocerca ? (
            <button
              type="button"
              onClick={() => setGeocerca('')}
              className="px-2 py-1.5 rounded-lg text-[10px] font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              title="Quitar el filtro de geocerca"
            >
              Quitar
            </button>
          ) : null}
        </div>
      </div>

      <CuerpoEstado
        pendienteDeFecha={pendienteDeFecha}
        mensajePendiente={mensajePendiente}
        estado={estado}
        error={error}
        onReintentar={() => setIntento((n) => n + 1)}
        mensajeVacio={`No hay visitas en ${rangoTexto || 'el rango elegido'}${geocerca ? ` para la geocerca ${geocerca}` : ''}${placa ? ` de la unidad ${placa}` : ''}. Prueba con otro día/mes, con “Todo el periodo” o quitando los filtros.`}
      >
        {estado === 'ok' ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-slate-700">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2.5 font-bold text-left">Placa</th>
                    <th className="px-3 py-2.5 font-bold text-left">Geocerca</th>
                    <th className="px-3 py-2.5 font-bold text-left">Entrada</th>
                    <th className="px-3 py-2.5 font-bold text-left">Salida</th>
                    <th className="px-3 py-2.5 font-bold text-right">Duración</th>
                    <th className="px-3 py-2.5 font-bold text-right">Apagado</th>
                    <th className="px-3 py-2.5 font-bold text-right">Ralentí</th>
                    <th className="px-3 py-2.5 font-bold text-right">Viajando</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => (
                    <tr key={`${f.placa}-${f.geocerca}-${f.entrada}-${i}`} className="border-b border-slate-50 hover:bg-slate-50/60">
                      <td className="px-3 py-2 whitespace-nowrap font-bold text-slate-800">{f.placa || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{f.geocerca || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                        {f.entrada ? formatearFechaHora(f.entrada) : '—'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {visitaAbierta(f) ? (
                          <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
                            En curso
                          </span>
                        ) : f.salida ? (
                          <span className="text-slate-600">{formatearFechaHora(f.salida)}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                        {f.duracion_segundos == null ? '—' : formatearDuracion(f.duracion_segundos)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-500 whitespace-nowrap">
                        {conDesglose && f.apagado_segundos != null ? formatearDuracion(f.apagado_segundos) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-amber-700 whitespace-nowrap">
                        {conDesglose && f.ralenti_segundos != null ? formatearDuracion(f.ralenti_segundos) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-700 whitespace-nowrap">
                        {conDesglose && f.viaje_segundos != null ? formatearDuracion(f.viaje_segundos) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 text-slate-700 font-bold">
                    <td className="px-3 py-2.5" colSpan={4}>
                      Totales de {filas.length} visita{filas.length === 1 ? '' : 's'}
                      {geocerca ? ` · geocerca ${geocerca}` : ''}{placa ? ` · ${placa}` : ''}
                      {abiertas ? ` · ${abiertas} en curso` : ''}
                    </td>
                    <td className="px-3 py-2.5 text-right">{formatearDuracion(totales.duracion)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-500">
                      {conDesglose ? formatearDuracion(totales.apagado) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-amber-700">
                      {conDesglose ? formatearDuracion(totales.ralenti) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-emerald-700">
                      {conDesglose ? formatearDuracion(totales.viaje) : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {filas.length >= LIMITE_VISITAS_GEOCERCA ? (
              <p className="px-4 py-2 text-[10px] text-amber-600 border-t border-slate-50">
                Se alcanzó el tope de {LIMITE_VISITAS_GEOCERCA} visitas (límite de PostgREST). Reduce el rango o filtra por geocerca.
              </p>
            ) : null}
            {!conDesglose ? (
              <p className="px-4 py-2 text-[10px] text-amber-600 border-t border-slate-50">
                El desglose apagado / ralentí / viajando no está disponible todavía: ejecuta la versión
                actualizada de scripts/agrotrack-geocercas-reportes.sql en el SQL Editor de Supabase.
              </p>
            ) : null}
          </>
        ) : null}
      </CuerpoEstado>

      <p className="px-4 py-2.5 text-[10px] text-slate-400 border-t border-slate-50 leading-relaxed">
        {fuente === 'real' ? (
          <span className="inline-flex items-center gap-1">
            <Database size={10} /> Cálculo en SQL sobre public.agrotrack_posiciones + public.agrotrack_geocercas (agrotrack_visitas_geocerca_flota).
          </span>
        ) : (
          'Aún no hay datos reales para esta empresa.'
        )}
        <span className="block mt-0.5">
          Una fila por visita · apagado + ralentí + viajando = duración · las visitas aún abiertas se marcan “En curso” ·
          “Guardar respaldo del rango” usa agrotrack_guardar_respaldo_visitas · hora de Perú.
        </span>
      </p>
    </div>
  );
}

export default function FleetGeofenceReports({ empresaId, periodo = null, fuente = 'real', vehicles = [] }) {
  return (
    <div className="space-y-4">
      <CardEventos empresaId={empresaId} periodo={periodo} fuente={fuente} />
      <CardLotes empresaId={empresaId} periodo={periodo} fuente={fuente} vehicles={vehicles} />
      <CardVisitas empresaId={empresaId} periodo={periodo} fuente={fuente} vehicles={vehicles} />
    </div>
  );
}
