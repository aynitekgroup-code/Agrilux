import React, { useMemo, useState } from 'react';
import { Bell, Check, AlertTriangle, RotateCw, Database, Sparkles, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { SEVERITY_META } from './fleetTokens';
import {
  priorizarAlertas,
  armarContextoAlertas,
  mapaAccionesPorClave,
  LIMITE_GRUPOS_IA,
} from '../../../lib/priorizarAlertas';
import { llamarIaGestion } from '../../../lib/agrotrackIa';

/**
 * Alertas de operación (FASE: IA en Gestión).
 *
 * La vista "Agrupadas" fusiona las alertas repetidas (28 "Alta velocidad"
 * casi iguales son UN hallazgo) con reglas deterministas y, opcionalmente,
 * le pide a la IA UNA frase de "qué hacer" por grupo. Los números y el
 * orden los calcula el cliente (gratis); la IA solo redacta.
 */
export default function FleetAlerts({
  alerts = [],
  vehicles = [],
  onAck,
  cargando = false,
  error = null,
  fuente = 'demo',
  notaTope = null,
  onReintentar,
  empresaNombre = '',
  rangoTexto = '',
}) {
  const [filtro, setFiltro] = useState('pendientes');
  const [accionesIa, setAccionesIa] = useState({});
  const [resumenIa, setResumenIa] = useState('');
  const [cargandoIa, setCargandoIa] = useState(false);
  const [errorIa, setErrorIa] = useState('');
  const [expandido, setExpandido] = useState('');

  const pendientes = alerts.filter((a) => !a.atendida).length;
  const visibles = filtro === 'pendientes' ? alerts.filter((a) => !a.atendida) : alerts;

  // Grupos de la vista "agrupadas": primero lo pendiente, y si no hay, todo.
  const grupos = useMemo(() => {
    const base = alerts.filter((a) => !a.atendida);
    return priorizarAlertas(base.length ? base : alerts);
  }, [alerts]);

  const placa = (id) => {
    const v = vehicles.find((item) => item.id === id);
    return v ? v.placa : id;
  };

  const priorizarConIa = async () => {
    if (!grupos.length || cargandoIa) return;
    setCargandoIa(true);
    setErrorIa('');
    try {
      const contexto = armarContextoAlertas(grupos.slice(0, LIMITE_GRUPOS_IA), {
        empresa: empresaNombre,
        rango: rangoTexto,
      });
      const data = await llamarIaGestion({ modo: 'alertas', contexto });
      setAccionesIa(mapaAccionesPorClave(data.datos, grupos));
      setResumenIa(data.datos?.resumen || '');
    } catch (e) {
      setErrorIa(e?.message || 'No se pudieron priorizar las alertas.');
    } finally {
      setCargandoIa(false);
    }
  };

  const atenderGrupo = (ids) => {
    if (!onAck) return;
    ids.forEach((id) => onAck(id));
  };

  const renderGrupo = (grupo) => {
    const sev = SEVERITY_META[grupo.severidad] || SEVERITY_META.info;
    const accion = accionesIa[grupo.clave];
    const abierto = expandido === grupo.clave;
    const visiblesUnidades = abierto ? grupo.unidades : grupo.unidades.slice(0, 3);
    const resto = grupo.unidades.length - visiblesUnidades.length;
    // Solo se pueden atender las que siguen pendientes (si el grupo ya está
    // todo atendido no se ofrece el botón, para no prometer lo imposible).
    const atendidas = new Set(alerts.filter((a) => a.atendida).map((a) => a.id));
    const pendientesIds = grupo.ids.filter((id) => !atendidas.has(id));

    return (
      <div key={grupo.clave} className="p-3.5 flex gap-2.5">
        <span className="w-1 rounded-full shrink-0" style={{ background: sev.stripe }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
              style={{ background: sev.bg, color: sev.color }}
            >
              {sev.label}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
              {grupo.total} alerta{grupo.total === 1 ? '' : 's'}
            </span>
            <span className="ml-auto text-[10px] text-slate-400">{grupo.ultimaFecha || 's/f'}</span>
          </div>
          <p className="text-sm font-semibold text-slate-800 mt-1 flex items-center gap-1.5">
            <AlertTriangle size={13} style={{ color: sev.color }} />
            {grupo.tipo}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{grupo.mensaje}</p>
          <p className="text-[11px] text-slate-400 mt-1">
            {grupo.unidades.length} unidad{grupo.unidades.length === 1 ? '' : 'es'}:
            {' '}{visiblesUnidades.map(placa).join(', ')}
            {resto > 0 ? ` +${resto} más` : ''}
            {grupo.unidades.length > 3 ? (
              <button
                type="button"
                onClick={() => setExpandido(abierto ? '' : grupo.clave)}
                className="ml-1.5 inline-flex items-center gap-0.5 text-forest font-semibold hover:underline"
              >
                {abierto ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                {abierto ? 'menos' : 'ver todas'}
              </button>
            ) : null}
          </p>
          {accion ? (
            <p className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50/70 px-2.5 py-1.5 text-[11px] font-medium text-emerald-800">
              ✨ {accion}
            </p>
          ) : null}
          {pendientesIds.length && onAck ? (
            <button
              type="button"
              onClick={() => atenderGrupo(pendientesIds)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-forest hover:text-forest transition-colors"
            >
              <Check size={12} /> Marcar atendidas ({pendientesIds.length})
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  const filtros = [
    { id: 'pendientes', label: 'Pendientes' },
    { id: 'todas', label: 'Todas' },
    { id: 'agrupadas', label: 'Agrupadas' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col min-w-0 h-full">
      <div className="p-4 sm:p-5 border-b border-slate-50">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <Bell size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">Alertas de operación</h2>
            <p className="text-xs text-slate-500">
              {cargando ? 'Cargando…' : `${pendientes} pendientes de revisión`}
            </p>
          </div>
          <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
            {cargando ? '…' : pendientes}
          </span>
        </div>
        <div className="mt-3 flex gap-1.5 flex-wrap">
          {filtros.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                filtro === f.id ? 'bg-forest text-white' : 'bg-slate-50 text-slate-500 hover:text-forest'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filtro === 'agrupadas' && grupos.length ? (
          <button
            type="button"
            onClick={priorizarConIa}
            disabled={cargandoIa}
            className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 transition-colors"
          >
            {cargandoIa ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {cargandoIa
              ? 'Priorizando…'
              : resumenIa
                ? 'Re-priorizar con IA'
                : `✨ Priorizar con IA (${Math.min(grupos.length, LIMITE_GRUPOS_IA)} grupos)`}
          </button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto max-h-[560px] divide-y divide-slate-50">
        {cargando ? (
          <div className="p-4 space-y-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="flex gap-2.5 animate-pulse">
                <span className="w-1 rounded-full bg-slate-100 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 rounded bg-slate-100" />
                  <div className="h-3.5 w-2/3 rounded bg-slate-100" />
                  <div className="h-3 w-1/2 rounded bg-slate-100" />
                </div>
              </div>
            ))}
            <p className="text-center text-[11px] text-slate-400">Cargando alertas…</p>
          </div>
        ) : null}

        {!cargando && error ? (
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-600">No se pudieron cargar las alertas</p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{error}</p>
            {onReintentar ? (
              <button
                type="button"
                onClick={onReintentar}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-forest hover:text-forest transition-colors"
              >
                <RotateCw size={12} /> Reintentar
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Resumen de priorización con IA (solo lectura: no cambia datos). */}
        {!cargando && !error && filtro === 'agrupadas' && (resumenIa || errorIa) ? (
          <div className="p-3.5 bg-slate-50/70">
            {resumenIa ? (
              <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                <Sparkles size={12} className="inline text-emerald-600 mr-1" />
                {resumenIa}
              </p>
            ) : null}
            {errorIa ? <p className="text-[11px] text-red-600 mt-1">{errorIa}</p> : null}
          </div>
        ) : null}

        {!cargando && !error && filtro === 'agrupadas'
          ? grupos.map(renderGrupo)
          : null}

        {!cargando && !error && filtro !== 'agrupadas'
          ? visibles.map((alert) => {
          const sev = SEVERITY_META[alert.severidad] || SEVERITY_META.info;
          return (
            <div key={alert.id} className={`p-3.5 flex gap-2.5 ${alert.atendida ? 'opacity-55' : ''}`}>
              <span className="w-1 rounded-full shrink-0" style={{ background: sev.stripe }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: sev.bg, color: sev.color }}>
                    {sev.label}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">{alert.fecha}</span>
                  <span className="ml-auto text-[10px] text-slate-400">{alert.origen}</span>
                </div>
                <p className="text-sm font-semibold text-slate-800 mt-1 flex items-center gap-1.5">
                  <AlertTriangle size={13} style={{ color: sev.color }} />
                  {alert.tipo}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{placa(alert.vehiculo_id)} · {alert.mensaje}</p>
                {!alert.atendida && onAck ? (
                  <button
                    type="button"
                    onClick={() => onAck(alert.id)}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-forest hover:text-forest transition-colors"
                  >
                    <Check size={12} /> Marcar atendida
                  </button>
                ) : null}
              </div>
            </div>
          );
        })
          : null}
        {!cargando && !error && filtro !== 'agrupadas' && visibles.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-slate-600">Sin alertas pendientes</p>
            <p className="text-xs text-slate-400 mt-1">La operación está al día.</p>
          </div>
        ) : null}
        {!cargando && !error && filtro === 'agrupadas' && grupos.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-slate-600">Sin alertas para agrupar</p>
            <p className="text-xs text-slate-400 mt-1">La operación está al día.</p>
          </div>
        ) : null}
      </div>

      <p className="px-4 py-2.5 text-[10px] text-slate-400 border-t border-slate-50">
        {fuente === 'real' ? (
          <span className="inline-flex items-center gap-1">
            <Database size={10} /> Eventos reales de agrotrack_posiciones (Alta velocidad / Botón de pánico).
          </span>
        ) : (
          'Eventos simulados preparados para la tabla agrotrack_alertas.'
        )}
        <span className="block mt-0.5">
          La agrupación y el orden se calculan en tu navegador (gratis); la IA solo redacta la acción de cada grupo.
        </span>
        {notaTope ? <span className="block mt-0.5 text-amber-600">{notaTope}</span> : null}
      </p>
    </div>
  );
}
