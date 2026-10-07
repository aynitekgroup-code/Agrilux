/**
 * src/pages/ParcelaEmpresas.jsx
 * Sección Parcela EMPRESAS: Panel, Lotes, Bitácora, Tareas,
 * Calendario, Cosecha y Equipo. Lee/escribe Supabase directo.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../lib/AuthContext';
import { isOnline } from '../lib/offlineStorage';
import {
  DEMO, listarEmpresas, crearEmpresa, cargarTodoEmpresa,
  crearFundo, crearLote, crearLabor, crearTarea, crearCosecha,
  crearGasto, invitarMiembro, actualizarTarea, calcularKPIs,
} from '../lib/empresaApi';
import { PanelCampana, LoteDetalle } from '../components/empresa/PanelLote';
import { Bitacora, TareasEquipo, CalendarioEmpresa } from '../components/empresa/BitacoraTareas';
import { CosechaCostos, EquipoReportes } from '../components/empresa/CosechaEquipo';

const TABS = [
  { id: 'panel', label: 'Panel' },
  { id: 'lotes', label: 'Lotes' },
  { id: 'bitacora', label: 'Bitácora' },
  { id: 'tareas', label: 'Tareas' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'cosecha', label: 'Cosecha' },
  { id: 'equipo', label: 'Equipo' },
];

const leerPendientes = () => { try { return JSON.parse(localStorage.getItem('agrilux_emp_pendientes') || '[]'); } catch { return []; } };
const guardarPendiente = (op) => {
  const arr = leerPendientes(); arr.push({ ...op, ts: Date.now() });
  localStorage.setItem('agrilux_emp_pendientes', JSON.stringify(arr));
};

export default function ParcelaEmpresas() {
  const { user } = useAuth();
  const uid = user?.id || user?.uid;
  const [empresas, setEmpresas] = useState([]);
  const [empresaId, setEmpresaId] = useState('');
  const [demo, setDemo] = useState(true);
  const [faltaSQL, setFaltaSQL] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('panel');
  const [loteSel, setLoteSel] = useState(null);
  const [datos, setDatos] = useState({ fundos: [], lotes: [], labores: [], tareas: [], cosechas: [], gastos: [], miembros: [], campanas: [] });
  const [pendientes, setPendientes] = useState(leerPendientes());
  const [nuevaEmpresa, setNuevaEmpresa] = useState({ nombre: '', ruc: '', telefono: '', ubicacion: '' });
  const [nuevoLote, setNuevoLote] = useState(null);

  const empresa = useMemo(
    () => empresas.find((e) => e.id === empresaId) || (demo ? DEMO.empresa : null),
    [empresas, empresaId, demo]
  );
  const d = useMemo(() => (demo ? {
    fundos: DEMO.fundos, lotes: DEMO.lotes, labores: DEMO.labores, tareas: DEMO.tareas,
    cosechas: DEMO.cosechas, gastos: DEMO.gastos, miembros: DEMO.miembros, campanas: DEMO.campanas,
  } : datos), [demo, datos]);

  // Rol del usuario actual en la empresa
  const miRol = useMemo(() => {
    if (demo) return 'administrador';
    if (user?.email === 'aynitek.group@gmail.com') return 'administrador';
    const m = d.miembros.find((x) => x.email === user?.email || x.user_id === uid || x.nombre === user?.nombre);
    return m?.rol || 'administrador';
  }, [demo, d.miembros, user, uid]);
  const puedeGestionar = ['administrador', 'ingeniero'].includes(miRol);
  const puedeAsignar = ['administrador', 'ingeniero', 'supervisor'].includes(miRol);

  useEffect(() => { init(); }, []);

  async function init() {
    setLoading(true);
    const res = await listarEmpresas(uid);
    setFaltaSQL(!!res.faltaSQL);
    if (res.data.length && !res.demo) {
      setEmpresas(res.data);
      setEmpresaId(res.data[0].id);
      setDemo(false);
      await cargar(res.data[0].id);
    } else {
      setDemo(true);
    }
    setLoading(false);
  }

  async function cargar(eid) {
    try {
      const todo = await cargarTodoEmpresa(eid);
      // Enriquecer nombres de fundo/lote para mostrar
      const fundoNombre = Object.fromEntries((todo.fundos || []).map((f) => [f.id, f.nombre]));
      const loteNombre = Object.fromEntries((todo.lotes || []).map((l) => [l.id, l.nombre]));
      (todo.lotes || []).forEach((l) => { l.fundo_nombre = fundoNombre[l.fundo_id] || ''; });
      (todo.labores || []).forEach((l) => { l.lote_nombre = loteNombre[l.lote_id] || ''; });
      (todo.tareas || []).forEach((t) => { t.lote_nombre = loteNombre[t.lote_id] || ''; });
      (todo.cosechas || []).forEach((c) => { c.lote_nombre = loteNombre[c.lote_id] || ''; });
      setDatos(todo);
    } catch { /* modo demo visual si falla */ }
  }

  const recargar = () => { if (!demo && empresaId) cargar(empresaId); };

  // ── Guardados con cola offline ──
  async function guardarConCola(tabla, fila, crear) {
    const completa = { ...fila, empresa_id: empresaId };
    if (!isOnline()) {
      guardarPendiente({ tabla, fila: completa });
      setPendientes(leerPendientes());
      // Reflejo optimista local
      const tmp = { ...completa, id: 'tmp-' + Date.now() };
      setDatos((p) => ({ ...p, [tabla]: [tmp, ...(p[tabla] || [])] }));
      return tmp;
    }
    const saved = await crear(completa);
    recargar();
    return saved;
  }

  async function flushPendientes() {
    const ops = leerPendientes();
    const crearPorTabla = { labores: crearLabor, tareas: crearTarea, cosechas: crearCosecha, gastos: crearGasto };
    let ok = 0;
    for (const op of ops) {
      try { await crearPorTabla[op.tabla](op.fila); ok++; } catch { /* se queda para luego */ }
    }
    const resto = ops.slice(ok);
    localStorage.setItem('agrilux_emp_pendientes', JSON.stringify(resto));
    setPendientes(resto);
    recargar();
  }

  async function handleCrearEmpresa() {
    if (!nuevaEmpresa.nombre.trim()) return;
    const emp = await crearEmpresa({ ...nuevaEmpresa, created_by: uid });
    await invitarMiembro({ empresa_id: emp.id, user_id: uid, nombre: user?.nombre || user?.email, email: user?.email, rol: 'administrador' });
    setEmpresas([emp, ...empresas]);
    setEmpresaId(emp.id);
    setDemo(false);
    setNuevaEmpresa({ nombre: '', ruc: '', telefono: '', ubicacion: '' });
    await cargar(emp.id);
  }

  const kpis = useMemo(() => calcularKPIs({
    lotes: d.lotes, labores: d.labores, tareas: d.tareas,
    cosechas: d.cosechas, gastos: d.gastos, campana: empresa?.campana_activa || '2026-A',
  }), [d, empresa]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Selector de empresa */}
      <div className="bg-white rounded-2xl p-3 border border-gray-100 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-gray-500">{demo ? 'Modo ejemplo' : 'Empresa'} · Campaña {empresa?.campana_activa || '2026-A'}</p>
          {demo && empresas.length === 0 ? (
            <p className="font-bold text-sm truncate">{DEMO.empresa.nombre}</p>
          ) : (
            <select value={empresaId} onChange={(e) => { setEmpresaId(e.target.value); setDemo(false); setLoteSel(null); cargar(e.target.value); }}
              className="font-bold text-sm w-full bg-transparent">
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          )}
        </div>
        {miRol && <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded-full capitalize">{miRol}</span>}
      </div>

      {faltaSQL && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-xs text-blue-800">
          <b>Paso único pendiente:</b> pega <b>scripts/supabase-empresas.sql</b> en Supabase → SQL Editor → Run. Mientras tanto ves datos de ejemplo.
        </div>
      )}

      {demo && !faltaSQL && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-2">
          <p className="text-sm font-bold">Crea tu empresa para empezar</p>
          <input value={nuevaEmpresa.nombre} onChange={(e) => setNuevaEmpresa({ ...nuevaEmpresa, nombre: e.target.value })} placeholder="Nombre (ej. Agro Andina S.A.C.)" className="w-full border rounded-xl px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input value={nuevaEmpresa.ruc} onChange={(e) => setNuevaEmpresa({ ...nuevaEmpresa, ruc: e.target.value })} placeholder="RUC" className="border rounded-xl px-3 py-2 text-sm" />
            <input value={nuevaEmpresa.telefono} onChange={(e) => setNuevaEmpresa({ ...nuevaEmpresa, telefono: e.target.value })} placeholder="Teléfono" className="border rounded-xl px-3 py-2 text-sm" />
          </div>
          <button onClick={handleCrearEmpresa} className="w-full bg-primary text-white font-bold py-2.5 rounded-xl text-sm">Crear empresa</button>
        </div>
      )}

      {pendientes.length > 0 && (
        <button onClick={flushPendientes} className="w-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold rounded-xl p-2.5">
          ⏳ {pendientes.length} registros sin enviar — toca para sincronizar
        </button>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.filter((t) => t.id !== 'equipo' || puedeGestionar || demo).map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); if (t.id !== 'lotes') setLoteSel(null); }}
            className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold ${tab === t.id ? 'bg-primary text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'panel' && (
        <PanelCampana empresa={empresa} kpis={kpis} lotes={d.lotes} fundos={d.fundos}
          onVerLote={(l) => { setLoteSel(l); setTab('lotes'); }}
          onNuevoLote={() => setNuevoLote({ nombre: '', cultivo: 'papa', variedad: '', area_ha: '', fecha_siembra: '', fundo_id: d.fundos[0]?.id || '' })} />
      )}

      {tab === 'lotes' && !loteSel && (
        <div className="space-y-2">
          {d.lotes.map((l) => (
            <button key={l.id} onClick={() => setLoteSel(l)} className="w-full bg-white rounded-xl p-3 border border-gray-100 text-left">
              <p className="text-sm font-bold">{l.nombre}</p>
              <p className="text-[11px] text-gray-500">{l.fundo_nombre || ''} · {l.cultivo || ''} · {l.area_ha || '-'} ha</p>
            </button>
          ))}
          <button onClick={() => setNuevoLote({ nombre: '', cultivo: 'papa', variedad: '', area_ha: '', fecha_siembra: '', fundo_id: d.fundos[0]?.id || '' })}
            className="w-full bg-primary text-white font-bold py-3 rounded-2xl text-sm">+ Nuevo lote</button>
        </div>
      )}

      {tab === 'lotes' && loteSel && (
        <LoteDetalle lote={loteSel} labores={d.labores} hallazgos={[]}
          onVolver={() => setLoteSel(null)}
          onSubirFoto={() => alert('Monitoreo: usa Diagnóstico para analizar la foto con IA.')}
          onMarcarHallazgo={() => alert('Hallazgo: registra lat/lon del punto en la bitácora.')} />
      )}

      {tab === 'bitacora' && (
        <Bitacora lotes={d.lotes} labores={d.labores} demo={demo}
          onGuardar={(f) => guardarConCola('labores', f, crearLabor)} />
      )}

      {tab === 'tareas' && (
        <TareasEquipo lotes={d.lotes} tareas={d.tareas} miembros={d.miembros} demo={demo}
          puedeAsignar={puedeAsignar || demo}
          filtroOperario={miRol === 'operario' ? (user?.nombre || '') : ''}
          onGuardar={(f) => guardarConCola('tareas', f, crearTarea)}
          onCambiarEstado={async (id, estado) => {
            if (demo) return;
            if (String(id).startsWith('tmp-')) return;
            await actualizarTarea(id, { estado }); recargar();
          }} />
      )}

      {tab === 'calendario' && (
        <CalendarioEmpresa labores={d.labores} tareas={d.tareas} cosechas={d.cosechas} lotes={d.lotes} />
      )}

      {tab === 'cosecha' && (
        <CosechaCostos lotes={d.lotes} cosechas={d.cosechas} gastos={d.gastos}
          campana={empresa?.campana_activa || '2026-A'} demo={demo}
          onGuardarCosecha={(f) => guardarConCola('cosechas', { ...f, campana: empresa?.campana_activa || '2026-A' }, crearCosecha)}
          onGuardarGasto={(f) => guardarConCola('gastos', { ...f, campana: empresa?.campana_activa || '2026-A' }, crearGasto)} />
      )}

      {tab === 'equipo' && (
        <EquipoReportes miembros={d.miembros} empresa={empresa} lotes={d.lotes} labores={d.labores} cosechas={d.cosechas} gastos={d.gastos}
          demo={demo} puedeGestionar={puedeGestionar || demo}
          onInvitar={(f) => guardarConCola('empresa_miembros', f, invitarMiembro).then(() => {})} />
      )}

      {/* Modal nuevo lote / fundo rápido */}
      {nuevoLote && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={() => setNuevoLote(null)}>
          <div className="bg-white rounded-t-3xl p-5 w-full max-w-[430px] space-y-2" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold">+ Nuevo lote</p>
            <input value={nuevoLote.nombre} onChange={(e) => setNuevoLote({ ...nuevoLote, nombre: e.target.value })} placeholder="Nombre del lote" className="w-full border rounded-xl px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input value={nuevoLote.cultivo} onChange={(e) => setNuevoLote({ ...nuevoLote, cultivo: e.target.value })} placeholder="Cultivo" className="border rounded-xl px-3 py-2 text-sm" />
              <input value={nuevoLote.variedad} onChange={(e) => setNuevoLote({ ...nuevoLote, variedad: e.target.value })} placeholder="Variedad" className="border rounded-xl px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" value={nuevoLote.area_ha} onChange={(e) => setNuevoLote({ ...nuevoLote, area_ha: e.target.value })} placeholder="Área ha" className="border rounded-xl px-3 py-2 text-sm" />
              <input type="date" value={nuevoLote.fecha_siembra} onChange={(e) => setNuevoLote({ ...nuevoLote, fecha_siembra: e.target.value })} className="border rounded-xl px-3 py-2 text-sm" />
            </div>
            <button disabled={demo || !nuevoLote.nombre} onClick={async () => {
              await guardarConCola('lotes', { ...nuevoLote, area_ha: parseFloat(nuevoLote.area_ha) || 0, fecha_siembra: nuevoLote.fecha_siembra || null }, crearLote);
              setNuevoLote(null);
            }} className="w-full bg-primary text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50">
              {demo ? 'Activa tu empresa para crear' : 'Crear lote'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
