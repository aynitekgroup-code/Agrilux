import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { db } from './lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Layout from './components/Layout';
import SelectorUbicacion from './components/SelectorUbicacion';
import Registro from './pages/Registro';
import Diagnostico from './pages/Diagnostico';
import Mercado from './pages/Mercado';
import Admin from './pages/Admin';
import MotorizadoPanel from './pages/MotorizadoPanel';

function AppRoutes() {
  const { user, loading } = useAuth();
  const [plagaDetectada, setPlagaDetectada] = useState('');
  const [esMotorizado, setEsMotorizado] = useState(false);

  useEffect(() => {
    if (!user?.uid || user?.rol === 'motorizado') return;
    const check = async () => {
      try {
        const snap = await getDoc(doc(db, 'solicitudes', user.uid));
        if (snap.exists() && snap.data().estado === 'aceptada') {
          setEsMotorizado(true);
        }
      } catch (e) { /* silencioso */ }
    };
    check();
  }, [user?.uid, user?.rol]);

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

  if (user && !user.ubicacion && user.rol !== 'motorizado' && !esMotorizado) {
    return <SelectorUbicacion esPrimeraVez={true} />;
  }

  return (
    <Routes>
      <Route path="/admin" element={<Admin />} />
      <Route path="/motorizado" element={(user?.rol === 'motorizado' || esMotorizado) ? <MotorizadoPanel /> : <Navigate to="/" />} />

      <Route path="*" element={
        !user ? <Registro /> : (
          <Layout>
            <Routes>
              <Route path="/" element={<Diagnostico onPlagaDetectada={setPlagaDetectada} />} />
              <Route path="/mercado" element={<Mercado plagaBuscada={plagaDetectada} />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Layout>
        )
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