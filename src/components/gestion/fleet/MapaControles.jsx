import React, { useMemo } from 'react';
import { Layers, Satellite, X } from 'lucide-react';
import { COLORES_GRUPO, ETIQUETAS_GRUPO } from '../../../lib/asistenteMapa';
import { areaHectareas, contarVertices } from '../../../lib/geocercasGeometria';

/**
 * Controles flotantes del mapa de flota (FASE 3.8):
 *   * LeyendaGrupos    → leyenda con colores y conteos por grupo (abajo-izquierda).
 *   * FichaGeocerca    → ficha de la geocerca seleccionada con vértices y área (arriba-derecha).
 *   * ControlVistaSatelite → alterna vista satélite / calle (arriba-derecha).
 * Van DENTRO del contenedor del mapa (position absolute).
 */

/* ------------------------------------------------------------------ */
/* Leyenda                                                             */
/* ------------------------------------------------------------------ */

const ORDEN_GRUPOS = ['autorizada', 'oficina', 'distrito', 'poligono'];

export function LeyendaGrupos({ geofences = [] }) {
  const conteos = useMemo(() => {
    const cuenta = {};
    for (const g of geofences) {
      const clave = g.tipo && COLORES_GRUPO[g.tipo] ? g.tipo : 'poligono';
      cuenta[clave] = (cuenta[clave] || 0) + 1;
    }
    return cuenta;
  }, [geofences]);

  const visibles = ORDEN_GRUPOS.filter((grupo) => conteos[grupo]);
  if (!visibles.length) return null;

  return (
    <div className="absolute bottom-3 left-3 z-[1100] rounded-xl border border-white/80 bg-white/95 px-3 py-2.5 shadow-[0_4px_18px_rgba(15,23,42,0.22)] backdrop-blur">
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        <Layers size={12} />
        Geocercas
      </p>
      <ul className="space-y-1">
        {visibles.map((grupo) => (
          <li key={grupo} className="flex items-center gap-2 text-[12px] text-slate-700">
            <span
              className="h-3 w-3 shrink-0 rounded-sm ring-1 ring-black/15"
              style={{ background: COLORES_GRUPO[grupo].relleno }}
              aria-hidden="true"
            />
            <span className="font-medium">{ETIQUETAS_GRUPO[grupo]}</span>
            <span className="ml-auto rounded-full bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-bold text-slate-600">
              {conteos[grupo]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ficha de la geocerca seleccionada                                   */
/* ------------------------------------------------------------------ */

export function FichaGeocerca({ geocerca, onCerrar }) {
  if (!geocerca) return null;

  const tipo = geocerca.tipo && COLORES_GRUPO[geocerca.tipo] ? geocerca.tipo : 'poligono';
  const etiqueta = ETIQUETAS_GRUPO[tipo];
  const vertices = geocerca.geometria ? contarVertices(geocerca.geometria) : 0;
  const area = geocerca.geometria ? areaHectareas(geocerca.geometria) : 0;
  const colores = COLORES_GRUPO[tipo];

  return (
    <div
      className="absolute top-3 right-3 z-[1100] w-[min(260px,calc(100%-24px))] overflow-hidden rounded-xl border border-white/80 bg-white/97 shadow-[0_6px_24px_rgba(15,23,42,0.25)] backdrop-blur"
      role="region"
      aria-label="Ficha de la geocerca seleccionada"
    >
      <div
        className="flex items-center gap-2 px-3 py-2 text-white"
        style={{ background: `linear-gradient(135deg, ${colores.borde}, ${colores.relleno})` }}
      >
        <span className="h-3 w-3 shrink-0 rounded-sm bg-white/85 ring-1 ring-black/15" aria-hidden="true" />
        <p className="min-w-0 flex-1 truncate text-[13px] font-bold" title={geocerca.nombre}>
          {geocerca.nombre || '(sin nombre)'}
        </p>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-lg p-1 transition-colors hover:bg-white/20"
          aria-label="Cerrar ficha de la geocerca"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 px-3 pt-2">
        <span
          className="rounded-full px-2 py-0.5 text-[10.5px] font-bold text-white ring-1 ring-black/10"
          style={{ background: colores.borde }}
        >
          {etiqueta}
        </span>
        {geocerca.division ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-600">
            {geocerca.division}
          </span>
        ) : null}
        {geocerca.incluir_reportes === false ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700">
            Fuera de reportes
          </span>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-px bg-slate-100 mt-2 border-t border-slate-100">
        <div className="bg-white px-3 py-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Vértices</dt>
          <dd className="text-[15px] font-bold text-slate-800">{vertices}</dd>
        </div>
        <div className="bg-white px-3 py-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Área</dt>
          <dd className="text-[15px] font-bold text-slate-800">
            {area >= 100
              ? `${Math.round(area).toLocaleString('es-PE')} ha`
              : `${area.toFixed(2)} ha`}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Control vista satélite                                              */
/* ------------------------------------------------------------------ */

export function ControlVistaSatelite({ satelite, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={satelite}
      className={`absolute top-3 left-16 z-[1100] flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-bold shadow-[0_4px_16px_rgba(15,23,42,0.25)] ring-1 ring-black/5 transition-all hover:scale-[1.03] ${
        satelite
          ? 'bg-slate-900 text-white'
          : 'bg-white/95 text-slate-700 backdrop-blur'
      }`}
      title={satelite ? 'Ver vista de calle' : 'Ver vista satélite'}
    >
      <Satellite size={15} />
      {satelite ? 'Calle' : 'Satélite'}
    </button>
  );
}
