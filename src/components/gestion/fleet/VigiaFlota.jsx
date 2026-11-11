import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, AlertTriangle, RotateCw, ShieldCheck, CheckCircle, Clock } from 'lucide-react';
import { useAgentes } from '../../../lib/AgentContext';
import { obtenerActividadFlota, formatearRango } from '../../../lib/agrotrackFlota';
import { evaluarReglasVigia } from '../../../lib/vigiaFlota';

/**
 * Agente "Vigía de flota" (FASE 3.4).
 *
 * Al entrar a la consola (y cada 30 minutos mientras esté abierta) consulta el
 * reporte agregado del periodo cargado, aplica las reglas de vigiaFlota.js y
 * comparte los hallazgos con el resto de agentes a través de AgentContext
 * (se ven en AgentStatus). NO descarga posiciones: una sola RPC por revisión.
 */
const INTERVALO_REVISION_MS = 30 * 60 * 1000;

const NIVEL_META = {
  alto: { chip: 'bg-red-100 text-red-700 border-red-200', punto: 'bg-red-500' },
  medio: { chip: 'bg-orange-100 text-orange-700 border-orange-200', punto: 'bg-orange-500' },
  bajo: { chip: 'bg-yellow-100 text-yellow-700 border-yellow-200', punto: 'bg-yellow-500' },
};

function hora(iso) {
  try {
    return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function VigiaFlota({ empresaId, periodo = null, fuente = 'real' }) {
  const { reportarVigiaFlota } = useAgentes();
  const [estado, setEstado] = useState('inactivo'); // inactivo | cargando | ok | vacio | error
  const [hallazgos, setHallazgos] = useState([]);
  const [error, setError] = useState(null);
  const [rangoTexto, setRangoTexto] = useState('');
  const [unidades, setUnidades] = useState(0);
  const [ultimaRevision, setUltimaRevision] = useState(null);
  const [intento, setIntento] = useState(0);

  const conPeriodo = Boolean(empresaId && periodo?.desde);

  const revisar = useCallback(async () => {
    if (!empresaId) {
      setEstado('inactivo');
      return;
    }
    if (!periodo?.desde) {
      setEstado('vacio');
      setHallazgos([]);
      return;
    }
    setEstado('cargando');
    setError(null);
    try {
      const filas = await obtenerActividadFlota(empresaId, {
        desde: periodo.desde,
        hasta: periodo.hasta,
        agrupar: 'unidad',
      });
      const textoRango = formatearRango(periodo.desde, periodo.hasta);
      const encontrados = evaluarReglasVigia(filas, { rangoTexto: textoRango });
      setHallazgos(encontrados);
      setRangoTexto(textoRango);
      setUnidades(filas.length);
      setEstado('ok');
      setUltimaRevision(new Date().toISOString());
      reportarVigiaFlota(encontrados, { rangoTexto: textoRango, unidades: filas.length });
    } catch (e) {
      setHallazgos([]);
      setError(e?.message || 'No se pudo revisar el reporte de actividad.');
      setEstado('error');
    }
  }, [empresaId, periodo?.desde, periodo?.hasta, reportarVigiaFlota]);

  // Revisión automática al entrar y cada 30 minutos mientras la consola esté abierta.
  useEffect(() => {
    revisar();
    if (!conPeriodo) return undefined;
    const timer = setInterval(() => setIntento((n) => n + 1), INTERVALO_REVISION_MS);
    return () => clearInterval(timer);
  }, [revisar, conPeriodo, intento]);

  if (estado === 'inactivo') return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm min-w-0">
      <div className="p-4 sm:p-5 border-b border-slate-50 flex flex-wrap items-center gap-3">
        <span className="w-9 h-9 rounded-xl bg-forest/10 text-forest flex items-center justify-center">
          <ShieldCheck size={17} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900">Vigía de flota</h2>
          <p className="text-xs text-slate-500">
            Agente que revisa el reporte de actividad automáticamente y avisa al resto de agentes.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {ultimaRevision ? (
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
              <Clock size={11} /> Última revisión {hora(ultimaRevision)} · cada 30 min
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setIntento((n) => n + 1)}
            disabled={estado === 'cargando'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-forest hover:text-forest disabled:opacity-40 transition-colors"
          >
            <RotateCw size={12} className={estado === 'cargando' ? 'animate-spin' : ''} />
            Revisar ahora
          </button>
        </div>
      </div>

      {estado === 'cargando' ? (
        <div className="p-6 flex flex-col items-center gap-2 text-slate-500">
          <Loader2 size={18} className="animate-spin" />
          <p className="text-xs">Revisando el reporte de actividad del periodo…</p>
        </div>
      ) : null}

      {estado === 'error' ? (
        <div className="p-6 text-center">
          <div className="mx-auto w-9 h-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
            <AlertTriangle size={17} />
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-700">No se pudo revisar el periodo</p>
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

      {estado === 'vacio' ? (
        <div className="p-6 text-center">
          <p className="text-sm font-semibold text-slate-600">Sin periodo cargado</p>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-md mx-auto">
            {fuente === 'real'
              ? 'Esta empresa todavía no tiene filas en agrotrack_posiciones, así que el vigía no hay nada que revisar.'
              : 'El vigía solo opera con datos reales de agrotrack_posiciones; hoy la consola está en modo demostración.'}
          </p>
        </div>
      ) : null}

      {estado === 'ok' ? (
        <div className="p-4 sm:p-5 space-y-3">
          <p className="text-[11px] text-slate-400">
            Revisado sobre {unidades} unidad(es) · {rangoTexto || 'periodo cargado'} ·{' '}
            {hallazgos.length} hallazgo{hallazgos.length === 1 ? '' : 's'}.
          </p>

          {hallazgos.length ? (
            <ul className="space-y-2">
              {hallazgos.map((h) => {
                const meta = NIVEL_META[h.nivel] || NIVEL_META.bajo;
                return (
                  <li key={h.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                    <div className="flex items-start gap-2">
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${meta.punto}`} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-bold text-slate-800">{h.titulo}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.chip}`}>
                            {h.nivel}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{h.detalle}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 flex items-start gap-2">
              <CheckCircle size={16} className="text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-emerald-800">Sin hallazgos en este periodo</p>
                <p className="text-[11px] text-emerald-700 mt-1 leading-relaxed">
                  Ninguna unidad superó los umbrales del vigía (ralentí ≥ 30 % del encendido, velocidad máxima ≥ 90 km/h,
                  3 o más alertas, sin encender o recorrido atípico).
                </p>
              </div>
            </div>
          )}

          <p className="text-[10px] text-slate-400 border-t border-slate-100 pt-3 leading-relaxed">
            Los hallazgos se comparten con el resto de agentes (Agentes sincronizados). Los umbrales están en
            src/lib/vigiaFlota.js; el criterio de viaje/ralentí/encendido vive en scripts/agrotrack-reportes-flota.sql.
          </p>
        </div>
      ) : null}
    </div>
  );
}
