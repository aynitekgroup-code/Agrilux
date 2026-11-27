import React, { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { AgentProvider } from './lib/AgentContext';
import { useExperienceType } from './lib/useExperienceType';
import { puedeVerInvernadero, soloModuloGestion } from './lib/alcanceNavegacion';
import WebLayout from './components/layout/WebLayout';
import MobileLayout from './components/layout/MobileLayout';
import SelectorUbicacion from './components/SelectorUbicacion';
import Registro from './pages/Registro';
import RegistroEmpresaNueva from './pages/RegistroEmpresaNueva';
import RegistroUnirse from './pages/RegistroUnirse';
import RegistroInvitar from './pages/RegistroInvitar';
import RegistroSolicitudEnviada from './pages/RegistroSolicitudEnviada';
import EmpresaMiembros from './pages/EmpresaMiembros';
import Bienvenida from './pages/Bienvenida';
import { Clock, Mail, LogOut, Building } from 'lucide-react';

/**
 * ExperienceLayout — elige el layout según el entorno detectado.
 * WebLayout (escritorio) o MobileLayout (PWA/Capacitor/móvil).
 * No participa en auth ni permisos: solo presentación.
 */
function ExperienceLayout({ children }) {
  const experience = useExperienceType();
  return experience === 'mobile' ? (
    <MobileLayout>{children}</MobileLayout>
  ) : (
    <WebLayout>{children}</WebLayout>
  );
}

const Diagnostico = lazy(() => import('./modules/diagnostico/DiagnosticoPage'));
const MiParcela = lazy(() => import('./modules/parcela/ParcelaPage'));
const CicloCultivo = lazy(() => import('./modules/ciclo/CicloPage'));
const Gestion = lazy(() => import('./modules/gestion/GestionPage'));
const Invernadero = lazy(() => import('./modules/invernadero/InvernaderoPage'));
const AgroTrackPomalca = lazy(() => import('./modules/gestion/AgroTrackPomalcaPage'));
const Admin = lazy(() => import('./pages/admin/Admin'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const Descargar = lazy(() => import('./pages/Descargar'));
const EliminarCuenta = lazy(() => import('./pages/EliminarCuenta'));

// Solo cambia el destino de inicio; la membresía y los permisos siguen vigentes.
function Inicio() {
  const { user, loading, isAprobado, empresas_disponibles, empresasCargadasUsuario, empresa_activa_id, setEmpresaActiva } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const pomalca = empresas_disponibles.find((empresa) => String(empresa.nombre || '').trim().toLowerCase() === 'pomalca');
  const listaCargada = !user || empresasCargadasUsuario === user.uid;
  useEffect(() => {
    if (loading || !user || !isAprobado || !listaCargada || !pomalca) return;
    let cancelado = false;
    async function abrirMapa() {
      if (empresa_activa_id !== pomalca.id) {
        const cambiado = await setEmpresaActiva(pomalca.id);
        if (cancelado) return;
        if (!cambiado) { setError('No se pudo seleccionar Pomalca. Ingresa a Gestión y selecciona la empresa.'); return; }
      }
      if (!cancelado) navigate('/gestion/vehiculos-flota', { replace: true });
    }
    abrirMapa();
    return () => { cancelado = true; };
  }, [loading, user?.uid, isAprobado, listaCargada, pomalca?.id, empresa_activa_id, navigate]);
  if (error) return <div role="alert" className="p-6 text-red-700">{error}</div>;
  if (loading || (user && isAprobado && (!listaCargada || pomalca))) return <div className="p-6 text-center text-green-700" role="status">Abriendo tu mapa…</div>;
  return <Bienvenida />;
}

/**
 * Pomalca: los módulos fuera de Gestión (Diagnóstico, Ciclo, Parcela) no están
 * habilitados y redirigen al mapa de la flota. Las demás empresas no se ven
 * afectadas. El administrador del sistema conserva el acceso completo.
 */
function RutaSoloGestion({ children }) {
  const { user, empresa_activa_id, empresas_disponibles } = useAuth();
  const soloGestion = soloModuloGestion({
    empresa_activa_id,
    empresas_disponibles,
    email: user?.email,
  });
  if (soloGestion) return <Navigate to="/gestion/vehiculos-flota" replace />;
  return children;
}

function RutaInvernadero() {
  const { user, isAprobado, empresa_activa_id, empresas_disponibles, empresasCargadasUsuario } = useAuth();
  if (!user) return <Navigate to="/registro" replace />;
  if (!isAprobado) return <PantallaPendiente />;
  if (empresasCargadasUsuario !== user.uid) return <div role="status" className="p-6">Comprobando acceso…</div>;
  if (!puedeVerInvernadero({ user, empresa_activa_id, empresas_disponibles, empresasCargadasUsuario })) return <Navigate to="/gestion" replace />;
  return <Invernadero />;
}

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
              <p className="text-sm font-semibold text-gray-800">{user?.nombre}</p>
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

// Guard: verifica empresa activa antes de mostrar rutas de empresa
function EmpresaGuard({ children }) {
  const { user, empresa_activa_id, empresas_disponibles, setEmpresaActiva } = useAuth();
  const navigate = useNavigate();

  if (!user) return <Navigate to="/registro" replace />;

  if (!empresa_activa_id) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 text-center">
          <Building size={32} className="text-blue-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800">Selecciona una empresa</h2>
          <p className="text-gray-600 text-sm mt-2">Selecciona una empresa para continuar.</p>
          {empresas_disponibles && empresas_disponibles.length > 0 ? (
            <select
              value={empresas_disponibles[0]?.id || ''}
              onChange={(e) => setEmpresaActiva(e.target.value)}
              className="w-full mt-4 px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
            >
              <option value="">Seleccionar empresa</option>
              {empresas_disponibles.map((e) => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
          ) : (
            <p className="mt-4 text-xs text-gray-500">No perteneces a ninguna empresa aún.</p>
          )}
          <button
            onClick={() => navigate('/registro/empresa-nueva')}
            className="mt-6 bg-primary text-white font-bold py-3 rounded-xl w-full hover:bg-[#14522e] transition-colors"
          >
            Ir al registro
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading, isAprobado } = useAuth();
  const location = useLocation();
  const [plagaDetectada, setPlagaDetectada] = useState('');
  const [selectorMostrado, setSelectorMostrado] = useState(() => {
    try {
      return localStorage.getItem('agrilux_selector_mostrado') === '1';
    } catch {
      return false;
    }
  });

  let ubicacionGuardada = false;
  try {
    const ubicacionLocal = user?.ubicacion || localStorage.getItem('agrilux_ubicacion') || '';
    ubicacionGuardada = Boolean(String(ubicacionLocal).trim());
  } catch {
    ubicacionGuardada = Boolean(String(user?.ubicacion || '').trim());
  }

  useEffect(() => {
    if (ubicacionGuardada) {
      try {
        localStorage.setItem('agrilux_selector_mostrado', '1');
      } catch {}
      setSelectorMostrado(true);
    }
  }, [ubicacionGuardada]);

  useEffect(() => {
    if (user && !ubicacionGuardada && !selectorMostrado) {
      try {
        localStorage.setItem('agrilux_selector_mostrado', '1');
      } catch {}
      setSelectorMostrado(true);
    }
  }, [user, ubicacionGuardada, selectorMostrado]);

  if (location.pathname === '/') return <Inicio />;

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

  // Public routes — always accessible (sin layout)
  const publicPaths = ['/admin', '/privacy', '/descargar'];
  if (publicPaths.includes(location.pathname)) {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full animate-spin" /></div>}>
        <Routes>
          <Route path="/admin" element={<Admin />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/descargar" element={<Descargar />} />
        </Routes>
      </Suspense>
    );
  }

  // Logged in, no location → selector (solo una vez por sesión/usuario hasta guardar ubicación)
  if (user && !ubicacionGuardada && !selectorMostrado) {
    return <SelectorUbicacion esPrimeraVez={true} />;
  }

  // ── RUTAS PRINCIPALES ──
  // Diagnóstico: SIEMPRE accesible (con o sin login)
  // Parcela y Ciclo: requieren login + aprobación
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full animate-spin" /></div>}>
      <Routes>
        <Route path="/registro" element={<Registro />} />
        <Route path="/registro/empresa-nueva" element={<RegistroEmpresaNueva />} />
        <Route path="/registro/unirse" element={<RegistroUnirse />} />
        <Route path="/registro/invitar" element={<RegistroInvitar />} />
        <Route path="/registro/solicitud-enviada" element={<RegistroSolicitudEnviada />} />
        <Route path="/eliminar-cuenta" element={
          user ? <EliminarCuenta /> : <Navigate to="/registro" replace />
        } />

      <Route path="*" element={
        <ExperienceLayout>
          <Routes>
            {/* Diagnóstico — siempre accesible (excepto Pomalca: solo Gestión) */}
            <Route path="/diagnostico" element={
              <RutaSoloGestion><Diagnostico onPlagaDetectada={setPlagaDetectada} /></RutaSoloGestion>
            } />

            {/* Parcela — requiere login + aprobación */}
            <Route path="/parcela" element={
              <RutaSoloGestion>
                {user && isAprobado ? <MiParcela /> : user ? <PantallaPendiente /> : <Navigate to="/registro" />}
              </RutaSoloGestion>
            } />

            {/* Ciclo — requiere login + aprobación */}
            <Route path="/ciclo" element={
              <RutaSoloGestion>
                {user && isAprobado ? <CicloCultivo /> : user ? <PantallaPendiente /> : <Navigate to="/registro" />}
              </RutaSoloGestion>
            } />

            {/* Gestión — requiere login + aprobación */}
            <Route path="/gestion" element={
              user && isAprobado ? <Gestion /> : user ? <PantallaPendiente /> : <Navigate to="/registro" />
            } />
            <Route path="/invernadero" element={<RutaInvernadero />} />
            <Route path="/gestion/sensores-agricolas" element={
              user && isAprobado ? <AgroTrackPomalca /> : user ? <PantallaPendiente /> : <Navigate to="/registro" />
            } />
            <Route path="/gestion/vehiculos-flota" element={
              user && isAprobado ? <AgroTrackPomalca /> : user ? <PantallaPendiente /> : <Navigate to="/registro" />
            } />
            <Route path="/gestion/reportes" element={
              user && isAprobado ? <Navigate to="/gestion/vehiculos-flota?section=reportes" replace /> : user ? <PantallaPendiente /> : <Navigate to="/registro" />
            } />
            <Route path="/gestion/finanzas" element={<Navigate to="/gestion" replace />} />
            <Route path="/empresa/miembros" element={
              <EmpresaGuard>
                <EmpresaMiembros />
              </EmpresaGuard>
            } />
            <Route path="/empresa/plan" element={<Navigate to="/empresa/miembros" replace />} />

            {/* Mercado desactivado: las rutas antiguas vuelven al diagnóstico */}
            <Route path="/mercado" element={<Navigate to="/" replace />} />
            <Route path="/ofertas" element={<Navigate to="/" replace />} />
            <Route path="/voz" element={<Navigate to="/" replace />} />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </ExperienceLayout>
      } />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1));
      const type = params.get('type');
      window.history.replaceState(null, '', window.location.pathname);
      if (type === 'recovery') {
        window.location.replace('/registro?mode=reset');
      } else {
        window.location.replace('/');
      }
    }
  }, []);

  return (
    <AuthProvider>
      <AgentProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AgentProvider>
    </AuthProvider>
  );
}
