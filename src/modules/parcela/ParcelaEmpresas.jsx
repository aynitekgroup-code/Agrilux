/**
 * src/modules/parcela/ParcelaEmpresas.jsx
 *
 * Sección Parcela EMPRESAS: Trabajadores de la empresa.
 * Muestra SOLO los trabajadores asociados (empresa_miembros):
 * listar, invitar (admin), cambiar rol y activar/desactivar.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../lib/AuthContext';
import {
  DEMO, listarEmpresas, crearEmpresaConMiembro,
  agregarTrabajador, cambiarRolTrabajador, cambiarActivoTrabajador,
} from '../../lib/empresaApi';
import { supabase } from '../../lib/supabase';
import { Loader2, Users, UserPlus } from 'lucide-react';

const ROLES_TRAB = ['operario', 'supervisor', 'ingeniero', 'administrador'];
const SQL_HINT = 'No se pudo guardar. Ejecuta scripts/onboarding-2.5-10-funciones.sql y scripts/onboarding-2.7-trabajadores.sql en Supabase → SQL Editor.';

export default function ParcelaEmpresas() {
  const { user } = useAuth();
  const uid = user?.id || user?.uid;
  const [empresas, setEmpresas] = useState([]);
  const [empresaId, setEmpresaId] = useState('');
  const [demo, setDemo] = useState(true);
  const [faltaSQL, setFaltaSQL] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accion, setAccion] = useState('');
  const [error, setError] = useState('');
  const [miembros, setMiembros] = useState([]);
  const [nuevaEmpresa, setNuevaEmpresa] = useState({ nombre: '', ruc: '', telefono: '', ubicacion: '' });
  const [inv, setInv] = useState({ nombre: '', email: '', rol: 'operario' });

  const empresa = useMemo(
    () => empresas.find((e) => e.id === empresaId) || (demo ? DEMO.empresa : null),
    [empresas, empresaId, demo]
  );
  const listaMiembros = demo ? DEMO.miembros : miembros;

  const miRol = useMemo(() => {
    if (demo) return 'administrador';
    const m = listaMiembros.find((x) =>
      (x.user_id && x.user_id === uid) || (x.email && x.email === user?.email) || x.nombre === user?.nombre
    );
    return m?.rol || null;
  }, [demo, listaMiembros, user, uid]);
  const esAdmin = miRol === 'administrador';

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
      const { data, error } = await supabase
        .from('empresa_miembros')
        .select('*')
        .eq('empresa_id', eid)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setMiembros(data || []);
    } catch {
      setMiembros([]);
    }
  }

  const recargar = () => { if (!demo && empresaId) cargar(empresaId); };

  async function handleCrearEmpresa() {
    if (!nuevaEmpresa.nombre.trim()) return;
    setError('');
    setAccion('crear-empresa');
    try {
      const emp = await crearEmpresaConMiembro({
        nombreEmpresa: nuevaEmpresa.nombre,
        ruc: nuevaEmpresa.ruc,
        telefonoEmpresa: nuevaEmpresa.telefono,
        ubicacionEmpresa: nuevaEmpresa.ubicacion,
        usuarioId: uid,
        usuarioNombre: user?.nombre || user?.email || '',
        usuarioEmail: user?.email || ''
      });
      setEmpresas([emp, ...empresas]);
      setEmpresaId(emp.id);
      setDemo(false);
      setNuevaEmpresa({ nombre: '', ruc: '', telefono: '', ubicacion: '' });
      await cargar(emp.id);
    } catch (e) {
      setError(e.message || 'Error al crear la empresa');
    } finally {
      setAccion('');
    }
  }

  async function handleInvitar() {
    if (!inv.nombre.trim()) return;
    setError('');
    setAccion('invitar');
    try {
      await agregarTrabajador({ empresaId, nombre: inv.nombre, email: inv.email, rol: inv.rol });
      setInv({ nombre: '', email: '', rol: 'operario' });
      recargar();
    } catch (e) {
      setError(e.message || SQL_HINT);
    } finally {
      setAccion('');
    }
  }

  async function handleCambiarRol(miembroId, nuevoRol) {
    setError('');
    setAccion(`rol-${miembroId}`);
    try {
      await cambiarRolTrabajador(miembroId, nuevoRol);
      recargar();
    } catch (e) {
      setError(e.message || SQL_HINT);
    } finally {
      setAccion('');
    }
  }

  async function handleActivarDesactivar(miembroId, activoActual) {
    setError('');
    setAccion(`act-${miembroId}`);
    try {
      await cambiarActivoTrabajador(miembroId, !activoActual);
      recargar();
    } catch (e) {
      setError(e.message || SQL_HINT);
    } finally {
      setAccion('');
    }
  }

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
          <p className="text-[11px] text-gray-500">{demo ? 'Modo ejemplo' : 'Empresa'}{empresa?.ruc ? ` · RUC ${empresa.ruc}` : ''}</p>
          {demo && empresas.length === 0 ? (
            <p className="font-bold text-sm truncate">{DEMO.empresa.nombre}</p>
          ) : (
            <select value={empresaId} onChange={(e) => { setEmpresaId(e.target.value); setDemo(false); cargar(e.target.value); }}
              className="font-bold text-sm w-full bg-transparent">
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          )}
        </div>
        {miRol && <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded-full capitalize">{miRol}</span>}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-xs text-red-700">{error}</div>
      )}

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
          <button onClick={handleCrearEmpresa} disabled={accion === 'crear-empresa'} className="w-full bg-primary text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            {accion === 'crear-empresa' ? <><Loader2 size={14} className="animate-spin" /> Creando...</> : 'Registrar empresa'}
          </button>
        </div>
      )}

      {/* Datos de la empresa */}
      {empresa && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Datos de la empresa</p>
          <p className="text-sm font-bold text-gray-800">{empresa.nombre}</p>
          <p className="text-[11px] text-gray-500">
            {empresa.ruc && <>RUC: {empresa.ruc} · </>}
            {empresa.telefono && <>Tel: {empresa.telefono} · </>}
            {empresa.ubicacion}
          </p>
        </div>
      )}

      {/* Trabajadores */}
      <p className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2"><Users size={14} /> Trabajadores</p>
      <div className="space-y-2">
        {listaMiembros.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">Aún no hay trabajadores asociados a la empresa.</p>
        )}
        {listaMiembros.map((m) => {
          const activo = m.activo !== false;
          const cargandoAccion = accion === `act-${m.id}` || accion === `rol-${m.id}`;
          return (
            <div key={m.id} className="bg-white rounded-xl p-3 border border-gray-100 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-green-100 text-green-700 font-bold text-[11px] flex items-center justify-center shrink-0">
                {(m.nombre || '?').split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{m.nombre}</p>
                <p className="text-[11px] text-gray-500 truncate">{m.email || '—'}{m.email ? '' : ''}</p>
              </div>
              {esAdmin && !demo ? (
                <select
                  value={m.rol}
                  disabled={cargandoAccion}
                  onChange={(e) => handleCambiarRol(m.id, e.target.value)}
                  className="text-[11px] font-semibold border rounded-lg px-2 py-1.5 bg-white capitalize disabled:opacity-50"
                >
                  {ROLES_TRAB.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              ) : (
                <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded-full capitalize">{m.rol}</span>
              )}
              {esAdmin && !demo ? (
                <button
                  onClick={() => handleActivarDesactivar(m.id, activo)}
                  disabled={cargandoAccion}
                  title={activo ? 'Desactivar' : 'Activar'}
                  className={`text-[10px] font-bold px-2 py-1.5 rounded-lg disabled:opacity-50 ${activo ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                >
                  {cargandoAccion ? <Loader2 size={12} className="animate-spin" /> : (activo ? 'Desactivar' : 'Activar')}
                </button>
              ) : (
                <span className={`text-[10px] font-bold px-2 py-1.5 rounded-lg ${activo ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'}`}>{activo ? 'Activo' : 'Inactivo'}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Agregar trabajador (solo administradores) */}
      {esAdmin && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-2">
          <p className="text-sm font-bold flex items-center gap-2"><UserPlus size={16} /> Agregar trabajador</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input value={inv.nombre} onChange={(e) => setInv({ ...inv, nombre: e.target.value })} placeholder="Nombre completo" className="w-full border rounded-xl px-3 py-2 text-sm" />
            <input value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} placeholder="Correo (opcional)" type="email" className="w-full border rounded-xl px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <select value={inv.rol} onChange={(e) => setInv({ ...inv, rol: e.target.value })} className="flex-1 border rounded-xl px-3 py-2 text-sm capitalize">
              {ROLES_TRAB.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button onClick={handleInvitar} disabled={demo || accion === 'invitar' || !inv.nombre.trim()} className="flex-1 bg-primary text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {accion === 'invitar' ? <><Loader2 size={14} className="animate-spin" /> Agregando...</> : 'Agregar'}
            </button>
          </div>
          <p className="text-[11px] text-gray-400">El trabajador aparece en la lista de la empresa; el rol se usa para permisos futuros.</p>
        </div>
      )}
    </div>
  );
}
