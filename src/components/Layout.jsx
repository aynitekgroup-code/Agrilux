import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Camera, Leaf, Calendar, Store, LogOut, Menu, X, MapPin, Shield, User, Sparkles, Key, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';
import SelectorUbicacion from './SelectorUbicacion';
import OnlineStatus from './OnlineStatus';
import AgentStatus from './AgentStatus';

const navItems = [
  { path: '/',        icon: Camera,  label: 'Diagnóstico' },
  { path: '/ciclo',   icon: Calendar, label: 'Ciclo' },
  { path: '/parcela', icon: Leaf,    label: 'Parcela' },
  { path: '/mercado', icon: Store,   label: 'Mercado' },
];

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mostrarUbicacion, setMostrarUbicacion] = useState(false);
  const [adminModal, setAdminModal] = useState(false);
  const [adminClave, setAdminClave] = useState('');
  const [adminError, setAdminError] = useState('');
  const [modalClave, setModalClave] = useState(false);
  const [claveEmail, setClaveEmail] = useState('');
  const [claveLoading, setClaveLoading] = useState(false);
  const [claveExito, setClaveExito] = useState(false);
  const [claveError, setClaveError] = useState('');

  const ADMIN_EMAIL = 'aynitek.group@gmail.com';
  const esAdmin = user?.email === ADMIN_EMAIL;

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    navigate('/');
  };

  const handleActuarAdmin = () => {
    setMenuOpen(false);
    setAdminClave('');
    setAdminError('');
    setAdminModal(true);
  };

  const handleAdminLogin = async () => {
    try {
      const res = await fetch('/api/alertas-preventivas?type=auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave: adminClave }),
      });
      const data = await res.json();
      if (data.ok) {
        sessionStorage.setItem('agrilux_admin', 'ok');
        setAdminModal(false);
        navigate('/admin');
      } else {
        setAdminError('Clave incorrecta');
      }
    } catch {
      setAdminError('Error de conexión');
    }
  };

  const enviarRecuperacion = async () => {
    if (!claveEmail.trim()) { setClaveError('Ingresa tu correo'); return; }
    setClaveLoading(true);
    setClaveError('');
    setClaveExito(false);
    try {
      await sendPasswordResetEmail(auth, claveEmail.trim());
      setClaveExito(true);
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        setClaveError('No existe una cuenta con ese correo');
      } else if (e.code === 'auth/invalid-email') {
        setClaveError('Correo inválido');
      } else {
        setClaveError('Error al enviar. Intenta de nuevo.');
      }
    }
    setClaveLoading(false);
  };

  return (
    <div className="flex flex-col min-h-screen max-w-[430px] mx-auto">
      <OnlineStatus />
      <div className="flex justify-between items-center px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-sm font-semibold text-gray-700 truncate">
            {user?.nombre ? `Hola, ${user.nombre.split(' ')[0]}` : 'Agrilux'}
          </div>
          {user?.ubicacion && (
            <button onClick={() => setMostrarUbicacion(true)}
              className="flex items-center gap-1 text-xs text-primary bg-primary/5 px-2 py-1 rounded-full hover:bg-primary/10 transition-colors shrink-0">
              <MapPin size={12} />
              <span className="truncate max-w-[120px]">
                {user?.coords?.lat ? `${user.coords.lat.toFixed(4)}, ${user.coords.lon.toFixed(4)}` : user.ubicacion.split(',')[0]}
              </span>
            </button>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-100 z-50">
              <button
                onClick={() => { setMenuOpen(false); setMostrarUbicacion(true); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-primary/5 hover:text-primary transition-colors text-sm font-medium rounded-lg">
                <MapPin size={18} />
                Cambiar ubicación
              </button>
              <button
                onClick={() => { setMenuOpen(false); navigate('/mercado?tab=mitienda'); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-green-50 hover:text-green-700 transition-colors text-sm font-medium rounded-lg">
                <Store size={18} />
                Mi tienda / Ofertas
              </button>
              {user ? (
                <>
                  <button
                    onClick={() => { setMenuOpen(false); setClaveEmail(user.email || ''); setModalClave(true); setClaveExito(false); setClaveError(''); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-amber-50 hover:text-amber-700 transition-colors text-sm font-medium rounded-lg">
                    <Key size={18} />
                    Cambiar contraseña
                  </button>
                  {esAdmin && (
                    <button
                      onClick={handleActuarAdmin}
                      className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors text-sm font-medium rounded-lg">
                      <Shield size={18} />
                      Actuar como administrador
                    </button>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors text-sm font-medium rounded-lg">
                    <LogOut size={18} />
                    Cerrar sesión
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { setMenuOpen(false); navigate('/registro'); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-primary hover:bg-primary/5 transition-colors text-sm font-medium rounded-lg">
                  <User size={18} />
                  Iniciar sesión
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <main className="flex-1 pb-28 overflow-y-auto">
        <div className="px-4 pt-2">
          <AgentStatus />
        </div>
        {children}
      </main>
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-gray-100 shadow-lg z-50">
        <div className="flex">
          {navItems.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path;
            return (
              <button key={path} onClick={() => {
                  if (!user && (path === '/parcela' || path === '/ciclo')) {
                    navigate('/registro');
                  } else {
                    navigate(path);
                  }
                }}
                className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors ${active ? 'text-primary' : 'text-gray-400'}`}>
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {mostrarUbicacion && (
        <div className="fixed inset-0 z-50 bg-white/95 flex items-center justify-center" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-[430px] mx-auto relative">
            <SelectorUbicacion esPrimeraVez={false} onClose={() => setMostrarUbicacion(false)} />
          </div>
        </div>
      )}

      {adminModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setAdminModal(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2">
              <Shield size={20} className="text-blue-600" />
              Acceso administrador
            </h3>
            <p className="text-sm text-gray-500 mb-4">Ingresa la clave de administrador:</p>
            <input
              type="password"
              value={adminClave}
              onChange={e => { setAdminClave(e.target.value); setAdminError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
              placeholder="Clave..."
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            {adminError && <p className="text-red-500 text-xs mt-1">{adminError}</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setAdminModal(false)} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">Cancelar</button>
              <button onClick={handleAdminLogin} className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">Entrar</button>
            </div>
          </div>
        </div>
      )}

      {modalClave && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModalClave(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2">
              <Key size={20} className="text-amber-600" />
              Cambiar contraseña
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Te enviaremos un enlace a tu correo para restablecer la contraseña.
            </p>

            {claveExito ? (
              <div className="text-center py-4">
                <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-800">Correo enviado</p>
                <p className="text-xs text-gray-500 mt-1">Revisa tu bandeja de entrada y sigue las instrucciones.</p>
              </div>
            ) : (
              <>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Correo electrónico</label>
                <input
                  type="email"
                  value={claveEmail}
                  onChange={e => { setClaveEmail(e.target.value); setClaveError(''); }}
                  placeholder="tu@email.com"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                />
                {claveError && <p className="text-red-500 text-xs mt-1">{claveError}</p>}
              </>
            )}

            <div className="flex gap-3 mt-4">
              <button onClick={() => setModalClave(false)} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
                {claveExito ? 'Cerrar' : 'Cancelar'}
              </button>
              {!claveExito && (
                <button
                  onClick={enviarRecuperacion}
                  disabled={claveLoading || !claveEmail.trim()}
                  className="flex-1 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {claveLoading ? <><Loader2 size={14} className="animate-spin" /> Enviando...</> : 'Enviar enlace'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
