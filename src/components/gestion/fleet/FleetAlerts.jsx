import React, { useState } from 'react';
import { Bell, Check, AlertTriangle } from 'lucide-react';
import { SEVERITY_META } from './fleetTokens';

export default function FleetAlerts({ alerts = [], vehicles = [], onAck }) {
  const [filtro, setFiltro] = useState('pendientes');
  const pendientes = alerts.filter((a) => !a.atendida).length;
  const visibles = filtro === 'pendientes' ? alerts.filter((a) => !a.atendida) : alerts;
  const placa = (id) => {
    const v = vehicles.find((item) => item.id === id);
    return v ? v.placa : id;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col min-w-0 h-full">
      <div className="p-4 sm:p-5 border-b border-slate-50">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <Bell size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">Alertas de operación</h2>
            <p className="text-xs text-slate-500">{pendientes} pendientes de revisión</p>
          </div>
          <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">{pendientes}</span>
        </div>
        <div className="mt-3 flex gap-1.5">
          {[
            { id: 'pendientes', label: 'Pendientes' },
            { id: 'todas', label: 'Todas' },
          ].map((f) => (
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
      </div>

      <div className="flex-1 overflow-y-auto max-h-[560px] divide-y divide-slate-50">
        {visibles.map((alert) => {
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
        })}
        {visibles.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-slate-600">Sin alertas pendientes</p>
            <p className="text-xs text-slate-400 mt-1">La operación está al día.</p>
          </div>
        ) : null}
      </div>

      <p className="px-4 py-2.5 text-[10px] text-slate-400 border-t border-slate-50">
        Eventos simulados preparados para la tabla agrotrack_alertas.
      </p>
    </div>
  );
}
