import React, { useState } from 'react';
import { Search, Filter, Power, Truck } from 'lucide-react';
import { STATUS_META } from './fleetTokens';

export function StatusPill({ estado }) {
  const meta = STATUS_META[estado] || STATUS_META.offline;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold whitespace-nowrap" style={{ background: meta.bg, color: meta.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.dot }} />
      {meta.label}
    </span>
  );
}

export default function VehicleList({ vehicles = [], selectedId, onSelect, onCut }) {
  const [query, setQuery] = useState('');
  const [estado, setEstado] = useState('todos');

  const term = query.trim().toLowerCase();
  const filtered = vehicles.filter((v) => {
    const matchesEstado = estado === 'todos' || v.estado === estado;
    const matchesQuery =
      term === '' ||
      String(v.placa || '').toLowerCase().includes(term) ||
      String(v.conductor_nombre || '').toLowerCase().includes(term);
    return matchesEstado && matchesQuery;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-w-0">
      <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Vehículos de la flota</h2>
          <p className="text-xs text-slate-500">{filtered.length} de {vehicles.length} unidades visibles</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 lg:ml-auto w-full lg:w-auto">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por placa o conductor"
              className="w-full sm:w-64 rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-3 py-2 text-sm text-slate-700 outline-none focus:border-forest focus:bg-white"
            />
          </div>
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full sm:w-44 appearance-none rounded-xl border border-slate-200 bg-slate-50/60 pl-8 pr-3 py-2 text-sm text-slate-700 outline-none focus:border-forest"
            >
              <option value="todos">Todos los estados</option>
              <option value="en_ruta">En ruta</option>
              <option value="detenido">Detenido</option>
              <option value="alerta">Alerta</option>
              <option value="offline">Sin conexión</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className="bg-slate-50 text-left">
              {['Placa', 'Modelo', 'Tipo', 'Conductor', 'Estado', 'Última ubicación', 'Última actualización', 'Acciones'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap border-y border-slate-100">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => {
              const isSelected = v.id === selectedId;
              return (
                <tr
                  key={v.id}
                  onClick={onSelect ? () => onSelect(v.id) : undefined}
                  className={`border-b border-slate-50 transition-colors ${onSelect ? 'cursor-pointer' : ''} ${isSelected ? 'bg-emerald-50/50' : 'hover:bg-slate-50/60'}`}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-2 font-bold text-slate-800">
                      <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
                        <Truck size={14} />
                      </span>
                      {v.placa}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{v.modelo}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{v.tipo}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{v.conductor_nombre}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><StatusPill estado={v.estado} /></td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{v.ultima_ubicacion}</td>
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">{v.ultima_actualizacion}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onCut) onCut(v);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-forest hover:text-forest transition-colors"
                    >
                      <Power size={13} /> Inmovilizar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-semibold text-slate-600">Sin resultados</p>
            <p className="text-xs text-slate-400 mt-1">Prueba con otra placa, conductor o estado.</p>
          </div>
        ) : null}
      </div>

      <div className="px-4 py-2.5 text-[11px] text-slate-400 border-t border-slate-50">
        Vista demostrativa. Los estados provienen de datos simulados listos para conectarse a Supabase.
      </div>
    </div>
  );
}
