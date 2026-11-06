import React, { useState } from 'react';
import {
  Bell,
  Clock,
  Fuel,
  History,
  Lock,
  Pause,
  Play,
  Power,
  Settings2,
  ShieldAlert,
  Timer,
  Unlock,
  WifiOff,
} from 'lucide-react';

const GROUP_BY_TYPE = {
  Camión: 'Transporte',
  'Pick-up': 'Supervisión',
  Tractor: 'Maquinaria',
};

const RULES_DEFAULT = [
  {
    id: 'geocerca',
    label: 'Salida de la zona autorizada',
    desc: 'Solicita el bloqueo si la unidad sale sin autorización.',
    activa: true,
  },
  {
    id: 'velocidad',
    label: 'Exceso de velocidad',
    desc: 'Notifica y programa el bloqueo al detenerse.',
    activa: true,
  },
  {
    id: 'detencion',
    label: 'Detención prolongada',
    desc: 'Alerta si la unidad permanece detenida más de 30 minutos.',
    activa: false,
  },
  {
    id: 'bateria',
    label: 'Batería baja del GPS',
    desc: 'Avisa antes de perder la telemetría de la unidad.',
    activa: true,
  },
];

const ESTADO_CORTE = {
  bloqueado: {
    label: 'Bloqueado',
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
  },
  pendiente: {
    label: 'Pendiente',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  conduciendo: {
    label: 'Conduciendo',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  ralenti: {
    label: 'Ralentí',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  detenido: {
    label: 'Detenido',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  },
  offline: {
    label: 'Sin conexión',
    color: 'text-slate-500',
    bg: 'bg-slate-100',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  },
};

const ORDEN_ESTADO = {
  'Aplicada (demo)': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Pendiente: 'bg-amber-50 text-amber-700 border-amber-200',
  Simulada: 'bg-slate-100 text-slate-600 border-slate-200',
};

function grupoVehiculo(vehiculo) {
  return GROUP_BY_TYPE[vehiculo.tipo] || vehiculo.tipo || 'Flota';
}

function galonesCombustible(vehiculo) {
  const capacidad = Number(vehiculo.capacidad_tanque_gal || 0);
  const nivel = Number(vehiculo.nivel_tanque_pct || 0);
  return ((capacidad * nivel) / 100).toFixed(1);
}

function estadoCorte(vehiculo, bloqueado, pendiente) {
  if (bloqueado) return 'bloqueado';
  if (pendiente) return 'pendiente';
  if (!vehiculo.conectado) return 'offline';
  if (vehiculo.velocidad_kmh > 0) return 'conduciendo';
  if (vehiculo.ignicion) return 'ralenti';
  return 'detenido';
}

function EstadoPill({ estado }) {
  const meta = ESTADO_CORTE[estado];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${meta.bg} ${meta.color} ${meta.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function AccionCorte({ vehiculo, bloqueado, pendiente, onBlock, onUnblock, onSchedule }) {
  if (bloqueado) {
    return (
      <button
        type="button"
        onClick={() => onUnblock(vehiculo)}
        className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
      >
        <Unlock size={13} /> Desbloquear
      </button>
    );
  }

  if (pendiente) {
    return (
      <span
        title="La orden se aplicará cuando la unidad se detenga"
        className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700"
      >
        <Clock size={13} /> Pendiente al detenerse
      </span>
    );
  }

  if (!vehiculo.conectado) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex cursor-not-allowed items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-400"
      >
        <WifiOff size={13} /> Sin conexión
      </button>
    );
  }

  if (vehiculo.velocidad_kmh > 0) {
    return (
      <button
        type="button"
        onClick={() => onSchedule(vehiculo)}
        className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-rose-700"
      >
        <Timer size={13} /> Bloquear al detenerse
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onBlock(vehiculo)}
      className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-rose-700"
    >
      <Lock size={13} /> Bloquear motor
    </button>
  );
}

export default function EngineCutSection({
  vehicles = [],
  alerts = [],
  requests = [],
  blockedIds = [],
  pendingIds = [],
  onBlock,
  onUnblock,
  onSchedule,
}) {
  const [paused, setPaused] = useState(false);
  const [rules, setRules] = useState(RULES_DEFAULT);

  const hora = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  const alertasAbiertas = alerts.filter((a) => !a.atendida).length;
  const bloqueados = vehicles.filter((v) => blockedIds.includes(v.id)).length;
  const reglasActivas = rules.filter((r) => r.activa).length;

  const toggleRule = (id) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, activa: !r.activa } : r)));
  };

  const placaDe = (id) => {
    const found = vehicles.find((v) => v.id === id);
    return found ? found.placa : id;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
          <Power size={20} />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-900 sm:text-xl">Corte de motor remoto</h2>
          <p className="mt-0.5 max-w-3xl text-sm text-slate-500">
            El relé corta la bomba de combustible con la unidad conectada y a 0 km/h. Si está en
            marcha, la orden queda pendiente hasta que se detenga. Toda orden queda registrada.
          </p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
          <ShieldAlert size={12} /> Modo demo
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <Clock size={14} className="text-forest" /> Hora de la flota
          <strong className="text-slate-900">{hora}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800">
          <Timer size={12} /> Simulación: cada 2 s equivale a un reporte GPS de 60 s
        </span>
        {paused ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
            Simulación pausada
          </span>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPaused((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            {paused ? <Play size={13} /> : <Pause size={13} />}
            {paused ? 'Reanudar' : 'Pausar'}
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
            <Bell size={13} className="text-rose-500" /> {alertasAbiertas} alertas abiertas
          </span>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-900">
        <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-600" />
        <p>
          Protocolo de seguridad: en esta demostración el bloqueo solo se habilita con GPS en línea
          y velocidad de 0 km/h. Las unidades en movimiento reciben una orden pendiente que se
          aplicaría al detenerse. No se envían comandos físicos al vehículo.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          <h3 className="text-base font-bold text-slate-900">Unidades de la flota</h3>
          <span className="text-xs text-slate-500">{vehicles.length} unidades registradas</span>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
              {bloqueados} bloqueadas
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              {pendingIds.length} pendientes
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              {reglasActivas} reglas activas
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                {['Unidad', 'Grupo', 'Estado', 'Velocidad', 'Ubicación', 'Combustible', 'Acción'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => {
                const bloqueado = blockedIds.includes(v.id);
                const pendiente = pendingIds.includes(v.id);
                const estado = estadoCorte(v, bloqueado, pendiente);
                return (
                  <tr
                    key={v.id}
                    className={`border-b border-slate-50 last:border-0 hover:bg-slate-50/60 ${
                      bloqueado ? 'bg-rose-50/40' : pendiente ? 'bg-amber-50/30' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-800">{v.placa}</p>
                      <p className="text-[11px] text-slate-500">{v.modelo}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{grupoVehiculo(v)}</td>
                    <td className="px-4 py-3"><EstadoPill estado={estado} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-700">
                      {v.velocidad_kmh} km/h
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{v.ultima_ubicacion}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                        <Fuel size={13} className="text-emerald-600" /> {galonesCombustible(v)} gal
                      </span>
                      <span className="ml-1.5 text-[10px] text-slate-400">{v.nivel_tanque_pct}%</span>
                    </td>
                    <td className="px-4 py-3">
                      <AccionCorte
                        vehiculo={v}
                        bloqueado={bloqueado}
                        pendiente={pendiente}
                        onBlock={onBlock}
                        onUnblock={onUnblock}
                        onSchedule={onSchedule}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Settings2 size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Reglas automáticas</h3>
              <p className="text-[11px] text-slate-500">Se evalúan en cada reporte GPS simulado.</p>
            </div>
            <span className="ml-auto rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              {reglasActivas} activas
            </span>
          </div>
          <div className="space-y-2 p-3">
            {rules.map((rule) => (
              <button
                key={rule.id}
                type="button"
                role="switch"
                aria-checked={rule.activa}
                onClick={() => toggleRule(rule.id)}
                className="flex w-full items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-left transition-colors hover:bg-slate-50"
              >
                <span
                  className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                    rule.activa ? 'bg-forest' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      rule.activa ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-800">{rule.label}</span>
                  <span className="block text-xs text-slate-500">{rule.desc}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-400">
            Reglas demostrativas. No ejecutan comandos reales ni modifican el vehículo.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <History size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Bitácora de órdenes</h3>
              <p className="text-[11px] text-slate-500">Historial simulado de bloqueos y desbloqueos.</p>
            </div>
            <span className="ml-auto rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-500">
              {requests.length} órdenes
            </span>
          </div>
          <div className="max-h-[300px] overflow-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  {['Hora', 'Unidad', 'Acción', 'Origen', 'Estado'].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requests.map((orden) => (
                  <tr key={orden.id} className="border-b border-slate-50 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 text-[11px] text-slate-500">{orden.hora}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700">{placaDe(orden.vehiculo_id)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">{orden.accion}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-[11px] text-slate-500">{orden.origen}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ORDEN_ESTADO[orden.estado] || ORDEN_ESTADO.Simulada}`}>
                        {orden.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
