import React, { useMemo, useState } from 'react';
import { Bell, Check, AlertTriangle, RotateCw, Database, Sparkles, Loader2, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
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
  const [busqueda, setBusqueda] = useState('');

  const pendientes = alerts.filter((a) => !a.atendida).length;
  const visibles = filtro === 'pendientes' ? alerts.filter((a) => !a.atendida) : alerts;

  const placa = (id) => {
    const v = vehicles.find((item) => item.id === id);
    return v ? v.placa : id;
  };

  // Grupos de la vista "agrupadas": primero lo pendiente, y si no hay, todo.
  const grupos = useMemo(() => {
    const base = alerts.filter((a) => !a.atendida);
    return priorizarAlertas(base.length ? base : alerts);
  }, [alerts]);

  // Buscador de alertas: placa, tipo, mensaje, fecha u origen (en
  // "agrupadas" aplica al tipo/mensaje del grupo y a sus placas).
  const busquedaNorm = busqueda.trim().toLowerCase();
  const coincide = (valor) => valor != null && String(valor).toLowerCase().includes(busquedaNorm);
  const visiblesFiltradas = busquedaNorm
    ? visibles.filter((a) =>
        coincide(placa(a.vehiculo_id)) || coincide(a.tipo) || coincide(a.mensaje)
        || coincide(a.fecha) || coincide(a.origen) || coincide(a.severidad))
    : visibles;
  const gruposFiltrados = busquedaNorm
    ? grupos.filter((g) =>
        coincide(g.tipo) || coincide(g.mensaje)
        || g.unidades.some((unidad) => coincide(placa(unidad))))
    : grupos;

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
      <div key={grupo.clave} className="rounded-xl border border-slate-100 bg-white shadow-sm p-3 flex gap-2.5">
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
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <div className="flex gap-1.5 flex-wrap">
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
          <div className="relative ml-auto w-full sm:w-60">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar placa, tipo, mensaje…"
              aria-label="Buscar alerta"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/60 pl-8 pr-7 py-1.5 text-xs text-slate-700 outline-none focus:border-forest focus:bg-white"
            />
            {busqueda ? (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            ) : null}
          </div>
        </div>
        {busqueda.trim() ? (
          <p className="mt-2 text-[10px] font-semibold text-slate-400">
            Mostrando {filtro === 'agrupadas' ? gruposFiltrados.length : visiblesFiltradas.length} de {filtro === 'agrupadas' ? grupos.length : visibles.length} alerta{filtro === 'agrupadas' || visibles.length === 1 ? 's' : 's'}
          </p>
        ) : null}

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

      <div className="flex-1 overflow-y-auto max-h-72 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 content-start p-3">
        {cargando ? (
          <div className="col-span-full space-y-2">
            {[0, 1, 2].map((item) => (
              <div key={item} className="flex gap-2.5 animate-pulse rounded-xl border border-slate-100 p-3">
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
          <div className="col-span-full p-6 text-center">
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
          <div className="md:col-span-2 xl:col-span-3 p-3 bg-slate-50/70 rounded-xl border border-slate-100">
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
          ? gruposFiltrados.map(renderGrupo)
          : null}

        {!cargando && !error && filtro !== 'agrupadas'
          ? visiblesFiltradas.map((alert) => {
          const sev = SEVERITY_META[alert.severidad] || SEVERITY_META.info;
          return (
            <div key={alert.id} className={`rounded-xl border border-slate-100 bg-white shadow-sm p-3 flex gap-2.5 ${alert.atendida ? 'opacity-55' : ''}`}>
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
        {!cargando && !error && filtro !== 'agrupadas' && visiblesFiltradas.length === 0 ? (
          <div className="col-span-full p-6 text-center">
            <p className="text-sm font-semibold text-slate-600">
              {busqueda.trim() ? `Sin resultados para «${busqueda.trim()}»` : 'Sin alertas pendientes'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {busqueda.trim() ? 'Prueba con otra placa, tipo, mensaje o fecha.' : 'La operación está al día.'}
            </p>
          </div>
        ) : null}
        {!cargando && !error && filtro === 'agrupadas' && gruposFiltrados.length === 0 ? (
          <div className="col-span-full p-6 text-center">
            <p className="text-sm font-semibold text-slate-600">
              {busqueda.trim() ? `Sin resultados para «${busqueda.trim()}»` : 'Sin alertas para agrupar'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {busqueda.trim() ? 'Prueba con otra placa o tipo de alerta.' : 'La operación está al día.'}
            </p>
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
