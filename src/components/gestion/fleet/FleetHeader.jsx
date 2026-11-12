import React from 'react';
import {
  Leaf,
  Building2,
  MapPin,
  Wifi,
  LayoutDashboard,
  Fuel,
  Power,
  ShieldCheck,
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

function ContextChip({ icon: Icon, title, subtitle, tone }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 min-w-0">
      <div className="w-8 h-8 rounded-lg bg-white text-forest border border-slate-100 flex items-center justify-center shrink-0">
        <Icon size={15} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-400">{title}</p>
        <p className="text-xs font-semibold text-slate-700 truncate">
          {tone ? <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle" style={{ background: tone }} /> : null}
          {subtitle}
        </p>
      </div>
    </div>
  );
}

export default function FleetHeader({ activeSection, onSectionChange, pendingAlerts = 0 }) {
  const { user, empresa_activa_id, empresas_disponibles } = useAuth();
  const listaEmpresas = Array.isArray(empresas_disponibles) ? empresas_disponibles : [];
  const empresaActiva = listaEmpresas.find((e) => e.id === empresa_activa_id) || null;
  const empresaNombre = empresaActiva?.nombre || DEMO_FUNDO.empresa;
  const ubicacion = empresaActiva?.ubicacion || DEMO_FUNDO.sede;
  const campana = empresaActiva?.campana_activa || DEMO_FUNDO.campana;
  const cuota = user?.telemetria_cuota ?? user?.cuota_telemetria ?? null;
  const inicial = String(user?.nombre || user?.email || 'A').trim().charAt(0).toUpperCase();

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-forest text-white flex items-center justify-center shadow-sm shrink-0">
            <Leaf size={24} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Agrilux · AgroTrack Pomalca
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                Modo demo
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">Sistema de Gestión y Monitoreo de Flota Vehicular</p>
          </div>
          <div className="sm:ml-auto flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-800">{user?.nombre || 'Usuario Agrilux'}</p>
              <p className="text-xs text-slate-400">{user?.email || 'Sesión no disponible'}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-forest/10 text-forest flex items-center justify-center font-bold">
              {inicial}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <ContextChip icon={Building2} title="Empresa activa" subtitle={empresaActiva ? empresaNombre : `${empresaNombre} (Demo)`} tone={empresaActiva ? '#22C55E' : '#F59E0B'} />
          <ContextChip icon={MapPin} title={DEMO_FUNDO.fundo} subtitle={`${ubicacion} · ${campana} · Demo`} />
          <ContextChip
            icon={cuota != null ? Wifi : ShieldCheck}
            title="Cuota de telemetría"
            subtitle={cuota != null ? `${cuota} % de cuota usada` : 'Datos demo · sin consumo real'}
            tone={cuota != null ? '#3B82F6' : '#F59E0B'}
          />
        </div>
      </div>

      <nav className="px-3 sm:px-5 pb-3 pt-1 flex gap-1.5 overflow-x-auto border-t border-slate-100" aria-label="Secciones de AgroTrack">
        {FLEET_SECTIONS.map((section) => {
          const Icon = section.icon;
          const active = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSectionChange(section.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors ${
                active
                  ? 'bg-forest text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-forest'
              }`}
            >
              <Icon size={16} />
              {section.label}
              {section.id === 'consola' && pendingAlerts > 0 ? (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'}`}>
                  {pendingAlerts}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </section>
  );
}
