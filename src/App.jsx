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

function AppRoutes() {
  const { user, loading } = useAuth();
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

  if (user && !user.ubicacion) {
    return <SelectorUbicacion esPrimeraVez={true} />;
  }

  return (
    <Routes>
      <Route path="/admin" element={<Admin />} />
      <Route path="/registro" element={<Registro />} />

      <Route path="*" element={
        <Layout>
          <Routes>
            <Route path="/" element={<Diagnostico onPlagaDetectada={setPlagaDetectada} />} />
            <Route path="/parcela" element={user ? <MiParcela /> : <Navigate to="/registro" />} />
            <Route path="/ciclo" element={<CicloCultivo />} />
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