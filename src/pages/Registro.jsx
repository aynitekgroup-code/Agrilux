/**
 * src/pages/Registro.jsx
 *
 * Registro: nombre + correo + ubicación + contraseña
 * Login:    correo + contraseña
 */

import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { Loader2, Eye, EyeOff, User, Mail, Lock, MapPin, Navigation } from 'lucide-react';
import DOMPurify from 'dompurify';

const ERRORES = {
  'auth/email-already-in-use':     'Este correo ya está registrado.',
  'auth/invalid-email':            'El correo no es válido.',
  'auth/weak-password':            'La contraseña debe tener al menos 6 caracteres.',
  'auth/invalid-credential':       'Correo o contraseña incorrectos. Si no tienes cuenta, crea una en "Crear cuenta".',
  'auth/too-many-requests':        'Demasiados intentos. Espera unos minutos.',
  'auth/user-not-found':           'No existe una cuenta con este correo. Crea una en "Crear cuenta".',
  'auth/wrong-password':           'Contraseña incorrecta.',
  'auth/network-request-failed':   'Error de conexión. Verifica tu internet.',
  'auth/operation-not-allowed':    'Este método de inicio de sesión no está habilitado.',
};

function msgError(code) {
  return ERRORES[code] || `Error: ${code || 'desconocido'}. Intenta de nuevo.`;
}

export default function Registro() {
  const { register, login } = useAuth();
  const navigate = useNavigate();

  const [modo, setModo]           = useState('login');
  const [nombre, setNombre]       = useState('');
  const [whatsapp, setWhatsapp]   = useState('');
  const [email, setEmail]         = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [detectandoGPS, setDetectandoGPS] = useState(false);
  const [coords, setCoords]       = useState(null);

  const submittingRef = useRef(false);

  const cambiarModo = (m) => {
    setModo(m); setError('');
    setNombre(''); setWhatsapp(''); setEmail(''); setUbicacion(''); setPassword(''); setCoords(null);
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
          const res = await fetch(`/api/geocode?lat=${lat}&lon=${lon}`);
          if (!res.ok) throw new Error();
          const data = await res.json();
          const nombreCorto = [data.address?.city, data.address?.town, data.address?.village, data.address?.county, data.address?.state]
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
      setError(msgError(e.code));
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'linear-gradient(160deg, #f0faf4 0%, #e8f5ee 100%)' }}
    >
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-24 h-24 bg-primary rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-xl">
            <span className="text-5xl">🌾</span>
          </div>
          <h1 className="text-4xl font-display font-bold text-primary">AGRILUX</h1>
          <p className="text-gray-500 mt-2 text-sm">Agricultura Inteligente del Perú</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-2xl p-1 mb-6">
          {[['login', 'Iniciar sesión'], ['registro', 'Crear cuenta']].map(([m, label]) => (
            <button
              key={m}
              onClick={() => cambiarModo(m)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                modo === m ? 'bg-white text-primary shadow-sm' : 'text-gray-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6 space-y-4">

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* ── REGISTRO ── */}
          {modo === 'registro' && (
            <>
              {/* Nombre */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Nombre completo</label>
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    placeholder="Ej: Juan Pérez García"
                    className="w-full border-2 border-gray-100 rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                    autoComplete="name"
                  />
                </div>
              </div>

              {/* WhatsApp */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">WhatsApp *</label>
                <div className="relative">
                  <input
                    value={whatsapp}
                    onChange={e => setWhatsapp(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    placeholder="Ej: 987654321"
                    className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </div>
              </div>

              {/* Ubicación */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Ubicación *</label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input
                    value={ubicacion}
                    onChange={e => setUbicacion(e.target.value)}
                    placeholder="Ej: Cutervo, Cajamarca"
                    className="w-full border-2 border-gray-100 rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
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

          {/* ── CORREO (siempre visible) ── */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Correo electrónico</label>
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="tucorreo@gmail.com"
                className="w-full border-2 border-gray-100 rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                autoComplete="email"
                inputMode="email"
              />
            </div>
          </div>

          {/* ── CONTRASEÑA (siempre visible) ── */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">
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
                className="w-full border-2 border-gray-100 rounded-2xl pl-10 pr-12 py-3 text-sm focus:outline-none focus:border-primary transition-colors"
                autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Botón */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-primary text-white font-bold py-4 rounded-2xl text-base hover:bg-primary-dark transition-colors disabled:opacity-50 shadow-lg mt-2"
          >
            {loading
              ? <span className="flex items-center justify-center gap-2">
                  <Loader2 size={20} className="animate-spin" /> Procesando...
                </span>
              : modo === 'login' ? 'Iniciar sesión →' : 'Crear cuenta →'
            }
          </button>

        </div>

        {/* Pie */}
        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            ¿Ayuda?{' '}
            <a
              href="https://wa.me/51935211605"
              target="_blank"
              rel="noreferrer"
              className="text-primary font-semibold"
            >
              935 211 605
            </a>
          </p>
          <button
            onClick={() => navigate('/admin')}
            className="text-xs text-gray-300 hover:text-gray-500 transition-colors"
          >
            · · ·
          </button>
        </div>

      </div>
    </div>
  );
}