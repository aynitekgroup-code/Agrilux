import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCheck, X, Bell, RefreshCw, Database, Loader2, AlertTriangle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import {
  vehicles,
  alerts as mockAlerts,
  fuelReadings as mockFuelReadings,
  cutRequests,
} from '../../mocks/agrotrackData';
import { cargarPanelFlota, textoPeriodoCargado, formatearRango, LIMITE_ALERTAS_PANEL, clasificarEstado } from '../../lib/agrotrackFlota';
import { obtenerEstadoVivo, suscribirEstadoVivo, obtenerUltimasPosicionesDirecto } from '../../lib/agrotrackTiempoReal';
import { cargarVehiculosMaestro } from '../../lib/agrotrackVehiculos';
import FleetHeader from '../../components/gestion/fleet/FleetHeader';
import FleetKpis from '../../components/gestion/fleet/FleetKpis';
import FleetMap from '../../components/gestion/fleet/FleetMap';
import VehicleList from '../../components/gestion/fleet/VehicleList';
import FleetReports from '../../components/gestion/fleet/FleetReports';
import HunterReports from '../../components/gestion/fleet/HunterTablaDiaria';
import HunterActividad from '../../components/gestion/fleet/HunterActividad';
import FleetKilometrosDiarios from '../../components/gestion/fleet/FleetKilometrosDiarios';
import MenuReportes, { GRUPOS } from '../../components/gestion/fleet/MenuReportes';
import HunterEstadoVivo from '../../components/gestion/fleet/HunterEstadoVivo';
import FleetEventsSummary from '../../components/gestion/fleet/FleetEventsSummary';
import FleetUnitStatus from '../../components/gestion/fleet/FleetUnitStatus';
import FleetSinReportar from '../../components/gestion/fleet/FleetSinReportar';
import FleetGeofenceStatus from '../../components/gestion/fleet/FleetGeofenceStatus';
import FleetGeofenceReports from '../../components/gestion/fleet/FleetGeofenceReports';
import FleetGeofenceSummary from '../../components/gestion/fleet/FleetGeofenceSummary';
import FleetTablaDiariaGeocercas from '../../components/gestion/fleet/FleetTablaDiariaGeocercas';
import ErrorBoundary from '../../components/gestion/fleet/ErrorBoundary';
import VigiaFlota from '../../components/gestion/fleet/VigiaFlota';
import BriefingFlota from '../../components/gestion/fleet/BriefingFlota';
import RemoteCutModal from '../../components/gestion/fleet/RemoteCutModal';
import FleetAlerts from '../../components/gestion/fleet/FleetAlerts';
import ModulesOverview from '../../components/gestion/fleet/ModulesOverview';
import PreguntarAgrilux from '../../components/gestion/PreguntarAgrilux';
import { PanelSinDatos } from '../../components/gestion/fleet/reportesComunes';
import ReportesPage from './ReportesPage';
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
 * PanelSinDatos (estado honesto de una sección sin fuente real de datos) se
 * importa de reportesComunes.jsx para que la consola y el catálogo de
 * reportes se vean idénticos.
 */

/**
 * La entrada normal a /gestion/vehiculos-flota abre el mapa. Cualquier
 * ?section=... explícito sigue teniendo prioridad.
 */
export default function AgroTrackPomalcaPage({ initialSection = 'mapas' }) {
  const [searchParams] = useSearchParams();
  const { user, empresa_activa_id, empresas_disponibles } = useAuth();
  const empresaActiva = (empresas_disponibles || []).find((empresa) => empresa.id === empresa_activa_id);
  const esPomalca = String(empresaActiva?.nombre || '').trim().toLowerCase() === 'pomalca';
  const puedeImportarGeocercas = ['administrador', 'ingeniero'].includes(empresaActiva?.rol);
  // La RLS solo permite DELETE a administradores (FASE 3.7: editor de geocercas).
  const puedeEliminarGeocercas = empresaActiva?.rol === 'administrador';
  const [section, setSection] = useState(() => searchParams.get('section') || initialSection);
  const [destinoInterno, setDestinoInterno] = useState(null);
  const [proveedorReportes, setProveedorReportes] = useState('hunter');
  const [reporteActivo, setReporteActivo] = useState('hunter-reportes');
  const [vistaGeocercas, setVistaGeocercas] = useState('diaria');
  const [selectedFleetModule, setSelectedFleetModule] = useState('flota');
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

  // 14/11/2026: posiciones EN VIVO (agente de Zonar cada 2 min). Si existen,
  // se sobreponen a la última posición del periodo cargado: el mapa y el
  // localizador se mueven solos sin recargar la página.
  const [vivo, setVivo] = useState([]);
  // Intervalo de actualización del mapa en vivo (Zonas → "Actualizar el mapa cada…").
  const [actualizarMapaCada, setActualizarMapaCada] = useState(30 * 1000);
  useEffect(() => {
    if (!empresa_activa_id) return undefined;
    let cancelado = false;
    // 18/11/2026: si la tabla en vivo no existe o está vacía (agente sin
    // correr), se lee la última posición de cada placa directo de
    // agrotrack_posiciones, para que el mapa nunca se quede sin unidades.
    let ultimoRespaldo = 0;
    let filasRespaldo = [];
    const respaldo = async () => {
      // como mucho cada 5 minutos (son ~44 consultas pequeñas)
      if (Date.now() - ultimoRespaldo < 5 * 60 * 1000 && filasRespaldo.length) return filasRespaldo;
      ultimoRespaldo = Date.now();
      let padron = [];
      try {
        padron = ((await cargarVehiculosMaestro(empresa_activa_id)).unidades || []).map((u) => u.placa);
      } catch {
        padron = [];
      }
      filasRespaldo = await obtenerUltimasPosicionesDirecto(empresa_activa_id, padron);
      return filasRespaldo;
    };
    const leer = () => obtenerEstadoVivo(empresa_activa_id)
      .then((filas) => (filas.length ? filas : respaldo()))
      .catch(() => respaldo())
      .then((filas) => { if (!cancelado) setVivo(filas || []); })
      .catch(() => { if (!cancelado) setVivo([]); });
    leer();
    let pendiente = null;
    const cancelar = suscribirEstadoVivo(empresa_activa_id, () => {
      clearTimeout(pendiente);
      pendiente = setTimeout(leer, 1500);
    });
    const reloj = setInterval(leer, actualizarMapaCada);
    return () => { cancelado = true; clearTimeout(pendiente); clearInterval(reloj); cancelar(); };
  }, [empresa_activa_id, actualizarMapaCada]);

  const unidadesConVivo = useMemo(() => {
    if (!conDatosReales || !vivo.length) return panel.unidades;
    const ahora = new Date().toISOString();
    const porPlaca = new Map(vivo.map((v) => [v.placa, v]));
    const vistas = new Set();
    const mezcladas = panel.unidades.map((u) => {
      const v = porPlaca.get(u.placa);
      vistas.add(u.placa);
      if (!v || (u.ultima_fecha && Date.parse(v.ultima_fecha) < Date.parse(u.ultima_fecha))) return u;
      return {
        ...u,
        lat: Number(v.latitud),
        lng: Number(v.longitud),
        velocidad_kmh: Number(v.ultima_velocidad || 0),
        ultima_fecha: v.ultima_fecha,
        ultimo_evento: v.ultimo_evento || u.ultimo_evento,
        estado: clasificarEstado(v, ahora),
        geocerca_actual: v.geocerca || null,
        en_vivo: true,
      };
    });
    vivo.forEach((v) => {
      if (vistas.has(v.placa)) return;
      mezcladas.push({
        id: v.placa, placa: v.placa, descripcion: v.descripcion || v.unidad || '', modelo: v.descripcion || v.unidad || '',
        estado: clasificarEstado(v, ahora), lat: Number(v.latitud), lng: Number(v.longitud),
        velocidad_kmh: Number(v.ultima_velocidad || 0), ultima_fecha: v.ultima_fecha, ultimo_evento: v.ultimo_evento || '',
        km_recorridos: 0, eventos_alta_velocidad: 0, fuente: 'real', geocerca_actual: v.geocerca || null, en_vivo: true,
      });
    });
    return mezcladas;
  }, [conDatosReales, vivo, panel.unidades]);

  // 18/11/2026 (observación X): si el panel no carga (timeout o SQL
  // pendiente), el mapa YA NO se queda sin localizador, grupos ni
  // coordenadas: usa la última posición de cada unidad de la tabla en vivo.
  const unidadesSoloVivo = useMemo(() => {
    const ahora = new Date().toISOString();
    return vivo
      .filter((v) => Number.isFinite(Number(v.latitud)) && Number.isFinite(Number(v.longitud)))
      .map((v) => ({
        id: v.placa, placa: v.placa, descripcion: v.descripcion || v.unidad || '', modelo: v.descripcion || v.unidad || '',
        estado: clasificarEstado(v, ahora), lat: Number(v.latitud), lng: Number(v.longitud),
        velocidad_kmh: Number(v.ultima_velocidad || 0), ultima_fecha: v.ultima_fecha, ultimo_evento: v.ultimo_evento || '',
        km_recorridos: 0, eventos_alta_velocidad: 0, fuente: 'real', geocerca_actual: v.geocerca || null, en_vivo: true,
      }));
  }, [vivo]);
  const usaRespaldoVivo = (hayErrorPanel || sinDatosReales) && unidadesSoloVivo.length > 0;

  // Fuente compartida por tarjetas, alertas y marcadores del mapa.
  const vehiclesFuente = conDatosReales
    ? unidadesConVivo
    : usaRespaldoVivo ? unidadesSoloVivo : sinDatosReales && esPomalca ? vehicles : [];
  const alertasBase = conDatosReales ? panel.alertas : sinDatosReales && esPomalca ? mockAlerts : [];
  const alertList = alertasBase.map((alerta) => (ackIds.includes(alerta.id) ? { ...alerta, atendida: true } : alerta));
  const fuentePosiciones = conDatosReales || usaRespaldoVivo ? 'real' : enCarga ? 'cargando' : hayErrorPanel || !esPomalca ? 'ninguna' : 'demo';

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

  useEffect(() => {
    if (!destinoInterno || section !== destinoInterno.seccion) return;
    const id = requestAnimationFrame(() => {
      document.getElementById(destinoInterno.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setDestinoInterno(null);
    });
    return () => cancelAnimationFrame(id);
  }, [section, destinoInterno]);

  const abrirSeccionEn = (seccion, id) => {
    if (seccion === 'reportes') {
      setProveedorReportes(id.startsWith('hunter-') ? 'hunter' : id.startsWith('zonar-') ? 'zonar' : 'otros');
      setReporteActivo(id);
    }
    setDestinoInterno({ seccion, id });
    setSection(seccion);
  };

  // Lleva a las alertas de operación: cambia a la consola (si estaba en otra
  // pestaña) y hace scroll suave hasta el panel de alertas.
  const irAAlertas = () => {
    setSection('consola');
    window.setTimeout(() => {
      document.getElementById('alertas-operacion')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  const ackAlert = (id) => setAckIds((prev) => (prev.includes(id) ? prev : [...prev, id]));

  const abrirCorte = (vehiculo) => setCutModal({ vehiculoId: vehiculo ? vehiculo.id : '' });

  const registrarAbastecimiento = (registro) => setReadings((prev) => [registro, ...prev]);

  const registrarOrden = (vehiculoId, accion, origen, estado, extra = {}) => {
    const now = new Date();
    const dia = String(now.getDate()).padStart(2, '0');
    const mes = String(now.getMonth() + 1).padStart(2, '0');
    const hora = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    setCutOrders((prev) => [
      { id: `ord-${Date.now()}`, hora: `${dia}/${mes} · ${hora}`, vehiculo_id: vehiculoId, accion, origen, estado, ...extra },
      ...prev,
    ]);
  };

  const aplicarCorte = (resultado) => {
    const vehiculoId = resultado.vehiculo_id;
    setBlockedIds((prev) => (prev.includes(vehiculoId) ? prev : [...prev, vehiculoId]));
    setPendingIds((prev) => prev.filter((id) => id !== vehiculoId));
    // Trazabilidad: la evaluación previa con IA (si se hizo) queda en la orden.
    const evaluacion = resultado.evaluacionIa;
    registrarOrden(
      vehiculoId,
      'Bloqueo de motor',
      resultado.responsable || 'Supervisor de flota',
      'Aplicada (demo)',
      {
        justificacionIa: evaluacion
          ? `${evaluacion.veredicto}: ${evaluacion.justificacion}${evaluacion.decidioContinuar ? ' (el supervisor decidió continuar pese a la evaluación)' : ''}`
          : null,
      },
    );
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
    <div className="space-y-4 pb-4 min-w-0 overflow-x-hidden">
      <FleetHeader
        activeSection={section}
        onSectionChange={setSection}
        pendingAlerts={pendientes}
        fuente={fuentePosiciones}
      />

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
                <p className="text-sm font-semibold text-amber-800">{esPomalca ? 'Datos de demostración' : 'Sin datos de flota'}</p>
                <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                  {esPomalca ? 'Esta empresa todavía no tiene posiciones cargadas; se muestran datos de ejemplo.' : 'Esta empresa todavía no tiene posiciones de flota disponibles.'} Carga un reporte de Zonar con “Cargar reporte de unidades” para ver la flota real.
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
          {/* Briefing del día con IA (solo datos ya agregados del panel). */}
          <BriefingFlota
            empresaNombre={empresaActiva?.nombre || ''}
            periodo={conDatosReales ? panel.periodo : null}
            unidades={vehiclesFuente}
            alertas={alertList}
            cortesPendientes={pendingIds.length}
            cortesAplicados={blockedIds.length}
            fuente={fuentePosiciones === 'real' ? 'real' : 'demo'}
          />
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <div className="xl:col-span-12 min-w-0">
              <ErrorBoundary mensaje="No se pudo dibujar el mapa de la consola. Prueba a recargar o pulsa Reintentar.">
                <FleetMap
                  empresaId={empresa_activa_id}
                  actualizarMapaCada={actualizarMapaCada}
                  onActualizarMapaCada={setActualizarMapaCada}
                  userId={user?.id}
                  canImport={puedeImportarGeocercas}
                  canDelete={puedeEliminarGeocercas}
                  vehicles={vehiclesFuente}
                  selectedId={selectedVehicleId}
                  onSelect={setSelectedVehicleId}
                  fuentePosiciones={fuentePosiciones}
                  periodo={conDatosReales ? panel.periodo : null}
                  errorUnidades={hayErrorPanel ? panel.error : null}
                  onReintentarUnidades={recargarPanel}
                  onIrAMapas={() => setSection('mapas')}
                />
              </ErrorBoundary>
            </div>
            <div className="xl:col-span-12 min-w-0" id="alertas-operacion">
              <FleetAlerts
                alerts={alertList}
                vehicles={vehiclesFuente}
                onAck={ackAlert}
                cargando={enCarga}
                error={hayErrorPanel ? panel.error : null}
                fuente={conDatosReales ? 'real' : 'demo'}
                empresaNombre={empresaActiva?.nombre || ''}
                rangoTexto={conDatosReales ? formatearRango(panel.periodo?.desde, panel.periodo?.hasta) : ''}
                notaTope={
                  conDatosReales && panel.alertas.length >= LIMITE_ALERTAS_PANEL
                    ? `Se muestran las ${LIMITE_ALERTAS_PANEL} más recientes; hay más eventos en el periodo.`
                    : null
                }
                onReintentar={recargarPanel}
              />
            </div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-white p-4">
            <h2 className="font-bold text-slate-900">Reporte de actividad</h2>
            <p className="mt-1 text-sm text-slate-600">Consulta el detalle, los filtros y la descarga en Reportes de Zonar.</p>
            <button type="button" onClick={() => abrirSeccionEn('reportes', 'zonar-actividad')} className="mt-3 min-h-11 rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white hover:bg-forest-dark">Abrir reporte de actividad</button>
          </div>
          <div id="consola-vigia" className="scroll-mt-24">
          <VigiaFlota
            empresaId={empresa_activa_id}
            periodo={conDatosReales ? panel.periodo : null}
            fuente={fuentePosiciones === 'real' ? 'real' : 'demo'}
          />
          </div>
          <FleetGeofenceSummary
            empresaId={empresa_activa_id}
            periodo={conDatosReales ? panel.periodo : null}
            fuente={fuentePosiciones === 'real' ? 'real' : 'demo'}
            onVerReporte={() => setSection('geocercas')}
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
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 px-1">
            <h2 className="text-base font-bold text-slate-900">Mapa de flota</h2>
            {conDatosReales ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
                <Database size={12} /> Datos reales
              </span>
            ) : null}
          </div>
          <ErrorBoundary mensaje="No se pudo dibujar el mapa. Revisa la sección y pulsa Reintentar.">
            <FleetMap
              empresaId={empresa_activa_id}
              actualizarMapaCada={actualizarMapaCada}
              onActualizarMapaCada={setActualizarMapaCada}
              userId={user?.id}
              canImport={puedeImportarGeocercas}
              canDelete={puedeEliminarGeocercas}
              vehicles={vehiclesFuente}
              selectedId={selectedVehicleId}
              onSelect={setSelectedVehicleId}
              fuentePosiciones={fuentePosiciones}
              periodo={conDatosReales ? panel.periodo : null}
              consolaVisible
              sateliteInicial={esPomalca}
              mostrarTablasAlFinal={false}
              errorUnidades={hayErrorPanel ? panel.error : null}
              onReintentarUnidades={recargarPanel}
            />
          </ErrorBoundary>
        </div>
      ) : null}

      {section === 'reportes' ? (
        <div className="space-y-4">
          <SectionHeading
            title="Reportes de flota"
            description="Consulta actividad, estado, unidades sin reportar y estado por geocerca (apagado, ralentí y conduciendo). Los reportes de Hunter y Zonar se muestran por separado."
          />
          <MenuReportes onSeleccionar={(id) => abrirSeccionEn('reportes', id)} />
          <nav aria-label="Ir a reportes por proveedor" className="flex flex-wrap gap-2 rounded-xl border border-emerald-100 bg-white p-3 text-sm">
            {[["hunter", "Hunter 360", "hunter-reportes"], ["zonar", "Zonar", "zonar-kilometros"], ["otros", "Otros", "reportes-vigia"]].map(([id, etiqueta, primero]) => <button key={id} type="button" aria-pressed={proveedorReportes === id} onClick={() => { setProveedorReportes(id); setReporteActivo(primero); }} className={`rounded-lg border border-emerald-300 px-3 py-2 font-semibold ${proveedorReportes === id ? 'bg-forest text-white' : 'text-emerald-800 hover:bg-emerald-50'}`}>{etiqueta}</button>)}
          </nav>
          {(() => { const opciones = GRUPOS[proveedorReportes === 'hunter' ? 0 : proveedorReportes === 'zonar' ? 1 : 2].opciones; const indice = opciones.findIndex(([id]) => id === reporteActivo); return <nav aria-label="Navegar entre reportes" className="flex items-center justify-between gap-2 rounded-lg border bg-white p-2 text-sm"><button type="button" disabled={indice <= 0} onClick={() => setReporteActivo(opciones[indice - 1][0])} className="rounded border px-3 py-2 disabled:opacity-40">Anterior</button><span className="text-center font-semibold">{opciones[indice]?.[1]}</span><button type="button" disabled={indice < 0 || indice >= opciones.length - 1} onClick={() => setReporteActivo(opciones[indice + 1][0])} className="rounded border px-3 py-2 disabled:opacity-40">Siguiente</button></nav>; })()}
          {proveedorReportes === 'hunter' && <div id="reportes-hunter" className="scroll-mt-4 space-y-4">
          {reporteActivo === 'hunter-actividad' && <div id="hunter-actividad" className="scroll-mt-24"><HunterActividad empresaId={empresa_activa_id} /></div>}
          {reporteActivo === 'hunter-status' && <div id="hunter-status" className="scroll-mt-24"><HunterEstadoVivo empresaId={empresa_activa_id} /></div>}
          {reporteActivo === 'hunter-reportes' && <div id="hunter-reportes" className="scroll-mt-24"><HunterReports empresaId={empresa_activa_id} /></div>}
          </div>}
          {proveedorReportes === 'zonar' && <div id="reportes-zonar" className="scroll-mt-4 space-y-4">
          {reporteActivo === 'zonar-kilometros' && <div id="zonar-kilometros" className="scroll-mt-24"><FleetKilometrosDiarios empresaId={empresa_activa_id} vehicles={vehiclesFuente} /></div>}
          {reporteActivo === 'zonar-actividad' && <div id="zonar-actividad" className="scroll-mt-24">
          <FleetReports
            empresaId={empresa_activa_id}
            empresaNombre={empresaActiva?.nombre || ''}
            periodo={conDatosReales ? panel.periodo : null}
            vehicles={vehiclesFuente}
            fuente={fuentePosiciones === 'real' ? 'real' : 'demo'}
          />
          </div>}
          {reporteActivo === 'zonar-eventos' && <div id="zonar-eventos" className="scroll-mt-24">
          <FleetEventsSummary
            empresaId={empresa_activa_id}
            periodo={conDatosReales ? panel.periodo : null}
            vehicles={vehiclesFuente}
            fuente={fuentePosiciones === 'real' ? 'real' : 'demo'}
          />
          </div>}
          {reporteActivo === 'zonar-status' && <div id="zonar-status" className="scroll-mt-24">
          <FleetUnitStatus
            empresaId={empresa_activa_id}
            periodo={conDatosReales ? panel.periodo : null}
            fuente={fuentePosiciones === 'real' ? 'real' : 'demo'}
          />
          </div>}
          {reporteActivo === 'zonar-sin-reportar' && <div id="zonar-sin-reportar" className="scroll-mt-24">
          <FleetSinReportar
            empresaId={empresa_activa_id}
            fuente={fuentePosiciones === 'real' ? 'real' : 'demo'}
          />
          </div>}
          {reporteActivo === 'zonar-geocercas' && <div id="zonar-geocercas" className="scroll-mt-24">
          <FleetGeofenceStatus
            empresaId={empresa_activa_id}
            fuente={fuentePosiciones === 'real' ? 'real' : 'demo'}
          />
          </div>}
          </div>}
          {proveedorReportes === 'otros' && <>
          {reporteActivo === 'reportes-vigia' && <div id="reportes-vigia" className="scroll-mt-24">
            <div className="rounded-xl border border-emerald-200 bg-white p-4">
              <h2 className="font-bold text-slate-900">Vigía de flota</h2>
              <p className="mt-1 text-sm text-slate-600">La revisión automática se encuentra en Consola principal.</p>
              <button type="button" onClick={() => abrirSeccionEn('consola', 'consola-vigia')} className="mt-3 min-h-11 rounded-lg border border-emerald-700 px-4 py-2 text-sm font-semibold text-forest hover:bg-emerald-50">Abrir Vigía de flota</button>
            </div>
          </div>}
          {/* Esquema de módulos arriba del catálogo: en Reportes viven
              Flota y Alertas y eventos. ModulesOverview filtra el catálogo. */}
          {reporteActivo === 'reportes-catalogo' && <div id="reportes-catalogo" className="scroll-mt-24">
          <ModulesOverview modulos={['flota', 'alertas']} selectedId={selectedFleetModule} onSelect={setSelectedFleetModule} />
          <ReportesPage
            empresaId={empresa_activa_id}
            periodo={conDatosReales ? panel.periodo : null}
            fuente={fuentePosiciones === 'real' ? 'real' : 'demo'}
            vehicles={vehiclesFuente}
            selectedModuleId={selectedFleetModule}
          />
          </div>}
          </>}
        </div>
      ) : null}

      {section === 'geocercas' ? (
        <div className="space-y-4">
          <SectionHeading
            title="Reportes de geocercas"
            description="Consulta entradas, salidas y tiempo dentro de los lotes, según los datos disponibles de Zonar."
          />
          <label className="block rounded-xl border border-emerald-200 bg-white p-3 text-sm font-semibold text-forest">Elegir módulo de geocercas
            <select value={vistaGeocercas} onChange={(e) => setVistaGeocercas(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-slate-800">
              <option value="diaria">Tabla diaria de geocercas</option><option value="eventos">Entradas y salidas</option><option value="lotes">Tiempo en cada lote</option><option value="visitas">Visitas por geocerca</option><option value="catalogo">Catálogo de geocercas y rutas</option>
            </select>
          </label>
          {/* 14/11/2026: todas las unidades juntas + tabla dinámica de las 6:30. */}
          {vistaGeocercas === 'diaria' && <ErrorBoundary mensaje="No se pudo dibujar la tabla diaria de geocercas.">
            <FleetTablaDiariaGeocercas
              empresaId={empresa_activa_id}
              periodo={conDatosReales ? panel.periodo : null}
              fuente={fuentePosiciones === 'real' ? 'real' : 'demo'}
              vehicles={vehiclesFuente}
            />
          </ErrorBoundary>}
          {['eventos', 'lotes', 'visitas'].includes(vistaGeocercas) && <ErrorBoundary mensaje="No se pudo dibujar el reporte de geocercas. Prueba con otro rango o pulsa Reintentar.">
            <FleetGeofenceReports
              empresaId={empresa_activa_id}
              periodo={conDatosReales ? panel.periodo : null}
              fuente={fuentePosiciones === 'real' ? 'real' : 'demo'}
              vehicles={vehiclesFuente}
              vista={vistaGeocercas}
            />
          </ErrorBoundary>}
          {/* El módulo "Geocercas y rutas" vive aquí, arriba del catálogo. */}
          {vistaGeocercas === 'catalogo' && <><ModulesOverview modulos={['geocercas']} selectedId="geocercas" onSelect={() => {}} />
          <ReportesPage
            empresaId={empresa_activa_id}
            periodo={conDatosReales ? panel.periodo : null}
            fuente={fuentePosiciones === 'real' ? 'real' : 'demo'}
            vehicles={vehiclesFuente}
            selectedModuleId="geocercas"
          />
          </>}
        </div>
      ) : null}

      {section === 'combustible' ? (
        <div className="space-y-4">
          <SectionHeading
            title="Control de combustible"
            description="Consulta de combustible. Esta sección aún no tiene una fuente de datos conectada."
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
          {/* El módulo "Combustible" vive al final (aún sin fuente real). */}
          <ModulesOverview modulos={['combustible']} selectedId="combustible" onSelect={() => {}} />
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

      {cutModal ? (
        <RemoteCutModal
          vehicles={vehicles}
          initialVehicleId={cutModal.vehiculoId}
          responsable={user?.nombre || 'Supervisor de flota'}
          onComplete={aplicarCorte}
          onClose={() => setCutModal(null)}
        />
      ) : null}

      {/* Chat "Preguntar a Agrilux": asistente de texto (placas, grupos,
          geocercas y resumen) con IA solo como fallback. */}
      {empresa_activa_id ? (
        <PreguntarAgrilux empresaId={empresa_activa_id} empresaNombre={empresaActiva?.nombre || ''} />
      ) : null}

      {/* Icono de alerta operativo: solo en la sección Consola principal;
          va justo encima del FAB del chat. */}
      {pendientes > 0 && section === 'consola' ? (
        <button
          type="button"
          onClick={irAAlertas}
          aria-label={`${pendientes} alerta${pendientes === 1 ? '' : 's'} de operación pendiente${pendientes === 1 ? '' : 's'} — ir a alertas`}
          title={`${pendientes} alerta${pendientes === 1 ? '' : 's'} de operación pendiente${pendientes === 1 ? '' : 's'}`}
          className="fixed right-4 bottom-36 sm:right-5 sm:bottom-20 z-[1301] grid h-11 w-11 place-items-center rounded-full bg-red-500 text-white shadow-[0_6px_20px_rgba(220,38,38,0.45)] ring-2 ring-white/70 transition-transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-red-300/60"
        >
          <Bell size={18} />
          <span className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[9px] font-extrabold leading-none text-red-600 ring-1 ring-red-200">
            {pendientes > 99 ? '99+' : pendientes}
          </span>
        </button>
      ) : null}

      {toast ? (
        <div
          className="fixed right-4 sm:right-5 bottom-5 sm:bottom-20 z-[1400] flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-white shadow-lg"
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
