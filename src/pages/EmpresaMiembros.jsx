/**
 * src/pages/EmpresaMiembros.jsx
 *
 * Panel de administración de trabajadores de la empresa.
 * Solo administradores pueden gestionar trabajadores.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { agregarTrabajador, cambiarRolTrabajador, cambiarActivoTrabajador } from '../lib/empresaApi';
import { Loader2, Trash2, Edit2, Plus, AlertTriangle, X } from 'lucide-react';

const ROLES_TRAB = ['administrador', 'ingeniero', 'supervisor', 'operario'];
const SQL_HINT = 'No se pudo ejecutar la acción. Ejecuta los scripts de onboarding en Supabase → SQL Editor.';

export default function EmpresaMiembros() {
  const { user, empresas_disponibles } = useAuth();
  const [trabajadores, setTrabajadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [nuevo, setNuevo] = useState({ nombre: '', email: '', rol: 'operario' });
  const [guardando, setGuardando] = useState(false);

  const cargarTrabajadores = async (empresaId) => {
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase
        .from('empresa_miembros')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTrabajadores(data || []);
    } catch (err) {
      setError(err.message || 'Error al cargar trabajadores');
    } finally {
      setLoading(false);
    }
  };

  const handleEmpresaChange = (e) => {
    const empresaId = e.target.value;
    setEmpresaSeleccionada(empresaId);
    if (empresaId) {
      cargarTrabajadores(empresaId);
    }
  };

  const handleActivarDesactivar = async (miembroId, actualmenteActivo) => {
    if (!confirm(`¿Estás seguro de ${actualmenteActivo ? 'desactivar' : 'activar'} a este trabajador?`)) return;

    try {
      await cambiarActivoTrabajador(miembroId, !actualmenteActivo);
      cargarTrabajadores(empresaSeleccionada);
    } catch (err) {
      setError(err.message || SQL_HINT);
    }
  };

  const handleCambiarRol = async (miembroId, rolActual) => {
    const nuevoRol = prompt(`Cambiar rol de "${rolActual}" a (administrador/ingeniero/supervisor/operario):`);
    if (!nuevoRol || !ROLES_TRAB.includes(nuevoRol)) {
      setError('Rol no válido');
      return;
    }

    try {
      await cambiarRolTrabajador(miembroId, nuevoRol);
      cargarTrabajadores(empresaSeleccionada);
    } catch (err) {
      setError(err.message || SQL_HINT);
    }
  };

  const handleAgregar = async () => {
    if (!nuevo.nombre.trim()) {
      setError('Ingresa el nombre del trabajador.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      await agregarTrabajador({
        empresaId: empresaSeleccionada,
        nombre: nuevo.nombre,
        email: nuevo.email,
        rol: nuevo.rol,
      });
      setNuevo({ nombre: '', email: '', rol: 'operario' });
      setModalAbierto(false);
      cargarTrabajadores(empresaSeleccionada);
    } catch (err) {
      setError(err.message || SQL_HINT);
    } finally {
      setGuardando(false);
    }
  };

  useEffect(() => {
    if (empresas_disponibles && empresas_disponibles.length > 0) {
      setEmpresaSeleccionada(empresas_disponibles[0].id);
      cargarTrabajadores(empresas_disponibles[0].id);
    }
  }, [empresas_disponibles]);

  const esAdmin = empresaSeleccionada && trabajadores.some(t => t.user_id === user?.id && t.rol === 'administrador' && t.activo);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Trabajadores de la empresa</h1>
            <p className="text-gray-600 text-sm">Gestiona a los trabajadores de tu empresa</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-gray-700">Empresa:</label>
              <select
                value={empresaSeleccionada || ''}
                onChange={handleEmpresaChange}
                className="px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
              >
                <option value="">Seleccionar empresa</option>
                {empresas_disponibles?.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                ))}
              </select>
            </div>
            {empresaSeleccionada && esAdmin && (
              <button
                onClick={() => setModalAbierto(true)}
                className="bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-[#14522e] transition-colors flex items-center gap-2"
              >
                <Plus size={16} /> Agregar trabajador
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : !empresaSeleccionada ? (
            <div className="flex justify-center py-8 text-gray-500 text-sm">
              Selecciona una empresa para ver sus trabajadores
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Correo</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Rol</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {trabajadores.map((t) => (
                    <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-800">{t.nombre}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{t.email || '—'}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${t.rol === 'administrador' ? 'bg-blue-100 text-blue-700' : t.rol === 'ingeniero' ? 'bg-green-100 text-green-700' : t.rol === 'supervisor' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>
                          {t.rol}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${t.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {t.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          {esAdmin && (
                            <>
                              <button
                                onClick={() => handleActivarDesactivar(t.id, t.activo)}
                                className="p-2 rounded-lg hover:bg-gray-100 text-sm"
                                title={t.activo ? 'Desactivar' : 'Activar'}
                              >
                                {t.activo ? <Trash2 size={16} className="text-red-600" /> : <AlertTriangle size={16} className="text-amber-600" />}
                              </button>
                              <button
                                onClick={() => handleCambiarRol(t.id, t.rol)}
                                className="p-2 rounded-lg hover:bg-gray-100 text-sm"
                                title="Cambiar rol"
                              >
                                <Edit2 size={16} className="text-blue-600" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal agregar trabajador */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setModalAbierto(false)}>
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">Agregar trabajador</h2>
              <button onClick={() => setModalAbierto(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={18} className="text-gray-500" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-700">Nombre completo *</label>
                <input
                  type="text"
                  value={nuevo.nombre}
                  onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
                  placeholder="Juan Pérez García"
                  className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700">Correo electrónico (opcional)</label>
                <input
                  type="email"
                  value={nuevo.email}
                  onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })}
                  placeholder="trabajador@empresa.com"
                  className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700">Rol</label>
                <select
                  value={nuevo.rol}
                  onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value })}
                  className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none capitalize"
                >
                  {ROLES_TRAB.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setModalAbierto(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAgregar}
                disabled={guardando}
                className="flex-1 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-[#14522e] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {guardando ? <Loader2 size={16} className="animate-spin" /> : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
