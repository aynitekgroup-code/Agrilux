/**
 * src/pages/RegistroUnirse.jsx
 *
 * Registro para unirse a una empresa existente.
 * El usuario crea su cuenta y envía una solicitud de incorporación.
 * La solicitud queda pendiente hasta que el administrador la apruebe.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { solicitarUnirseEmpresa, waitForSession } from '../lib/empresaApi';
import { supabase } from '../lib/supabase';
import { Loader2, User, Building, Mail, Phone } from 'lucide-react';

export default function RegistroUnirse() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    password: '',
    whatsapp: '',
    empresa_id: '',
    cargo_id: '',
    area_trabajo: ''
  });

  const [empresas, setEmpresas] = useState([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const cargarEmpresas = async () => {
    setLoadingEmpresas(true);
    try {
      const { data, error } = await supabase
        .from('empresas')
        .select('id, nombre, ruc')
        .order('nombre');
      if (error) throw error;
      setEmpresas(data || []);
    } catch (err) {
      console.error('Error cargando empresas:', err.message);
    } finally {
      setLoadingEmpresas(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register({
        nombre: form.nombre,
        email: form.email,
        password: form.password,
        ubicacion: '',
        whatsapp: form.whatsapp,
        coords: null
      });
      const session = await waitForSession(5000);
      if (!session) {
        throw new Error('Confirma tu correo electrónico antes de enviar la solicitud');
      }
      await solicitarUnirseEmpresa({
        empresa_id: form.empresa_id,
        cargo_id: form.cargo_id || null,
        area_trabajo: form.area_trabajo || '',
        nombre: form.nombre,
        email: form.email,
        whatsapp: form.whatsapp
      });

      navigate('/registro/solicitud-enviada');
    } catch (err) {
      setError(err.message || 'Error al enviar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarEmpresas();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-xl">
        <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <User size={32} className="text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Unirse a una empresa</h1>
            <p className="text-gray-600 text-sm mt-2">
              Crea tu cuenta y solicita incorporarte a una empresa existente.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700">Nombre completo</label>
                <input
                  type="text"
                  name="nombre"
                  value={form.nombre}
                  onChange={handleChange}
                  placeholder="Juan Pérez García"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700">Correo electrónico</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="tu@empresa.com"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700">WhatsApp</label>
                <input
                  type="tel"
                  name="whatsapp"
                  value={form.whatsapp}
                  onChange={handleChange}
                  placeholder="987654321"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  autoComplete="tel"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700">Contraseña</label>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700">Área de trabajo</label>
                <input
                  type="text"
                  name="area_trabajo"
                  value={form.area_trabajo}
                  onChange={handleChange}
                  placeholder="Ej: Cultivos, Flota, Administración"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700">Empresa</label>
              <select
                name="empresa_id"
                value={form.empresa_id}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
              >
                <option value="">Seleccionar empresa</option>
                {loadingEmpresas ? (
                  <option disabled>Cargando empresas...</option>
                ) : (
                  empresas.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nombre} ({emp.ruc || 'Sin RUC'})
                    </option>
                  ))
                )}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading || !form.empresa_id}
              className="w-full bg-primary text-white font-bold py-4 rounded-xl text-base hover:bg-[#14522e] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={20} className="animate-spin" /> Enviando solicitud...
                </span>
              ) : (
                <>
                  <Building size={18} /> Enviar solicitud
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              ¿Ya tienes cuenta?{' '}
              <button
                onClick={() => navigate('/registro')}
                className="text-primary font-bold hover:underline"
              >
                Inicia sesión
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}