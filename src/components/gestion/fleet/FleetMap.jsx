import React from 'react';
import { MapPin, Info } from 'lucide-react';
import { fleetMap, geofences } from '../../../mocks/agrotrackData';
import { FLEET, STATUS_META } from './fleetTokens';

const { lotes, vias, planta, zona, colores } = fleetMap;

export default function FleetMap({ vehicles = [], selectedId, onSelect }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-w-0">
      <div className="p-4 sm:p-5 flex flex-wrap items-start gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900">Mapa de monitoreo</h2>
          <p className="text-xs text-slate-500">Geocercas y posiciones aproximadas de la flota</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
          <MapPin size={12} /> Modo demo / coordenadas simuladas
        </span>
      </div>

      <div className="px-3 sm:px-5 pb-2 overflow-x-auto">
        <svg
          viewBox="0 0 1000 620"
          role="img"
          aria-label="Mapa demostrativo de la flota con vehículos y geocercas simuladas"
          style={{ width: '100%', minWidth: 640, height: 'auto', display: 'block', borderRadius: 14, background: colores.fondo }}
        >
          <rect x="0" y="0" width="1000" height="620" fill={colores.fondo} rx="14" />

          {geofences.filter((g) => g.activa).map((g) => (
            <polygon
              key={g.id}
              points={g.coords.map((p) => p.join(',')).join(' ')}
              fill={g.color}
              fillOpacity="0.08"
              stroke={g.color}
              strokeWidth="2"
              strokeDasharray="8 6"
              strokeLinejoin="round"
            />
          ))}

          {lotes.map((l) => (
            <polygon
              key={l.id}
              points={l.pts.map((p) => p.join(',')).join(' ')}
              fill={colores.lote}
              stroke={colores.borde_lote}
              strokeWidth="1.5"
            />
          ))}

          <rect x={planta.x} y={planta.y} width={planta.w} height={planta.h} rx="4" fill={colores.planta} stroke={colores.borde_via} strokeWidth="1.5" />

          {vias.map((r, i) => (
            <polyline key={`via-borde-${i}`} points={r} fill="none" stroke={colores.borde_via} strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {vias.map((r, i) => (
            <polyline key={`via-${i}`} points={r} fill="none" stroke={colores.via} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
          ))}

          <rect
            x={zona.x0}
            y={zona.y0}
            width={zona.x1 - zona.x0}
            height={zona.y1 - zona.y0}
            rx="8"
            fill="none"
            stroke={FLEET.forest}
            strokeWidth="2.5"
            strokeDasharray="10 7"
            opacity="0.55"
          />

          {lotes.map((l) => (
            <text key={`lbl-${l.id}`} x={l.pts[0][0] + 14} y={l.pts[0][1] + 26} fontSize="14" fontWeight="600" fill="#1F2937" opacity="0.65">
              {l.nombre}
            </text>
          ))}
          <text x={planta.x + 10} y={planta.y + 24} fontSize="14" fontWeight="600" fill="#1F2937" opacity="0.65">
            Planta / grifo
          </text>

          {vehicles.map((v) => {
            const meta = STATUS_META[v.estado] || STATUS_META.offline;
            const isSelected = v.id === selectedId;
            return (
              <g
                key={v.id}
                role="button"
                tabIndex={0}
                aria-label={`${v.placa} · ${meta.label}`}
                onClick={onSelect ? () => onSelect(v.id) : undefined}
                onKeyDown={
                  onSelect
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelect(v.id);
                        }
                      }
                    : undefined
                }
                style={{ cursor: onSelect ? 'pointer' : 'default' }}
              >
                {isSelected ? <circle cx={v.posicion[0]} cy={v.posicion[1]} r="20" fill="none" stroke={FLEET.blue} strokeWidth="3" /> : null}
                <circle cx={v.posicion[0]} cy={v.posicion[1]} r="8" fill={meta.dot} stroke="#FFFFFF" strokeWidth="3" />
                <rect x={v.posicion[0] + 12} y={v.posicion[1] - 25} width="82" height="21" rx="6" fill="#FFFFFF" stroke={isSelected ? FLEET.blue : '#E2E8F0'} strokeWidth="1.5" />
                <text x={v.posicion[0] + 19} y={v.posicion[1] - 10} fontSize="12" fontWeight="600" fill="#0F172A">
                  {v.placa}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="px-4 sm:px-5 pb-4 pt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500">
        {Object.entries(STATUS_META).map(([key, meta]) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: meta.dot }} />
            {meta.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 sm:ml-auto">
          <Info size={12} /> Marcadores simulados; sin hardware real.
        </span>
      </div>
    </div>
  );
}
