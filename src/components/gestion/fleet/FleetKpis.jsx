import React from 'react';
import { Truck, Activity, Clock, WifiOff, Bell, Fuel } from 'lucide-react';
import { FLEET } from './fleetTokens';

function KpiCard({ icon: Icon, label, value, suffix, color, soft }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
        <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: soft, color }}>
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900 leading-none">
        {value}
        {suffix ? <span className="ml-1 text-xs font-medium text-slate-400">{suffix}</span> : null}
      </p>
    </div>
  );
}

export default function FleetKpis({ vehicles = [], alerts = [], fuelTotal = 0 }) {
  const enRuta = vehicles.filter((v) => v.estado === 'en_ruta').length;
  const detenidos = vehicles.filter((v) => v.estado === 'detenido').length;
  const offline = vehicles.filter((v) => v.estado === 'offline').length;
  const alertasPendientes = alerts.filter((a) => !a.atendida).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      <KpiCard icon={Truck} label="Total vehículos" value={vehicles.length} suffix="unidades" color={FLEET.forest} soft={FLEET.greenSoft} />
      <KpiCard icon={Activity} label="En movimiento" value={enRuta} suffix="en ruta" color={FLEET.green} soft={FLEET.greenSoft} />
      <KpiCard icon={Clock} label="Detenidos" value={detenidos} suffix="unidades" color={FLEET.amber} soft={FLEET.amberSoft} />
      <KpiCard icon={WifiOff} label="Sin conexión" value={offline} suffix="fuera de línea" color={FLEET.grey} soft={FLEET.greySoft} />
      <KpiCard icon={Bell} label="Alertas pendientes" value={alertasPendientes} suffix="por revisar" color={alertasPendientes > 0 ? FLEET.red : FLEET.green} soft={alertasPendientes > 0 ? FLEET.redSoft : FLEET.greenSoft} />
      <KpiCard icon={Fuel} label="Combustible acumulado" value={Number(fuelTotal).toFixed(0)} suffix="gal" color={FLEET.blue} soft={FLEET.blueSoft} />
    </div>
  );
}
