/**
 * Cosecha y costos + Equipo y reportes (pantallas 5 y 6 de Parcela empresas)
 */
import React, { useState } from 'react';
import { CATEGORIAS_GASTO, iniciales, exportarCSV, ROLES } from '../../lib/empresaApi';

const fmt = (n) => (Number(n) || 0).toLocaleString('es-PE', { maximumFractionDigits: 0 });
const CAT_LABEL = { insumos: 'Insumos', mano_obra: 'Mano de obra', riego: 'Riego', maquinaria: 'Maquinaria', otros: 'Otros' };

// ── COSECHA Y COSTOS ─────────────────────────────────
export function CosechaCostos({ lotes, cosechas, gastos, campana, demo, onGuardarCosecha, onGuardarGasto }) {
  const [fc, setFc] = useState({ lote_id: lotes[0]?.id || '', fecha: new Date().toISOString().slice(0, 10), sacos: '', area_ha: '', precio_unit: '' });
  const [fg, setFg] = useState({ lote_id: lotes[0]?.id || '', categoria: 'insumos', concepto: '', monto: '', fecha: new Date().toISOString().slice(0, 10) });

  const porCamp = (camp) => cosechas.filter((c) => c.campana === camp);
  const rend = (camp) => {
    const cs = porCamp(camp);
    const s = cs.reduce((a, c) => a + (parseFloat(c.sacos) || 0), 0);
    const h = cs.reduce((a, c) => a + (parseFloat(c.area_ha) || 0), 0);
    return h > 0 ? s / h : 0;
  };
  const rAct = rend(campana); const rAnt = rend(campana === '2026-A' ? '2025-B' : '');
  const mejoraPct = rAnt > 0 ? Math.round(((rAct - rAnt) / rAnt) * 100) : 0;

  const gastosCamp = gastos.filter((g) => g.campana === campana);
  const costoTotal = gastosCamp.reduce((a, g) => a + (parseFloat(g.monto) || 0), 0);
  const ha = lotes.reduce((a, l) => a + (parseFloat(l.area_ha) || 0), 0);
  const costoHa = ha > 0 ? costoTotal / ha : 0;
  const ingresoHa = rAct * (parseFloat(porCamp(campana)[0]?.precio_unit) || 120);
  const margenHa = ingresoHa - costoHa;
  const maxBar = Math.max(rAct, rAnt, 1);

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <p className="text-xs text-gray-500 mb-2">Sacos por hectárea</p>
        <div className="flex gap-6 items-end h-28 border-b-2 border-gray-100 px-6">
          <div className="flex-1 flex flex-col items-center justify-end h-full gap-1">
            <b>{fmt(rAnt)}</b><div className="w-full bg-gray-200 rounded-t-lg" style={{ height: `${(rAnt / maxBar) * 70}%` }} />
          </div>
          <div className="flex-1 flex flex-col items-center justify-end h-full gap-1">
            <b>{fmt(rAct)}</b><div className="w-full bg-primary rounded-t-lg" style={{ height: `${(rAct / maxBar) * 70}%` }} />
          </div>
        </div>
        <div className="flex gap-6 px-6 text-[11px] text-gray-500">
          <span className="flex-1 text-center">Anterior</span><span className="flex-1 text-center">{campana}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-2xl p-3 border border-gray-100"><p className="text-[11px] text-gray-500">Mejora</p><p className="text-xl font-bold text-green-600">+{mejoraPct} %</p></div>
        <div className="bg-white rounded-2xl p-3 border border-gray-100"><p className="text-[11px] text-gray-500">Costo por ha</p><p className="text-xl font-bold">S/ {fmt(costoHa)}</p></div>
        <div className="bg-white rounded-2xl p-3 border border-gray-100"><p className="text-[11px] text-gray-500">Ingreso por ha</p><p className="text-xl font-bold">S/ {fmt(ingresoHa)}</p></div>
        <div className="bg-white rounded-2xl p-3 border border-gray-100"><p className="text-[11px] text-gray-500">Margen por ha</p><p className="text-xl font-bold text-green-600">S/ {fmt(margenHa)}</p></div>
      </div>
      <div className="bg-white rounded-2xl p-3 border border-gray-100 space-y-1.5">
        {CATEGORIAS_GASTO.map((c) => {
          const t = gastosCamp.filter((g) => g.categoria === c).reduce((a, g) => a + (parseFloat(g.monto) || 0), 0);
          if (!t) return null;
          return <p key={c} className="text-xs text-gray-700 flex justify-between"><span>{CAT_LABEL[c]}</span><b>S/ {fmt(t)}</b></p>;
        })}
        {gastosCamp.length === 0 && <p className="text-xs text-gray-400">Sin gastos registrados en {campana}.</p>}
      </div>

      <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-2">
        <p className="text-sm font-bold">+ Registrar cosecha</p>
        <select value={fc.lote_id} onChange={(e) => setFc({ ...fc, lote_id: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm">
          {lotes.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
        </select>
        <div className="grid grid-cols-3 gap-2">
          <input type="number" value={fc.sacos} onChange={(e) => setFc({ ...fc, sacos: e.target.value })} placeholder="Sacos" className="border rounded-xl px-3 py-2 text-sm" />
          <input type="number" value={fc.area_ha} onChange={(e) => setFc({ ...fc, area_ha: e.target.value })} placeholder="Ha" className="border rounded-xl px-3 py-2 text-sm" />
          <input type="number" value={fc.precio_unit} onChange={(e) => setFc({ ...fc, precio_unit: e.target.value })} placeholder="S/ saco" className="border rounded-xl px-3 py-2 text-sm" />
        </div>
        <button disabled={demo} onClick={() => onGuardarCosecha({ ...fc, sacos: parseFloat(fc.sacos) || 0, area_ha: parseFloat(fc.area_ha) || 0, precio_unit: parseFloat(fc.precio_unit) || 0, campana, empresa_id: undefined })} className="w-full bg-primary text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
          Guardar cosecha
        </button>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-2">
        <p className="text-sm font-bold">+ Registrar gasto</p>
        <div className="grid grid-cols-2 gap-2">
          <select value={fg.categoria} onChange={(e) => setFg({ ...fg, categoria: e.target.value })} className="border rounded-xl px-3 py-2 text-sm">
            {CATEGORIAS_GASTO.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
          </select>
          <input type="number" value={fg.monto} onChange={(e) => setFg({ ...fg, monto: e.target.value })} placeholder="Monto S/" className="border rounded-xl px-3 py-2 text-sm" />
        </div>
        <input value={fg.concepto} onChange={(e) => setFg({ ...fg, concepto: e.target.value })} placeholder="Concepto" className="w-full border rounded-xl px-3 py-2 text-sm" />
        <button disabled={demo} onClick={() => fg.concepto && onGuardarGasto({ ...fg, monto: parseFloat(fg.monto) || 0, campana, empresa_id: undefined })} className="w-full bg-primary text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
          Guardar gasto
        </button>
        <button onClick={() => exportarCSV('costos.csv', gastosCamp)} className="w-full bg-white text-primary border-2 border-primary font-bold py-2.5 rounded-xl text-sm">
          Exportar costos (CSV)
        </button>
      </div>
    </div>
  );
}

// ── EQUIPO Y REPORTES ────────────────────────────────
export function EquipoReportes({ miembros, empresa, lotes, labores, cosechas, gastos, demo, puedeGestionar, onInvitar }) {
  const [inv, setInv] = useState({ nombre: '', email: '', rol: 'operario' });

  const reporteCampana = () => {
    const lineas = [
      `INFORME DE CAMPAÑA - ${empresa.nombre}`,
      `Campaña: ${empresa.campana_activa}`,
      `Lotes: ${lotes.length}`,
      ...lotes.map((l) => `- ${l.nombre} (${l.cultivo || ''}): ${labores.filter((x) => x.lote_id === l.id).length} labores, ${cosechas.filter((x) => x.lote_id === l.id).reduce((a, c) => a + (parseFloat(c.sacos) || 0), 0)} sacos`),
      `Gasto total: S/ ${gastos.reduce((a, g) => a + (parseFloat(g.monto) || 0), 0)}`,
    ];
    const blob = new Blob([lineas.join('\n')], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'informe-campana.txt'; a.click();
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-gray-500 uppercase">Usuarios</p>
      <div className="space-y-2">
        {miembros.map((m) => (
          <div key={m.id} className="bg-white rounded-xl p-3 border border-gray-100 flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-green-100 text-green-700 font-bold text-[11px] flex items-center justify-center">{iniciales(m.nombre)}</span>
            <div className="flex-1"><p className="text-sm font-bold">{m.nombre}</p><p className="text-[11px] text-gray-500 capitalize">{m.rol}</p></div>
          </div>
        ))}
      </div>

      {puedeGestionar && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-2">
          <p className="text-sm font-bold">+ Invitar usuario</p>
          <input value={inv.nombre} onChange={(e) => setInv({ ...inv, nombre: e.target.value })} placeholder="Nombre" className="w-full border rounded-xl px-3 py-2 text-sm" />
          <input value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} placeholder="Correo" className="w-full border rounded-xl px-3 py-2 text-sm" />
          <select value={inv.rol} onChange={(e) => setInv({ ...inv, rol: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm capitalize">
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button disabled={demo || !inv.nombre} onClick={() => { onInvitar({ ...inv, empresa_id: undefined }); setInv({ nombre: '', email: '', rol: 'operario' }); }} className="w-full bg-primary text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
            Invitar
          </button>
          {!demo && <p className="text-[11px] text-gray-400">El invitado entra con su cuenta y aparece con ese rol.</p>}
        </div>
      )}

      <p className="text-xs font-bold text-gray-500 uppercase">Reportes</p>
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
        <button onClick={reporteCampana} className="w-full flex justify-between p-3 text-sm"><span>Informe de campaña {empresa.campana_activa}</span><span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded-full">TXT</span></button>
        <button onClick={() => exportarCSV('trazabilidad.csv', labores)} className="w-full flex justify-between p-3 text-sm"><span>Trazabilidad por lote (labores)</span><span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded-full">CSV</span></button>
        <button onClick={() => exportarCSV('costos-cosecha.csv', [...gastos.map((g) => ({ tipo: 'gasto', ...g })), ...cosechas.map((c) => ({ tipo: 'cosecha', ...c }))])} className="w-full flex justify-between p-3 text-sm"><span>Costos y cosecha</span><span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded-full">CSV</span></button>
      </div>
    </div>
  );
}
