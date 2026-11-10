import React from 'react';
import { Truck, Activity, Clock, WifiOff, Bell, Fuel, RotateCw, Database } from 'lucide-react';
import { FLEET } from './fleetTokens';

/**
 * estado: 'ok' | 'cargando' | 'error' | 'vacio'
 * - cargando: esqueleto animado
 * - error:   valor "—" con botón de reintento
 * - vacio:   valor "—" con el sufijo reemplazado por "sin datos"
 */
function KpiCard({ icon: Icon, label, value, suffix, color, soft, estado = 'ok', destacado = false, onReintentar }) {
  const sufijo = estado === 'vacio' ? 'sin datos' : suffix;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
        <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: soft, color }}>
          <Icon size={16} />
        </span>
      </div>

      {estado === 'cargando' ? (
        <div className="mt-2 h-7 w-20 rounded-lg bg-slate-100 animate-pulse" aria-label="Cargando" />
      ) : estado === 'error' ? (
        <div className="mt-2">
          <p className="text-2xl font-bold text-slate-300 leading-none">—</p>
          <button
            type="button"
            onClick={onReintentar}
            className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-red-600 hover:text-red-700"
          >
            <RotateCw size={11} /> Reintentar
          </button>
        </div>
      ) : (
        <p className={`mt-2 text-2xl font-bold leading-none ${estado === 'vacio' ? 'text-slate-300' : 'text-slate-900'}`}>
          {estado === 'vacio' ? '—' : value}
          {sufijo ? <span className="ml-1 text-xs font-medium text-slate-400">{sufijo}</span> : null}
        </p>
      )}

      {destacado ? (
        <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
          <Database size={10} /> demo · sin datos
        </span>
      ) : null}
    </div>
  );
}

export default function FleetKpis({
  vehicles = [],
  alerts = [],
  fuelTotal = 0,
  cargando = false,
  error = null,
  combustibleDemo = true,
  notaPeriodo = null,
  onReintentar,
}) {
  const enRuta = vehicles.filter((v) => v.estado === 'en_ruta').length;
  const detenidos = vehicles.filter((v) => v.estado === 'detenido').length;
  const offline = vehicles.filter((v) => v.estado === 'offline').length;
  const alertasPendientes = alerts.filter((a) => !a.atendida).length;

  const estadoUnidades = cargando ? 'cargando' : error ? 'error' : vehicles.length ? 'ok' : 'vacio';
  const estadoAlertas = cargando ? 'cargando' : error ? 'error' : 'ok';

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard
          icon={Truck}
          label="Total vehículos"
          value={vehicles.length}
          suffix="unidades"
          color={FLEET.forest}
          soft={FLEET.greenSoft}
          estado={estadoUnidades}
          onReintentar={onReintentar}
        />
        <KpiCard
          icon={Activity}
          label="En movimiento"
          value={enRuta}
          suffix="en ruta"
          color={FLEET.green}
          soft={FLEET.greenSoft}
          estado={estadoUnidades}
          onReintentar={onReintentar}
        />
        <KpiCard
          icon={Clock}
          label="Detenidos"
          value={detenidos}
          suffix="unidades"
          color={FLEET.amber}
          soft={FLEET.amberSoft}
          estado={estadoUnidades}
          onReintentar={onReintentar}
        />
        <KpiCard
          icon={WifiOff}
          label="Sin conexión"
          value={offline}
          suffix="fuera de línea"
          color={FLEET.grey}
          soft={FLEET.greySoft}
          estado={estadoUnidades}
          onReintentar={onReintentar}
        />
        <KpiCard
          icon={Bell}
          label="Alertas pendientes"
          value={alertasPendientes}
          suffix="por revisar"
          color={alertasPendientes > 0 ? FLEET.red : FLEET.green}
          soft={alertasPendientes > 0 ? FLEET.redSoft : FLEET.greenSoft}
          estado={estadoAlertas}
          onReintentar={onReintentar}
        />
        <KpiCard
          icon={Fuel}
          label="Combustible acumulado"
          value={Number(fuelTotal).toFixed(0)}
          suffix="gal"
          color={FLEET.blue}
          soft={FLEET.blueSoft}
          estado={cargando ? 'cargando' : 'ok'}
          destacado={combustibleDemo}
          onReintentar={onReintentar}
        />
      </div>

      {notaPeriodo && !cargando && !error ? (
        <p className="mt-2 text-[11px] text-slate-500">{notaPeriodo}</p>
      ) : null}
    </div>
  );
}
