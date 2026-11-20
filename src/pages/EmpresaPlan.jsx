/**
 * src/pages/EmpresaPlan.jsx
 *
 * Pantalla de membresía/suscripción de la empresa.
 * Muestra información del plan contratado, módulos habilitados y límites.
 * Solo administradores pueden gestionar.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { Loader2, Shield, CreditCard, Calendar, Users, Layers } from 'lucide-react';

export default function EmpresaPlan() {
  const { user, empresa_activa_id } = useAuth();
  const [plan, setPlan] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const cargarPlan = async (empresaId) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('empresa_plan')
        .select(`
          *,
          planes (
            nombre,
            modulos_habilitados,
            limite_usuarios,
            precio
          )
        `)
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      const planData = data?.[0] || null;
      setPlan(planData);

      const { data: empData, error: empError } = await supabase
        .from('empresas')
        .select('*')
        .eq('id', empresaId)
        .single();

      if (empError) throw empError;
      setEmpresa(empData);

      const { data: miembros } = await supabase
        .from('empresa_miembros')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('activo', true);

      setMiembrosActivos(miembros?.length || 0);
    } catch (err) {
      setError(err.message || 'Error al cargar plan');
    } finally {
      setLoading(false);
    }
  };

  const [miembrosActivos, setMiembrosActivos] = useState(0);

  useEffect(() => {
    if (empresa_activa_id) {
      cargarPlan(empresa_activa_id);
    }
  }, [empresa_activa_id]);

  const modulos = plan?.planes?.modulos_habilitados || [];
  const limiteUsuarios = plan?.planes?.limite_usuarios || 0;
  const usuariosActuales = miembrosActivos;
  const puedeAgregarMiembros = usuariosActuales < limiteUsuarios;

  const estadoColor = {
    activa: 'bg-green-100 text-green-700',
    vencida: 'bg-red-100 text-red-700',
    cancelada: 'bg-gray-100 text-gray-700',
    pendiente_pago: 'bg-amber-100 text-amber-700'
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!empresa_activa_id) {
    return (
      <div className="flex justify-center py-12 text-gray-500 text-sm">
        No hay empresa seleccionada
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Membresía de la empresa</h1>
            <p className="text-gray-600 text-sm mt-2">
              Consulta tu plan actual, módulos habilitados y límites de usuarios.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Plan actual</h3>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-bold text-gray-800">{plan?.planes?.nombre || '—'}</span>
              {plan?.planes?.precio && (
                <span className="text-sm text-gray-500">/mes</span>
              )}
            </div>
            <p className="text-xs text-gray-600 mb-3">
              {plan?.estado === 'activa'
                ? 'Tu suscripción está activa y puedes usar todos los módulos contratados.'
                : plan?.estado === 'vencida'
                ? 'Tu suscripción ha vencido. Algunos módulos pueden estar limitados.'
                : plan?.estado === 'cancelada'
                ? 'Tu suscripción ha sido cancelada.'
                : 'Tu suscripción está pendiente de pago.'}
            </p>
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${estadoColor[plan?.estado] || 'bg-gray-100 text-gray-700'}`}>
              {plan?.estado?.charAt(0).toUpperCase() + plan?.estado?.slice(1)}
            </span>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Módulos habilitados</h3>
            <div className="space-y-2">
              {modulos.length > 0 ? (
                modulos.map((mod, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Layers size={16} className="text-primary" />
                    <span className="text-sm text-gray-700 capitalize">{mod.replace(/_/g, ' ')}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-500">Sin módulos habilitados</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Usuarios</h3>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-bold text-gray-800">{usuariosActuales}</span>
              <span className="text-sm text-gray-500">/{limiteUsuarios}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`bg-primary h-2 rounded-full transition-all duration-300`}
                style={{ width: `${Math.min((usuariosActuales / limiteUsuarios) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-2">
              {usuariosActuales} de {limiteUsuarios} miembros activos
              {puedeAgregarMiembros ? ' — puedes agregar más' : ' — límite alcanzado'}
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Vigencia</h3>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-bold text-gray-800">
                {plan?.fecha_vencimiento ? new Date(plan.fecha_vencimiento).toLocaleDateString('es-ES') : '—'}
              </span>
            </div>
            <p className="text-xs text-gray-600">
              {plan?.estado === 'activa'
                ? 'Tu suscripción está vigente.'
                : plan?.estado === 'vencida'
                ? 'Tu suscripción ha vencido. Renueva para seguir accediendo a todos los módulos.'
                : plan?.estado === 'cancelada'
                ? 'Tu suscripción está cancelada.'
                : 'Tu suscripción está pendiente de pago.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}