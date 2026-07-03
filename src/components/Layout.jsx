import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Camera, ShieldCheck, LogOut, Menu, X, MapPin, Truck, Send, Loader2, Clock, CheckCircle, XCircle, Shield } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import SelectorUbicacion from './SelectorUbicacion';

const navItemsAgricultor = [
  { path: '/',        icon: Camera,      label: 'Diagnóstico' },
  { path: '/mercado', icon: ShieldCheck, label: 'Fungicidas'  },
];

const navItemsMotorizado = [
  { path: '/motorizado', icon: Truck, label: 'Delivery' },
  { path: '/mercado',    icon: ShieldCheck, label: 'Mercado' },
];

function ModalSolicitarMotorizado({ user, onClose, onSolicitudEnviada }) {
  const [form, setForm] = useState({ nombre: user?.nombre || '', celular: user?.celular || '', ubicacion: user?.ubicacion || '', motivo: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);

  const enviar = async () => {
    if (!form.nombre.trim() || !form.celular || !form.ubicacion) {
      setError('Completa nombre, celular y ubicación'); return;
    }
    setLoading(true);
    setError('');
    try {
      await setDoc(doc(db, 'solicitudes', user.uid), {
        userId: user.uid,
        nombre: form.nombre.trim(),
        email: user.email || '',
        celular: form.celular,
        ubicacion: form.ubicacion,
        motivo: form.motivo.trim(),
        estado: 'pendiente',
        createdAt: new Date().toISOString(),
      });
      setEnviado(true);
      onSolicitudEnviada();
    } catch (e) {
      setError('Error al enviar solicitud');
    }
    setLoading(false);
  };

  if (enviado) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center">
        <div className="bg-white rounded-t-3xl w-full max-w-[430px] p-6 text-center space-y-4">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
            <Clock size={32} className="text-yellow-600" />
          </div>
          <h3 className="font-display font-bold text-lg">Solicitud enviada</h3>
          <p className="text-sm text-gray-500">Tu solicitud está pendiente de revisión por el administrador. Te notificaremos cuando sea aprobada.</p>
          <button onClick={onClose}
            className="w-full bg-primary text-white font-bold py-3 rounded-xl">
            Entendido
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl w-full max-w-[430px] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-lg">Ser Motorizado</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        <div className="bg-purple-50 rounded-xl p-3">
          <p className="text-xs text-purple-700 font-semibold">¿Cómo funciona?</p>
          <p className="text-xs text-purple-600 mt-1">Envías tu solicitud → El administrador la revisa → Si te aprueba, podrás ver y aceptar pedidos de delivery</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3"><p className="text-red-600 text-sm">{error}</p></div>}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Nombre completo *</label>
            <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Tu nombre"
              className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Celular / WhatsApp *</label>
            <input value={form.celular} onChange={e => setForm(f => ({ ...f, celular: e.target.value.replace(/\D/g, '').slice(0, 9) }))}
              placeholder="9XXXXXXXX" maxLength={9}
              className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Ubicación / Distrito *</label>
            <input value={form.ubicacion} onChange={e => setForm(f => ({ ...f, ubicacion: e.target.value }))}
              placeholder="Ej: Cutervo, Cajamarca"
              className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">¿Por qué quieres ser motorizado?</label>
            <textarea value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} rows={2}
              placeholder="Opcional"
              className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary resize-none" />
          </div>
          <button onClick={enviar} disabled={loading || !form.nombre.trim() || !form.celular || !form.ubicacion}
            className="w-full bg-purple-600 text-white font-bold py-3.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {loading ? 'Enviando...' : 'Enviar solicitud'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mostrarUbicacion, setMostrarUbicacion] = useState(false);
  const [solicitudModal, setSolicitudModal] = useState(false);
  const [solicitudEstado, setSolicitudEstado] = useState(null);
  const [adminModal, setAdminModal] = useState(false);
  const [adminClave, setAdminClave] = useState('');
  const [adminError, setAdminError] = useState('');

  const ADMIN_EMAIL = 'jose.llanos.d@uni.pe';
  const esAdmin = user?.email === ADMIN_EMAIL;

  const navItems = user?.rol === 'motorizado' ? navItemsMotorizado : navItemsAgricultor;

  useEffect(() => {
    if (!user?.uid || user?.rol === 'motorizado') return;
    const checkSolicitud = async () => {
      try {
        const snap = await getDoc(doc(db, 'solicitudes', user.uid));
        if (snap.exists()) {
          setSolicitudEstado(snap.data().estado);
        }
      } catch (e) { /* silencioso */ }
    };
    checkSolicitud();
  }, [user?.uid, user?.rol]);

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    navigate('/');
  };

  const handleActuarMotorizado = () => {
    setMenuOpen(false);
    if (user?.rol === 'motorizado') {
      navigate('/motorizado');
    } else if (solicitudEstado === 'aceptada') {
      navigate('/motorizado');
    } else if (solicitudEstado === 'rechazada') {
      alert('Tu solicitud fue rechazada. Contacta al administrador para más información.');
    } else if (solicitudEstado === 'pendiente') {
      alert('Tu solicitud está pendiente de revisión. Espera la aprobación del administrador.');
    } else {
      setSolicitudModal(true);
    }
  };

  const handleActuarAdmin = () => {
    setMenuOpen(false);
    setAdminClave('');
    setAdminError('');
    setAdminModal(true);
  };

  const handleAdminLogin = () => {
    if (adminClave === import.meta.env.VITE_ADMIN_KEY) {
      sessionStorage.setItem('agrilux_admin_auth', 'true');
      setAdminModal(false);
      navigate('/admin');
    } else {
      setAdminError('Clave incorrecta');
    }
  };

  return (
    <div className="flex flex-col min-h-screen max-w-[430px] mx-auto">
      <div className="flex justify-between items-center px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-sm font-semibold text-gray-700 truncate">
            {user?.nombre ? `Hola, ${user.nombre.split(' ')[0]}` : 'Agrilux'}
          </div>
          {user?.ubicacion && user?.rol !== 'motorizado' && (
            <button onClick={() => setMostrarUbicacion(true)}
              className="flex items-center gap-1 text-xs text-primary bg-primary/5 px-2 py-1 rounded-full hover:bg-primary/10 transition-colors shrink-0">
              <MapPin size={12} />
              <span className="truncate max-w-[80px]">{user.ubicacion.split(',')[0]}</span>
            </button>
          )}
          {user?.rol === 'motorizado' && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">🏍️ Delivery</span>
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
              {user?.rol !== 'motorizado' && (
                <button
                  onClick={() => { setMenuOpen(false); setMostrarUbicacion(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-primary/5 hover:text-primary transition-colors text-sm font-medium rounded-lg">
                  <MapPin size={18} />
                  Cambiar ubicación
                </button>
              )}
              <button
                onClick={handleActuarMotorizado}
                className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors text-sm font-medium rounded-lg">
                <Truck size={18} />
                {user?.rol === 'motorizado' ? 'Ver pedidos' : 'Actuar como motorizado'}
                {solicitudEstado === 'pendiente' && <Clock size={12} className="text-yellow-500 ml-auto" />}
                {solicitudEstado === 'aceptada' && user?.rol !== 'motorizado' && <CheckCircle size={12} className="text-green-500 ml-auto" />}
                {solicitudEstado === 'rechazada' && <XCircle size={12} className="text-red-500 ml-auto" />}
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
            </div>
          )}
        </div>
      </div>

      <main className="flex-1 pb-28 overflow-y-auto">{children}</main>
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-gray-100 shadow-lg z-50">
        <div className="flex">
          {navItems.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path;
            return (
              <button key={path} onClick={() => navigate(path)}
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

      {solicitudModal && (
        <ModalSolicitarMotorizado
          user={user}
          onClose={() => setSolicitudModal(false)}
          onSolicitudEnviada={() => { setSolicitudEstado('pendiente'); setSolicitudModal(false); }}
        />
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
    </div>
  );
}
