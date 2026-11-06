/**
 * src/pages/EmpresaMiembros.jsx
 *
 * Panel de administración de miembros de la empresa.
 * Solo administradores pueden gestionar miembros.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { Loader2, Shield, User, Trash2, Edit2, Plus, AlertTriangle } from 'lucide-react';

export default function EmpresaMiembros() {
  const { user, empresa_activa_id, empresas_disponibles } = useAuth();
  const navigate = useNavigate();
  const [miembros, setMiembros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState('');

  const cargarMiembros = async (empresaId) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('empresa_miembros')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMiembros(data || []);
    } catch (err) {
      setError(err.message || 'Error al cargar miembros');
    } finally {
      setLoading(false);
    }
  };

  const handleEmpresaChange = (e) => {
    const empresaId = e.target.value;
    setEmpresaSeleccionada(empresaId);
    if (empresaId) {
      cargarMiembros(empresaId);
    }
  };

  const handleActivarDesactivar = async (miembroId, actualmenteActivo) => {
    if (!confirm(`¿Estás seguro de ${actualmenteActivo ? 'desactivar' : 'activar'} este miembro?`)) return;

    try {
      const { error } = await supabase.rpc('modificar_miembro_empresa', {
        p_miembro_id: miembroId,
        p_nuevo_rol: null,
        p_nuevo_activo: !actualmenteActivo
      });
      if (error) throw error;
      cargarMiembros(empresaSeleccionada);
    } catch (err) {
      setError(err.message || 'Error al cambiar estado del miembro');
    }
  };

  const handleCambiarRol = async (miembroId, rolActual) => {
    const nuevoRol = prompt(`Cambiar rol de "${rolActual}" a (administrador/ingeniero/supervisor/operario):`);
    if (!nuevoRol || !['administrador', 'ingeniero', 'supervisor', 'operario'].includes(nuevoRol)) {
      setError('Rol no válido');
      return;
    }

    try {
      const { error } = await supabase.rpc('modificar_miembro_empresa', {
        p_miembro_id: miembroId,
        p_nuevo_rol: nuevoRol,
        p_nuevo_activo: null
      });
      if (error) throw error;
      cargarMiembros(empresaSeleccionada);
    } catch (err) {
      setError(err.message || 'Error al cambiar rol');
    }
  };

  useEffect(() => {
    if (empresas_disponibles && empresas_disponibles.length > 0) {
      setEmpresaSeleccionada(empresas_disponibles[0].id);
      cargarMiembros(empresas_disponibles[0].id);
    }
  }, [empresas_disponibles]);

  const esAdmin = empresaSeleccionada && miembros.some(m => m.user_id === user?.id && m.rol === 'administrador' && m.activo);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Miembros de la empresa</h1>
            <p className="text-gray-600 text-sm">Gestiona a los miembros de tu empresa</p>
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
                onClick={() => navigate('/empresa/miembros/nuevo')}
                className="bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-[#14522e] transition-colors flex items-center gap-2"
              >
                <Plus size={16} /> Agregar miembro
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : !empresaSeleccionada ? (
            <div className="flex justify-center py-8 text-gray-500 text-sm">
              Selecciona una empresa para ver sus miembros
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
                  {miembros.map((m) => (
                    <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-800">{m.nombre}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{m.email}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${m.rol === 'administrador' ? 'bg-blue-100 text-blue-700' : m.rol === 'ingeniero' ? 'bg-green-100 text-green-700' : m.rol === 'supervisor' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>
                          {m.rol}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${m.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {m.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          {esAdmin && (
                            <>
                              <button
                                onClick={() => handleActivarDesactivar(m.id, m.activo)}
                                className="p-2 rounded-lg hover:bg-gray-100 text-sm"
                                title={m.activo ? 'Desactivar' : 'Activar'}
                              >
                                {m.activo ? <Trash2 size={16} className="text-red-600" /> : <AlertTriangle size={16} className="text-amber-600" />}
                              </button>
                              <button
                                onClick={() => handleCambiarRol(m.id, m.rol)}
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
    </div>
  );
}