/**
 * src/components/GraficosCultivo.jsx
 * Gráficos estadísticos del monitoreo de cultivos
 */
import React from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const COLORES = ['#22C55E', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export function GraficoMonitoreo({ registros }) {
  if (!registros?.length) return null;

  const datos = registros.map((r, i) => ({
    name: new Date(r.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }),
    dias: r.diasDesdeSiembra || i * 10,
    registros: 1,
  }));

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">📊 Monitoreos en el tiempo</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={datos}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="dias" fill="#22C55E" radius={[4, 4, 0, 0]} name="Días desde siembra" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GraficoClima({ pronostico }) {
  if (!pronostico?.fechas) return null;

  const datos = pronostico.fechas.map((f, i) => ({
    name: new Date(f).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }),
    max: pronostico.tempMax?.[i],
    min: pronostico.tempMin?.[i],
    lluvia: pronostico.lluvia?.[i] || 0,
  }));

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">🌡️ Pronóstico 7 días</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={datos}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="max" stroke="#EF4444" strokeWidth={2} name="Máx °C" dot={{ r: 3 }} />
          <Line type="monotone" dataKey="min" stroke="#3B82F6" strokeWidth={2} name="Mín °C" dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GraficoRiesgo({ indicadores }) {
  if (!indicadores) return null;

  const datos = [
    { name: 'Precipitación (mm)', value: indicadores.precipitacionTotal7d || 0 },
    { name: 'Evapotranspiración (mm)', value: indicadores.evapotranspiracion7d || 0 },
  ];

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">💧 Balance hídrico 7 días</p>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={datos} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" label={({ name, value }) => `${value}mm`}>
                {datos.map((_, i) => <Cell key={i} fill={COLORES[i]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-xs text-gray-600">Lluvia: {indicadores.precipitacionTotal7d}mm</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-xs text-gray-600">ET0: {indicadores.evapotranspiracion7d}mm</span>
          </div>
          <div className={`text-xs font-bold px-2 py-1 rounded-lg ${
            indicadores.balanceHidrico < 0 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
          }`}>
            Balance: {indicadores.balanceHidrico}mm
          </div>
          <div className="text-xs text-gray-500">{indicadores.riesgoHidrico}</div>
        </div>
      </div>
    </div>
  );
}
