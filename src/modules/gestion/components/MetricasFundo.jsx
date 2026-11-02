import React from 'react';

const metricas = [
  { titulo: 'Riego semanal', valor: '4,820 m³', detalle: '78% de cuota', panel: 'bg-blue-50 border-blue-100', barra: 'bg-blue-500', texto: 'text-blue-700', progreso: '78%' },
  { titulo: 'Maquinaria', valor: '9 / 11', detalle: '82% operativa', panel: 'bg-emerald-50 border-emerald-100', barra: 'bg-emerald-500', texto: 'text-emerald-700', progreso: '82%' },
  { titulo: 'Costo / ha', valor: 'S/ 1,420', detalle: '65% de presupuesto', panel: 'bg-amber-50 border-amber-100', barra: 'bg-amber-500', texto: 'text-amber-700', progreso: '65%' },
];

export default function MetricasFundo() {
  return (
    <section className="mb-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700">Métricas clave del fundo</h2>
        <span className="text-[9px] text-slate-400">Actualizado hace 12 min</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {metricas.map((metrica) => (
          <div key={metrica.titulo} className={`rounded-lg border p-2 ${metrica.panel}`}>
            <p className="min-h-6 text-[8px] font-semibold uppercase text-slate-500">{metrica.titulo}</p>
            <p className="mt-1 text-sm font-bold text-slate-800">{metrica.valor}</p>
            <div className="mt-2 h-1 rounded-full bg-white/80">
              <div className={`h-1 rounded-full ${metrica.barra}`} style={{ width: metrica.progreso }} />
            </div>
            <p className={`mt-1 text-[8px] ${metrica.texto}`}>{metrica.detalle}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
