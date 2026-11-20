import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Fuel, Plus, AlertTriangle, Droplets, X, Activity, Gauge } from 'lucide-react';
import { fuelComparison } from '../../../mocks/agrotrackData';
import { FLEET, FUEL_TYPE_META, ANOMALY_META, formatMoney } from './fleetTokens';

function TankBar({ vehicle }) {
  const pct = Math.max(0, Math.min(100, vehicle.nivel_tanque_pct));
  const color = pct < 20 ? FLEET.red : pct < 40 ? FLEET.amber : FLEET.green;
  return (
    <div className="grid items-center gap-2.5" style={{ gridTemplateColumns: '96px minmax(0,1fr) 40px' }}>
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-700 truncate">{vehicle.placa}</p>
        <p className="text-[10px] text-slate-400 truncate">{vehicle.modelo}</p>
      </div>
      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-bold text-right" style={{ color }}>{pct} %</span>
    </div>
  );
}

export default function FuelDashboard({ vehicles = [], readings = [], anomalies = [], onRegister, responsable, onToast }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0, 16),
    vehiculo_id: vehicles[0]?.id || '',
    galones: '',
    costo: '',
    tipo: 'manual',
  });
  const [formError, setFormError] = useState('');

  const totalGal = readings.reduce((sum, r) => sum + Number(r.galones || 0), 0);
  const totalCosto = readings.reduce((sum, r) => sum + Number(r.costo_total || 0), 0);
  const promedio = readings.length ? totalGal / readings.length : 0;
  const ordenados = [...vehicles].sort((a, b) => a.nivel_tanque_pct - b.nivel_tanque_pct);

  const actualizar = (campo, valor) => setForm((prev) => ({ ...prev, [campo]: valor }));

  const registrar = () => {
    const galones = Number(form.galones);
    const costo = Number(form.costo);
    if (!form.vehiculo_id) {
      setFormError('Selecciona un vehículo.');
      return;
    }
    if (!Number.isFinite(galones) || galones <= 0) {
      setFormError('Ingresa una cantidad de galones mayor a cero.');
      return;
    }
    if (!Number.isFinite(costo) || costo < 0) {
      setFormError('Ingresa un costo total válido.');
      return;
    }
    const vehiculo = vehicles.find((v) => v.id === form.vehiculo_id);
    const registro = {
      id: `fuel-${Date.now()}`,
      vehiculo_id: form.vehiculo_id,
      fecha: form.fecha.replace('T', ' '),
      galones,
      costo_total: costo,
      tipo: form.tipo,
      responsable: responsable || 'Supervisor de flota',
      nota: 'Registro manual desde consola demo',
    };
    if (onRegister) onRegister(registro);
    setModalOpen(false);
    setFormError('');
    setForm({
      fecha: new Date().toISOString().slice(0, 16),
      vehiculo_id: vehicles[0]?.id || '',
      galones: '',
      costo: '',
      tipo: 'manual',
    });
    if (onToast) onToast(`Abastecimiento registrado para ${vehiculo ? vehiculo.placa : 'la unidad'}`);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Consumo acumulado</span>
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><Fuel size={16} /></span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{totalGal.toFixed(0)} <span className="text-xs font-medium text-slate-400">gal</span></p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Costo registrado</span>
            <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center"><Activity size={16} /></span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{formatMoney(totalCosto)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Promedio por carga</span>
            <span className="w-8 h-8 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center"><Gauge size={16} /></span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{promedio.toFixed(1)} <span className="text-xs font-medium text-slate-400">gal</span></p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Anomalías detectadas</span>
            <span className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center"><AlertTriangle size={16} /></span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{anomalies.length} <span className="text-xs font-medium text-slate-400">eventos</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><Droplets size={17} /></div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Nivel de tanque por vehículo</h2>
              <p className="text-xs text-slate-500">Lectura simulada del sensor capacitivo</p>
            </div>
          </div>
          <div className="space-y-3">
            {ordenados.map((v) => <TankBar key={v.id} vehicle={v} />)}
          </div>
        </div>

        <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Consumo real vs. estimado</h2>
              <p className="text-xs text-slate-500">Galones por día · datos demo</p>
            </div>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-forest px-3 py-2 text-xs font-semibold text-white hover:bg-forest-dark"
            >
              <Plus size={14} /> Registrar abastecimiento
            </button>
          </div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fuelComparison} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} />
                <XAxis dataKey="periodo" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="real" name="Real" fill={FLEET.forest} radius={[5, 5, 0, 0]} maxBarSize={26} />
                <Bar dataKey="estimado" name="Estimado" fill="#CBD5E1" radius={[5, 5, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 flex items-center gap-2 border-b border-slate-50">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center"><Fuel size={17} /></div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Registro de abastecimientos</h2>
              <p className="text-xs text-slate-500">{readings.length} registros locales</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr className="bg-slate-50 text-left">
                  {['Fecha', 'Vehículo', 'Galones', 'Costo', 'Tipo', 'Responsable'].map((h) => (
                    <th key={h} className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {readings.slice(0, 7).map((r) => {
                  const v = vehicles.find((item) => item.id === r.vehiculo_id);
                  const tipo = FUEL_TYPE_META[r.tipo] || FUEL_TYPE_META.manual;
                  return (
                    <tr key={r.id} className="border-b border-slate-50">
                      <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{r.fecha}</td>
                      <td className="px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">{v ? v.placa : r.vehiculo_id}</td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{Number(r.galones).toFixed(1)} gal</td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{formatMoney(r.costo_total)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: tipo.bg, color: tipo.color }}>{tipo.label}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{r.responsable}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 flex items-center gap-2 border-b border-slate-50">
            <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center"><AlertTriangle size={17} /></div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Anomalías de combustible</h2>
              <p className="text-xs text-slate-500">Eventos que requieren revisión del supervisor</p>
            </div>
          </div>
          <div className="divide-y divide-slate-50">
            {anomalies.map((a) => {
              const meta = ANOMALY_META[a.tipo] || ANOMALY_META.sin_registro;
              const v = vehicles.find((item) => item.id === a.vehiculo_id);
              return (
                <div key={a.id} className="p-3.5 flex items-start gap-2.5">
                  <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: meta.color }} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                      <span className="text-[11px] font-mono text-slate-400">{a.fecha}</span>
                      <span className="font-bold text-xs text-slate-700">{v ? v.placa : a.vehiculo_id}</span>
                      <span className="text-xs font-bold ml-auto" style={{ color: meta.color }}>{a.delta_gal > 0 ? `+${a.delta_gal}` : a.delta_gal} gal</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{a.nota}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="fuel-modal-title">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center gap-3 p-5 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><Fuel size={19} /></div>
              <div>
                <h2 id="fuel-modal-title" className="text-lg font-bold text-slate-900">Registrar abastecimiento</h2>
                <p className="text-xs text-slate-500">Registro local demostrativo</p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} aria-label="Cerrar" className="ml-auto text-slate-400 hover:text-slate-700"><X size={19} /></button>
            </div>

            <div className="p-5 space-y-3">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Fecha y hora</span>
                <input type="datetime-local" value={form.fecha} onChange={(e) => actualizar('fecha', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-slate-700 outline-none focus:border-forest focus:bg-white" />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Vehículo</span>
                <select value={form.vehiculo_id} onChange={(e) => actualizar('vehiculo_id', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-slate-700 outline-none focus:border-forest focus:bg-white">
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.placa} · {v.modelo}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Galones</span>
                  <input type="number" min="0" step="0.1" value={form.galones} onChange={(e) => actualizar('galones', e.target.value)} placeholder="0.0" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-slate-700 outline-none focus:border-forest focus:bg-white" />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Costo total (S/)</span>
                  <input type="number" min="0" step="0.01" value={form.costo} onChange={(e) => actualizar('costo', e.target.value)} placeholder="0.00" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-slate-700 outline-none focus:border-forest focus:bg-white" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Tipo de registro</span>
                <select value={form.tipo} onChange={(e) => actualizar('tipo', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-slate-700 outline-none focus:border-forest focus:bg-white">
                  <option value="manual">Manual</option>
                  <option value="sensor">Sensor</option>
                  <option value="simulado">Simulado</option>
                </select>
              </label>
              {formError ? <p className="text-xs font-semibold text-red-600">{formError}</p> : null}
            </div>

            <div className="p-5 pt-0 flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button type="button" onClick={registrar} className="rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-white hover:bg-forest-dark">Registrar abastecimiento</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
