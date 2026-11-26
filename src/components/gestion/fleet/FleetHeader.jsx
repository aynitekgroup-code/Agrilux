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

/**
 * Secciones de AgroTrack.
 * Los nombres y el orden son los que ya conoce el usuario: el estilo imita al
 * menú superior de Zonar (barra oscura con pestañas) sin cambiar la etiqueta
 * de ninguna sección.
 */
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
      {/* ── Identidad ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 p-3 sm:gap-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 sm:items-start sm:gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:h-12 sm:w-12">
            <img src="/icons/Agrilux.logo%20(2).png" alt="Agrilux" className="h-10 w-8 object-contain" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-slate-900 sm:text-2xl">Agrilux · {empresaNombre}</h1>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tonoFuente}`}>{etiquetaFuente}</span>
            </div>
            <p className="mt-0.5 hidden text-sm text-slate-500 sm:block">Sistema de Gestión y Monitoreo de Flota Vehicular</p>
          </div>
          <div className="ml-auto hidden items-center gap-3 sm:flex">
            <p className="hidden text-right text-sm font-semibold text-slate-800 sm:block">{user?.nombre || 'Usuario Agrilux'}</p>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-forest/10 font-bold text-forest">{inicial}</div>
          </div>
        </div>
      </div>

      {/* ── Menú superior (estilo Zonar): barra oscura con pestañas ── */}
      <nav
        className="flex gap-1 overflow-x-auto bg-forest px-2 pt-1.5 pb-0 sm:px-4"
        aria-label="Secciones de AgroTrack"
      >
        {FLEET_SECTIONS.map((section) => {
          const Icon = section.icon;
          const active = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onSectionChange(section.id)}
              className={`flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-t-md px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-sm ${
                active
                  ? 'bg-white text-forest shadow-sm'
                  : 'text-white/85 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={16} />
              {section.label}
              {section.id === 'consola' && pendingAlerts > 0 ? (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-red-100 text-red-700' : 'bg-white/20 text-white'}`}>
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
