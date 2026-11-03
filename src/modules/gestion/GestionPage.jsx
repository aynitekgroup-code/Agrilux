import React, { useState } from 'react';
import {
  Check,
  ClipboardList,
  Droplets,
  Factory,
  FlaskConical,
  Info,
  Leaf,
  Radio,
  Settings2,
  Truck,
  Wrench,
  Zap,
} from 'lucide-react';

const infraestructuras = [
  {
    id: 'agricola',
    icon: Leaf,
    iconClass: 'bg-emerald-100 text-emerald-700',
    badge: 'CAMPO',
    badgeClass: 'border-emerald-300 text-emerald-700',
    title: 'Telemetría Agrícola',
    subtitle: 'Cultivos, Humedad de Suelo & Riego',
    description:
      'Vincula sensores y dispositivos instalados en campo: sensores de humedad de suelo, sondas volumétricas, temperatura/humedad ambiental, estaciones meteorológicas y electroválvulas de riego.',
    tags: ['Sensores IoT', 'Humedad & Clima', 'Riego Automático'],
    button: 'Conectar Telemetría Agrícola',
    buttonClass: 'bg-emerald-800 hover:bg-emerald-900',
    footer: 'o registrar datos de suelo manualmente',
    footerAction: 'manual',
  },
  {
    id: 'flota',
    icon: Truck,
    iconClass: 'bg-orange-100 text-orange-700',
    badge: 'LOGÍSTICA',
    badgeClass: 'border-orange-300 text-orange-700',
    title: 'Telemetría de Flota',
    subtitle: 'Transporte Logístico & Insumos',
    description:
      'Vincula dispositivos GPS telemáticos en camiones de transporte de insumos agrícolas y cosechas, para monitorear ubicación en vivo, geocercas, velocidad y recorridos.',
    tags: ['GPS OBD / Satelital', 'Monitoreo en Vivo', 'Rutas y Despacho'],
    button: 'Conectar Telemetría de Flota',
    buttonClass: 'bg-slate-800 hover:bg-slate-900',
    footer: 'o registrar camiones manualmente',
    footerAction: 'flota-manual',
  },
];

const pendientes = [
  { icon: Droplets, title: 'Riego y Sensores IoT', detail: 'Requiere telemetría agrícola', color: 'text-sky-600' },
  { icon: Truck, title: 'Monitoreo de Flota GPS', detail: 'Requiere telemetría de flota', color: 'text-orange-600' },
  { icon: FlaskConical, title: 'Kardex & Logística', detail: 'En espera de datos', color: 'text-amber-600' },
  { icon: ClipboardList, title: 'Costos & Cuadrillas', detail: 'En espera de datos', color: 'text-rose-600' },
];

export default function Gestion() {
  const [conectando, setConectando] = useState('');
  const [mensaje, setMensaje] = useState('');

  const mostrarMensaje = (texto) => {
    setMensaje(texto);
    window.setTimeout(() => setMensaje(''), 3500);
  };

  const conectar = (id) => {
    setConectando(id);
    window.setTimeout(() => {
      setConectando('');
      mostrarMensaje(id === 'agricola'
        ? 'Configuración agrícola iniciada.'
        : 'Configuración de flota iniciada.');
    }, 500);
  };

  return (
    <main className="min-h-[calc(100vh-120px)] bg-slate-50 -mx-4 pb-8">
      <header className="bg-[#1d293d] px-5 py-5 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <ClipboardList size={25} />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">Gestión Agrilux</h1>
            <p className="text-xs text-slate-300">Administra y conecta tu infraestructura operativa</p>
          </div>
        </div>
      </header>

      <div className="space-y-5 px-4 py-4">
        <section className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Configuración inicial · Sin dispositivos
              </span>
              <h2 className="mt-2 text-base font-bold text-slate-900">Bienvenido a Gestión Agrilux</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Selecciona el tipo de infraestructura que deseas conectar para comenzar a sincronizar tus datos en tiempo real.
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
              <Settings2 size={20} />
            </div>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-end justify-between px-0.5">
            <h2 className="max-w-[260px] text-xs font-bold uppercase tracking-wide text-slate-800">
              Selecciona infraestructura a conectar
            </h2>
            <span className="text-right text-[10px] leading-tight text-slate-400">Paso<br />obligatorio</span>
          </div>
          <div className="space-y-2.5">
            {infraestructuras.map((item) => {
              const Icon = item.icon;
              const activo = conectando === item.id;
              return (
                <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-2">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.iconClass}`}>
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                          <p className="text-[11px] text-emerald-700">{item.subtitle}</p>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold ${item.badgeClass}`}>{item.badge}</span>
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-slate-600">{item.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.tags.map((tag) => <span key={tag} className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">{tag}</span>)}
                  </div>
                  <button
                    type="button"
                    onClick={() => conectar(item.id)}
                    disabled={activo}
                    className={`mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold text-white transition disabled:opacity-70 ${item.buttonClass}`}
                  >
                    {activo ? <Radio size={14} className="animate-pulse" /> : <Zap size={14} />}
                    {activo ? 'Preparando conexión...' : `+  ${item.button}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => mostrarMensaje(item.footerAction === 'manual' ? 'Registro manual de suelo disponible próximamente.' : 'Registro manual de camiones disponible próximamente.')}
                    className="mt-2 flex w-full items-center justify-center gap-1 text-[10px] text-slate-500 underline underline-offset-2"
                  >
                    {item.footer}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900">Asistente guiado de configuración</h2>
            <span className="text-[10px] text-slate-400">Ruta de 3 pasos</span>
          </div>
          <div className="space-y-2">
            {[
              ['1', 'Vincular Fundo o Agroexportadora', 'Código de empresa o API Key de fundo para sincronización segura en la nube.', 'Iniciar'],
              ['2', 'Emparejar Dispositivos Telemáticos', 'Escanear código QR de sensor/GPS o ingresar código IMEI/Serial del hardware.', 'Paso siguiente'],
              ['3', 'Validar Señal y Asignar a Parcela o Vehículo', 'Prueba de enlace sin datos ficticios para verificar telemetría en tiempo real.', 'Prueba en vivo'],
            ].map(([number, title, detail, action], index) => (
              <button type="button" key={number} onClick={() => mostrarMensaje(index === 0 ? 'Asistente de configuración iniciado.' : `${title}: completa el paso anterior.`)} className="flex w-full items-start gap-2 border-b border-slate-100 pb-2 text-left last:border-0 last:pb-0">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${index === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{index === 0 ? <Check size={12} /> : number}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2 text-xs font-bold text-slate-800"><span>{title}</span><span className="shrink-0 text-[10px] font-normal text-slate-400">{action}</span></span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-slate-400">{detail}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
            <p className="mb-2 text-[10px] font-bold text-slate-700">⚙ Opciones alternativas y trabajo en campo</p>
            <div className="space-y-1.5">
              <button type="button" onClick={() => mostrarMensaje('Modo sin conexión seleccionado.')} className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-[10px] text-slate-700"><span className="flex items-center gap-2"><Wrench size={14} className="text-orange-600" />Registrar datos manualmente sin conexión</span><span className="text-[9px] text-slate-400">Zonas sin señal</span></button>
              <button type="button" onClick={() => mostrarMensaje('Puedes explorar el modo demo desde aquí.')} className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-[10px] text-slate-700"><span className="flex items-center gap-2"><Factory size={14} className="text-purple-600" />Configurar más adelante (Explorar modo demo)</span><span className="text-[9px] font-semibold text-emerald-700">Omitir por ahora</span></button>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900">Módulos en espera de activación</h2>
            <span className="text-[10px] text-slate-400">Desactivadas</span>
          </div>
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5">
            <Info size={14} className="mt-0.5 shrink-0 text-emerald-700" />
            <p className="text-[10px] leading-relaxed text-emerald-900"><strong>Sin datos ficticios.</strong> Los módulos se activarán automáticamente una vez que el primer sensor o dispositivo GPS transmita señal verificada.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {pendientes.map(({ icon: Icon, title, detail, color }) => (
              <button type="button" key={title} onClick={() => mostrarMensaje('Activa una infraestructura para habilitar este módulo.')} className="rounded-xl border border-slate-200 bg-white p-2.5 text-left opacity-70">
                <div className="flex items-center justify-between"><Icon size={15} className={color} /><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[7px] font-bold text-slate-400">Inactiva</span></div>
                <p className="mt-2 text-xs font-bold text-slate-600">{title}</p>
                <p className="mt-0.5 text-[10px] text-slate-400">{detail}</p>
              </button>
            ))}
          </div>
        </section>

        {mensaje && (
          <div role="status" className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-[398px] -translate-x-1/2 items-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-[10px] font-semibold text-white shadow-lg">
            <Check size={15} className="text-emerald-400" /> {mensaje}
          </div>
        )}
      </div>
    </main>
  );
}
