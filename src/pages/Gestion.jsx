import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Beaker,
  CalendarCheck,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Droplets,
  Leaf,
  Package,
  Plus,
  Tractor,
  Users,
  WalletCards,
} from 'lucide-react';

const filtros = ['Todo el fundo', 'Riego & Agua', 'Maquinaria'];

const acciones = [
  {
    titulo: 'Mis parcelas',
    descripcion: 'Consulta tus cultivos, lotes y condiciones de campo.',
    icon: Leaf,
    color: 'bg-emerald-100 text-emerald-700',
    ruta: '/parcela',
  },
  {
    titulo: 'Planificar ciclo',
    descripcion: 'Organiza las actividades de tu campaña agrícola.',
    icon: CalendarCheck,
    color: 'bg-blue-100 text-blue-700',
    ruta: '/ciclo',
  },
  {
    titulo: 'Salud financiera',
    descripcion: 'Monitorea tus costos de producción y ventas.',
    icon: WalletCards,
    color: 'bg-amber-100 text-amber-700',
    ruta: '/gestion/finanzas',
  },
  {
    titulo: 'Gestión de Riego & IoT',
    descripcion: 'Monitoreo de sectores, electroválvulas y m³.',
    icon: Beaker,
    color: 'bg-cyan-100 text-cyan-700',
    estado: 'En turno',
  },
  {
    titulo: 'Maquinaria y Equipos',
    descripcion: 'Tractores, bombas, horómetro y mantenimientos.',
    icon: Tractor,
    color: 'bg-orange-100 text-orange-700',
  },
  {
    titulo: 'Inventario de Insumos',
    descripcion: 'Fertilizantes, agroquímicos, kardex y stock.',
    icon: Package,
    color: 'bg-violet-100 text-violet-700',
    estado: '1 crítico',
  },
];

const metricas = [
  {
    titulo: 'Riego semanal',
    valor: '4,820 m³',
    detalle: '78% de cuota',
    panel: 'bg-blue-50 border-blue-100',
    barra: 'bg-blue-500',
    texto: 'text-blue-700',
    progreso: '78%',
  },
  {
    titulo: 'Maquinaria',
    valor: '9 / 11',
    detalle: '82% operativa',
    panel: 'bg-emerald-50 border-emerald-100',
    barra: 'bg-emerald-500',
    texto: 'text-emerald-700',
    progreso: '82%',
  },
  {
    titulo: 'Costo / ha',
    valor: 'S/ 1,420',
    detalle: '65% de presupuesto',
    panel: 'bg-amber-50 border-amber-100',
    barra: 'bg-amber-500',
    texto: 'text-amber-700',
    progreso: '65%',
  },
];

export default function Gestion() {
  const navigate = useNavigate();
  const [filtroActivo, setFiltroActivo] = useState(filtros[0]);

  const abrirAccion = (ruta) => {
    if (ruta) navigate(ruta);
  };

  return (
    <div className="min-h-[calc(100vh-120px)] bg-slate-50 -mx-4 px-4 pb-6">
      <header className="bg-[#1e293b] text-white -mx-4 px-4 py-4 mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <ClipboardList size={23} />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Gestión Agrilux</h1>
            <p className="text-[11px] text-slate-300">Administra tus recursos y operaciones</p>
          </div>
        </div>
      </header>

      <div className="scrollbar-hide -mx-1 mb-4 flex gap-2 overflow-x-auto px-1">
        {filtros.map((filtro) => (
          <button
            key={filtro}
            type="button"
            onClick={() => setFiltroActivo(filtro)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
              filtroActivo === filtro
                ? 'border-emerald-700 bg-emerald-700 text-white'
                : 'border-slate-200 bg-white text-slate-500'
            }`}
          >
            {filtro === 'Riego & Agua' && <Droplets size={12} className="mr-1 inline" />}
            {filtro === 'Maquinaria' && <Tractor size={12} className="mr-1 inline" />}
            {filtro}
          </button>
        ))}
      </div>

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
          <button
            type="button"
            onClick={() => navigate('/parcela')}
            className="rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-emerald-200"
          >
            <Users size={18} className="mb-2 text-slate-600" />
            <p className="text-[10px] text-slate-500">Recursos y equipo</p>
            <p className="mt-1 text-xs font-bold text-slate-800">Centraliza tu operación</p>
            <p className="mt-2 text-[10px] font-semibold text-emerald-700">3 cuadrillas activas ›</p>
          </button>
          <button
            type="button"
            onClick={() => navigate('/ciclo')}
            className="rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-blue-200"
          >
            <ClipboardCheck size={18} className="mb-2 text-slate-600" />
            <p className="text-[10px] text-slate-500">Actividades</p>
            <p className="mt-1 text-xs font-bold text-slate-800">Organiza tus tareas</p>
            <p className="mt-2 text-[10px] font-semibold text-blue-700">8 para hoy (2 urgentes) ›</p>
          </button>
        </div>
      </section>

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700">Métricas clave del fundo</h2>
          <span className="text-[9px] text-slate-400">Actualizado hace 12 min</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {metricas.map((metrica) => (
            <div key={metrica.titulo} className={`rounded-lg border p-2 ${metrica.panel}`}>
              <p className="min-h-6 text-[8px] font-semibold uppercase text-slate-500">{metrica.titulo}</p>
              <p className="mt-1 text-sm font-bold text-slate-800">{metrica.valor}</p>
              <div className="mt-2 h-1 rounded-full bg-white/80">
                <div className={`h-1 rounded-full ${metrica.barra}`} style={{ width: metrica.progreso }} />
              </div>
              <p className={`mt-1 text-[8px] ${metrica.texto}`}>{metrica.detalle}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-xs font-bold text-amber-900">Alerta de Almacén e Hidráulica</h2>
              <span className="shrink-0 rounded bg-amber-200 px-1.5 py-0.5 text-[8px] font-bold text-amber-800">Prioridad Alta</span>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-amber-800">
              Nitrato de Calcio en umbral mínimo (solo 4 sacos restantes). Turno de riego en Sector B3 programado para las 18:00 hrs.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-slate-900">Accesos rápidos</h2>
        <div className="space-y-2.5">
          {acciones.map(({ titulo, descripcion, icon: Icon, color, ruta, estado }) => (
            <button
              key={titulo}
              type="button"
              onClick={() => abrirAccion(ruta)}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-emerald-200"
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}>
                <Icon size={21} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-bold text-slate-800">{titulo}</p>
                  {estado && (
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold ${
                      estado === '1 crítico' ? 'bg-red-100 text-red-600' : 'bg-cyan-100 text-cyan-700'
                    }`}>
                      {estado}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-[10px] text-slate-500">{descripcion}</p>
              </div>
              <ChevronRight size={17} className="shrink-0 text-slate-400" />
            </button>
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={() => navigate('/ciclo')}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-800"
      >
        <Plus size={17} />
        Registrar Nueva Tarea / Orden de Campo
      </button>
    </div>
  );
}
