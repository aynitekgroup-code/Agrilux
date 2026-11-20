import React from 'react';
import { AlertTriangle, MapPin } from 'lucide-react';
import { valorAHeatmapColor } from '../lib/indicesVegetacion';

export default function MapaCalorIndice({ mapaCalor, indiceActivo = 'ndvi' }) {
  if (!mapaCalor?.celdas?.length) return null;

  const { celdas, min, max, uniforme, zonas_problema, alerta_uniformidad } = mapaCalor;
  const gridSize = mapaCalor.grid_size || 10;

  const celdasMap = {};
  celdas.forEach(c => { celdasMap[`${c.gx}_${c.gy}`] = c; });

  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden mb-3">
      <div className="bg-gray-50 px-3 py-2 flex items-center justify-between">
        <p className="text-[10px] font-bold text-gray-600 uppercase">Mapa de calor — estilo NAX</p>
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
          uniforme ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
        }`}>
          {uniforme ? 'Uniforme' : 'No uniforme'}
        </span>
      </div>

      <div
        className="grid gap-0.5 p-2 bg-gray-900"
        style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)`, aspectRatio: '16/9' }}
      >
        {Array.from({ length: gridSize * gridSize }).map((_, idx) => {
          const gy = Math.floor(idx / gridSize);
          const gx = idx % gridSize;
          const celda = celdasMap[`${gx}_${gy}`];
          if (!celda) {
            return <div key={idx} className="rounded-sm bg-gray-800/50" />;
          }
          return (
            <div
              key={idx}
              className="rounded-sm transition-all"
              style={{ backgroundColor: celda.color || valorAHeatmapColor(celda.valor) }}
              title={`${(celda.valor * 100).toFixed(0)}%`}
            />
          );
        })}
      </div>

      <div className="flex justify-between px-3 py-1.5 text-[9px] text-gray-500 bg-white">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500" /> Sano</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-400" /> Regular</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-500" /> Estrés</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500" /> Problema</span>
      </div>

      {alerta_uniformidad && (
        <div className={`px-3 py-2 text-[10px] flex items-start gap-2 ${
          uniforme ? 'bg-green-50 text-green-800' : 'bg-orange-50 text-orange-800'
        }`}>
          {!uniforme && <AlertTriangle size={14} className="shrink-0 mt-0.5" />}
          <p>{alerta_uniformidad}</p>
        </div>
      )}

      {zonas_problema?.length > 0 && (
        <div className="px-3 py-2 bg-red-50 border-t border-red-100">
          <p className="text-[10px] font-bold text-red-700 mb-1.5">
            {zonas_problema.length} zona(s) con posible problema (min {min?.toFixed(2)} · max {max?.toFixed(2)})
          </p>
          <div className="space-y-1">
            {zonas_problema.slice(0, 3).map(z => (
              <div key={z.id} className="flex items-start gap-2 text-[10px] text-red-800">
                <MapPin size={10} className="shrink-0 mt-0.5" />
                <span>
                  Zona {z.id}: índice {z.indice?.toFixed(2)} ({z.severidad}) — {z.causa_probable}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
