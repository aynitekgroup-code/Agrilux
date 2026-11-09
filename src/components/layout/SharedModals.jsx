/**
 * src/components/layout/SharedModals.jsx
 *
 * Modales compartidos entre WebLayout y MobileLayout.
 * Extraídos de Layout.jsx para evitar duplicar lógica de negocio
 * (auth admin, recuperación de contraseña, selector de ubicación).
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Key, CheckCircle, Loader2, User, Mail, MapPin, Phone, Building, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import SelectorUbicacion from '../SelectorUbicacion';

// ── Modal: Acceso administrador ──────────────────────────────────────────────
export function AdminAccessModal({ open, onClose }) {
  const navigate = useNavigate();
  const [adminClave, setAdminClave] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminIntentos, setAdminIntentos] = useState(0);
  const adminBloqueado = adminIntentos >= 5;

  const handleAdminLogin = async () => {
    if (adminBloqueado) {
      setAdminError('Demasiados intentos. Espera unos minutos.');
      return;
    }
    try {
      const res = await fetch('/api/alertas-preventivas?type=auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave: adminClave }),
      });
      const data = await res.json();
      if (data.ok) {
        sessionStorage.setItem('agrilux_admin_token', data.token || Date.now().toString());
        setAdminClave('');
        setAdminError('');
        onClose();
        navigate('/admin');
      } else {
        setAdminIntentos((prev) => prev + 1);
        setAdminError('Clave incorrecta');
      }
    } catch {
      setAdminError('Error de conexión');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2">
          <Shield size={20} className="text-blue-600" />
          Acceso administrador
        </h3>
        <p className="text-sm text-gray-500 mb-4">Ingresa la clave de administrador:</p>
        <input
          type="password"
          value={adminClave}
          onChange={(e) => {
            setAdminClave(e.target.value);
            setAdminError('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
          placeholder="Clave..."
          className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
        {adminError && <p className="text-red-500 text-xs mt-1">{adminError}</p>}
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleAdminLogin} className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
            Entrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Cambiar contraseña ────────────────────────────────────────────────
export function ChangePasswordModal({ open, onClose, initialEmail = '' }) {
  const [claveEmail, setClaveEmail] = useState(initialEmail);
  const [claveLoading, setClaveLoading] = useState(false);
  const [claveExito, setClaveExito] = useState(false);
  const [claveError, setClaveError] = useState('');

  const enviarRecuperacion = async () => {
    if (!claveEmail.trim()) {
      setClaveError('Ingresa tu correo');
      return;
    }
    setClaveLoading(true);
    setClaveError('');
    setClaveExito(false);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(claveEmail.trim());
      if (error) throw error;
      setClaveExito(true);
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('not found')) {
        setClaveError('No existe una cuenta con ese correo');
      } else if (msg.includes('invalid')) {
        setClaveError('Correo inválido');
      } else {
        setClaveError('Error al enviar. Intenta de nuevo.');
      }
    }
    setClaveLoading(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
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
              onChange={(e) => {
                setClaveEmail(e.target.value);
                setClaveError('');
              }}
              placeholder="tu@email.com"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
            />
            {claveError && <p className="text-red-500 text-xs mt-1">{claveError}</p>}
          </>
        )}

        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            {claveExito ? 'Cerrar' : 'Cancelar'}
          </button>
          {!claveExito && (
            <button
              onClick={enviarRecuperacion}
              disabled={claveLoading || !claveEmail.trim()}
              className="flex-1 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {claveLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Enviando...
                </>
              ) : (
                'Enviar enlace'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modal: Selector de ubicación ─────────────────────────────────────────────
export function LocationSelectorModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white/95 flex items-center justify-center" style={{ backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-[430px] mx-auto relative">
        <SelectorUbicacion esPrimeraVez={false} onClose={onClose} />
      </div>
    </div>
  );
}

// ── Modal: Selector de empresa ────────────────────────────────────────────────
export function EmpresaSelectorModal({ open, onClose, empresas, empresaActivaId, onSelectEmpresa }) {
  const navigate = useNavigate();
  const lista = Array.isArray(empresas) ? empresas : [];
  const empresaActiva = lista.find((e) => e.id === empresaActivaId) || null;

  const handleSeleccionar = (empresaId) => {
    if (onSelectEmpresa) {
      onSelectEmpresa(empresaId);
    }
    onClose();
  };

  const handleIrRegistro = () => {
    onClose();
    navigate('/registro/empresa-nueva');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-1">
          <Building size={20} className="text-primary" />
          <h3 className="text-lg font-bold text-gray-800">Selecciona una empresa</h3>
        </div>
        <p className="text-sm text-gray-500 mb-6">Selecciona una empresa para continuar.</p>

        {lista.length > 0 ? (
          <div className="space-y-2 mb-6">
            {lista.map((empresa) => (
              <button
                key={empresa.id}
                onClick={() => handleSeleccionar(empresa.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-colors ${
                  empresaActivaId === empresa.id
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'bg-gray-50 text-gray-700 border border-gray-100 hover:bg-gray-100'
                }`}
              >
                <span className="truncate">{empresa.nombre}</span>
                {empresaActivaId === empresa.id && (
                  <span className="text-xs font-bold text-primary">Activa</span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center mb-6">
            <p className="text-sm text-gray-500">No perteneces a ninguna empresa aún.</p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {lista.length === 0 && (
            <button
              onClick={handleIrRegistro}
              className="w-full py-3 rounded-lg bg-[#1a6b3c] text-white text-sm font-bold hover:bg-[#14522e] transition-colors"
            >
              Ir al registro
            </button>
          )}
          <button onClick={onClose} className="w-full py-3 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Perfil de usuario ─────────────────────────────────────────────────
export function UserProfileModal({ open, onClose, user }) {
  if (!open || !user) return null;

  const rolLabels = {
    agricultor: 'Agricultor',
    admin: 'Administrador',
  };

  const statusLabels = {
    aprobado: 'Aprobado',
    pendiente: 'Pendiente',
    suspendido: 'Suspendido',
  };

  const coords = user.coords ? (typeof user.coords === 'string' ? user.coords : JSON.stringify(user.coords)) : 'No registrada';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <User size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-800">{user.nombre || 'Usuario Agrilux'}</h3>
            <p className="text-sm text-gray-500">{user.email || 'Sin correo'}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
            <Mail size={16} className="text-gray-400" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-500 uppercase">Correo electrónico</p>
              <p className="text-sm text-gray-700 truncate">{user.email || '—'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
            <MapPin size={16} className="text-gray-400" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-500 uppercase">Ubicación</p>
              <p className="text-sm text-gray-700">{user.ubicacion || 'No registrada'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
            <Phone size={16} className="text-gray-400" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-500 uppercase">WhatsApp</p>
              <p className="text-sm text-gray-700">{user.whatsapp || 'No registrado'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
            <Building size={16} className="text-gray-400" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-500 uppercase">Rol</p>
              <p className={`text-sm font-semibold ${user.rol === 'admin' ? 'text-blue-600' : 'text-green-600'}`}>
                {rolLabels[user.rol] || user.rol}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
            <Clock size={16} className="text-gray-400" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-500 uppercase">Estado de cuenta</p>
              <p className={`text-sm font-semibold ${user.status === 'aprobado' ? 'text-green-600' : user.status === 'pendiente' ? 'text-amber-600' : 'text-red-600'}`}>
                {statusLabels[user.status] || user.status}
              </p>
            </div>
          </div>

          {user.coords && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
              <MapPin size={16} className="text-gray-400" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-500 uppercase">Coordenadas GPS</p>
                <p className="text-sm text-gray-700 truncate">{coords}</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
