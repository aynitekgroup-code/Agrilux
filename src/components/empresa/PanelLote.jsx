/**
 * Panel de campaña + Detalle del lote (pantallas 1 y 2 de Parcela empresas)
 */
import React, { useState, useEffect } from 'react';
import NdviParcela from '../NdviParcela';
import { etiquetaRiesgo, colorRiesgo } from '../../lib/empresaApi';

const fmt = (n, d = 0) => (Number(n) || 0).toLocaleString('es-PE', { maximumFractionDigits: d });

export function PanelCampana({ empresa, kpis, lotes, fundos, onVerLote, onNuevoLote }) {
  const porFundo = fundos.length
    ? fundos.map((f) => ({ fundo: f, lotes: lotes.filter((l) => l.fundo_id === f.id) }))
    : [{ fundo: { nombre: 'Todos los lotes' }, lotes }];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
          <p className="text-[11px] text-gray-500">Hectáreas</p>
          <p className="text-xl font-bold text-gray-800">{fmt(kpis.hectareas, 1)} ha</p>
        </div>
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
          <p className="text-[11px] text-gray-500">Rendimiento vs anterior</p>
          <p className={`text-xl font-bold ${kpis.mejora >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {kpis.mejora >= 0 ? '+' : ''}{kpis.mejora} %
          </p>
        </div>
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
          <p className="text-[11px] text-gray-500">Alertas hoy</p>
          <p className="text-xl font-bold text-gray-800">{kpis.alertas}</p>
        </div>
        <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
          <p className="text-[11px] text-gray-500">Costo por ha</p>
          <p className="text-xl font-bold text-gray-800">S/ {fmt(kpis.costoPorHa)}</p>
        </div>
      </div>

      {porFundo.map(({ fundo, lotes: ls }, i) => (
        <div key={i}>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{fundo.nombre}</p>
          <div className="space-y-2">
            {ls.map((l) => (
              <button key={l.id} onClick={() => onVerLote(l)}
                className="w-full bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex items-center gap-3 text-left">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  l.riesgo === 'critico' ? 'bg-red-600' : l.riesgo === 'alto' ? 'bg-red-500'
                  : l.riesgo === 'moderado' ? 'bg-amber-500' : 'bg-green-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-800 truncate">{l.nombre} · {nombreCultivo(l.cultivo)}</p>
                  <p className="text-[11px] text-gray-500">{l.etapa || 'Sin etapa registrada'}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${colorRiesgo[l.riesgo] || colorRiesgo.bajo}`}>
                  {etiquetaRiesgo[l.riesgo] || 'Bajo'}
                </span>
              </button>
            ))}
            {ls.length === 0 && <p className="text-xs text-gray-400">Sin lotes aquí todavía.</p>}
          </div>
        </div>
      ))}

      <button onClick={onNuevoLote} className="w-full bg-primary text-white font-bold py-3 rounded-2xl text-sm">
        + Nuevo lote
      </button>
    </div>
  );
}

function nombreCultivo(id) {
  const m = { papa: 'Papa', palta: 'Palta', arandano: 'Arándano', maiz: 'Maíz', cana: 'Caña', platano: 'Plátano', papaya: 'Papaya', tomate: 'Tomate', aji_amarillo: 'Ají amarillo', pimiento: 'Pimiento' };
  return m[id] || id || '';
}

export function LoteDetalle({ lote, labores, hallazgos, onSubirFoto, onMarcarHallazgo, onVolver }) {
  const [tab, setTab] = useState('resumen');
  const [riesgo, setRiesgo] = useState(null);

  useEffect(() => {
    if (!lote?.lat || !lote?.lon) return;
    const dias = lote.fecha_siembra ? Math.floor((new Date() - new Date(lote.fecha_siembra)) / 864e5) : 30;
    fetch(`/api/alertas-preventivas?lat=${lote.lat}&lon=${lote.lon}&cultivo=${lote.cultivo || 'papa'}&diasDesdeSiembra=${dias}`)
      .then((r) => r.json()).then(setRiesgo).catch(() => {});
  }, [lote?.id]);

  const laboresLote = labores.filter((x) => x.lote_id === lote.id).slice(0, 5);
  const hallazgosLote = hallazgos.filter((x) => x.lote_id === lote.id);

  return (
    <div className="space-y-3">
      <button onClick={onVolver} className="text-primary text-sm font-bold">← Panel</button>
      <div>
        <h2 className="text-xl font-bold text-gray-800">{lote.nombre}</h2>
        <p className="text-xs text-gray-500">{nombreCultivo(lote.cultivo)}{lote.variedad ? ` ${lote.variedad}` : ''} · {lote.area_ha || '-'} ha</p>
      </div>

      <div className="flex gap-1.5">
        {['resumen', 'satelite', 'labores', 'costos'].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 text-xs font-bold py-2 rounded-xl capitalize ${tab === t ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>
            {t === 'satelite' ? 'Satélite' : t}
          </button>
        ))}
      </div>

      {tab === 'resumen' && (
        <>
          <div className={`rounded-2xl p-4 border-2 flex items-center gap-3 ${
            riesgo?.riesgo?.nivel === 'critico' ? 'bg-red-50 border-red-400'
            : riesgo?.riesgo?.nivel === 'alto' ? 'bg-orange-50 border-orange-400' : 'bg-amber-50 border-amber-200'}`}>
            <div className="w-10 h-10 rounded-full bg-amber-500 text-white font-bold flex items-center justify-center">
              {riesgo?.riesgo?.puntos ?? '–'}
            </div>
            <div className="text-xs">
              <p className="font-bold">Riesgo {riesgo?.riesgo?.nivel || lote.riesgo || 'moderado'}</p>
              <p className="text-gray-500">{riesgo?.alertas?.[0]?.nombre || 'Monitoreo activo del lote'}</p>
            </div>
          </div>
          {hallazgosLote.length > 0 && (
            <div className="bg-white rounded-2xl p-3 border border-gray-100">
              <p className="text-xs font-bold text-gray-500 mb-2">📍 Hallazgos en mapa ({hallazgosLote.length})</p>
              {hallazgosLote.slice(0, 3).map((h) => (
                <p key={h.id} className="text-xs text-gray-700">• {h.descripcion || h.tipo}</p>
              ))}
            </div>
          )}
          <button onClick={onSubirFoto} className="w-full bg-primary text-white font-bold py-3 rounded-2xl text-sm">
            Subir foto de monitoreo
          </button>
          <button onClick={onMarcarHallazgo} className="w-full bg-white text-primary border-2 border-primary font-bold py-3 rounded-2xl text-sm">
            Marcar hallazgo en el mapa
          </button>
        </>
      )}

      {tab === 'satelite' && lote.lat && (
        <NdviParcela lat={lote.lat} lon={lote.lon} cultivo={lote.cultivo} nombre={lote.nombre}
          diasDesdeSiembra={lote.fecha_siembra ? Math.floor((new Date() - new Date(lote.fecha_siembra)) / 864e5) : 0} />
      )}
      {tab === 'satelite' && !lote.lat && (
        <p className="text-xs text-gray-500 bg-white rounded-2xl p-4">Registra el GPS del lote para ver el satélite.</p>
      )}

      {tab === 'labores' && (
        <div className="space-y-2">
          {laboresLote.map((lb) => (
            <div key={lb.id} className="bg-white rounded-xl p-3 border border-gray-100">
              <p className="text-sm font-bold">{lb.tipo}{lb.producto ? ` · ${lb.producto}` : ''}</p>
              <p className="text-[11px] text-gray-500">{lb.fecha}{lb.responsable_nombre ? ` · ${lb.responsable_nombre}` : ''}</p>
            </div>
          ))}
          {laboresLote.length === 0 && <p className="text-xs text-gray-400">Sin labores registradas.</p>}
        </div>
      )}

      {tab === 'costos' && (
        <CostosLote labores={labores.filter((x) => x.lote_id === lote.id)} />
      )}
    </div>
  );
}

function CostosLote({ labores }) {
  const total = labores.reduce((a, l) => a + (parseFloat(l.costo) || 0), 0);
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100">
      <p className="text-xs text-gray-500">Gasto en labores del lote</p>
      <p className="text-2xl font-bold">S/ {fmt(total)}</p>
      <p className="text-[11px] text-gray-400 mt-1">{labores.length} labores registradas</p>
    </div>
  );
}
