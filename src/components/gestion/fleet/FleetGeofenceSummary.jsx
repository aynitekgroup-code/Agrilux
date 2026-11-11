import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, AlertTriangle, RotateCw, Database, MapPinned, ArrowRight } from 'lucide-react';
import { obtenerEventosGeocerca, obtenerLotesFlota, LIMITE_LOTES } from '../../../lib/agrotrackReportesGeocerca';
import { formatearDuracion } from '../../../lib/agrotrackFlota';

/**
 * Bloque compacto de geocercas para la Consola principal (FASE 3.5): los KPIs
 * de los dos reportes (entradas, salidas, lotes con actividad y tiempo total
 * en lotes) + los 3 lotes que más tiempo pasaron, con enlace al reporte
 * completo. Mismo cálculo en SQL que la pestaña «Geocercas»; aquí solo se
 * muestran las cifras ya agregadas por la RPC (nunca se bajan posiciones).
 */
const TOP = 3;

function numero(valor, decimales = 0) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('es-PE', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

function Kpi({ etiqueta, valor, detalle, tono }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{etiqueta}</p>
      <p className={`mt-1 text-lg font-bold leading-tight ${tono}`}>{valor}</p>
      {detalle ? <p className="text-[10px] text-slate-400 mt-0.5 truncate">{detalle}</p> : null}
    </div>
  );
}

export default function FleetGeofenceSummary({ empresaId, periodo = null, fuente = 'real', onVerReporte }) {
  const [estado, setEstado] = useState('inactivo');
  const [eventos, setEventos] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [error, setError] = useState(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!empresaId || !periodo?.desde) return undefined;
    let cancelado = false;
    setEstado('cargando');
    setError(null);
    Promise.all([
      obtenerEventosGeocerca(empresaId, {
        desde: periodo.desde,
        hasta: periodo.hasta,
        agrupar: 'geocerca',
      }),
      obtenerLotesFlota(empresaId, { desde: periodo.desde, hasta: periodo.hasta, limite: LIMITE_LOTES }),
    ])
      .then(([ev, lo]) => {
        if (cancelado) return;
        setEventos(ev);
        setLotes(lo);
        setEstado(ev.length || lo.length ? 'ok' : 'vacio');
      })
      .catch((e) => {
        if (cancelado) return;
        setEventos([]);
        setLotes([]);
        setError(e?.message || 'No se pudieron cargar los reportes de geocercas.');
        setEstado('error');
      });
    return () => {
      cancelado = true;
    };
  }, [empresaId, periodo?.desde, periodo?.hasta, intento]);

  const resumen = useMemo(() => {
    const entradas = eventos.reduce((s, f) => s + Number(f.entradas || 0), 0);
    const salidas = eventos.reduce((s, f) => s + Number(f.salidas || 0), 0);
    const segundos = lotes.reduce((s, f) => s + Number(f.permanencia_segundos || 0), 0);
    const km = lotes.reduce((s, f) => s + Number(f.km_recorridos || 0), 0);
    return { entradas, salidas, segundos, km, geocercas: eventos.length, top: lotes.slice(0, TOP) };
  }, [eventos, lotes]);

  const sinPeriodo = !periodo?.desde;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm min-w-0">
      <div className="p-4 sm:p-5 border-b border-slate-50 flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <MapPinned size={17} />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900">Geocercas (resumen)</h2>
          <p className="text-xs text-slate-500">
            Entradas y salidas de los eventos de Zonar + tiempo dentro de cada lote, del periodo cargado.
          </p>
        </div>
        <button
          type="button"
          onClick={onVerReporte}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
        >
          Ver reporte completo <ArrowRight size={13} />
        </button>
      </div>

      {sinPeriodo ? (
        <div className="p-8 text-center">
          <p className="text-sm font-semibold text-slate-600">Sin periodo cargado</p>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-md mx-auto">
            Esta empresa todavía no tiene filas en agrotrack_posiciones, así que no hay entradas, salidas ni tiempo en
            lotes que mostrar.
          </p>
        </div>
      ) : null}

      {!sinPeriodo && estado === 'cargando' ? (
        <div className="p-8 flex flex-col items-center gap-2 text-slate-500">
          <Loader2 size={18} className="animate-spin" />
          <p className="text-xs">Calculando entradas, salidas y tiempo en lotes…</p>
        </div>
      ) : null}

      {!sinPeriodo && estado === 'error' ? (
        <div className="p-8 text-center">
          <div className="mx-auto w-9 h-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
            <AlertTriangle size={17} />
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-700">No se pudo cargar el resumen de geocercas</p>
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

      {!sinPeriodo && estado === 'vacio' ? (
        <div className="p-8 text-center">
          <p className="text-sm font-semibold text-slate-600">Sin actividad de geocercas en el periodo</p>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            No hay eventos de geocerca ni posiciones dentro de los polígonos de agrotrack_geocercas en{' '}
            {periodo?.desde ? 'el periodo cargado' : 'ese rango'}.
          </p>
        </div>
      ) : null}

      {!sinPeriodo && estado === 'ok' ? (
        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <Kpi
              etiqueta="Entradas"
              valor={numero(resumen.entradas)}
              detalle={`${resumen.geocercas} geocercas con eventos`}
              tono="text-emerald-700"
            />
            <Kpi etiqueta="Salidas" valor={numero(resumen.salidas)} detalle="Eventos de Zonar" tono="text-slate-700" />
            <Kpi
              etiqueta="Lotes con actividad"
              valor={numero(lotes.length)}
              detalle={`de ${lotes.length >= LIMITE_LOTES ? `${LIMITE_LOTES}+` : lotes.length} con posiciones dentro`}
              tono="text-sky-700"
            />
            <Kpi
              etiqueta="Tiempo en lotes"
              valor={formatearDuracion(resumen.segundos)}
              detalle={`${numero(resumen.km, 1)} km recorridos dentro`}
              tono="text-amber-700"
            />
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
              Lotes con más tiempo en el periodo
            </p>
            {resumen.top.length ? (
              <ul className="space-y-1.5">
                {resumen.top.map((lote) => (
                  <li
                    key={lote.geocerca_id}
                    className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-slate-800 truncate">{lote.lote}</span>
                      <span className="block text-[10px] text-slate-400 truncate">
                        {lote.division || 'Sin división'} · {numero(lote.visitas, 0)} visita
                        {Number(lote.visitas) === 1 ? '' : 's'} · {numero(lote.km_recorridos, 1)} km
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-bold text-emerald-700">
                      {formatearDuracion(lote.permanencia_segundos)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400">Ningún lote tuvo posiciones dentro de su polígono.</p>
            )}
          </div>
        </div>
      ) : null}

      <p className="px-4 py-2.5 text-[10px] text-slate-400 border-t border-slate-50 leading-relaxed">
        {fuente === 'real' ? (
          <span className="inline-flex items-center gap-1">
            <Database size={10} /> Cálculo en SQL con PostGIS (agrotrack_eventos_geocerca_flota + agrotrack_lotes_flota)
            sobre el periodo cargado.
          </span>
        ) : (
          'Aún no hay datos reales para esta empresa.'
        )}
        <span className="block mt-0.5">
          Los lotes se listan solo si hubo al menos una posición dentro del polígono · hora de Perú.
        </span>
      </p>
    </div>
  );
}
