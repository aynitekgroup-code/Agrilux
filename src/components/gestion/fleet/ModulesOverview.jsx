import React, { useState } from 'react';
import {
  Truck,
  User,
  Radio,
  Activity,
  MapPin,
  Fuel,
  Bell,
  Database,
  ArrowRight,
  Link2,
  GitBranch,
} from 'lucide-react';
import { modules } from '../../../mocks/agrotrackData';
import { FLEET } from './fleetTokens';

const ICONS = {
  truck: Truck,
  user: User,
  radio: Radio,
  activity: Activity,
  map: MapPin,
  fuel: Fuel,
  bell: Bell,
  database: Database,
};

const nombreDe = (id) => {
  const found = modules.find((m) => m.id === id);
  return found ? found.nombre : id;
};

export default function ModulesOverview() {
  const [selectedId, setSelectedId] = useState(modules[0]?.id || '');
  const selected = modules.find((m) => m.id === selectedId) || modules[0];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">Esquema funcional de AgroTrack</h2>
            <p className="text-xs text-slate-500">Relación entre vehículos, dispositivos, telemetría y persistencia.</p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
            <GitBranch size={12} /> Arquitectura modular
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {modules.map((m, i) => {
            const Icon = ICONS[m.icon] || Database;
            const active = m.id === selectedId;
            return (
              <React.Fragment key={m.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(m.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                    active ? 'bg-forest text-white' : 'bg-slate-50 text-slate-600 hover:text-forest'
                  }`}
                >
                  <Icon size={13} />
                  {m.nombre}
                </button>
                {i < modules.length - 1 ? <ArrowRight size={13} className="text-slate-300" /> : null}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {modules.map((m) => {
          const Icon = ICONS[m.icon] || Database;
          const active = m.id === selectedId;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedId(m.id)}
              className={`text-left bg-white rounded-2xl border shadow-sm p-4 transition-all ${
                active ? 'border-forest ring-1 ring-forest/20' : 'border-slate-100 hover:border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${active ? 'bg-forest text-white' : 'bg-emerald-50 text-emerald-700'}`}>
                  <Icon size={17} />
                </span>
                {m.id === 'supabase' ? (
                  <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">RLS</span>
                ) : null}
              </div>
              <p className="mt-2 text-sm font-bold text-slate-900">{m.nombre}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{m.descripcion}</p>
              <p className="mt-2 text-[10px] font-mono text-slate-400 truncate">{m.tabla}</p>
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Detalle del módulo</span>
            <span className="rounded-full bg-forest text-white px-2.5 py-0.5 text-[11px] font-semibold">{selected.nombre}</span>
            <span className="ml-auto font-mono text-[11px] text-slate-400">{selected.tabla}</span>
          </div>
          <p className="text-sm text-slate-600 mt-2">{selected.descripcion}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
              <Link2 size={13} /> Depende de:
            </span>
            {selected.depende_de.length === 0 ? (
              <span className="text-[11px] text-slate-400">Módulo base</span>
            ) : (
              selected.depende_de.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedId(id)}
                  className="rounded-full border border-slate-200 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 hover:border-forest hover:text-forest"
                >
                  {nombreDe(id)}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Datos reales · Supabase</p>
          <ul className="mt-2 text-xs text-emerald-900/80 space-y-1.5">
            <li>Autenticación, empresa activa y permisos por <span className="font-semibold">empresa_id</span> (RLS).</li>
            <li>Posiciones GPS, km, estado y recorrido de <span className="font-mono">agrotrack_posiciones</span>.</li>
            <li>Geocercas reales importadas por ZIP: <span className="font-mono">agrotrack_geocercas</span>.</li>
            <li>Alertas de alta velocidad y botón de pánico.</li>
            <li>Reporte de actividad (día/mes), exportación a Excel y resumen con IA.</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Pendiente de fuente real</p>
          <ul className="mt-2 text-xs text-amber-900/80 space-y-1.5">
            <li>Combustible, nivel de tanque y anomalías (sin sensor ni registros de carga).</li>
            <li>Corte remoto: no existe la tabla de órdenes ni comando al rastreador.</li>
            <li>Conductor y temperatura: Zonar no los entrega en este volcado.</li>
            <li>
              La Consola principal conserva algunos indicadores demostrativos, siempre marcados como
              <span className="font-semibold"> demo</span>.
            </li>
          </ul>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 px-1" style={{ color: FLEET.muted }}>
        Los mocks viven en <span className="font-mono">src/mocks/agrotrackData.js</span> con nombres de campos alineados a futuras tablas PostgreSQL.
      </p>
    </div>
  );
}
