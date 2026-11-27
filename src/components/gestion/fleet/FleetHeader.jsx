import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutDashboard,
  Fuel,
  Power,
  Map,
  MapPinned,
  FileChartColumn,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../../lib/AuthContext';

/**
 * Secciones de AgroTrack.
 * Los nombres y el orden son los que ya conoce el usuario: el estilo imita a
 * Zonar (barra oscura con pestañas en escritorio; en móvil, menú lateral que
 * se abre con un clic y se cierra solo al elegir).
 */
export const FLEET_SECTIONS = [
  { id: 'consola', label: 'Consola principal', icon: LayoutDashboard, tono: 'bg-sky-100 text-sky-600' },
  { id: 'mapas', label: 'Mapas', icon: Map, tono: 'bg-emerald-100 text-emerald-600' },
  { id: 'reportes', label: 'Reportes', icon: FileChartColumn, tono: 'bg-violet-100 text-violet-600' },
  { id: 'geocercas', label: 'Geocercas', icon: MapPinned, tono: 'bg-amber-100 text-amber-600' },
  { id: 'combustible', label: 'Control de combustible', icon: Fuel, tono: 'bg-orange-100 text-orange-600' },
  { id: 'corte', label: 'Corte remoto', icon: Power, tono: 'bg-red-100 text-red-600' },
];

export default function FleetHeader({ activeSection, onSectionChange, pendingAlerts = 0, fuente = 'demo', modulos = {}, onModuloChange }) {
  const { user, empresa_activa_id, empresas_disponibles } = useAuth();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [modulosAbiertos, setModulosAbiertos] = useState('');
  const [posicionMenu, setPosicionMenu] = useState(null);
  const listaEmpresas = Array.isArray(empresas_disponibles) ? empresas_disponibles : [];
  const empresaActiva = listaEmpresas.find((empresa) => empresa.id === empresa_activa_id) || null;
  const empresaNombre = empresaActiva?.nombre || 'Flota';
  const inicial = String(user?.nombre || user?.email || 'A').trim().charAt(0).toUpperCase();
  const esReal = fuente === 'real';
  const etiquetaFuente = esReal ? 'Datos reales'
    : fuente === 'cargando' ? 'Cargando datos'
      : fuente === 'ninguna' ? 'Sin datos' : 'Modo demo';
  const tonoFuente = esReal || fuente === 'cargando'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-amber-50 text-amber-700 border-amber-200';

  const seccionActiva = FLEET_SECTIONS.find((section) => section.id === activeSection) || FLEET_SECTIONS[0];

  // El menú lateral se cierra solo: al elegir una sección o al cambiar la
  // sección desde otro lugar (por ejemplo ?section=reportes).
  useEffect(() => { setMenuAbierto(false); }, [activeSection]);

  // Esc lo cierra y, mientras está abierto, la página de atrás no se desplaza.
  useEffect(() => {
    if (!menuAbierto) return undefined;
    const alPulsar = (event) => { if (event.key === 'Escape') setMenuAbierto(false); };
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', alPulsar);
    return () => {
      document.body.style.overflow = overflowPrevio;
      window.removeEventListener('keydown', alPulsar);
    };
  }, [menuAbierto]);

  useEffect(() => {
    if (!modulosAbiertos) return undefined;
    const cerrar = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      if (event.type === 'scroll' && event.target instanceof Element && event.target.closest('nav[aria-label^="Módulos de"]')) return;
      setModulosAbiertos(''); setPosicionMenu(null);
    };
    window.addEventListener('keydown', cerrar);
    window.addEventListener('resize', cerrar);
    window.addEventListener('scroll', cerrar, true);
    return () => { window.removeEventListener('keydown', cerrar); window.removeEventListener('resize', cerrar); window.removeEventListener('scroll', cerrar, true); };
  }, [modulosAbiertos]);

  const elegirSeccion = (id) => {
    onSectionChange(id);
    setMenuAbierto(false);
    setModulosAbiertos((actual) => modulos[id] ? (actual === id ? '' : id) : '');
    setPosicionMenu(null);
  };

  const abrirDesdeBarra = (id, boton) => {
    if (!modulos[id]) { elegirSeccion(id); return; }
    if (modulosAbiertos === id && posicionMenu) { setModulosAbiertos(''); setPosicionMenu(null); return; }
    const rect = boton.getBoundingClientRect();
    setPosicionMenu({ top: rect.bottom, left: Math.max(8, Math.min(rect.left, window.innerWidth - 328)) });
    setModulosAbiertos(id);
  };

  const listaModulos = modulosAbiertos && modulos[modulosAbiertos] && <nav aria-label={`Módulos de ${modulosAbiertos}`} className="max-h-[min(65vh,480px)] overflow-y-auto rounded-lg border border-emerald-200 bg-white p-2 shadow-xl">
    {modulos[modulosAbiertos].map((grupo) => <div key={grupo.nombre}>
      <p className="rounded bg-emerald-50 px-3 py-2 text-xs font-bold uppercase text-emerald-800">{grupo.nombre}</p>
      {grupo.opciones.map(([id, label]) => <button key={id} type="button" onClick={() => { onModuloChange(modulosAbiertos, id); setModulosAbiertos(''); setPosicionMenu(null); }} className="block w-full rounded px-3 py-2 text-left text-sm text-slate-800 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700">{label}</button>)}
    </div>)}
  </nav>;

  return (
    <section className="fleet-cabecera overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
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

      {/* ── Columna estrecha: un clic abre el menú lateral ──────── */}
      <div className="fleet-cabecera-burger items-center gap-2 bg-forest px-2 py-1.5">
        <button
          type="button"
          onClick={() => setMenuAbierto(true)}
          aria-expanded={menuAbierto}
          aria-haspopup="dialog"
          aria-label="Abrir menú de secciones"
          title="Menú de secciones"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10 active:bg-white/20"
        >
          <Menu size={22} />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
          {seccionActiva.label}
        </span>
        {seccionActiva.id === 'consola' && pendingAlerts > 0 ? (
          <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
            {pendingAlerts}
          </span>
        ) : null}
      </div>

      {/* ── Escritorio: menú superior (estilo Zonar) con pestañas ── */}
      <nav
        className="fleet-cabecera-tabs gap-1 overflow-x-auto bg-forest px-4 pt-1.5 pb-0"
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
              onClick={(event) => abrirDesdeBarra(section.id, event.currentTarget)}
              aria-expanded={modulos[section.id] ? modulosAbiertos === section.id : undefined}
              className={`flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-t-md px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-sm ${
                active
                  ? 'bg-white text-forest shadow-sm'
                  : 'text-white/85 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={16} />
              {section.label}
              {modulos[section.id] && <ChevronRight size={14} className={modulosAbiertos === section.id ? 'rotate-90' : ''} />}
              {section.id === 'consola' && pendingAlerts > 0 ? (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? 'bg-red-100 text-red-700' : 'bg-white/20 text-white'}`}>
                  {pendingAlerts}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
      {listaModulos && (posicionMenu ? createPortal(<div className="fixed inset-0 z-[2000]" onClick={() => { setModulosAbiertos(''); setPosicionMenu(null); }}><div style={{ position: 'fixed', top: posicionMenu.top, left: posicionMenu.left, width: 'min(320px, calc(100vw - 16px))' }} onClick={(event) => event.stopPropagation()}>{listaModulos}</div></div>, document.body) : <div className="p-2">{listaModulos}</div>)}

      {/* ── Menú lateral: entra desde la izquierda y se cierra al elegir ── */}
      {menuAbierto ? createPortal(
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Menú de secciones">
          <button
            type="button"
            aria-label="Cerrar menú de secciones"
            onClick={() => setMenuAbierto(false)}
            className="menu-fondo absolute inset-0 bg-black/45"
          />
          <div className="menu-lateral absolute inset-y-0 left-0 flex w-[min(86%,320px)] flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-2 bg-forest px-4 py-3">
              <span className="min-w-0 truncate text-sm font-bold text-white">Menú de AgroTrack</span>
              <button
                type="button"
                onClick={() => setMenuAbierto(false)}
                aria-label="Cerrar menú de secciones"
                title="Cerrar"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-2" aria-label="Secciones de AgroTrack">
              {FLEET_SECTIONS.map((section) => {
                const Icon = section.icon;
                const active = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => elegirSeccion(section.id)}
                    className={`flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                      active ? 'bg-emerald-50' : 'hover:bg-slate-50 active:bg-slate-100'
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${section.tono}`}>
                      <Icon size={17} />
                    </span>
                    <span className={`min-w-0 flex-1 truncate text-sm ${active ? 'font-bold text-forest' : 'font-medium text-slate-700'}`}>
                      {section.label}
                    </span>
                    {section.id === 'consola' && pendingAlerts > 0 ? (
                      <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                        {pendingAlerts}
                      </span>
                    ) : null}
                    <ChevronRight size={16} className="shrink-0 text-slate-300" />
                  </button>
                );
              })}
            </nav>

            <p className="border-t border-slate-100 px-4 py-3 text-[11px] text-slate-400">
              Elige una sección: el menú se cierra solo.
            </p>
          </div>
        </div>,
        document.body,
      ) : null}
    </section>
  );
}
