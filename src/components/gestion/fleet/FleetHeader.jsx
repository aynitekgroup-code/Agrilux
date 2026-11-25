import React from 'react';
import {
  LayoutDashboard,
  Fuel,
  Power,
  Map,
  MapPinned,
  FileChartColumn,
} from 'lucide-react';
import { useAuth } from '../../../lib/AuthContext';
import { DEMO_FUNDO } from '../../../mocks/agrotrackData';

export const FLEET_SECTIONS = [
  { id: 'consola', label: 'Consola principal', icon: LayoutDashboard },
  { id: 'mapas', label: 'Mapas', icon: Map },
  { id: 'reportes', label: 'Reportes', icon: FileChartColumn },
  { id: 'geocercas', label: 'Geocercas', icon: MapPinned },
  { id: 'combustible', label: 'Control de combustible', icon: Fuel },
  { id: 'corte', label: 'Corte remoto', icon: Power },
];

export default function FleetHeader({ activeSection, onSectionChange, pendingAlerts = 0, fuente = 'demo' }) {
  const { user, empresa_activa_id, empresas_disponibles } = useAuth();
  const listaEmpresas = Array.isArray(empresas_disponibles) ? empresas_disponibles : [];
  const empresaActiva = listaEmpresas.find((empresa) => empresa.id === empresa_activa_id) || null;
  const empresaNombre = empresaActiva?.nombre || DEMO_FUNDO.empresa;
  const inicial = String(user?.nombre || user?.email || 'A').trim().charAt(0).toUpperCase();
  const esReal = fuente === 'real';
  const etiquetaFuente = esReal ? 'Datos reales'
    : fuente === 'cargando' ? 'Cargando datos'
      : fuente === 'ninguna' ? 'Sin datos' : 'Modo demo';
  const tonoFuente = esReal || fuente === 'cargando'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-amber-50 text-amber-700 border-amber-200';

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <img src="/icons/Agrilux.logo%20(2).png" alt="Agrilux" className="h-10 w-8 object-contain" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Agrilux · {empresaNombre}</h1>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tonoFuente}`}>{etiquetaFuente}</span>
            </div>
            <p className="mt-0.5 text-sm text-slate-500">Sistema de Gestión y Monitoreo de Flota Vehicular</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <p className="hidden text-right text-sm font-semibold text-slate-800 sm:block">{user?.nombre || 'Usuario Agrilux'}</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-forest/10 font-bold text-forest">{inicial}</div>
          </div>
        </div>
      </div>

      <nav className="flex gap-1.5 overflow-x-auto border-t border-slate-100 px-3 pb-3 pt-1 sm:px-5" aria-label="Secciones de AgroTrack">
        {FLEET_SECTIONS.map((section) => {
          const Icon = section.icon;
          const active = activeSection === section.id;
          return (
            <button key={section.id} type="button" onClick={() => onSectionChange(section.id)} className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${active ? 'bg-forest text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-forest'}`}>
              <Icon size={16} />
              {section.label}
              {section.id === 'consola' && pendingAlerts > 0 ? <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'}`}>{pendingAlerts}</span> : null}
            </button>
          );
        })}
      </nav>
    </section>
  );
}
