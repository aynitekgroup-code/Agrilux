import React, { useState } from 'react';
import {
  ShieldAlert,
  X,
  Check,
  Wifi,
  WifiOff,
  Gauge,
  Lock,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { FLEET, STATUS_META } from './fleetTokens';

const STEPS = [
  { id: 1, label: 'Selección' },
  { id: 2, label: 'Verificación' },
  { id: 3, label: 'Confirmación' },
];

function MiniPill({ estado }) {
  const meta = STATUS_META[estado] || STATUS_META.offline;
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: meta.bg, color: meta.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.dot }} />
      {meta.label}
    </span>
  );
}

function CheckLine({ ok, label, detail }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
        {ok ? <Check size={15} /> : <X size={15} />}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

export default function RemoteCutModal({ vehicles = [], initialVehicleId, responsable, onClose, onComplete }) {
  const preselected = vehicles.find((v) => v.id === initialVehicleId);
  const [step, setStep] = useState(preselected ? 2 : 1);
  const [vehicleId, setVehicleId] = useState(preselected ? preselected.id : '');
  const [motivo, setMotivo] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  const vehicle = vehicles.find((v) => v.id === vehicleId) || null;
  const listo = Boolean(vehicle && vehicle.conectado && vehicle.velocidad_kmh === 0);

  const reiniciar = () => {
    setStep(1);
    setVehicleId('');
    setMotivo('');
    setPin('');
    setError('');
    setResultado(null);
  };

  const continuarVerificacion = () => {
    if (!vehicle) {
      setError('Selecciona una unidad para continuar.');
      return;
    }
    setError('');
    setStep(2);
  };

  const solicitar = () => {
    if (!motivo.trim()) {
      setError('El motivo de la inmovilización es obligatorio.');
      return;
    }
    if (pin.trim().length < 4) {
      setError('Ingresa el PIN del responsable (mínimo 4 dígitos). Demo: 1234.');
      return;
    }
    setError('');
    const resultado = {
      placa: vehicle.placa,
      modelo: vehicle.modelo,
      motivo: motivo.trim(),
      hora: new Date().toLocaleString('es-PE'),
      responsable: responsable || 'Supervisor de flota',
    };
    setResultado(resultado);
    setStep(4);
    onComplete?.({ vehiculo_id: vehicle.id, ...resultado });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="cut-title">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start gap-3 p-5 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <ShieldAlert size={20} />
          </div>
          <div className="min-w-0">
            <h2 id="cut-title" className="text-lg font-bold text-slate-900">Inmovilización / corte remoto</h2>
            <p className="text-xs text-slate-500">Simulación segura. No se envían comandos reales al vehículo.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="ml-auto text-slate-400 hover:text-slate-700">
            <X size={20} />
          </button>
        </div>

        {step < 4 ? (
          <div className="px-5 pt-4 flex items-center gap-1.5 flex-wrap">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.id}>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${step === s.id ? 'bg-forest text-white' : step > s.id ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'}`}>
                  <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">
                    {step > s.id ? <Check size={10} /> : s.id}
                  </span>
                  {s.label}
                </span>
                {i < STEPS.length - 1 ? <ChevronRight size={14} className="text-slate-300" /> : null}
              </React.Fragment>
            ))}
          </div>
        ) : null}

        <div className="p-5 space-y-4">
          {step === 1 ? (
            <>
              <p className="text-sm text-slate-600">Selecciona la unidad que deseas inmovilizar en esta simulación.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {vehicles.map((v) => {
                  const active = v.id === vehicleId;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVehicleId(v.id)}
                      className={`text-left rounded-xl border p-3 transition-colors ${active ? 'border-forest bg-emerald-50/60' : 'border-slate-200 hover:border-slate-300'}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-800">{v.placa}</span>
                        <span className="ml-auto"><MiniPill estado={v.estado} /></span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{v.modelo} · {v.tipo}</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {v.conectado ? <Wifi size={11} className="inline mr-1" /> : <WifiOff size={11} className="inline mr-1" />}
                        {v.velocidad_kmh} km/h · {v.ultima_ubicacion}
                      </p>
                    </button>
                  );
                })}
              </div>
              {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button type="button" onClick={continuarVerificacion} className="rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-white hover:bg-forest-dark">Verificar unidad</button>
              </div>
            </>
          ) : null}

          {step === 2 && vehicle ? (
            <>
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-800">{vehicle.placa}</span>
                <span className="text-xs text-slate-500">{vehicle.modelo} · {vehicle.conductor_nombre}</span>
                <span className="ml-auto"><MiniPill estado={vehicle.estado} /></span>
              </div>

              <div className="space-y-2">
                <CheckLine
                  ok={vehicle.conectado}
                  label="Conexión del equipo GPS"
                  detail={vehicle.conectado ? 'Equipo reportando en línea.' : 'Sin conexión. No es posible verificar la unidad.'}
                />
                <CheckLine
                  ok={vehicle.velocidad_kmh === 0}
                  label="Velocidad de la unidad"
                  detail={vehicle.velocidad_kmh === 0 ? 'Unidad detenida (0 km/h).' : `Unidad en movimiento (${vehicle.velocidad_kmh} km/h). Detén la unidad para habilitar el corte.`}
                />
                <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                  <span className="w-7 h-7 rounded-lg bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                    <Gauge size={15} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Estado del motor</p>
                    <p className="text-xs text-slate-500">{vehicle.ignicion ? 'Ignición encendida' : 'Ignición apagada'} · Odómetro {vehicle.odometro_km.toLocaleString('es-PE')} km</p>
                  </div>
                </div>
              </div>

              {!listo ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                  La inmovilización solo se habilita con el vehículo conectado y a 0 km/h. Esta validación es parte del flujo de seguridad.
                </div>
              ) : null}

              <div className="flex justify-between gap-2 pt-1">
                <button type="button" onClick={() => { setStep(1); setError(''); }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Volver</button>
                <button
                  type="button"
                  onClick={() => { setError(''); setStep(3); }}
                  disabled={!listo}
                  className="rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-white hover:bg-forest-dark disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continuar a confirmación
                </button>
              </div>
            </>
          ) : null}

          {step === 3 && vehicle ? (
            <>
              <div className="rounded-xl border border-red-100 bg-red-50/60 p-3">
                <p className="text-sm font-semibold text-red-700">Vas a simular el corte de motor de {vehicle.placa}</p>
                <p className="text-xs text-red-600/80 mt-0.5">El vehículo está detenido y conectado. La solicitud quedará registrada con fines demostrativos.</p>
              </div>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Motivo de la inmovilización *</span>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                  placeholder="Ej. Sospecha de extracción de combustible"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-slate-700 outline-none focus:border-forest focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-400">PIN del responsable *</span>
                <div className="relative mt-1">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="PIN demo: 1234"
                    autoComplete="off"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-9 pr-3 py-2 text-sm text-slate-700 outline-none focus:border-forest focus:bg-white"
                  />
                </div>
              </label>

              {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}

              <div className="flex justify-between gap-2 pt-1">
                <button type="button" onClick={() => { setStep(2); setError(''); }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Volver</button>
                <button type="button" onClick={solicitar} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                  Solicitar inmovilización (DEMO)
                </button>
              </div>
            </>
          ) : null}

          {step === 4 && resultado ? (
            <div className="text-center py-2">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                <CheckCircle2 size={34} />
              </div>
              <h3 className="mt-3 text-lg font-bold text-slate-900">Solicitud procesada correctamente (DEMO)</h3>
              <p className="text-sm text-slate-500 mt-1">La orden quedó registrada únicamente en esta simulación.</p>

              <dl className="mt-4 text-left rounded-xl border border-slate-100 divide-y divide-slate-100">
                <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm"><dt className="text-slate-500">Unidad</dt><dd className="font-semibold text-slate-800">{resultado.placa} · {resultado.modelo}</dd></div>
                <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm"><dt className="text-slate-500">Motivo</dt><dd className="font-semibold text-slate-800 text-right">{resultado.motivo}</dd></div>
                <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm"><dt className="text-slate-500">Solicitado por</dt><dd className="font-semibold text-slate-800">{resultado.responsable}</dd></div>
                <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm"><dt className="text-slate-500">Fecha y hora</dt><dd className="font-semibold text-slate-800">{resultado.hora}</dd></div>
                <div className="flex items-center justify-between gap-3 px-3 py-2 text-sm"><dt className="text-slate-500">Estado</dt><dd className="font-semibold text-amber-700">Simulación · sin comando físico</dd></div>
              </dl>

              <div className="mt-4 flex flex-col sm:flex-row justify-center gap-2">
                <button type="button" onClick={reiniciar} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Nueva simulación</button>
                <button type="button" onClick={onClose} className="rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-white hover:bg-forest-dark">Cerrar</button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center gap-2 text-[11px] text-slate-500">
          <ShieldAlert size={13} className="text-amber-600 shrink-0" />
          Flujo 100 % demostrativo. No se invocan comandos físicos ni se desactivan protecciones de hardware.
        </div>
      </div>
    </div>
  );
}
