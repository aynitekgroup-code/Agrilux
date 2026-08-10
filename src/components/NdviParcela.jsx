import React, { useState, useEffect } from 'react';
import { Loader2, Satellite, Leaf } from 'lucide-react';
import { getSentinelNDVI } from '../lib/externalApis';

export default function NdviParcela({ lat, lon, cultivo, nombre }) {
  const [ndviData, setNdviData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!lat || !lon) return;
    setLoading(true);
    getSentinelNDVI(lat, lon, 1)
      .then(data => {
        setNdviData(data);
        setLoading(false);
      })
      .catch(err => {
        setError('No se pudo cargar NDVI');
        setLoading(false);
      });
  }, [lat, lon]);

  if (loading) return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 text-primary">
        <Loader2 size={18} className="animate-spin" />
        <p className="text-sm font-semibold">Cargando NDVI satelital...</p>
      </div>
    </div>
  );

  if (error || !ndviData) return null;

  const ndvi = ndviData.ndvi_promedio;
  const salud = ndviData.nivel_salud || 'Sin datos';
  const color = ndviData.color || '#22C55E';
  const imagen = ndviData.satellite_image || ndviData.ndvi_image;

  const getNivelColor = (ndvi) => {
    if (ndvi >= 0.7) return { bg: 'bg-green-100', text: 'text-green-700', label: 'Excelente' };
    if (ndvi >= 0.5) return { bg: 'bg-lime-100', text: 'text-lime-700', label: 'Buena' };
    if (ndvi >= 0.3) return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Regular' };
    if (ndvi >= 0.1) return { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Baja' };
    return { bg: 'bg-red-100', text: 'text-red-700', label: 'Crítica' };
  };

  const nivel = ndvi != null ? getNivelColor(ndvi) : null;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Satellite size={18} className="text-green-600" />
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">NDVI Satelital</p>
      </div>

      {imagen && (
        <div className="rounded-xl overflow-hidden mb-3 relative">
          <img src={imagen} alt="NDVI Satelital" className="w-full h-40 object-cover" />
          <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full">
            Sentinel-2 · 10m resolución
          </div>
        </div>
      )}

      {ndvi != null && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Índice de Vegetación</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold" style={{ color }}>{(ndvi * 100).toFixed(0)}%</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${nivel.bg} ${nivel.text}`}>
                  {nivel.label}
                </span>
              </div>
            </div>
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: color + '30' }}>
              <Leaf size={28} style={{ color }} />
            </div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="h-2.5 rounded-full transition-all duration-500" style={{ width: `${ndvi * 100}%`, backgroundColor: color }} />
          </div>

          <div className="flex justify-between text-[10px] text-gray-400">
            <span>0% - Sin vegetación</span>
            <span>50% - Vegetación moderada</span>
            <span>100% - Vegetación densa</span>
          </div>

          {ndviData.recomendacion && (
            <div className="bg-green-50 rounded-xl p-3 mt-2">
              <p className="text-xs text-green-700">📋 {ndviData.recomendacion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
