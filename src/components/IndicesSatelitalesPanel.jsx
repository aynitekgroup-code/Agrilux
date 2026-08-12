import React from 'react';
import { Satellite, Leaf, Sprout, FlaskConical } from 'lucide-react';
import { INDICES_INFO, getNivelIndice, esCultivoMaizOCana } from '../lib/indicesVegetacion';

const ICONOS = { msavi2: Sprout, ndvi: Leaf, ndre: FlaskConical };

function TarjetaIndice({ id, valor, recomendado }) {
  const info = INDICES_INFO[id];
  const nivel = getNivelIndice(valor, id);
  const Icon = ICONOS[id] || Leaf;

  return (
    <div className={`rounded-xl p-3 border-2 transition-all ${
      recomendado ? 'border-primary bg-primary/5 shadow-sm' : 'border-gray-100 bg-gray-50'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: info.color + '25' }}>
            <Icon size={16} style={{ color: info.color }} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-800">{info.nombre}</p>
            <p className="text-[10px] text-gray-500">{info.etapa}</p>
          </div>
        </div>
        {recomendado && (
          <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">
            Recomendado
          </span>
        )}
      </div>
      {valor != null ? (
        <>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-xl font-bold" style={{ color: info.color }}>{valor.toFixed(2)}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${nivel.bg} ${nivel.text}`}>
              {nivel.label}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
            <div className="h-1.5 rounded-full" style={{ width: `${Math.min(valor * 100, 100)}%`, backgroundColor: info.color }} />
          </div>
        </>
      ) : (
        <p className="text-xs text-gray-400 mt-2">Sin datos</p>
      )}
      <p className="text-[10px] text-gray-500 mt-2 leading-snug">{info.descripcion}</p>
    </div>
  );
}

export default function IndicesSatelitalesPanel({ data, cultivo = '', compact = false }) {
  if (!data) return null;

  const imagen = data.satellite_image || data.ndvi_image;
  const indiceRecomendado = data.indice_recomendado || 'ndvi';
  const mostrarGuia = data.es_maiz_o_cana || esCultivoMaizOCana(cultivo);

  const indices = {
    msavi2: data.msavi2_promedio,
    ndvi: data.ndvi_promedio,
    ndre: data.ndre_promedio,
  };

  return (
    <div className={compact ? '' : 'bg-white rounded-2xl p-4 shadow-sm'}>
      {!compact && (
        <div className="flex items-center gap-2 mb-3">
          <Satellite size={18} className="text-green-600" />
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Índices satelitales</p>
        </div>
      )}

      {imagen && (
        <div className="rounded-xl overflow-hidden mb-3 relative">
          <img src={imagen} alt="Vista satelital" className="w-full h-40 object-cover" />
          <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full">
            {data.source === 'sentinel-hub-wms' ? 'Sentinel-2 · 10m' : 'Satélite · vista aérea'}
          </div>
        </div>
      )}

      {mostrarGuia && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-3">
          <p className="text-[10px] font-bold text-amber-800 uppercase mb-2">Caña y maíz en la costa</p>
          <div className="flex items-center justify-between text-[9px] text-amber-700 gap-1">
            <div className="text-center flex-1">
              <p className="font-bold text-blue-600">MSAVI2</p>
              <p>Siembra</p>
            </div>
            <span className="text-amber-400">→</span>
            <div className="text-center flex-1">
              <p className="font-bold text-green-600">NDVI</p>
              <p>Crecimiento</p>
            </div>
            <span className="text-amber-400">→</span>
            <div className="text-center flex-1">
              <p className="font-bold text-purple-600">NDRE</p>
              <p>Cosecha</p>
            </div>
          </div>
          {data.nota_etapa && (
            <p className="text-[10px] text-amber-700 mt-2 text-center">{data.nota_etapa}</p>
          )}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        {(['msavi2', 'ndvi', 'ndre']).map(id => (
          <TarjetaIndice
            key={id}
            id={id}
            valor={indices[id]}
            recomendado={id === indiceRecomendado}
          />
        ))}
      </div>

      {data.recomendacion && (
        <div className="bg-green-50 rounded-xl p-3 mt-3">
          <p className="text-xs text-green-700">📋 {data.recomendacion}</p>
        </div>
      )}

      <p className="text-[10px] text-gray-400 mt-3 text-center">
        {data.source === 'sentinel-hub-wms' ? 'Sentinel-2 ESA · Resolución 10m' :
          data.source === 'esri-world-imagery' ? 'Satélite ESRI · índices estimados' :
          'Índices estimados por ubicación · MSAVI2 y NDRE derivados del análisis local'}
      </p>
    </div>
  );
}
