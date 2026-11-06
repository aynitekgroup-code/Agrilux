/**
 * src/pages/Registro.jsx
 *
 * Registro: nombre + correo + ubicación + contraseña
 * Login:    correo + contraseña
 * Empresa:  crear empresa, unirse a empresa, invitación
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { Loader2, Eye, EyeOff, User, Phone, Mail, Lock, MapPin, Navigation, Building, Key } from 'lucide-react';
import DOMPurify from 'dompurify';
import { supabase } from '../lib/supabase';

const ERRORES = {
  'auth/email-already-in-use':     'Este correo ya está registrado.',
  'auth/invalid-email':            'El correo no es válido.',
  'auth/weak-password':            'La contraseña debe tener al menos 6 caracteres.',
  'auth/invalid-credential':       'Correo o contraseña incorrectos. Si no tienes cuenta, regístrate en "Crear cuenta".',
  'auth/too-many-requests':        'Demasiados intentos.',
  'auth/user-not-found':           'Tu cuenta no está registrada. Regístrate primero en "Crear cuenta".',
  'auth/wrong-password':           'Contraseña incorrecta.',
  'auth/network-request-failed':   'Error de conexión.',
  'auth/operation-not-allowed':    'Este método no está habilitado.',
  'over_email_send_rate_limit':    'Has solicitado demasiados correos. Espera unos minutos antes de intentar de nuevo.',
  email_not_confirmed:             'Tu correo aún no está confirmado. Revisa tu bandeja de entrada o spam, o reenvía el enlace de confirmación.',
};

function msgError(code) {
  return ERRORES[code] || `Error: ${code || 'desconocido'}. Intenta de nuevo.`;
}

export default function Registro() {
  const { register, login, resendConfirmation, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';

  const [modo, setModo]           = useState('login');
  const [nombre, setNombre]       = useState('');
  const [whatsapp, setWhatsapp]   = useState('');
  const [email, setEmail]         = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [password, setPassword]   = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendInfo, setResendInfo] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [detectandoGPS, setDetectandoGPS] = useState(false);
  const [coords, setCoords]       = useState(null);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const submittingRef = useRef(false);

  useEffect(() => {
    if (searchParams.get('mode') === 'reset') {
      setResetMode(true);
      setModo('login');
    }
  }, [searchParams]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setInterval(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    if (!user?.uid) return;
    if (resetMode && !resetSuccess) return;
    navigate(redirectTo, { replace: true });
  }, [user?.uid, navigate, redirectTo, resetMode, resetSuccess]);

  const cambiarModo = (m) => {
    setModo(m); setError(''); setErrorCode(''); setResendInfo('');
    setNombre(''); setWhatsapp(''); setEmail(''); setUbicacion(''); setPassword(''); setCoords(null);
    setResetSent(false); setResetError('');
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setResetError('Ingresa tu correo electrónico primero.');
      return;
    }
    setResetLoading(true);
    setResetError('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (e) {
      setResetError(
        e.message?.includes('not found') || e.code === 'user_not_found'
          ? 'No existe una cuenta con ese correo.'
          : 'Error al enviar el correo. Intenta de nuevo.'
      );
    } finally {
      setResetLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email.trim()) {
      setError('Ingresa tu correo electrónico para reenviar la confirmación.');
      return;
    }
    setResendLoading(true);
    setResendInfo('');
    try {
      await resendConfirmation(email);
      setResendInfo('Correo reenviado. Revisa tu bandeja de entrada y la carpeta de spam.');
      setResendCooldown(60);
    } catch (e) {
      setError(e.code ? msgError(e.code) : (e.message || 'No se pudo reenviar el correo.'));
    } finally {
      setResendLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setResetSuccess(true);
    } catch (e) {
      setError('Error al actualizar la contraseña. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const detectarGPS = () => {
    if (!navigator.geolocation) {
      setError('Tu dispositivo no tiene GPS. Escribe tu ubicación manualmente.');
      return;
    }
    setDetectandoGPS(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setCoords({ lat, lon });
        try {
          const res = await fetch(`/api/mercadolibre?type=geocode&lat=${lat}&lon=${lon}`);
          if (!res.ok) throw new Error();
          const data = await res.json();
          const nombreCorto = [data.address?.district, data.address?.city_district, data.address?.city, data.address?.suburb, data.address?.neighbourhood, data.address?.city, data.address?.town, data.address?.village, data.address?.county, data.address?.state]
            .filter(Boolean).slice(0, 2).join(', ') || data.name.split(',')[0];
          setUbicacion(nombreCorto);
        } catch {
          setUbicacion(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
        }
        setDetectandoGPS(false);
      },
      () => {
        setError('No se pudo obtener GPS. Escribe tu ubicación manualmente.');
        setDetectandoGPS(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async () => {
    setError('');
    setErrorCode('');
    setResendInfo('');

    if (submittingRef.current) return;
    submittingRef.current = true;

    if (modo === 'registro') {
      if (!nombre.trim())       { setError('Ingresa tu nombre completo.'); submittingRef.current = false; return; }
      if (!whatsapp.trim())     { setError('Ingresa tu número de WhatsApp.'); submittingRef.current = false; return; }
      if (!email.trim())        { setError('Ingresa tu correo electrónico.'); submittingRef.current = false; return; }
      if (!ubicacion.trim())    { setError('Selecciona tu ubicación (GPS o manual).'); submittingRef.current = false; return; }
      if (password.length < 6)  { setError('La contraseña debe tener al menos 6 caracteres.'); submittingRef.current = false; return; }
    } else {
      if (!email.trim())        { setError('Ingresa tu correo electrónico.'); submittingRef.current = false; return; }
      if (!password)            { setError('Ingresa tu contraseña.'); submittingRef.current = false; return; }
    }

    setLoading(true);
    try {
      if (modo === 'registro') {
        const nombreSanitizado = DOMPurify.sanitize(nombre).trim();
        const ubicacionSanitizada = DOMPurify.sanitize(ubicacion).trim();
        const whatsappSanitizado = DOMPurify.sanitize(whatsapp).trim();
        await register({ nombre: nombreSanitizado, email, password, ubicacion: ubicacionSanitizada, coords, whatsapp: whatsappSanitizado });
      } else {
        await login({ email, password });
      }
    } catch (e) {
      console.error('Auth error:', e.code, e.message);
      const code = e.code || '';
      setErrorCode(code);
      if (code === 'email_not_confirmed') {
        setError(
          modo === 'registro'
            ? 'Tu cuenta fue creada. Revisa tu correo electrónico y confirma el enlace para poder iniciar sesión.'
            : msgError(code)
        );
      } else {
        setError(msgError(code));
      }
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: 'linear-gradient(160deg, #f0faf4 0%, #e8f5ee 100%)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <img src="/icons/icon-192x192.png" alt="Agrilux" className="w-20 h-20 shadow-xl rounded-3xl object-contain" />
          </div>
          <h1 className="text-[2.2rem] font-bold tracking-[0.14em] text-primary leading-none">AGRILUX</h1>
          <p className="text-base mt-2 text-[#3f5d52] font-normal">Agricultura Inteligente del Perú</p>
        </div>

        {/* ── RESET PASSWORD FORM ── */}
        {resetMode && (
          <div className="bg-white rounded-3xl shadow-xl p-6 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {resetSuccess ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">✓</span>
                </div>
                <p className="text-green-700 font-semibold mb-2">¡Contraseña actualizada!</p>
                <p className="text-gray-500 text-sm mb-4">Ya puedes iniciar sesión con tu nueva contraseña.</p>
                <button
                  onClick={() => { setResetMode(false); setResetSuccess(false); }}
                  className="w-full bg-primary text-white font-bold py-3 rounded-2xl text-sm"
                >
                  Ir a iniciar sesión →
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 text-center font-semibold">Ingresa tu nueva contraseña</p>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full border-2 border-gray-100 rounded-2xl pl-10 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
                    autoComplete="new-password"
                  />
                  <button
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <button
                  onClick={handleUpdatePassword}
                  disabled={loading}
                  className="w-full bg-primary text-white font-bold py-4 rounded-2xl text-base hover:bg-[#14522e] transition-colors disabled:opacity-50 shadow-lg"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={20} className="animate-spin" /> Guardando...
                    </span>
                  ) : 'Guardar nueva contraseña →'}
                </button>
              </>
            )}
          </div>
        )}

        {!resetMode && (
          <>
            {/* Tabs */}
            <div className="flex bg-gray-100 rounded-2xl p-1 mb-6">
              {[['login', 'Iniciar sesión'], ['registro', 'Crear cuenta'], ['empresa', 'Empresa']].map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => cambiarModo(m)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${modo === m ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-3xl shadow-xl p-6 space-y-4">
              {error && (
                <div
                  className={`rounded-xl border p-3 ${
                    errorCode === 'email_not_confirmed'
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-red-200 bg-red-50'
                  }`}
                >
                  <p className={`text-sm ${errorCode === 'email_not_confirmed' ? 'text-amber-800' : 'text-red-600'}`}>
                    {error}
                  </p>
                  {errorCode === 'email_not_confirmed' ? (
                    <div className="mt-2">
                      {resendInfo ? (
                        <p className="text-xs font-semibold text-emerald-700">{resendInfo}</p>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResendConfirmation}
                          disabled={resendLoading || resendCooldown > 0}
                          className="text-xs font-bold text-amber-900 underline disabled:opacity-50"
                        >
                          {resendLoading ? 'Reenviando...' : resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : 'Reenviar correo de confirmación'}
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              {/* ── REGISTRO ── */}
              {modo === 'registro' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-2">Nombre completo</label>
                    <div className="relative">
                      <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                      <input
                        value={nombre}
                        onChange={e => setNombre(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                        placeholder="Ej: Juan Pérez García"
                        className="w-full bg-[#e8f0fe] rounded-2xl pl-10 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
                        autoComplete="name"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-700 block mb-2">WhatsApp *</label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                      <input
                        value={whatsapp}
                        onChange={e => setWhatsapp(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                        placeholder="Ej: 987654321"
                        className="w-full bg-[#e8f0fe] rounded-2xl pl-10 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
                        autoComplete="tel"
                        inputMode="tel"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-700 block mb-2">Ubicación *</label>
                    <div className="relative">
                      <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                      <input
                        value={ubicacion}
                        onChange={e => setUbicacion(e.target.value)}
                        placeholder="Ej: Cutervo, Cajamarca"
                        className="w-full bg-[#e8f0fe] rounded-2xl pl-10 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={detectarGPS}
                      disabled={detectandoGPS}
                      className="mt-2 w-full flex items-center justify-center gap-2 text-xs font-semibold text-primary bg-primary/5 hover:bg-primary/10 py-2.5 rounded-xl transition-colors"
                    >
                      {detectandoGPS ? (
                        <><Loader2 size={14} className="animate-spin" /> Detectando ubicación...</>
                      ) : (
                        <><Navigation size={14} /> Usar GPS de mi teléfono</>
                      )}
                    </button>
                    <p className="text-[10px] text-gray-400 mt-1 text-center">Tu ubicación se usa para recomendaciones climáticas precisas</p>
                  </div>
                </>
              )}

              {/* ── EMPRESA ── */}
              {modo === 'empresa' && (
                <>
                  <div className="space-y-4">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Selecciona una opción</p>

                    <div className="space-y-3">
                      <button
                        onClick={() => navigate('/registro/empresa-nueva')}
                        className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl text-left hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Building size={18} className="text-primary" />
                          <span className="text-sm font-semibold text-gray-800">Crear una empresa</span>
                        </div>
                        <span className="text-xs text-gray-400">Registrar tu empresa y tu cuenta</span>
                      </button>

                      <button
                        onClick={() => navigate('/registro/unirse')}
                        className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl text-left hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <User size={18} className="text-primary" />
                          <span className="text-sm font-semibold text-gray-800">Unirme a una empresa existente</span>
                        </div>
                        <span className="text-xs text-gray-400">Solicita incorporación a una empresa</span>
                      </button>

                      <button
                        onClick={() => navigate('/registro/invitar')}
                        className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl text-left hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Key size={18} className="text-primary" />
                          <span className="text-sm font-semibold text-gray-800">Tengo una invitación</span>
                        </div>
                        <span className="text-xs text-gray-400">Código de invitación de administrador</span>
                      </button>
                    </div>

                    <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                      <p className="text-xs text-amber-700 leading-relaxed">
                        <span className="font-semibold">Nota:</span> El registro de empresa y la unión a una empresa existente requieren que las tablas de onboarding estén desplegadas en Supabase. Si aún no están disponibles, verás un mensaje informativo.
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* Email input - shared between registro and login modes */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-2">Correo electrónico</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    placeholder="tucorreo@gmail.com"
                    className="w-full bg-[#e8f0fe] rounded-2xl pl-10 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
                    autoComplete="email"
                    inputMode="email"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-2">
                  {modo === 'login' ? 'Contraseña' : 'Crear contraseña'}
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    placeholder={modo === 'login' ? 'Tu contraseña' : 'Mínimo 6 caracteres'}
                    className="w-full bg-[#e8f0fe] rounded-2xl pl-10 pr-12 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
                    autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
                  />
                  <button
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {modo === 'login' && (
                <div className="text-right -mt-1">
                  {resetSent ? (
                    <p className="text-xs text-green-600 font-semibold">✓ Correo enviado. Revisa tu bandeja de entrada.</p>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleResetPassword}
                        disabled={resetLoading}
                        className="text-xs text-primary font-semibold hover:underline disabled:opacity-50"
                      >
                        {resetLoading ? 'Enviando...' : '¿Olvidaste tu contraseña?'}
                      </button>
                      {resetError && (
                        <p className="text-xs text-red-500 mt-1">{resetError}</p>
                      )}
                    </>
                  )}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-primary text-white font-bold py-4 rounded-2xl text-base hover:bg-[#14522e] transition-colors disabled:opacity-50 shadow-lg mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={20} className="animate-spin" /> Procesando...
                  </span>
                ) : modo === 'login' ? 'Iniciar sesión →' : 'Crear cuenta →'}
              </button>
            </div>
          </>
        )}

        {/* Pie */}
        <div className="mt-6 flex flex-col items-center justify-center text-center space-y-3">
          <p className="text-sm text-gray-400 font-normal">
            ¿Dificultad o dudas para ingresar? Contacta con soporte:
          </p>
          <a
            href="https://wa.me/51920789045"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 bg-white border border-[#b2d8d0] text-[#0C5435] font-bold text-sm px-3.5 py-1.5 rounded-full shadow-sm hover:bg-gray-50 transition-all"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#6ed4b8]" />
            <span>Contáctanos</span>
          </a>
          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <span>Plataforma Agrícola Oficial</span>
            <button
              onClick={() => navigate('/admin')}
              aria-label="Administración"
              className="text-xs text-gray-300 hover:text-gray-500 transition-colors"
            >
              · · ·
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}