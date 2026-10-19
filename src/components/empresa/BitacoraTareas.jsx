/**
 * Bitácora de labores + Tareas del equipo + Calendario empresarial
 * (pantallas 3, 4 y calendario de Parcela empresas)
 */
import React, { useState, useMemo } from 'react';
import { TIPOS_LABOR, iniciales, exportarCSV } from '../../lib/empresaApi';
import { isOnline } from '../../lib/offlineStorage';

const fmtFecha = (f) => { try { return new Date(f + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }); } catch { return f; } };

// ── BITÁCORA ─────────────────────────────────────────
export function Bitacora({ lotes, labores, demo, onGuardar }) {
  const [form, setForm] = useState({ lote_id: lotes[0]?.id || '', tipo: 'Fumigación', producto: '', dosis: '', responsable_nombre: '', fecha: new Date().toISOString().slice(0, 10), carencia_hasta: '', costo: '', observaciones: '' });
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!form.lote_id || !form.tipo) return;
    setGuardando(true);
    try {
      await onGuardar({ ...form, costo: parseFloat(form.costo) || 0, carencia_hasta: form.carencia_hasta || null, empresa_id: undefined });
      setForm({ ...form, producto: '', dosis: '', costo: '', observaciones: '', carencia_hasta: '' });
    } catch (e) { alert('No se pudo guardar: ' + (e.message || e)); }
    setGuardando(false);
  };

  const carenciaActiva = labores.find((l) => l.carencia_hasta && l.carencia_hasta >= new Date().toISOString().slice(0, 10));

  return (
    <div className="space-y-3">
      {!isOnline() && (
        <p className="text-[11px] bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-2.5">
          Sin internet. Los registros se guardan en el equipo y se envían al reconectar.
        </p>
      )}
      {carenciaActiva && (
        <p className="text-[11px] bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-2.5">
          ⏳ Periodo de carencia: no cosechar antes del {fmtFecha(carenciaActiva.carencia_hasta)} ({carenciaActiva.producto || carenciaActiva.tipo}).
        </p>
      )}
      <div className="space-y-2">
        {labores.slice(0, 20).map((lb) => (
          <div key={lb.id} className="bg-white rounded-xl p-3 border border-gray-100">
            <p className="text-sm font-bold">{lb.tipo}{lb.producto ? ` · ${lb.producto}` : ''}</p>
            <p className="text-[11px] text-gray-500">
              {nombreLote(lotes, lb.lote_id)}{lb.dosis ? ` · ${lb.dosis}` : ''}{lb.responsable_nombre ? ` · ${lb.responsable_nombre}` : ''} · {fmtFecha(lb.fecha)}
            </p>
          </div>
        ))}
        {labores.length === 0 && <p className="text-xs text-gray-400">Sin labores todavía.</p>}
      </div>

      <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-2">
        <p className="text-sm font-bold">+ Registrar labor</p>
        <select value={form.lote_id} onChange={(e) => setForm({ ...form, lote_id: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm">
          {lotes.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="border rounded-xl px-3 py-2 text-sm">
            {TIPOS_LABOR.map((t) => <option key={t}>{t}</option>)}
          </select>
          <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className="border rounded-xl px-3 py-2 text-sm" />
        </div>
        <input value={form.producto} onChange={(e) => setForm({ ...form, producto: e.target.value })} placeholder="Producto (ej. Ridomil Gold MZ)" className="w-full border rounded-xl px-3 py-2 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <input value={form.dosis} onChange={(e) => setForm({ ...form, dosis: e.target.value })} placeholder="Dosis" className="border rounded-xl px-3 py-2 text-sm" />
          <input value={form.responsable_nombre} onChange={(e) => setForm({ ...form, responsable_nombre: e.target.value })} placeholder="Responsable" className="border rounded-xl px-3 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={form.carencia_hasta} onChange={(e) => setForm({ ...form, carencia_hasta: e.target.value })} className="border rounded-xl px-3 py-2 text-sm" />
          <input type="number" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} placeholder="Costo S/" className="border rounded-xl px-3 py-2 text-sm" />
        </div>
        <button onClick={guardar} disabled={guardando || demo} className="w-full bg-primary text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
          {guardando ? 'Guardando...' : demo ? 'Activa tu empresa para registrar' : 'Guardar labor'}
        </button>
        <button onClick={() => exportarCSV('bitacora.csv', labores)} className="w-full bg-white text-primary border-2 border-primary font-bold py-2.5 rounded-xl text-sm">
          Exportar bitácora (CSV)
        </button>
      </div>
    </div>
  );
}

const nombreLote = (lotes, id) => lotes.find((l) => l.id === id)?.nombre || '';

// ── TAREAS ───────────────────────────────────────────
const estadoStyle = {
  pendiente: 'bg-amber-100 text-amber-700',
  en_curso: 'bg-green-100 text-green-700',
  hecha: 'bg-gray-100 text-gray-500',
  atrasada: 'bg-red-100 text-red-700',
};
const estadoLabel = { pendiente: 'Pendiente', en_curso: 'En curso', hecha: 'Hecha', atrasada: 'Atrasada' };

export function TareasEquipo({ lotes, tareas, miembros, demo, puedeAsignar, filtroOperario, onGuardar, onCambiarEstado }) {
  const [form, setForm] = useState({ lote_id: lotes[0]?.id || '', titulo: '', asignado_nombre: '', vence: '', estado: 'pendiente' });
  const visibles = filtroOperario ? tareas.filter((t) => t.asignado_nombre === filtroOperario) : tareas;

  const guardar = async () => {
    if (!form.titulo.trim()) return;
    await onGuardar({ ...form, empresa_id: undefined });
    setForm({ ...form, titulo: '', asignado_nombre: '', vence: '' });
  };

  return (
    <div className="space-y-3">
      {!isOnline() && (
        <p className="text-[11px] bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-2.5">
          Sin internet. {tareas.length} registros se enviarán al reconectar.
        </p>
      )}
      <div className="space-y-2">
        {visibles.map((t) => (
          <div key={t.id} className="bg-white rounded-xl p-3 border border-gray-100 flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-green-100 text-green-700 font-bold text-[11px] flex items-center justify-center shrink-0">
              {iniciales(t.asignado_nombre)}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{t.titulo}</p>
              <p className="text-[11px] text-gray-500">{nombreLote(lotes, t.lote_id)}{t.vence ? ` · vence ${fmtFecha(t.vence)}` : ''}</p>
            </div>
            <select value={t.estado} disabled={demo} onChange={(e) => onCambiarEstado(t.id, e.target.value)}
              className={`text-[10px] font-bold px-2 py-1 rounded-full ${estadoStyle[t.estado] || estadoStyle.pendiente}`}>
              {Object.entries(estadoLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        ))}
        {visibles.length === 0 && <p className="text-xs text-gray-400">Sin tareas.</p>}
      </div>

      {puedeAsignar && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-2">
          <p className="text-sm font-bold">+ Asignar tarea</p>
          <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ej. Fungicida en El Recuerdo" className="w-full border rounded-xl px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.lote_id} onChange={(e) => setForm({ ...form, lote_id: e.target.value })} className="border rounded-xl px-3 py-2 text-sm">
              {lotes.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
            <input type="date" value={form.vence} onChange={(e) => setForm({ ...form, vence: e.target.value })} className="border rounded-xl px-3 py-2 text-sm" />
          </div>
          <select value={form.asignado_nombre} onChange={(e) => setForm({ ...form, asignado_nombre: e.target.value })} className="w-full border rounded-xl px-3 py-2 text-sm">
            <option value="">Asignar a...</option>
            {miembros.map((m) => <option key={m.id} value={m.nombre}>{m.nombre} ({m.rol})</option>)}
          </select>
          <button onClick={guardar} disabled={demo} className="w-full bg-primary text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
            {demo ? 'Activa tu empresa para asignar' : 'Asignar'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── CALENDARIO EMPRESARIAL ───────────────────────────
export function CalendarioEmpresa({ labores, tareas, cosechas, lotes }) {
  const [mes, setMes] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const eventos = useMemo(() => {
    const ev = {};
    const add = (fecha, item) => {
      if (!fecha) return;
      (ev[fecha] = ev[fecha] || []).push(item);
    };
    labores.forEach((l) => add(l.fecha, { tipo: 'labor', txt: `${l.tipo} · ${nombreLote(lotes, l.lote_id)}` }));
    labores.forEach((l) => { if (l.carencia_hasta) add(l.carencia_hasta, { tipo: 'carencia', txt: `Fin carencia · ${l.producto || l.tipo}` }); });
    tareas.forEach((t) => { if (t.estado !== 'hecha') add(t.vence, { tipo: 'tarea', txt: `${t.titulo}` }); });
    cosechas.forEach((c) => add(c.fecha, { tipo: 'cosecha', txt: `Cosecha · ${nombreLote(lotes, c.lote_id)}` }));
    return ev;
  }, [labores, tareas, cosechas, lotes]);

  const primero = new Date(mes.y, mes.m, 1);
  const inicio = (primero.getDay() + 6) % 7; // semana inicia lunes
  const diasMes = new Date(mes.y, mes.m + 1, 0).getDate();
  const celdas = [...Array(inicio).fill(null), ...Array.from({ length: diasMes }, (_, i) => i + 1)];
  const nombreMes = primero.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
  const key = (d) => `${mes.y}-${String(mes.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const [diaSel, setDiaSel] = useState(null);

  const colorEv = { labor: 'bg-green-500', tarea: 'bg-amber-500', cosecha: 'bg-blue-500', carencia: 'bg-red-400' };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setMes(mes.m === 0 ? { y: mes.y - 1, m: 11 } : { y: mes.y, m: mes.m - 1 })} className="bg-white border rounded-xl px-3 py-1.5 text-sm font-bold">‹</button>
        <p className="font-bold capitalize">{nombreMes}</p>
        <button onClick={() => setMes(mes.m === 11 ? { y: mes.y + 1, m: 0 } : { y: mes.y, m: mes.m + 1 })} className="bg-white border rounded-xl px-3 py-1.5 text-sm font-bold">›</button>
      </div>
      <div className="bg-white rounded-2xl p-3 border border-gray-100">
        <div className="grid grid-cols-7 text-center text-[10px] text-gray-400 font-bold mb-1">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <span key={d}>{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {celdas.map((d, i) => {
            const evs = d ? (eventos[key(d)] || []) : [];
            return (
              <button key={i} disabled={!d} onClick={() => setDiaSel(d)}
                className={`aspect-square rounded-lg text-xs flex flex-col items-center justify-center gap-0.5 ${d ? 'bg-gray-50' : ''} ${diaSel === d ? 'ring-2 ring-primary' : ''}`}>
                <span className="font-bold">{d || ''}</span>
                <span className="flex gap-0.5">{evs.slice(0, 3).map((e, j) => <i key={j} className={`w-1.5 h-1.5 rounded-full ${colorEv[e.tipo]}`} />)}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2 mt-2 text-[10px] text-gray-500">
          <span><i className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />Labor</span>
          <span><i className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" />Tarea</span>
          <span><i className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1" />Cosecha</span>
          <span><i className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" />Fin carencia</span>
        </div>
      </div>
      {diaSel && (
        <div className="bg-white rounded-2xl p-3 border border-gray-100">
          <p className="text-sm font-bold mb-2">{diaSel} de {nombreMes}</p>
          {(eventos[key(diaSel)] || []).map((e, i) => (
            <p key={i} className="text-xs text-gray-700 py-1 border-b border-gray-50 last:border-0">• {e.txt}</p>
          ))}
          {!(eventos[key(diaSel)] || []).length && <p className="text-xs text-gray-400">Sin eventos.</p>}
        </div>
      )}
    </div>
  );
}
