import React from 'react';
import { BarChart3, ClipboardCheck, Users } from 'lucide-react';

export default function PanelGestion({ onParcelas, onCiclo }) {
  return (
    <section className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={17} className="text-slate-700" />
          <h2 className="text-sm font-bold text-slate-800">Panel de gestión</h2>
        </div>
        <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-semibold text-emerald-700">
          Campaña 2025-A
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" onClick={onParcelas} className="rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-emerald-200">
          <Users size={18} className="mb-2 text-slate-600" />
          <p className="text-[10px] text-slate-500">Recursos y equipo</p>
          <p className="mt-1 text-xs font-bold text-slate-800">Centraliza tu operación</p>
          <p className="mt-2 text-[10px] font-semibold text-emerald-700">3 cuadrillas activas ›</p>
        </button>
        <button type="button" onClick={onCiclo} className="rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-blue-200">
          <ClipboardCheck size={18} className="mb-2 text-slate-600" />
          <p className="text-[10px] text-slate-500">Actividades</p>
          <p className="mt-1 text-xs font-bold text-slate-800">Organiza tus tareas</p>
          <p className="mt-2 text-[10px] font-semibold text-blue-700">8 para hoy (2 urgentes) ›</p>
        </button>
      </div>
    </section>
  );
}
