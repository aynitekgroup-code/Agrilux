/**
 * src/pages/RegistroEmpresaNueva.jsx
 *
 * Registro de empresa + cuenta personal en un solo flujo.
 * El usuario se convierte en administrador inicial de la empresa.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { registrarConEmpresa } from '../lib/empresaApi';
import { Loader2, User, Building, Mail, Phone, MapPin, Lock } from 'lucide-react';

export default function RegistroEmpresaNueva() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [form, setForm] = useState({
    nombre: '',
    email: '',
    password: '',
    whatsapp: '',
    ubicacion: '',
    nombreEmpresa: '',
    ruc: '',
    telefonoEmpresa: '',
    ubicacionEmpresa: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await registrarConEmpresa({
        nombre: form.nombre,
        email: form.email,
        password: form.password,
        ubicacion: form.ubicacion,
        whatsapp: form.whatsapp,
        nombreEmpresa: form.nombreEmpresa,
        ruc: form.ruc,
        telefonoEmpresa: form.telefonoEmpresa,
        ubicacionEmpresa: form.ubicacionEmpresa
      });

      // Redirigir al dashboard principal
      navigate('/');
    } catch (err) {
      setError(err.message || 'Error al crear empresa y cuenta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-xl">
        <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <Building size={32} className="text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Crear empresa</h1>
            <p className="text-gray-600 text-sm mt-2">
              Registra tu empresa y tu cuenta personal en un solo paso.
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
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700">Ubicación</label>
              <input
                type="text"
                name="ubicacion"
                value={form.ubicacion}
                onChange={handleChange}
                placeholder="Ej: Cutervo, Cajamarca"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
              />
            </div>

            <div className="border-t pt-6">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Datos de la empresa</h3>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700">Razón social</label>
                <input
                  type="text"
                  name="nombreEmpresa"
                  value={form.nombreEmpresa}
                  onChange={handleChange}
                  placeholder="Agro Andina S.A.C."
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-700">RUC</label>
                  <input
                    type="text"
                    name="ruc"
                    value={form.ruc}
                    onChange={handleChange}
                    placeholder="20123456789"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-700">Teléfono</label>
                  <input
                    type="tel"
                    name="telefonoEmpresa"
                    value={form.telefonoEmpresa}
                    onChange={handleChange}
                    placeholder="987654321"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700">Ubicación de la empresa</label>
                <input
                  type="text"
                  name="ubicacionEmpresa"
                  value={form.ubicacionEmpresa}
                  onChange={handleChange}
                  placeholder="Ej: Cutervo, Cajamarca"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white font-bold py-4 rounded-xl text-base hover:bg-[#14522e] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={20} className="animate-spin" /> Creando empresa...
                </span>
              ) : (
                <>
                  <Building size={18} /> Crear empresa y cuenta
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