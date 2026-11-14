import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  Building,
  Check,
  Leaf,
  Radio,
  Shield,
  Truck,
  X,
  Zap,
} from 'lucide-react';

const FOREST = 'bg-forest hover:bg-forest-dark text-white';

const infraestructuras = [
  {
    id: 'agricola',
    icon: Leaf,
    iconClass: 'bg-emerald-50 border border-emerald-200/80 text-emerald-700',
    badge: 'CAMPO',
    badgeClass: 'bg-emerald-100 text-emerald-900 border border-emerald-300',
    title: 'Telemetría Agrícola',
    subtitle: 'Cultivos, Humedad de Suelo & Riego',
    description:
      'Aún no tienes sensores conectados. Enlaza un nodo telemático LoRaWAN/4G para comenzar a registrar datos agronómicos en tiempo real.',
    chips: [
      { label: 'LoRaWAN', class: 'bg-emerald-50/70 text-emerald-800 border border-emerald-200/70', dot: 'bg-emerald-500' },
      { label: 'ESP32 / 4G', class: 'bg-slate-100 text-slate-700 border border-slate-200', dot: 'bg-slate-400' },
      { label: 'Humedad & Riego', class: 'bg-slate-100 text-slate-700 border border-slate-200', dot: 'bg-slate-400' },
      { label: 'Supabase Sync', class: 'bg-emerald-100/70 text-emerald-800 border border-emerald-300/60', dot: 'bg-emerald-500' },
    ],
    button: '+ Conectar Sensores Agrícolas',
    buttonClass: 'bg-emerald-800 hover:bg-emerald-900 text-white shadow-md shadow-emerald-950/20',
    statusText: 'Listo para emparejar gateway / dispositivo',
    statusColor: 'text-emerald-700',
    statusBadge: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  },
  {
    id: 'flota',
    icon: Truck,
    iconClass: 'bg-slate-100 border border-slate-200 text-slate-700',
    badge: 'LOGÍSTICA',
    badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300',
    title: 'Flota',
    subtitle: 'Vehículos y conductores',
    description:
      'Gestiona tus unidades vehiculares y conductores asignados.',
    chips: [
      { label: 'Vehículos', class: 'bg-slate-50 text-slate-700 border border-slate-200', dot: 'bg-slate-400' },
      { label: 'Conductores', class: 'bg-amber-50 text-amber-800 border border-amber-200', dot: 'bg-amber-500' },
    ],
    button: '+ Gestionar Vehículos',
    buttonClass: 'bg-slate-900 hover:bg-slate-800 text-white shadow-md shadow-slate-900/20',
    statusText: 'Listo para emparejar gateway / dispositivo',
    statusColor: 'text-slate-600',
    statusBadge: 'bg-slate-100 text-slate-600 border border-slate-200',
  },
];

export default function Gestion() {
  const navigate = useNavigate();
  const { user, empresa_activa_id, empresas_disponibles } = useAuth();
  const [conectando, setConectando] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [proximamente, setProximamente] = useState(false);
  const [dispositivos, setDispositivos] = useState({ flota: false, campo: false, verificando: true });

  const nombreUsuario = (user?.nombre || '').trim();
  const nombreVisible = nombreUsuario || (user?.email ? user.email.split('@')[0] : 'Usuario Agrilux');
  const primerNombre = nombreVisible.split(' ')[0];
  const emailUsuario = user?.email || 'Sin correo configurado';

  const empresaActiva = (empresas_disponibles || []).find((empresa) => empresa.id === empresa_activa_id);
  const ROL_EMPRESA = { administrador: 'Administrador', ingeniero: 'Ingeniero', supervisor: 'Supervisor', operario: 'Operario' };
  const rolEmpresaLabel = ROL_EMPRESA[empresaActiva?.rol] || user?.rol || 'Usuario';

  useEffect(() => {
    if (!empresa_activa_id) {
      setDispositivos({ flota: false, campo: false, verificando: false });
      return undefined;
    }
    let cancelado = false;
    (async () => {
      const consulta = (tabla) =>
        supabase.from(tabla).select('id', { count: 'exact', head: true }).eq('empresa_id', empresa_activa_id);
      const [flotaRes, campoRes] = await Promise.all([consulta('agrotrack_posiciones'), consulta('agrotrack_telemetria')]);
      if (cancelado) return;
      setDispositivos({
        flota: !flotaRes.error && (flotaRes.count || 0) > 0,
        campo: !campoRes.error && (campoRes.count || 0) > 0,
        verificando: false,
      });
    })();
    return () => {
      cancelado = true;
    };
  }, [empresa_activa_id]);

  const dominiosConectados = [dispositivos.flota ? 'Flota' : null, dispositivos.campo ? 'Campo' : null].filter(Boolean);
  const hayDispositivos = dominiosConectados.length > 0;
  const resumenDispositivos = dominiosConectados.join(' y ');

  const mostrarMensaje = (texto) => {
    setMensaje(texto);
    window.setTimeout(() => setMensaje(''), 3500);
  };

  const conectar = (id) => {
    if (id === 'agricola') {
      setProximamente(true);
      return;
    }
    setConectando(id);
    window.setTimeout(() => {
      setConectando('');
      navigate('/gestion/vehiculos-flota');
    }, 300);
  };

  return (
    <main className="flex-1 max-w-[1580px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── Sidebar Izquierda ───────────────────────────────────── */}
        <aside className="lg:col-span-4 xl:col-span-3 space-y-5" data-purpose="configuration-sidebar">
          {/* Card 1: Org & Account Overview */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle hover:border-slate-300 transition-all">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
                  <Building size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-slate-900 text-base">{nombreVisible}</h2>
                    <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/90 rounded border border-emerald-300/60">
                      Nuevo
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium truncate max-w-[170px]" title={emailUsuario}>{emailUsuario}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Security & RLS Isolation */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-emerald-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Seguridad & RLS</h3>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Políticas RLS</span>
                <span className="px-2 py-0.5 font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md text-[11px]">
                  Aislado y Seguro
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Nodos IoT Activos</span>
                <span className="font-bold text-slate-800">0 conectados</span>
              </div>
            </div>
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span className="text-slate-500">Uso de Telemetría</span>
                <span className="text-slate-700">0 MB / 500 MB</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full w-[2%] rounded-full"></div>
              </div>
              <p className="text-[10px] text-slate-400 text-right">0% consumido • Cuota intacta</p>
            </div>
            <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-start gap-2.5">
              <svg className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
              <p className="text-[11px] text-emerald-900 leading-snug">
                Tu entorno aislado con <strong>Row Level Security</strong> ya está activo y protegido.
              </p>
            </div>
          </div>

        </aside>

        {/* ── Main Workspace ──────────────────────────────────────── */}
        <section className="lg:col-span-8 xl:col-span-9 space-y-6" data-purpose="onboarding-workspace">
          {/* Welcome Hero Banner */}
          <div className="relative bg-white rounded-3xl p-6 sm:p-7 border border-emerald-100 shadow-subtle overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-radial from-emerald-100/50 to-transparent rounded-full blur-3xl -z-10"></div>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center flex-shrink-0 shadow-inner">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </div>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 rounded-full">
                      Primer Ingreso
                    </span>
                    <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                      ¡Te damos la bienvenida a Agrilux, {primerNombre}!
                    </h1>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                    Este es tu centro operativo para enlazar telemetría IoT de campo, riego tecnificado, clima y logística vehicular directo con Supabase.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 self-start md:self-center text-xs">
                <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 font-semibold text-slate-700">
                  <span className={`w-2 h-2 rounded-full ${dispositivos.verificando ? 'bg-amber-500 animate-pulse' : hayDispositivos ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                  <span>
                    {dispositivos.verificando
                      ? 'Estado: Verificando…'
                      : hayDispositivos
                        ? `Estado: ${resumenDispositivos} en funcionamiento`
                        : 'Estado: Sin dispositivos aún'}
                  </span>
                </span>
                <span className="px-2.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 font-bold text-slate-600 tracking-wide">
                  Rol: {rolEmpresaLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Sección: Selección de Infraestructura */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900">
                  Selecciona Infraestructura a Conectar
                </h2>
              </div>
              <span className="px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/80 rounded-full border border-emerald-200 tracking-wide">
                PASO RECOMENDADO
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {infraestructuras.map((item) => {
                const Icon = item.icon;
                const activo = conectando === item.id;
                return (
                  <article
                    key={item.id}
                    className="bg-white rounded-2xl p-6 border border-slate-200/80 hover:border-emerald-500/50 shadow-subtle hover:shadow-card transition-all flex flex-col justify-between group h-full"
                  >
                    <div className="space-y-4">
                      {/* Top Row */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${item.iconClass} group-hover:scale-105 transition-transform flex-shrink-0`}>
                            <Icon size={20} />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900 text-base leading-snug">{item.title}</h3>
                            <p className="text-xs text-slate-500 font-medium">{item.subtitle}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                            0 {item.id === 'agricola' ? 'sensores' : 'vehículos'}
                          </span>
                          <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md ${item.badgeClass}`}>{item.badge}</span>
                        </div>
                      </div>
                      {/* Description Alert */}
                      <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-100 text-xs text-slate-600 flex items-start gap-2.5">
                        <svg className={`w-4 h-4 ${item.id === 'agricola' ? 'text-emerald-600' : 'text-blue-500'} mt-0.5 flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                        </svg>
                        <p className="leading-relaxed">{item.description}</p>
                      </div>
                      {/* Organized Technical Feature Chips */}
                      <div className="space-y-1.5 pt-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {item.id === 'agricola' ? 'Protocolos & Compatibilidad' : 'Protocolos & Cobertura'}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {item.chips.map((chip, idx) => (
                            <span key={idx} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${chip.class}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${chip.dot}`}></span>
                              {chip.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    {/* Bottom Action Block */}
                    <div className="pt-5 mt-4 border-t border-slate-100 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-slate-500 font-medium">
                          <span className={`w-2 h-2 rounded-full ${item.id === 'agricola' ? 'bg-emerald-500' : 'bg-blue-500'} animate-pulse`}></span>
                          <span className="text-[11px]">{item.statusText}</span>
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${item.statusColor}`}>En Espera</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => conectar(item.id)}
                        disabled={activo}
                        className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-70 ${item.buttonClass}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                        </svg>
                        {activo ? <Radio size={14} className="animate-pulse" /> : <Zap size={14} />}
                        <span>{activo ? 'Preparando conexión...' : item.button}</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {proximamente && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="proximamente-title"
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
            >
              <div className="relative w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white p-6 text-center shadow-xl">
                <button
                  type="button"
                  onClick={() => setProximamente(false)}
                  aria-label="Cerrar"
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                >
                  <X size={18} />
                </button>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                  <Radio size={24} />
                </div>
                <h2 id="proximamente-title" className="text-lg font-bold text-slate-900">Próximamente</h2>
                <p className="mt-1.5 text-sm text-slate-500">
                  La conexión de sensores agrícolas estará disponible muy pronto.
                </p>
                <button
                  type="button"
                  onClick={() => setProximamente(false)}
                  className={`mt-5 w-full inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold ${FOREST}`}
                >
                  Entendido
                </button>
              </div>
            </div>
          )}

          {mensaje && (
            <div role="status" className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-[398px] -translate-x-1/2 items-center gap-2 rounded-xl bg-[#0F4C3A] px-3 py-2.5 text-[10px] font-semibold text-white shadow-md">
              <Check size={15} className="text-green-300" /> {mensaje}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
