import React, { useCallback, useEffect, useState } from 'react';
import { CheckCheck, X, Bell, RefreshCw, Database, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import {
  vehicles,
  alerts as mockAlerts,
  fuelReadings as mockFuelReadings,
  cutRequests,
} from '../../mocks/agrotrackData';
import { cargarPanelFlota, textoPeriodoCargado, formatearRango, LIMITE_ALERTAS_PANEL } from '../../lib/agrotrackFlota';
import FleetHeader from '../../components/gestion/fleet/FleetHeader';
import FleetKpis from '../../components/gestion/fleet/FleetKpis';
import FleetMap from '../../components/gestion/fleet/FleetMap';
import VehicleList from '../../components/gestion/fleet/VehicleList';
import FleetReports from '../../components/gestion/fleet/FleetReports';
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

/**
 * Estado honesto de una sección que todavía no tiene fuente real de datos.
 * Reemplaza a los tableros demostrativos: no se muestran cifras inventadas.
 */
function PanelSinDatos({ titulo, descripcion, puntos = [], nota = null }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
          <Database size={18} />
        </span>
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
            Sin datos
          </span>
          <h3 className="mt-2 text-base font-bold text-slate-800">{titulo}</h3>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed max-w-3xl">{descripcion}</p>
          {puntos.length ? (
            <ul className="mt-3 space-y-1.5">
              {puntos.map((punto) => (
                <li key={punto} className="text-xs text-slate-500 flex items-start gap-2">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                  {punto}
                </li>
              ))}
            </ul>
          ) : null}
          {nota ? (
            <p className="mt-3 text-[11px] text-slate-400 border-t border-slate-100 pt-3 leading-relaxed">{nota}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function AgroTrackPomalcaPage({ initialSection = 'consola' }) {
  const { user, empresa_activa_id, empresas_disponibles } = useAuth();
  const empresaActiva = (empresas_disponibles || []).find((empresa) => empresa.id === empresa_activa_id);
  const puedeImportarGeocercas = ['administrador', 'ingeniero'].includes(empresaActiva?.rol);
  const [section, setSection] = useState(initialSection);
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicles[0]?.id || '');
  const [readings, setReadings] = useState(mockFuelReadings);
  // Panel de flota con datos reales de public.agrotrack_posiciones (FASE 1).
  const [panel, setPanel] = useState({ estado: 'cargando', periodo: null, unidades: [], alertas: [], error: null });
  // "Marcar atendida" queda en memoria: todavía no existe la tabla agrotrack_alertas.
  const [ackIds, setAckIds] = useState([]);
  const [cutModal, setCutModal] = useState(null);
  const [toast, setToast] = useState('');
  const [blockedIds, setBlockedIds] = useState(['veh-003', 'veh-005']);
  const [pendingIds, setPendingIds] = useState(['veh-002']);
  const [cutOrders, setCutOrders] = useState(INITIAL_CUT_ORDERS);

  // ¿Hay filas reales en agrotrack_posiciones para esta empresa?
  const enCarga = panel.estado === 'cargando';
  const hayErrorPanel = panel.estado === 'error';
  const conDatosReales = panel.estado === 'real';
  const sinDatosReales = panel.estado === 'vacio';

  // Fuente compartida por tarjetas, alertas y marcadores del mapa.
  const vehiclesFuente = conDatosReales ? panel.unidades : sinDatosReales ? vehicles : [];
  const alertasBase = conDatosReales ? panel.alertas : sinDatosReales ? mockAlerts : [];
  const alertList = alertasBase.map((alerta) => (ackIds.includes(alerta.id) ? { ...alerta, atendida: true } : alerta));
  const fuentePosiciones = conDatosReales ? 'real' : enCarga ? 'cargando' : hayErrorPanel ? 'ninguna' : 'demo';

  const recargarPanel = useCallback(async () => {
    if (!empresa_activa_id) {
      setPanel({ estado: 'vacio', periodo: null, unidades: [], alertas: [], error: null });
      return;
    }
    setPanel((prev) => ({ ...prev, estado: 'cargando', error: null }));
    setPanel(await cargarPanelFlota(empresa_activa_id));
  }, [empresa_activa_id]);

  useEffect(() => {
    recargarPanel();
  }, [recargarPanel]);

  // Con datos reales, la selección pasa a la primera unidad real (ids = placa).
  useEffect(() => {
    if (panel.estado !== 'real' || !panel.unidades.length) return;
    setSelectedVehicleId((prev) => (panel.unidades.some((unidad) => unidad.id === prev) ? prev : panel.unidades[0].id));
  }, [panel]);

  const pendientes = alertList.filter((a) => !a.atendida).length;
  const consumoTotal = readings.reduce((sum, r) => sum + Number(r.galones || 0), 0);

  const ackAlert = (id) => setAckIds((prev) => (prev.includes(id) ? prev : [...prev, id]));

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
          {enCarga ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-start gap-3">
              <span className="flex shrink-0 items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500">
                <Loader2 size={16} className="animate-spin" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-700">Cargando datos de flota</p>
                <p className="text-xs text-slate-500 mt-0.5">Consultando public.agrotrack_posiciones de la empresa activa…</p>
              </div>
            </div>
          ) : null}

          {hayErrorPanel ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
              <span className="flex shrink-0 items-center justify-center w-8 h-8 rounded-full bg-red-200 text-red-700">
                <AlertTriangle size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-red-800">No se pudieron cargar los datos reales</p>
                <p className="text-xs text-red-700 mt-0.5 leading-relaxed">{panel.error}</p>
              </div>
              <button
                type="button"
                onClick={recargarPanel}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-2.5 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-100 transition-colors"
              >
                <RefreshCw size={12} /> Reintentar
              </button>
            </div>
          ) : null}

          {conDatosReales ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
              <span className="flex shrink-0 items-center justify-center w-8 h-8 rounded-full bg-emerald-200 text-emerald-700">
                <Database size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-emerald-800">
                  Datos reales: {formatearRango(panel.periodo?.desde, panel.periodo?.hasta)}
                </p>
                <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">
                  {panel.periodo?.unidades} unidades · {panel.periodo?.registros} posiciones de public.agrotrack_posiciones.
                  Combustible, conductor y temperatura siguen sin fuente real (demo / sin datos).
                </p>
              </div>
            </div>
          ) : null}

          {sinDatosReales ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
              <span className="flex shrink-0 items-center justify-center w-8 h-8 rounded-full bg-amber-200 text-amber-700 font-bold text-xs">!</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-800">Datos de demostración</p>
                <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                  Esta empresa todavía no tiene filas en agrotrack_posiciones, así que ves datos de ejemplo (vehículos,
                  conductores, telemetría y combustible). Carga un reporte de Zonar con “Cargar reporte de unidades” para ver la flota real.
                </p>
              </div>
            </div>
          ) : null}

          <FleetKpis
            vehicles={vehiclesFuente}
            alerts={alertList}
            fuelTotal={consumoTotal}
            cargando={enCarga}
            error={hayErrorPanel ? panel.error : null}
            combustibleDemo
            notaPeriodo={conDatosReales ? textoPeriodoCargado(panel.periodo) : null}
            onReintentar={recargarPanel}
          />
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 min-w-0">
              <FleetMap
                empresaId={empresa_activa_id}
                userId={user?.id}
                canImport={puedeImportarGeocercas}
                vehicles={vehiclesFuente}
                selectedId={selectedVehicleId}
                onSelect={setSelectedVehicleId}
                fuentePosiciones={fuentePosiciones}
                periodo={conDatosReales ? panel.periodo : null}
              />
            </div>
            <div className="min-w-0">
              <FleetAlerts
                alerts={alertList}
                vehicles={vehiclesFuente}
                onAck={ackAlert}
                cargando={enCarga}
                error={hayErrorPanel ? panel.error : null}
                fuente={conDatosReales ? 'real' : 'demo'}
                notaTope={
                  conDatosReales && panel.alertas.length >= LIMITE_ALERTAS_PANEL
                    ? `Se muestran las ${LIMITE_ALERTAS_PANEL} más recientes; hay más eventos en el periodo.`
                    : null
                }
                onReintentar={recargarPanel}
              />
            </div>
          </div>
          {/* Lo que ya funciona con datos reales, también en la pantalla principal. */}
          <FleetReports
            empresaId={empresa_activa_id}
            empresaNombre={empresaActiva?.nombre || ''}
            periodo={conDatosReales ? panel.periodo : null}
            vehicles={vehiclesFuente}
            fuente={fuentePosiciones === 'real' ? 'real' : 'demo'}
          />
          <VehicleList
            vehicles={vehicles}
            selectedId={selectedVehicleId}
            onSelect={setSelectedVehicleId}
            onCut={abrirCorte}
          />
        </div>
      ) : null}

      {section === 'mapas' ? (
        <div className="space-y-4">
          <SectionHeading
            title="Mapa de flota"
            description="Posiciones de agrotrack_posiciones sobre el mapa: geocercas, buscador, comandos de voz y recorrido por unidad."
          >
            {conDatosReales ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
                <Database size={12} /> Datos reales
              </span>
            ) : null}
          </SectionHeading>
          <FleetMap
            empresaId={empresa_activa_id}
            userId={user?.id}
            canImport={puedeImportarGeocercas}
            vehicles={vehiclesFuente}
            selectedId={selectedVehicleId}
            onSelect={setSelectedVehicleId}
            fuentePosiciones={fuentePosiciones}
            periodo={conDatosReales ? panel.periodo : null}
          />
        </div>
      ) : null}

      {section === 'reportes' ? (
        <div className="space-y-4">
          <SectionHeading
            title="Reportes de flota"
            description="Reporte de actividad por día y por mes: recorrido, encendido, hora de viaje y ralentí por separado (los 4 reportes pedidos, listos para exportar)."
          />
          <FleetReports
            empresaId={empresa_activa_id}
            empresaNombre={empresaActiva?.nombre || ''}
            periodo={conDatosReales ? panel.periodo : null}
            vehicles={vehiclesFuente}
            fuente={fuentePosiciones === 'real' ? 'real' : 'demo'}
          />
        </div>
      ) : null}

      {section === 'combustible' ? (
        <div className="space-y-4">
          <SectionHeading
            title="Control de combustible"
            description="Niveles de tanque, cargas registradas, comparación real vs. estimada y anomalías detectadas."
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
              <Bell size={12} /> Sin fuente de datos
            </span>
          </SectionHeading>
          <PanelSinDatos
            titulo="Todavía no hay fuente real de combustible"
            descripcion="Los niveles de tanque, el consumo y las anomalías requieren un sensor de nivel o el registro de cargas con su comprobante. Mientras no exista esa fuente no mostramos cifras, para no presentar números inventados como reales."
            puntos={[
              'Nivel de tanque por vehículo: no hay sensor conectado.',
              'Cargas y consumos: se mostrarán con los registros reales (hoy no hay ninguno en la base).',
              'Comparación real vs. estimada y anomalías: dependen del historial de cargas.',
            ]}
            nota="La Consola principal conserva su indicador demostrativo de combustible mientras no haya fuente real (así se pidió)."
          />
        </div>
      ) : null}

      {section === 'corte' ? (
        <div className="space-y-4">
          <SectionHeading
            title="Corte remoto"
            description="Bloqueo y desbloqueo del motor, órdenes pendientes y su trazabilidad."
          >
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
              <Bell size={12} /> Sin fuente de datos
            </span>
          </SectionHeading>
          <PanelSinDatos
            titulo="Todavía no hay fuente real de corte remoto"
            descripcion="Cortar el motor a distancia exige un rastreador que acepte comandos y una tabla de órdenes auditada en Supabase. Ninguna de las dos existe hoy, así que no mostramos órdenes ni estados de bloqueo."
            puntos={[
              'Órdenes de bloqueo / desbloqueo: no existe la tabla de órdenes.',
              'Estado de bloqueo por unidad: no viene de agrotrack_posiciones.',
              'Trazabilidad de quién aplicó el corte: pendiente de definir.',
            ]}
            nota="Las órdenes simuladas que aparecen en la Consola principal se mantienen solo como demostración (así se pidió)."
          />
        </div>
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
