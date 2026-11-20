/**
 * src/pages/RegistroInvitar.jsx
 *
 * Registro mediante invitación directa de un administrador.
 * El usuario accede con un código de invitación y crea su cuenta.
 * La membresía se activa inmediatamente con el rol asignado en la invitación.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, User, Key, Mail, Phone, Shield } from 'lucide-react';
import { canjearInvitacion, validarCodigoInvitacion } from '../lib/empresaApi';

export default function RegistroInvitar() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const codigo = searchParams.get('codigo') || '';

  const [form, setForm] = useState({
    nombre: '',
    email: '',
    password: '',
    whatsapp: ''
  });

  const [infoEmpresa, setInfoEmpresa] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validando, setValidando] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  // Validar el código de invitación al montar
  useEffect(() => {
    if (codigo) {
      validarCodigo(codigo);
    }
  }, [codigo]);

  const validarCodigo = async (token) => {
    setValidando(true);
    setError('');
    try {
      const res = await validarCodigoInvitacion(token);
      if (!res.ok || !res.data) {
        setError(res.error || 'Código de invitación inválido');
        setInfoEmpresa(null);
        return;
      }
      setInfoEmpresa(res.data);
    } catch (err) {
      setError(err.message || 'Error al validar invitación');
    } finally {
      setValidando(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const resultado = await canjearInvitacion({
        token: codigo,
        nombre: form.nombre,
        email: form.email,
        password: form.password,
        whatsapp: form.whatsapp,
        ubicacion: '',
        coords: null
      });

      navigate('/');
    } catch (err) {
      setError(err.message || 'Error al aceptar la invitación');
    } finally {
      setLoading(false);
    }
  };

  if (!codigo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 text-center">
          <Shield size={32} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800">Código de invitación requerido</h2>
          <p className="text-gray-600 text-sm mt-2">
            Necesitas un código de invitación válido para registrarte por esta vía.
          </p>
          <button
            onClick={() => navigate('/registro')}
            className="mt-6 bg-primary text-white font-bold py-3 rounded-xl w-full hover:bg-[#14522e] transition-colors"
          >
            Ir al registro
          </button>
        </div>
      </div>
    );
  }

if (validando || !infoEmpresa) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 text-center">
        <Loader2 size={24} className="animate-spin text-primary mx-auto mb-4" />
        <p className="text-sm text-gray-600 mt-2">Validando invitación...</p>
      </div>
    </div>
  );
}

return (
  <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
    <div className="w-full max-w-xl">
      <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Key size={32} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Aceptar invitación</h1>
          <p className="text-gray-600 text-sm mt-2">
            Crea tu cuenta y únete a la empresa.
          </p>
        </div>

        {infoEmpresa && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Shield size={18} className="text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-800">Empresa</p>
                <p className="text-xs text-gray-600">{infoEmpresa.empresa?.nombre || 'Empresa'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 mt-2">
              <Mail size={16} className="text-gray-400 mt-0.5" />
              <p className="text-xs text-gray-600">Rol asignado: {infoEmpresa.rol_asignado}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {infoEmpresa && !loading && (
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

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white font-bold py-4 rounded-xl text-base hover:bg-[#14522e] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={20} className="animate-spin" /> Creando cuenta...
                </span>
              ) : (
                <>
                  <User size={18} /> Aceptar invitación
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  </div>
  );
}