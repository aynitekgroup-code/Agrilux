import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Shield } from 'lucide-react';

const diaAbrev = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const nivelColors = {
  minimo: 'bg-green-100 text-green-700 border-green-300',
  bajo: 'bg-green-100 text-green-700 border-green-300',
  moderado: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  alto: 'bg-orange-100 text-orange-700 border-orange-300',
  critico: 'bg-red-100 text-red-700 border-red-300',
};

const barColors = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
};

const cardBorderColors = {
  green: 'border-green-300',
  yellow: 'border-yellow-300',
  orange: 'border-orange-300',
  red: 'border-red-300',
};

const cardBgColors = {
  green: 'bg-green-50',
  yellow: 'bg-yellow-50',
  orange: 'bg-orange-50',
  red: 'bg-red-50',
};

function formatFecha(fecha) {
  const d = new Date(fecha + 'T00:00:00');
  const dia = diaAbrev[d.getDay()];
  const num = d.getDate();
  return { dia, num };
}

export default function TimelineRiesgo({ timeline = [], resumen }) {
  const [expandedIdx, setExpandedIdx] = useState(null);

  const toggle = (idx) => {
    setExpandedIdx((prev) => (prev === idx ? null : idx));
  };

  const avgRiesgo = resumen?.riesgoPromedio ?? 0;
  const nivelGeneral = resumen?.nivelGeneral ?? 'bajo';
  const diasCriticos = resumen?.diasCriticos ?? 0;
  const plagaPrincipal = resumen?.plagaPrincipal ?? '-';
  const plagaPrincipalRiesgo = resumen?.plagaPrincipalRiesgo ?? 0;

  return (
    <div className="w-full max-w-[430px] mx-auto space-y-3">
      {/* Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Shield size={16} />
          Resumen 16 Días
        </h3>

        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${nivelColors[nivelGeneral] ?? nivelColors.bajo}`}
          >
            {nivelGeneral.charAt(0).toUpperCase() + nivelGeneral.slice(1)}
          </span>
          <span className="text-xs text-gray-500">
            Riesgo promedio: {avgRiesgo}%
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-500 shrink-0" />
            <div>
              <p className="text-red-600 font-medium">{diasCriticos} días críticos</p>
            </div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
            <p className="text-orange-600 font-medium truncate">{plagaPrincipal}</p>
            <p className="text-orange-500 text-[10px]">Max: {plagaPrincipalRiesgo}%</p>
          </div>
        </div>

        {resumen?.recomendacionesPrincipales?.length > 0 && (
          <div className="text-[11px] text-gray-500 border-t border-gray-100 pt-2">
            {resumen.recomendacionesPrincipales[0]}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
        <div className="flex gap-2 min-w-max">
          {timeline.map((day, idx) => {
            const { dia, num } = formatFecha(day.fecha);
            const color = day.color ?? 'green';
            const isExpanded = expandedIdx === idx;
            const topPestes = (day.plagas ?? [])
              .slice()
              .sort((a, b) => b.riesgo - a.riesgo)
              .slice(0, 3);

            return (
              <div key={day.fecha} className="flex flex-col items-center shrink-0 w-[72px]">
                <button
                  onClick={() => toggle(idx)}
                  className={`
                    w-full rounded-xl border p-2 cursor-pointer transition-all duration-200
                    ${cardBgColors[color]} ${cardBorderColors[color]}
                    ${isExpanded ? 'ring-2 ring-blue-300 shadow-md' : 'shadow-sm hover:shadow-md'}
                  `}
                >
                  <p className="text-[10px] font-semibold text-gray-600">{dia}</p>
                  <p className="text-xs font-bold text-gray-800 mb-1">{num}</p>

                  {/* Risk bar */}
                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mb-1">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColors[color]}`}
                      style={{ width: `${day.riesgoGeneral}%` }}
                    />
                  </div>

                  <p className="text-[10px] font-bold text-gray-700 mb-1">
                    {day.riesgoGeneral}%
                  </p>

                  {/* Top pest icons */}
                  <div className="flex justify-center gap-0.5">
                    {topPestes.map((p) => (
                      <span key={p.key} className="text-sm leading-none" title={p.nombre}>
                        {p.icono}
                      </span>
                    ))}
                  </div>
                </button>

                {/* Chevron */}
                <button
                  onClick={() => toggle(idx)}
                  className="mt-1 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={isExpanded ? 'Colapsar detalles' : 'Expandir detalles'}
                >
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {/* Expanded details */}
                <div
                  className={`
                    w-[200px] -ml-[64px] mt-1 origin-top transition-all duration-300 ease-in-out overflow-hidden
                    ${isExpanded ? 'max-h-[500px] opacity-100 scale-y-100' : 'max-h-0 opacity-0 scale-y-0'}
                  `}
                >
                  <div className="bg-white rounded-xl shadow-md border border-gray-200 p-3 text-left">
                    <p className="text-[10px] font-semibold text-gray-500 mb-2">
                      {dia} {num} · {day.riesgoGeneral}% riesgo
                    </p>

                    <div className="space-y-2">
                      {(day.plagas ?? []).map((plaga) => (
                        <div key={plaga.key} className="border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-sm">{plaga.icono}</span>
                            <span className="text-xs font-semibold text-gray-800">{plaga.nombre}</span>
                            <span className="ml-auto text-[10px] font-bold text-gray-600">{plaga.riesgo}%</span>
                          </div>

                          {plaga.factores?.length > 0 && (
                            <p className="text-[10px] text-gray-500 leading-tight">
                              {plaga.factores.join(' · ')}
                            </p>
                          )}

                          {plaga.recomendaciones?.length > 0 && (
                            <ul className="mt-1 space-y-0.5">
                              {plaga.recomendaciones.map((rec, i) => (
                                <li key={i} className="text-[10px] text-gray-600 flex items-start gap-1">
                                  <span className="text-blue-400 mt-0.5">•</span>
                                  <span>{rec}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
