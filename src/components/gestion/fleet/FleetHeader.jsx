import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Fuel,
  Power,
  Map,
  MapPinned,
  FileChartColumn,
  Save,
  Settings,
  X,
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

function ModalAdministrarDatos({ open, onClose, empresa, user, onGuardarEmpresa, onGuardarPerfil }) {
  const [form, setForm] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm({
      empresaNombre: empresa?.nombre || '',
      ruc: empresa?.ruc || '',
      telefonoEmpresa: empresa?.telefono || '',
      ubicacionEmpresa: empresa?.ubicacion || '',
      campana: empresa?.campana_activa || '2026-A',
      nombre: user?.nombre || '',
      whatsapp: user?.whatsapp || '',
      ubicacion: user?.ubicacion || '',
    });
    setError('');
    setExito('');
  }, [open, empresa, user]);

  if (!open) return null;

  const actualizar = (campo, valor) => setForm((prev) => ({ ...prev, [campo]: valor }));
  const guardar = async (event) => {
    event.preventDefault();
    setGuardando(true);
    setError('');
    setExito('');
    try {
      await onGuardarEmpresa({
        nombre: form.empresaNombre,
        ruc: form.ruc,
        telefono: form.telefonoEmpresa,
        ubicacion: form.ubicacionEmpresa,
        campana_activa: form.campana,
      });
      await onGuardarPerfil({
        nombre: form.nombre,
        whatsapp: form.whatsapp,
        ubicacion: form.ubicacion,
      });
      setExito('Datos actualizados correctamente.');
    } catch (saveError) {
      setError(saveError?.message || 'No se pudieron guardar los cambios.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="administrar-datos-titulo" onMouseDown={onClose}>
      <form className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl" onSubmit={guardar} onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Solo administradores</p>
            <h2 id="administrar-datos-titulo" className="mt-0.5 text-lg font-bold text-slate-900">Datos de empresa y perfil</h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Cerrar">
            <X size={17} />
          </button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <fieldset className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
            <legend className="px-1 text-xs font-bold text-emerald-800">Empresa activa</legend>
            <label className="block text-[11px] font-semibold text-slate-600">Nombre
              <input required value={form.empresaNombre || ''} onChange={(event) => actualizar('empresaNombre', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500" />
            </label>
            <label className="block text-[11px] font-semibold text-slate-600">RUC
              <input value={form.ruc || ''} onChange={(event) => actualizar('ruc', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500" />
            </label>
            <label className="block text-[11px] font-semibold text-slate-600">Teléfono
              <input value={form.telefonoEmpresa || ''} onChange={(event) => actualizar('telefonoEmpresa', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500" />
            </label>
            <label className="block text-[11px] font-semibold text-slate-600">Ubicación
              <input value={form.ubicacionEmpresa || ''} onChange={(event) => actualizar('ubicacionEmpresa', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500" />
            </label>
            <label className="block text-[11px] font-semibold text-slate-600">Campaña activa
              <input value={form.campana || ''} onChange={(event) => actualizar('campana', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500" />
            </label>
          </fieldset>

          <fieldset className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <legend className="px-1 text-xs font-bold text-slate-700">Tu perfil</legend>
            <label className="block text-[11px] font-semibold text-slate-600">Nombre
              <input required value={form.nombre || ''} onChange={(event) => actualizar('nombre', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500" />
            </label>
            <label className="block text-[11px] font-semibold text-slate-600">Correo electrónico
              <input value={user?.email || ''} readOnly className="mt-1 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-2 text-xs text-slate-500" />
            </label>
            <label className="block text-[11px] font-semibold text-slate-600">WhatsApp
              <input value={form.whatsapp || ''} onChange={(event) => actualizar('whatsapp', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500" />
            </label>
            <label className="block text-[11px] font-semibold text-slate-600">Ubicación personal
              <input value={form.ubicacion || ''} onChange={(event) => actualizar('ubicacion', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500" />
            </label>
          </fieldset>
        </div>

        {error ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">{error}</p> : null}
        {exito ? <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700" role="status">{exito}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
          <button type="submit" disabled={guardando} className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-3 py-2 text-xs font-semibold text-white hover:bg-forest-dark disabled:opacity-60">
            <Save size={14} /> {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function FleetHeader({ activeSection, onSectionChange, pendingAlerts = 0, fuente = 'demo' }) {
  const { user, empresa_activa_id, empresas_disponibles, updateEmpresaActiva, updatePerfil } = useAuth();
  const [administrandoDatos, setAdministrandoDatos] = useState(false);
  const listaEmpresas = Array.isArray(empresas_disponibles) ? empresas_disponibles : [];
  const empresaActiva = listaEmpresas.find((e) => e.id === empresa_activa_id) || null;
  const empresaNombre = empresaActiva?.nombre || DEMO_FUNDO.empresa;
  const inicial = String(user?.nombre || user?.email || 'A').trim().charAt(0).toUpperCase();
  // La consola puede estar alimentada por agrotrack_posiciones ("real") o por
  // los mocks ("demo"). La etiqueta debe reflejar la fuente actual, no fijar
  // "Modo demo" aunque el mapa y los reportes muestren datos reales.
  const esReal = fuente === 'real';
  const etiquetaFuente = esReal ? 'Datos reales'
    : fuente === 'cargando' ? 'Cargando datos'
      : fuente === 'ninguna' ? 'Sin datos' : 'Modo demo';
  const tonoFuente = esReal || fuente === 'cargando'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-amber-50 text-amber-700 border-amber-200';
  const esAdministrador = empresaActiva?.rol === 'administrador';

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
            <img src="/icons/Agrilux.logo%20(2).png" alt="Agrilux" className="h-10 w-8 object-contain" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Agrilux · {empresaNombre}
              </h1>
              <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${tonoFuente}`}>
                {etiquetaFuente}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">Sistema de Gestión y Monitoreo de Flota Vehicular</p>
          </div>
          <div className="sm:ml-auto flex items-center gap-3">
            {esAdministrador ? (
              <button type="button" onClick={() => setAdministrandoDatos(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100" title="Administrar datos de empresa y perfil">
                <Settings size={15} /> <span className="hidden lg:inline">Administrar datos</span>
              </button>
            ) : null}
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-800">{user?.nombre || 'Usuario Agrilux'}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-forest/10 text-forest flex items-center justify-center font-bold">
              {inicial}
            </div>
          </div>
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
      <ModalAdministrarDatos
        open={administrandoDatos && esAdministrador}
        onClose={() => setAdministrandoDatos(false)}
        empresa={empresaActiva}
        user={user}
        onGuardarEmpresa={updateEmpresaActiva}
        onGuardarPerfil={updatePerfil}
      />
    </section>
  );
}
