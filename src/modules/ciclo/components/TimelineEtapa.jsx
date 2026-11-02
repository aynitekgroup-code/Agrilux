import React from 'react';
import { Check, Circle, ArrowRight } from 'lucide-react';

export default function TimelineEtapa({ etapas, diasDesdeSiembra, onSelect }) {
  const getEstado = (etapa) => {
    if (diasDesdeSiembra >= etapa.diasFin) return 'pasada';
    if (diasDesdeSiembra >= etapa.diasInicio) return 'actual';
    return 'futura';
  };

  const progresoEnEtapa = (etapa) => {
    if (diasDesdeSiembra < etapa.diasInicio) return 0;
    if (diasDesdeSiembra >= etapa.diasFin) return 100;
    const duracion = etapa.diasFin - etapa.diasInicio;
    const transcurrido = diasDesdeSiembra - etapa.diasInicio;
    return Math.round((transcurrido / duracion) * 100);
  };

  return (
    <div className="relative">
      {etapas.map((etapa, i) => {
        const estado = getEstado(etapa);
        const progreso = progresoEnEtapa(etapa);
        const esUltimo = i === etapas.length - 1;

        return (
          <div key={etapa.id} className="flex gap-3 relative" onClick={() => onSelect?.(etapa)}>
            {/* Línea vertical + nodo */}
            <div className="flex flex-col items-center">
              {/* Nodo */}
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10
                transition-all duration-300 cursor-pointer
                ${estado === 'pasada' ? 'bg-green-500 text-white' :
                  estado === 'actual' ? 'bg-primary text-white ring-4 ring-primary/20' :
                  'bg-gray-200 text-gray-400'}
              `}>
                {estado === 'pasada' ? (
                  <Check size={18} strokeWidth={3} />
                ) : estado === 'actual' ? (
                  <span className="text-lg">{etapa.emoji}</span>
                ) : (
                  <Circle size={18} />
                )}
              </div>
              {/* Línea conectora */}
              {!esUltimo && (
                <div className="w-0.5 flex-1 min-h-[40px] relative">
                  <div className="absolute inset-0 bg-gray-200 rounded-full" />
                  {estado === 'pasada' && (
                    <div className="absolute inset-0 bg-green-500 rounded-full" />
                  )}
                  {estado === 'actual' && (
                    <div className="absolute top-0 left-0 right-0 bg-primary rounded-full"
                         style={{ height: `${progreso}%` }} />
                  )}
                </div>
              )}
            </div>

            {/* Contenido */}
            <div className={`flex-1 pb-6 ${!esUltimo ? '' : ''}`}>
              <div className={`
                rounded-xl p-3 transition-all cursor-pointer
                ${estado === 'actual' ? 'bg-primary/5 border border-primary/20' :
                  estado === 'pasada' ? 'bg-green-50/50' :
                  'bg-gray-50/50'}
              `}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-lg mr-1">{etapa.emoji}</span>
                    <span className={`font-bold text-sm ${
                      estado === 'pasada' ? 'text-green-700' :
                      estado === 'actual' ? 'text-primary' :
                      'text-gray-400'
                    }`}>
                      {etapa.nombre}
                    </span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    estado === 'pasada' ? 'bg-green-100 text-green-600' :
                    estado === 'actual' ? 'bg-primary/10 text-primary' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {etapa.diasInicio}–{etapa.diasFin} días
                  </span>
                </div>

                {/* Barra de progreso solo para etapa actual */}
                {estado === 'actual' && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Día {diasDesdeSiembra - etapa.diasInicio} de {etapa.diasFin - etapa.diasInicio}</span>
                      <span className="font-bold text-primary">{progreso}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all duration-500"
                           style={{ width: `${progreso}%` }} />
                    </div>
                  </div>
                )}

                {/* Acciones compactas */}
                {estado === 'actual' && etapa.acciones?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {etapa.acciones.slice(0, 3).map((a, j) => (
                      <div key={j} className="flex items-start gap-1.5 text-xs text-gray-600">
                        <ArrowRight size={12} className="text-primary mt-0.5 flex-shrink-0" />
                        <span>{a}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Etapa futura: preview */}
                {estado === 'futura' && (
                  <p className="text-xs text-gray-400 mt-1">
                    En {etapa.diasInicio - diasDesdeSiembra} días aproximadamente
                  </p>
                )}

                {/* Etapa pasada: resumen */}
                {estado === 'pasada' && (
                  <p className="text-xs text-green-600 mt-1">Completada</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
