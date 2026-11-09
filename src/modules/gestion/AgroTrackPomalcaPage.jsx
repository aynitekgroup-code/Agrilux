import React, { useState } from 'react';
import { CheckCheck, X, Bell } from 'lucide-react';
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
import VehicleList from '../../components/gestion/fleet/VehicleList';
import EngineCutSection from '../../components/gestion/fleet/EngineCutSection';
import FuelDashboard from '../../components/gestion/fleet/FuelDashboard';
import RemoteCutModal from '../../components/gestion/fleet/RemoteCutModal';
import FleetAlerts from '../../components/gestion/fleet/FleetAlerts';
import ModulesOverview from '../../components/gestion/fleet/ModulesOverview';
import { FLEET } from '../../components/gestion/fleet/fleetTokens';

const INITIAL_CUT_ORDERS = [
  { id: 'ord-seed-001', hora: '06/11 · 09:12', vehiculo_id: 'veh-003', accion: 'Bloqueo de motor', origen: 'Supervisor de flota', estado: 'Aplicada (demo)' },
  { id: 'ord-seed-002', hora: '06/11 · 09:05', vehiculo_id: 'veh-005', accion: 'Bloqueo de motor', origen: 'Supervisor de flota', estado: 'Aplicada (demo)' },
  { id: 'ord-seed-003', hora: '06/11 · 08:40', vehiculo_id: 'veh-002', accion: 'Bloqueo al detenerse', origen: 'Consola remota', estado: 'Pendiente' },
  ...cutRequests.map((r) => ({
    id: r.id,
    hora: r.fecha,
    vehiculo_id: r.vehiculo_id,
    accion: 'Bloqueo de motor',
    origen: r.solicitado_por,
    estado: 'Simulada',
  })),
];

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

export default function AgroTrackPomalcaPage({ initialSection = 'consola' }) {
  const { user, empresa_activa_id, empresas_disponibles } = useAuth();
  const empresaActiva = (empresas_disponibles || []).find((empresa) => empresa.id === empresa_activa_id);
  const puedeImportarGeocercas = ['administrador', 'ingeniero'].includes(empresaActiva?.rol);
  const [section, setSection] = useState(initialSection);
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicles[0]?.id || '');
  const [alertList, setAlertList] = useState(mockAlerts);
  const [readings, setReadings] = useState(mockFuelReadings);
  const [cutModal, setCutModal] = useState(null);
  const [toast, setToast] = useState('');
  const [blockedIds, setBlockedIds] = useState(['veh-003', 'veh-005']);
  const [pendingIds, setPendingIds] = useState(['veh-002']);
  const [cutOrders, setCutOrders] = useState(INITIAL_CUT_ORDERS);

  const pendientes = alertList.filter((a) => !a.atendida).length;
  const consumoTotal = readings.reduce((sum, r) => sum + Number(r.galones || 0), 0);

  const ackAlert = (id) => setAlertList((prev) => prev.map((a) => (a.id === id ? { ...a, atendida: true } : a)));

  const abrirCorte = (vehiculo) => setCutModal({ vehiculoId: vehiculo ? vehiculo.id : '' });

  const registrarAbastecimiento = (registro) => setReadings((prev) => [registro, ...prev]);

  const registrarOrden = (vehiculoId, accion, origen, estado) => {
    const now = new Date();
    const dia = String(now.getDate()).padStart(2, '0');
    const mes = String(now.getMonth() + 1).padStart(2, '0');
    const hora = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    setCutOrders((prev) => [
      { id: `ord-${Date.now()}`, hora: `${dia}/${mes} · ${hora}`, vehiculo_id: vehiculoId, accion, origen, estado },
      ...prev,
    ]);
  };

  const aplicarCorte = (resultado) => {
    const vehiculoId = resultado.vehiculo_id;
    setBlockedIds((prev) => (prev.includes(vehiculoId) ? prev : [...prev, vehiculoId]));
    setPendingIds((prev) => prev.filter((id) => id !== vehiculoId));
    registrarOrden(vehiculoId, 'Bloqueo de motor', resultado.responsable || 'Supervisor de flota', 'Aplicada (demo)');
    setToast(`Corte simulado aplicado a ${resultado.placa}`);
  };

  const desbloquearVehiculo = (vehiculo) => {
    setBlockedIds((prev) => prev.filter((id) => id !== vehiculo.id));
    setPendingIds((prev) => prev.filter((id) => id !== vehiculo.id));
    registrarOrden(vehiculo.id, 'Desbloqueo de motor', 'Consola remota', 'Aplicada (demo)');
    setToast(`Desbloqueo simulado registrado para ${vehiculo.placa}`);
  };

  const programarBloqueo = (vehiculo) => {
    if (pendingIds.includes(vehiculo.id)) return;
    setPendingIds((prev) => [...prev, vehiculo.id]);
    registrarOrden(vehiculo.id, 'Bloqueo al detenerse', 'Consola remota', 'Pendiente');
    setToast(`Orden pendiente para ${vehiculo.placa}: se aplicará cuando se detenga.`);
  };

  return (
    <div className="space-y-4 pb-4">
      <FleetHeader activeSection={section} onSectionChange={setSection} pendingAlerts={pendientes} />

      {section === 'consola' ? (
        <div className="space-y-4">
          <FleetKpis vehicles={vehicles} alerts={alertList} fuelTotal={consumoTotal} />
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 min-w-0">
              <FleetMap
                empresaId={empresa_activa_id}
                userId={user?.id}
                canImport={puedeImportarGeocercas}
                vehicles={vehicles}
                selectedId={selectedVehicleId}
                onSelect={setSelectedVehicleId}
              />
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

      {section === 'corte' ? (
        <EngineCutSection
          vehicles={vehicles}
          alerts={alertList}
          requests={cutOrders}
          blockedIds={blockedIds}
          pendingIds={pendingIds}
          onBlock={abrirCorte}
          onUnblock={desbloquearVehiculo}
          onSchedule={programarBloqueo}
        />
      ) : null}

      {section === 'modulos' ? <ModulesOverview /> : null}

      {cutModal ? (
        <RemoteCutModal
          vehicles={vehicles}
          initialVehicleId={cutModal.vehiculoId}
          responsable={user?.nombre || 'Supervisor de flota'}
          onComplete={aplicarCorte}
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
