import React from 'react';
import { Beaker, CalendarCheck, ChevronRight, Leaf, Package, Plus, Tractor } from 'lucide-react';

const acciones = [
  { titulo: 'Mis parcelas', descripcion: 'Consulta tus cultivos, lotes y condiciones de campo.', icon: Leaf, color: 'bg-emerald-100 text-emerald-700', ruta: '/parcela' },
  { titulo: 'Planificar ciclo', descripcion: 'Organiza las actividades de tu campaña agrícola.', icon: CalendarCheck, color: 'bg-blue-100 text-blue-700', ruta: '/ciclo' },
  { titulo: 'Gestión de Riego & IoT', descripcion: 'Monitoreo de sectores, electroválvulas y m³.', icon: Beaker, color: 'bg-cyan-100 text-cyan-700', estado: 'En turno' },
  { titulo: 'Maquinaria y Equipos', descripcion: 'Tractores, bombas, horómetro y mantenimientos.', icon: Tractor, color: 'bg-orange-100 text-orange-700' },
  { titulo: 'Inventario de Insumos', descripcion: 'Fertilizantes, agroquímicos, kardex y stock.', icon: Package, color: 'bg-violet-100 text-violet-700', estado: '1 crítico' },
];

export default function AccesosGestion({ onNavigate }) {
  return (
    <>
      <section>
        <h2 className="mb-3 text-sm font-bold text-slate-900">Accesos rápidos</h2>
        <div className="space-y-2.5">
          {acciones.map(({ titulo, descripcion, icon: Icon, color, ruta, estado }) => (
            <button key={titulo} type="button" onClick={() => onNavigate(ruta)} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-emerald-200">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}><Icon size={21} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-bold text-slate-800">{titulo}</p>
                  {estado && <span className={`shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold ${estado === '1 crítico' ? 'bg-red-100 text-red-600' : 'bg-cyan-100 text-cyan-700'}`}>{estado}</span>}
                </div>
                <p className="mt-0.5 truncate text-[10px] text-slate-500">{descripcion}</p>
              </div>
              <ChevronRight size={17} className="shrink-0 text-slate-400" />
            </button>
          ))}
        </div>
      </section>
      <button type="button" onClick={() => onNavigate('/ciclo')} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-800">
        <Plus size={17} />
        Registrar Nueva Tarea / Orden de Campo
      </button>
    </>
  );
}
