import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import {
  Building,
  Check,
  ClipboardList,
  Droplets,
  Factory,
  Leaf,
  Radio,
  Shield,
  Truck,
  Wrench,
  X,
  Zap,
} from 'lucide-react';

const FOREST = 'bg-forest hover:bg-forest-dark text-white';
const FOREST_DARK = 'bg-forest-dark text-white';

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
    title: 'Telemetría de Flota',
    subtitle: 'Transporte Logístico & Insumos',
    description:
      'No hay camiones ni GPS vinculados. Monitorea insumos y cosechas conectando tus primeras unidades telemáticas satelitales u OBD-II.',
    chips: [
      { label: 'GPS OBD-II', class: 'bg-blue-50 text-blue-800 border border-blue-200', dot: 'bg-blue-500' },
      { label: 'Rastreo Satelital', class: 'bg-slate-100 text-slate-700 border border-slate-200', dot: 'bg-slate-400' },
      { label: 'Monitoreo en Vivo', class: 'bg-slate-100 text-slate-700 border border-slate-200', dot: 'bg-slate-400' },
      { label: 'Geocercas', class: 'bg-slate-100 text-slate-700 border border-slate-200', dot: 'bg-slate-400' },
    ],
    button: '+ Vincular Vehículos / Flota',
    buttonClass: 'bg-slate-900 hover:bg-slate-800 text-white shadow-md shadow-slate-900/20',
    statusText: 'Listo para emparejar gateway / dispositivo',
    statusColor: 'text-slate-600',
    statusBadge: 'bg-slate-100 text-slate-600 border border-slate-200',
  },
];

export default function Gestion() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [conectando, setConectando] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [proximamente, setProximamente] = useState(false);

  const nombreUsuario = (user?.nombre || '').trim();
  const nombreVisible = nombreUsuario || (user?.email ? user.email.split('@')[0] : 'Usuario Agrilux');
  const primerNombre = nombreVisible.split(' ')[0];
  const emailUsuario = user?.email || 'Sin correo configurado';

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
            <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                <span className="text-xs font-semibold text-amber-900">Supabase Cloud Sync</span>
              </div>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold text-[10px] rounded tracking-wide border border-amber-300/70">
                POR CONFIGURAR
              </span>
            </div>
          </div>

          {/* Card 2: Environment Selector */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Entorno de Operación</h3>
              <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-800 bg-emerald-100/80 rounded-full border border-emerald-200">
                FASE 3
              </span>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Empresa Activa</label>
              <div className="relative">
                <button className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-slate-800 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl transition-colors" type="button">
                  <span className="flex items-center gap-2">
                    <Building size={14} className="text-emerald-600" />
                    <span>Espacio Personal (Autónomo)</span>
                  </span>
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M8 9l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Espacio Autónomo</span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">Empieza aquí</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Configuración lista para uso personal sin necesidad de registrar empresa ni facturación.
              </p>
            </div>
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-sm" type="button">
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
              <span>Vincular / Crear Empresa</span>
            </button>
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

          {/* Card 4: Edge Agent */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white rounded-2xl p-5 shadow-card border border-slate-700/50 relative overflow-hidden">
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-emerald-400 border border-white/10">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">Agente Agrilux Edge</h4>
                <p className="text-[11px] text-emerald-400 font-medium">ESP32 & LoRaWAN Gateway</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Instálalo cuando vayas a conectar tu primera estación o microcontrolador ESP32/LoRaWAN. Listo para vincularse sin IP pública.
            </p>
            <button className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-950/20 transition-all" type="button">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
              <span>Descargar CLI v2.4</span>
            </button>
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
              <div className="flex items-center gap-2 self-start md:self-center px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 text-xs font-semibold text-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Estado: Cuenta recién creada</span>
                <button className="text-slate-400 hover:text-slate-600 ml-1" title="Información" type="button">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </div>
                <span className="font-semibold text-slate-800">Configuración Inicial Guiada (0 de 3 completados)</span>
                <span className="text-slate-400 hidden sm:inline">•</span>
                <span className="text-slate-500 hidden sm:inline">Selecciona el tipo de telemetría que deseas integrar para activar tu primera transmisión o prueba con datos simulados.</span>
              </div>
              <span className="self-start sm:self-auto px-2.5 py-1 rounded-md text-[11px] font-bold text-slate-500 bg-slate-100 tracking-wide border border-slate-200">
                SIN DISPOSITIVOS AÚN
              </span>
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

          {/* Sección: Asistente Guiado de Configuración */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-subtle space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                  Asistente Guiado de Configuración & Integración
                </h3>
                <p className="text-xs text-slate-500">Sincronización con backend Postgres Supabase & Gateway LoRa</p>
              </div>
              <span className="self-start sm:self-center px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 rounded-md border border-slate-200">
                Ruta de 3 pasos
              </span>
            </div>
            <div className="space-y-3">
              {[
                ['1', 'Elige tu tipo de telemetría', 'Campo o Flota', 'PASO ACTUAL', 'Comenzar ahora'],
                ['2', 'Registra tu primera parcela o estación de prueba', 'Configura el nombre del sector, cultivo y las variables que deseas medir.', 'Paso siguiente'],
                ['3', 'Prueba la sincronización de datos en vivo', 'Valida la recepción de telemetría en tiempo real respaldada por Supabase.', 'Pendiente'],
              ].map(([number, title, detail, action, actionBtn], index) => (
                <button type="button" key={number} onClick={() => mostrarMensaje(`${title}: paso ${number} listo.`)} className={`flex w-full items-start gap-4 border-b border-slate-100 pb-4 text-left last:border-0 last:pb-0 ${index === 0 ? 'bg-emerald-50/40 border-2 border-emerald-500/60' : ''}`}>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold shadow-sm ${index === 0 ? 'bg-forest text-white' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                    {index === 0 ? <Check size={14} /> : number}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-800">
                      <span>{title}</span>
                      <span className={`shrink-0 text-[10px] font-bold ${index === 0 ? 'text-forest' : 'text-slate-400'}`}>{action}</span>
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-snug text-slate-500">{detail}</span>
                  </span>
                  {index === 0 && (
                    <button type="button" onClick={() => mostrarMensaje('Iniciando configuración de telemetría...')} className="flex items-center gap-1.5 px-4 py-2 bg-forest text-white text-xs font-bold rounded-lg hover:bg-forest-dark transition-all shadow-sm shadow-forest-dark/20">
                      {actionBtn} <span className="text-[9px]">→</span>
                    </button>
                  )}
                  {index === 1 && (
                    <button type="button" onClick={() => mostrarMensaje('Pasando al siguiente paso...')} className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 bg-white text-xs font-bold text-slate-700 rounded-lg hover:bg-slate-50 transition-all shadow-sm">
                      {actionBtn} <span className="text-[9px]">→</span>
                    </button>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-[#F8F9FA] p-4">
              <p className="mb-2 text-[10px] font-semibold text-slate-700">Opciones alternativas y trabajo en campo</p>
              <div className="space-y-1.5">
                <button type="button" onClick={() => mostrarMensaje('Modo sin conexión seleccionado.')} className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-[10px] text-slate-700 hover:bg-forest/5 transition-all">
                  <span className="flex items-center gap-2"><Wrench size={14} className="text-forest" />Registrar datos manualmente sin conexión</span><span className="text-[9px] text-slate-400">Zonas sin señal</span>
                </button>
                <button type="button" onClick={() => mostrarMensaje('Puedes explorar el modo demo desde aquí.')} className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-[10px] text-slate-700 hover:bg-forest/5 transition-all">
                  <span className="flex items-center gap-2"><Factory size={14} className="text-slate-500" />Configurar más adelante (Modo demo)</span><span className="text-[9px] font-semibold text-forest">Omitir por ahora</span>
                </button>
              </div>
            </div>
          </div>

          {/* Sección: Live Previews ("¿QUÉ PODRÁS VER UNA VEZ CONECTADO?") */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900">
                  ¿Qué podrás ver una vez conectado?
                </h2>
              </div>
              <button className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 text-xs font-bold border border-emerald-200/80 transition-all self-start sm:self-auto" type="button">
                <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
                <span>Cargar datos de demostración (Modo Demo)</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Preview 1: Microclimático */}
              <div className="bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-subtle hover:shadow-card transition-all group">
                <div className="relative h-48 bg-slate-900 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent z-10"></div>
                  <div className="absolute inset-0 bg-[radial-gradient(#22c55e_1px,transparent_1px)] [background-size:16px_16px] opacity-25"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_25px_rgba(34,197,94,0.3)]">
                        <svg className="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                        </svg>
                      </div>
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </span>
                    </div>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between text-[11px] text-emerald-300 font-mono bg-slate-900/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-emerald-500/20">
                    <span>Humedad: 34.2%</span>
                    <span>Temp: 21.4°C</span>
                    <span>EC: 1.8 dS/m</span>
                  </div>
                  <div className="absolute top-3 left-3 z-20">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-900/80 text-white backdrop-blur-md border border-white/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      VISTA PREVIA / DEMO
                    </span>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-slate-900">Ejemplo: Monitoreo Microclimático</h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Suelo & CE</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Lectura de conductividad eléctrica (EC), temperatura radical y tensión volumétrica hídrica en parcelas vivas una vez sincronizado tu gateway.
                  </p>
                </div>
              </div>
              {/* Preview 2: Cadena de Frío & Despacho */}
              <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-subtle hover:shadow-card transition-all group">
                <div className="relative h-48 bg-slate-950 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent z-10"></div>
                  <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px] opacity-20"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-2xl bg-blue-950/80 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-[0_0_25px_rgba(56,189,248,0.3)]">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M8 17a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4zM4 9h11v6H4V9zm11 2h3.586a1 1 0 01.707.293l2.414 2.414a1 1 0 01.293.707V15H15v-4z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                        </svg>
                      </div>
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                      </span>
                    </div>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between text-[11px] text-blue-300 font-mono bg-slate-900/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-blue-500/20">
                    <span>Camión #04 • Ruta N-5</span>
                    <span>Temp Contenedor: 3.8°C</span>
                  </div>
                  <div className="absolute top-3 left-3 z-20">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-900/80 text-white backdrop-blur-md border border-white/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                      VISTA PREVIA / DEMO
                    </span>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-slate-900">Ejemplo: Cadena de Frío & Despacho</h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">GPS & Temp</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Rastreo satelital continuo de camiones con sensor de temperatura de contenedor en tiempo real y geocercas activadas.
                  </p>
                </div>
              </div>
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
