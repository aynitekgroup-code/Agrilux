import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function AlertaGestion() {
  return (
    <section className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xs font-bold text-amber-900">Alerta de Almacén e Hidráulica</h2>
            <span className="shrink-0 rounded bg-amber-200 px-1.5 py-0.5 text-[8px] font-bold text-amber-800">Prioridad Alta</span>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-amber-800">
            Nitrato de Calcio en umbral mínimo (solo 4 sacos restantes). Turno de riego en Sector B3 programado para las 18:00 hrs.
          </p>
        </div>
      </div>
    </section>
  );
}
