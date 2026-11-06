import React, { useState } from 'react';
import {
  Power,
  ShieldAlert,
  Wifi,
  WifiOff,
  Gauge,
  CheckCheck,
  X,
  Bell,
} from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import {
  vehicles,
  alerts as mockAlerts,
  fuelReadings as mockFuelReadings,
  fuelAnomalies,
  cutRequests,
} from '../../mocks/agrotrackData';
import FleetHeader from '../../components/gestion/fleet/FleetHeader';
import FleetKpis from '../../components/gestion/fleet/FleetKpis';
import FleetMap from '../../components/gestion/fleet/FleetMap';
import VehicleList, { StatusPill } from '../../components/gestion/fleet/VehicleList';
import FuelDashboard from '../../components/gestion/fleet/FuelDashboard';
import RemoteCutModal from '../../components/gestion/fleet/RemoteCutModal';
import FleetAlerts from '../../components/gestion/fleet/FleetAlerts';
import ModulesOverview from '../../components/gestion/fleet/ModulesOverview';
import { FLEET } from '../../components/gestion/fleet/fleetTokens';

function SectionHeading({ title, description, children }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500 mt-0.5 max-w-3xl">{description}</p>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{children}</div> : null}
    </div>
  );
}

function CorteSection({ vehiclesList, onStart }) {
  const placa = (id) => {
    const found = vehiclesList.find((v) => v.id === id);
    return found ? found.placa : id;
  };

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Inmovilización / corte remoto"
        description="Flujo de seguridad de 3 pasos con verificación de conexión y velocidad. Todo el proceso es 100 % demostrativo."
      >
        <button
          type="button"
          onClick={() => onStart(null)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-white hover:bg-forest-dark"
        >
          <Power size={15} /> Iniciar simulación
        </button>
      </SectionHeading>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { n: 1, t: 'Selección', d: 'Elige la unidad objetivo del corte.' },
            { n: 2, t: 'Verificación', d: 'GPS conectado y velocidad de 0 km/h.' },
            { n: 3, t: 'Confirmación', d: 'Motivo obligatorio y PIN del responsable.' },
          ].map((s) => (
            <div key={s.n} className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              <span className="w-6 h-6 rounded-full bg-forest text-white text-xs font-bold flex items-center justify-center shrink-0">{s.n}</span>
              <div>
                <p className="text-sm font-semibold text-slate-800">{s.t}</p>
                <p className="text-xs text-slate-500">{s.d}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <ShieldAlert size={15} className="shrink-0 mt-0.5" />
          <p>No se invocan comandos físicos ni se desactivan protecciones de hardware. El resultado se registra solo en esta simulación.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h3 className="text-base font-bold text-slate-900">Unidades disponibles</h3>
          <span className="text-xs text-slate-500">{vehiclesList.length} unidades registradas</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {vehiclesList.map((v) => {
            const listo = v.conectado && v.velocidad_kmh === 0;
            return (
              <div key={v.id} className={`rounded-xl border p-3 ${listo ? 'border-slate-200' : 'border-amber-200 bg-amber-50/40'}`}>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-800">{v.placa}</span>
                  <span className="ml-auto"><StatusPill estado={v.estado} /></span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">{v.modelo} · {v.tipo}</p>
                <div className="mt-2 flex items-center gap-2 text-[11px]">
                  <span className={`inline-flex items-center gap-1 ${v.conectado ? 'text-emerald-700' : 'text-red-600'}`}>
                    {v.conectado ? <Wifi size={12} /> : <WifiOff size={12} />}
                    {v.conectado ? 'Conectado' : 'Sin conexión'}
                  </span>
                  <span className={`inline-flex items-center gap-1 ${v.velocidad_kmh === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    <Gauge size={12} /> {v.velocidad_kmh} km/h
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onStart(v)}
                  className="mt-3 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-forest hover:text-forest transition-colors"
                >
                  Simular corte
                </button>
                {!listo ? <p className="text-[10px] text-amber-700 mt-1.5">Requiere conexión y 0 km/h para habilitar el corte.</p> : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 flex items-center gap-2 border-b border-slate-50">
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center"><CheckCheck size={17} /></div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Bitácora de solicitudes demo</h3>
            <p className="text-xs text-slate-500">Historial simulado · sin comandos reales</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="bg-slate-50 text-left">
                {['Fecha', 'Vehículo', 'Motivo', 'Solicitado por', 'Estado', 'Respuesta'].map((h) => (
                  <th key={h} className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cutRequests.map((r) => (
                <tr key={r.id} className="border-b border-slate-50">
                  <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{r.fecha}</td>
                  <td className="px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">{placa(r.vehiculo_id)}</td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.motivo}</td>
                  <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{r.solicitado_por}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase">Demo</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">{r.respuesta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function AgroTrackPomalcaPage({ initialSection = 'consola' }) {
  const { user } = useAuth();
  const [section, setSection] = useState(initialSection);
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicles[0]?.id || '');
  const [alertList, setAlertList] = useState(mockAlerts);
  const [readings, setReadings] = useState(mockFuelReadings);
  const [cutModal, setCutModal] = useState(null);
  const [toast, setToast] = useState('');

  const pendientes = alertList.filter((a) => !a.atendida).length;
  const consumoTotal = readings.reduce((sum, r) => sum + Number(r.galones || 0), 0);

  const ackAlert = (id) => setAlertList((prev) => prev.map((a) => (a.id === id ? { ...a, atendida: true } : a)));

  const abrirCorte = (vehiculo) => setCutModal({ vehiculoId: vehiculo ? vehiculo.id : '' });

  const registrarAbastecimiento = (registro) => setReadings((prev) => [registro, ...prev]);

  return (
    <div className="space-y-4 pb-4">
      <FleetHeader activeSection={section} onSectionChange={setSection} pendingAlerts={pendientes} />

      {section === 'consola' ? (
        <div className="space-y-4">
          <FleetKpis vehicles={vehicles} alerts={alertList} fuelTotal={consumoTotal} />
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 min-w-0">
              <FleetMap vehicles={vehicles} selectedId={selectedVehicleId} onSelect={setSelectedVehicleId} />
            </div>
            <div className="min-w-0">
              <FleetAlerts alerts={alertList} vehicles={vehicles} onAck={ackAlert} />
            </div>
          </div>
          <VehicleList
            vehicles={vehicles}
            selectedId={selectedVehicleId}
            onSelect={setSelectedVehicleId}
            onCut={abrirCorte}
          />
        </div>
      ) : null}

      {section === 'combustible' ? (
        <div className="space-y-4">
          <SectionHeading
            title="Control de combustible"
            description="Niveles de tanque, cargas registradas, comparación real vs. estimada y anomalías detectadas."
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
              <Bell size={12} /> Datos simulados
            </span>
          </SectionHeading>
          <FuelDashboard
            vehicles={vehicles}
            readings={readings}
            anomalies={fuelAnomalies}
            onRegister={registrarAbastecimiento}
            responsable={user?.nombre || 'Supervisor de flota'}
            onToast={setToast}
          />
        </div>
      ) : null}

      {section === 'corte' ? <CorteSection vehiclesList={vehicles} onStart={abrirCorte} /> : null}

      {section === 'modulos' ? <ModulesOverview /> : null}

      {cutModal ? (
        <RemoteCutModal
          vehicles={vehicles}
          initialVehicleId={cutModal.vehiculoId}
          responsable={user?.nombre || 'Supervisor de flota'}
          onClose={() => setCutModal(null)}
        />
      ) : null}

      {toast ? (
        <div
          className="fixed right-5 bottom-5 z-50 flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-white shadow-lg"
          style={{ background: FLEET.forest }}
          role="status"
        >
          <CheckCheck size={16} />
          <span>{toast}</span>
          <button type="button" onClick={() => setToast('')} aria-label="Cerrar notificación" className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
