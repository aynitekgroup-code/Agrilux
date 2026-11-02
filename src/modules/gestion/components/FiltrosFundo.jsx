import React from 'react';
import { Droplets, Tractor } from 'lucide-react';

const filtros = ['Todo el fundo', 'Riego & Agua', 'Maquinaria'];

export default function FiltrosFundo({ activo, onChange }) {
  return (
    <div className="scrollbar-hide -mx-1 mb-4 flex gap-2 overflow-x-auto px-1">
      {filtros.map((filtro) => (
        <button
          key={filtro}
          type="button"
          onClick={() => onChange(filtro)}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
            activo === filtro
              ? 'border-emerald-700 bg-emerald-700 text-white'
              : 'border-slate-200 bg-white text-slate-500'
          }`}
        >
          {filtro === 'Riego & Agua' && <Droplets size={12} className="mr-1 inline" />}
          {filtro === 'Maquinaria' && <Tractor size={12} className="mr-1 inline" />}
          {filtro}
        </button>
      ))}
    </div>
  );
}
