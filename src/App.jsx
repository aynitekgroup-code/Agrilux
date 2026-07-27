import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import Layout from './components/Layout';
import SelectorUbicacion from './components/SelectorUbicacion';
import Registro from './pages/Registro';
import Diagnostico from './pages/Diagnostico';
import MiParcela from './pages/MiParcela';
import CicloCultivo from './pages/CicloCultivo';
import Admin from './pages/Admin';
import { Clock, Mail, LogOut } from 'lucide-react';

function PantallaPendiente() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-amber-50 to-orange-100">
      <div className="w-full max-w-sm text-center">
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock size={36} className="text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Cuenta pendiente</h1>
        <p className="text-gray-500 text-sm mb-6">
          Tu registro fue enviado al administrador. Espera a que apruebe tu cuenta para usar Agrilux.
        </p>
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-6 text-left">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Mail size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{user?.nombre || user?.email}</p>
              <p className="text-xs text-gray-400">{user?.email}</p>
            </div>
          </div>
          <div className="bg-amber-50 rounded-xl p-3">
            <p className="text-xs text-amber-700">
              <strong>¿Necesitas ayuda?</strong> Contacta al administrador:{' '}
              <a href="https://wa.me/51935211605" target="_blank" rel="noreferrer" className="underline font-bold">
                935 211 605
              </a>
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-gray-600 mx-auto"
        >
          <LogOut size={14} /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, loading, isAprobado } = useAuth();
  const [plagaDetectada, setPlagaDetectada] = useState('');

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-green-50 to-green-200">
      <div className="text-center">
        <div className="w-20 h-20 flex items-center justify-center mx-auto mb-4 bg-white rounded-full shadow-xl border-[3px] border-green-300 animate-pulse relative">
          <span className="text-4xl">🌱</span>
          <svg 
            className="absolute bottom-0 right-0 w-8 h-8 text-green-400 opacity-75"
            fill="none" viewBox="0 0 32 32">
            <path stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              d="M16 22V30M16 30L21 28M16 30L11 28M16 22L8 24M16 22L24 24" />
          </svg>
        </div>
        <div className="text-green-700 text-lg font-semibold mb-2">Agrilux</div>
        <div className="w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full animate-spin mx-auto mt-4" />
        <div className="mt-4 text-green-700 opacity-75 font-medium text-sm">
          Cargando tu campo inteligente...
        </div>
      </div>
    </div>
  );

  // Admin routes — always accessible
  if (window.location.pathname === '/admin') {
    return (
      <Routes>
        <Route path="/admin" element={<Admin />} />
      </Routes>
    );
  }

  // Logged in but NOT approved → pending screen (only for protected routes)
  if (user && !isAprobado && (window.location.pathname === '/parcela' || window.location.pathname === '/ciclo')) {
    return (
      <Routes>
        <Route path="*" element={<PantallaPendiente />} />
      </Routes>
    );
  }

  // Logged in AND approved, no location → selector
  if (user && isAprobado && !user.ubicacion) {
    return <SelectorUbicacion esPrimeraVez={true} />;
  }

  // ── RUTAS PRINCIPALES ──
  // Diagnóstico: SIEMPRE accesible (con o sin login)
  // Parcela y Ciclo: requieren login + aprobación
  return (
    <Routes>
      <Route path="/admin" element={<Admin />} />
      <Route path="/registro" element={<Registro />} />

      <Route path="*" element={
        <Layout>
          <Routes>
            {/* Diagnóstico — siempre accesible */}
            <Route path="/" element={<Diagnostico onPlagaDetectada={setPlagaDetectada} />} />

            {/* Parcela — requiere login */}
            <Route path="/parcela" element={
              user && isAprobado ? <MiParcela /> : <Navigate to="/registro" />
            } />

            {/* Ciclo — requiere login */}
            <Route path="/ciclo" element={
              user && isAprobado ? <CicloCultivo /> : <Navigate to="/registro" />
            } />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Layout>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
