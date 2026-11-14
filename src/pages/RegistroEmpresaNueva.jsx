/**
 * src/pages/RegistroEmpresaNueva.jsx
 *
 * Registro de empresa + cuenta personal en un solo flujo.
 * El usuario se convierte en administrador inicial de la empresa.
 * Formulario separado en dos pasos: Datos personales y Datos de la empresa.
 * Los datos personales se verifican contra Supabase al continuar:
 * si el correo o el WhatsApp ya están registrados, no se puede avanzar
 * y se señala el campo duplicado. La ubicación es el único dato duplicable.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { registrarConEmpresa, verificarDatosRegistro } from '../lib/empresaApi';
import { Loader2, Building, Navigation, User, ArrowRight, ArrowLeft } from 'lucide-react';

export default function RegistroEmpresaNueva() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [paso, setPaso] = useState('personales');
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
  const [verificando, setVerificando] = useState(false);
  const [detectandoGPS, setDetectandoGPS] = useState(null);
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState('');
  const [erroresCampo, setErroresCampo] = useState({});

  const detectarGPS = (campo = 'ubicacion') => {
    if (!navigator.geolocation) {
      setError('Tu dispositivo no tiene GPS. Escribe tu ubicación manualmente.');
      return;
    }
    setDetectandoGPS(campo);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        if (campo === 'ubicacion') setCoords({ lat, lon });
        try {
          const res = await fetch(`/api/mercadolibre?type=geocode&lat=${lat}&lon=${lon}`);
          if (!res.ok) throw new Error();
          const data = await res.json();
          const nombreCorto = [data.address?.district, data.address?.city_district, data.address?.city, data.address?.suburb, data.address?.neighbourhood, data.address?.town, data.address?.village, data.address?.county, data.address?.state]
            .filter(Boolean).slice(0, 2).join(', ') || data.name.split(',')[0];
          setForm(prev => ({ ...prev, [campo]: nombreCorto }));
        } catch {
          setForm(prev => ({ ...prev, [campo]: `${lat.toFixed(4)}, ${lon.toFixed(4)}` }));
        }
        setDetectandoGPS(null);
      },
      () => {
        setError('No se pudo obtener GPS. Escribe tu ubicación manualmente.');
        setDetectandoGPS(null);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    setError('');
    if (erroresCampo[name]) {
      setErroresCampo(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validarPersonales = () => {
    const e = {};
    if (!form.nombre.trim()) e.nombre = 'Ingresa tu nombre completo.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Ingresa un correo electrónico válido, ej: tu@empresa.com.';
    if (form.password.length < 6) e.password = 'La contraseña debe tener al menos 6 caracteres.';
    if (String(form.whatsapp).replace(/\D/g, '').length < 9) e.whatsapp = 'Ingresa un número de WhatsApp válido (mínimo 9 dígitos).';
    if (!form.ubicacion.trim()) e.ubicacion = 'Ingresa tu ubicación (GPS o manual).';
    setErroresCampo(e);
    if (Object.keys(e).length) {
      const faltantes = [];
      if (e.nombre) faltantes.push('nombre');
      if (e.email) faltantes.push('correo electrónico');
      if (e.password) faltantes.push('contraseña');
      if (e.whatsapp) faltantes.push('WhatsApp');
      if (e.ubicacion) faltantes.push('ubicación');
      setError(`No puedes continuar. Revisa: ${faltantes.join(', ')}.`);
      return false;
    }
    return true;
  };

  // Verifica contra Supabase que el correo y el WhatsApp no estén registrados.
  // Devuelve true si está todo disponible o si no se puede comprobar
  // (así los no registrados pueden avanzar; los duplicados se bloquean
  // igualmente al registrar, cuando el servidor responde).
  const verificarDisponibilidad = async () => {
    setVerificando(true);
    setError('');
    setErroresCampo({});
    try {
      let resultado = null;
      try {
        resultado = await verificarDatosRegistro({ email: form.email, whatsapp: form.whatsapp });
      } catch {
        resultado = null;
      }
      if (!resultado) {
        return true;
      }
      if (resultado.email_registrado || resultado.whatsapp_registrado) {
        const e = {};
        if (resultado.email_registrado) e.email = 'Este correo ya está registrado en otra cuenta.';
        if (resultado.whatsapp_registrado) e.whatsapp = 'Este WhatsApp ya está registrado en otra cuenta.';
        setErroresCampo(e);
        const partes = [];
        if (resultado.email_registrado) partes.push('el correo electrónico');
        if (resultado.whatsapp_registrado) partes.push('el WhatsApp');
        setError(`No puedes continuar: ${partes.join(' y ')} ya está registrado. Usa otro dato o inicia sesión.`);
        return false;
      }
      return true;
    } finally {
      setVerificando(false);
    }
  };

  const handleContinuar = async () => {
    if (!validarPersonales()) return;
    const disponible = await verificarDisponibilidad();
    if (!disponible) return;
    setPaso('empresa');
    setError('');
  };

  const irAEmpresa = async () => {
    if (paso === 'empresa') return;
    await handleContinuar();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.nombreEmpresa.trim()) { setError('Ingresa la razón social de la empresa.'); return; }
    setError('');
    if (!validarPersonales()) { setPaso('personales'); return; }

    setLoading(true);

    try {
      // Guardia final anti-duplicados antes de registrar; si no se puede comprobar se deja pasar
      const resultado = await verificarDatosRegistro({ email: form.email, whatsapp: form.whatsapp }).catch(() => null);
      if (resultado && (resultado.email_registrado || resultado.whatsapp_registrado)) {
        const e = {};
        if (resultado.email_registrado) e.email = 'Este correo ya está registrado en otra cuenta.';
        if (resultado.whatsapp_registrado) e.whatsapp = 'Este WhatsApp ya está registrado en otra cuenta.';
        setErroresCampo(e);
        const partes = [];
        if (resultado.email_registrado) partes.push('el correo electrónico');
        if (resultado.whatsapp_registrado) partes.push('el WhatsApp');
        setError(`No puedes registrarte: ${partes.join(' y ')} ya está registrado en otra cuenta. Usa otro dato o inicia sesión.`);
        setPaso('personales');
        setLoading(false);
        return;
      }

      await registrarConEmpresa({
        nombre: form.nombre,
        email: form.email,
        password: form.password,
        ubicacion: form.ubicacion,
        coords,
        whatsapp: form.whatsapp,
        nombreEmpresa: form.nombreEmpresa,
        ruc: form.ruc,
        telefonoEmpresa: form.telefonoEmpresa,
        ubicacionEmpresa: form.ubicacionEmpresa
      });

      // Redirigir al dashboard principal
      navigate('/');
    } catch (err) {
      const msg = String(err?.message || '');
      if (/already registered|already exists|email-already-in-use|user_already_exists|email_already_registered/i.test(msg) || err?.code === 'email_already_registered') {
        setError('Este correo ya está registrado. Inicia sesión o usa otro correo.');
        setErroresCampo(prev => ({ ...prev, email: 'Este correo ya está registrado en otra cuenta.' }));
        setPaso('personales');
      } else {
        setError(err.message || 'Error al registrar empresa y cuenta');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none';
  const campoErrorClass = 'w-full px-4 py-3 border border-red-400 bg-red-50 rounded-lg text-sm focus:ring-2 focus:ring-red-300 outline-none';
  const claseCampo = (campo) => (erroresCampo[campo] ? campoErrorClass : inputClass);
  const ErrorCampo = ({ campo }) =>
    erroresCampo[campo] ? <p className="text-[11px] text-red-600 font-semibold">{erroresCampo[campo]}</p> : null;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-xl">
        <div className="bg-white rounded-3xl shadow-xl p-8 space-y-6">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <Building size={32} className="text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Registrar empresa</h1>
            <p className="text-gray-600 text-sm mt-2">
              Registra tu empresa y tu cuenta personal en un solo paso.
            </p>
          </div>

          {/* ── Pestañas: Datos personales / Datos de la empresa ── */}
          <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1.5 rounded-2xl">
            <button
              type="button"
              onClick={() => setPaso('personales')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                paso === 'personales' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <User size={16} /> 1. Datos personales
            </button>
            <button
              type="button"
              onClick={irAEmpresa}
              disabled={verificando}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 ${
                paso === 'empresa' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Building size={16} /> 2. Datos de la empresa
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ══════════ PASO 1: DATOS PERSONALES ══════════ */}
            {paso === 'personales' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-700">Nombre completo *</label>
                    <input
                      type="text"
                      name="nombre"
                      value={form.nombre}
                      onChange={handleChange}
                      placeholder="Juan Pérez García"
                      autoComplete="name"
                      className={claseCampo('nombre')}
                    />
                    <ErrorCampo campo="nombre" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-700">Correo electrónico *</label>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="tu@empresa.com"
                      className={claseCampo('email')}
                      autoComplete="email"
                    />
                    <ErrorCampo campo="email" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-700">Contraseña *</label>
                    <input
                      type="password"
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      placeholder="Mínimo 6 caracteres"
                      className={claseCampo('password')}
                      autoComplete="new-password"
                    />
                    <ErrorCampo campo="password" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-700">WhatsApp *</label>
                    <input
                      type="tel"
                      name="whatsapp"
                      value={form.whatsapp}
                      onChange={handleChange}
                      placeholder="987654321"
                      className={claseCampo('whatsapp')}
                      autoComplete="tel"
                    />
                    <ErrorCampo campo="whatsapp" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-700">Ubicación *</label>
                  <input
                    type="text"
                    name="ubicacion"
                    value={form.ubicacion}
                    onChange={handleChange}
                    placeholder="Ej: Cutervo, Cajamarca"
                    className={claseCampo('ubicacion')}
                  />
                  <ErrorCampo campo="ubicacion" />
                  <button
                    type="button"
                    onClick={() => detectarGPS('ubicacion')}
                    disabled={detectandoGPS !== null}
                    className="mt-2 w-full flex items-center justify-center gap-2 text-xs font-semibold text-primary bg-primary/5 hover:bg-primary/10 py-2.5 rounded-xl transition-colors disabled:opacity-60"
                  >
                    {detectandoGPS === 'ubicacion' ? (
                      <><Loader2 size={14} className="animate-spin" /> Detectando ubicación...</>
                    ) : (
                      <><Navigation size={14} /> Registrarse mediante GPS</>
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleContinuar}
                  disabled={verificando}
                  className="w-full bg-primary text-white font-bold py-4 rounded-xl text-base hover:bg-[#14522e] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {verificando ? (
                    <><Loader2 size={18} className="animate-spin" /> Comprobando en la base de datos...</>
                  ) : (
                    <>Continuar: datos de la empresa <ArrowRight size={18} /></>
                  )}
                </button>
              </>
            )}

            {/* ══════════ PASO 2: DATOS DE LA EMPRESA ══════════ */}
            {paso === 'empresa' && (
              <>
                <div className="bg-primary/5 border border-primary/10 rounded-xl p-3">
                  <p className="text-xs text-gray-600">
                    Registrando como: <span className="font-semibold text-gray-800">{form.nombre} · {form.email}</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-700">Razón social *</label>
                  <input
                    type="text"
                    name="nombreEmpresa"
                    value={form.nombreEmpresa}
                    onChange={handleChange}
                    placeholder="Agro Andina S.A.C."
                    className={inputClass}
                    required
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
                      className={inputClass}
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
                      className={inputClass}
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
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => detectarGPS('ubicacionEmpresa')}
                    disabled={detectandoGPS !== null}
                    className="mt-2 w-full flex items-center justify-center gap-2 text-xs font-semibold text-primary bg-primary/5 hover:bg-primary/10 py-2.5 rounded-xl transition-colors disabled:opacity-60"
                  >
                    {detectandoGPS === 'ubicacionEmpresa' ? (
                      <><Loader2 size={14} className="animate-spin" /> Detectando ubicación...</>
                    ) : (
                      <><Navigation size={14} /> Registrarse mediante GPS</>
                    )}
                  </button>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setPaso('personales')}
                    className="flex-1 border border-gray-200 text-gray-600 font-semibold py-4 rounded-xl text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <ArrowLeft size={16} /> Volver
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-[2] bg-primary text-white font-bold py-4 rounded-xl text-base hover:bg-[#14522e] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 size={20} className="animate-spin" /> Registrando empresa...
                      </span>
                    ) : (
                      <>
                        <Building size={18} /> Registrar empresa y cuenta
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
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
