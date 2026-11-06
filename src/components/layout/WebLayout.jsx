/**
 * src/components/layout/WebLayout.jsx
 *
 * Experiencia web (escritorio) de Agrilux.
 * Sidebar lateral + header superior + área de contenido amplia.
 * Orientado a gerentes, administradores, ingenieros y supervisores.
 *
 * Comparte AuthContext, permisos, OnlineStatus, AgentStatus y modales
 * con MobileLayout. No duplica lógica de negocio.
 */

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Camera,
  Leaf,
  Calendar,
  ClipboardList,
  LogOut,
  MapPin,
  Shield,
  User,
  Key,
  Download,
  BookOpen,
  Trash2,
  ChevronDown,
  Users,
  Building,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import OnlineStatus from '../OnlineStatus';
import AgentStatus from '../AgentStatus';
import { AdminAccessModal, ChangePasswordModal, LocationSelectorModal } from './SharedModals';

const navItems = [
  { path: '/', icon: Camera, label: 'Diagnóstico' },
  { path: '/ciclo', icon: Calendar, label: 'Ciclo' },
  { path: '/parcela', icon: Leaf, label: 'Parcela' },
  { path: '/gestion', icon: ClipboardList, label: 'Gestión' },
];

const ADMIN_EMAIL = 'aynitek.group@gmail.com';

export default function WebLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, empresa_activa_id, empresas_disponibles, setEmpresaActiva } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mostrarUbicacion, setMostrarUbicacion] = useState(false);
  const [adminModal, setAdminModal] = useState(false);
  const [modalClave, setModalClave] = useState(false);
  const [empresaModalOpen, setEmpresaModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const esAdmin = user?.email === ADMIN_EMAIL;

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    navigate('/');
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <OnlineStatus />

      <div className="flex flex-1 min-h-0">
        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <aside
          className={`hidden md:flex shrink-0 bg-white border-r border-gray-200 flex-col sticky top-0 h-screen transition-[width] duration-300 ease-in-out ${
            sidebarOpen ? 'w-64' : 'w-20'
          }`}
        >
        {/* Identidad */}
        <div className={`py-5 border-b border-gray-100 flex items-center ${sidebarOpen ? 'px-5 justify-between' : 'px-4 justify-center'}`}>
          {sidebarOpen && (
            <img
              src="/icons/Agrilux.logo.web.png"
              alt="Logo Agrilux"
              className="h-16 w-auto shrink-0 object-contain"
            />
          )}
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label={sidebarOpen ? 'Colapsar menú lateral' : 'Expandir menú lateral'}
            aria-expanded={sidebarOpen}
            title={sidebarOpen ? 'Colapsar menú lateral' : 'Expandir menú lateral'}
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <span className="absolute inset-1 rounded-full border border-primary/20" aria-hidden="true" />
            {sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
          </button>
        </div>

        {/* Navegación */}
        <nav className={`flex-1 py-4 space-y-1 overflow-y-auto ${sidebarOpen ? 'px-3' : 'px-2'}`}>
          {navItems.map(({ path, icon: Icon, label }) => {
            const active = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
            return (
              <button
                key={path}
                onClick={() => {
                  if (!user && (path === '/parcela' || path === '/ciclo' || path === '/gestion')) {
                    navigate('/registro');
                  } else {
                    navigate(path);
                  }
                }}
                title={!sidebarOpen ? label : undefined}
                className={`w-full flex items-center rounded-lg text-sm font-medium transition-colors ${
                  sidebarOpen ? 'gap-3 px-3' : 'justify-center px-2'
                } py-2.5 ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
                {sidebarOpen && label}
              </button>
            );
          })}
        </nav>

        {/* Usuario en sidebar */}
        <div className={`py-4 border-t border-gray-100 ${sidebarOpen ? 'px-4' : 'px-2'}`}>
          {sidebarOpen ? (
            <>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                  <User size={16} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {user?.nombre || 'Invitado'}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{user?.email || 'Sin sesión'}</p>
                </div>
              </div>

              {/* Selector de empresa */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-700 uppercase mb-2">Empresa activa</p>
                <div className="space-y-2">
                  <button
                    onClick={() => setEmpresaModalOpen(true)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm text-gray-700 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Building size={14} className="text-primary" />
                      <span className="truncate w-full">
                        {empresa_activa_id
                          ? empresas_disponibles?.find((e) => e.id === empresa_activa_id)?.nombre || 'Cargando...'
                          : 'Seleccionar empresa'}
                      </span>
                    </span>
                    <ChevronDown size={14} className="text-gray-400" />
                  </button>
                  {empresas_disponibles && empresas_disponibles.length > 0 && (
                    <div className="ml-4 space-y-1">
                      {empresas_disponibles.map((empresa) => (
                        <button
                          key={empresa.id}
                          onClick={() => {
                            setEmpresaActiva(empresa.id);
                            setEmpresaModalOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                            empresa_activa_id === empresa.id
                              ? 'bg-primary/10 text-primary border border-primary/20'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <span className="truncate">{empresa.nombre}</span>
                          {empresa_activa_id === empresa.id && (
                            <span className="text-xs font-bold text-primary">Activa</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {empresas_disponibles && empresas_disponibles.length === 0 && (
                    <div className="px-3 py-2.5 rounded-lg bg-gray-50 text-sm text-gray-500">
                      No perteneces a ninguna empresa aún
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => navigate('/descargar')}
                className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#1a6b3c] text-white rounded-lg text-xs font-bold hover:bg-[#14522e] transition-colors"
              >
                <Download size={14} /> Descargar app
              </button>
            </>
          ) : (
            <div className="flex justify-center">
              <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center" title={user?.nombre || 'Invitado'}>
                <User size={16} className="text-primary" />
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Contenido principal ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header superior */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40 px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-base font-semibold text-gray-800 truncate">
              {navItems.find((i) =>
                i.path === '/' ? location.pathname === '/' : location.pathname.startsWith(i.path)
              )?.label || 'Agrilux'}
            </h1>
            {user?.ubicacion && (
              <span className="hidden lg:flex items-center gap-1 text-xs text-gray-400 truncate">
                <MapPin size={12} /> {user.ubicacion}
              </span>
            )}
          </div>

          <div className="relative flex items-center gap-2">
            <button
              onClick={() => navigate('/descargar')}
              title="Descargar app sin Play Store"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#1a6b3c] text-white rounded-full text-xs font-bold hover:bg-[#14522e] transition-colors"
            >
              <Download size={14} /> Descargar
            </button>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors text-sm text-gray-700"
            >
              <span className="hidden md:inline truncate max-w-[140px]">
                {user?.nombre || 'Menú'}
              </span>
              <ChevronDown size={16} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute top-full right-0 mt-2 w-60 max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain bg-white rounded-lg shadow-lg border border-gray-100 z-50">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setMostrarUbicacion(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-primary/5 hover:text-primary transition-colors text-sm font-medium rounded-lg"
                  >
                    <MapPin size={18} />
                    Cambiar ubicación
                  </button>
                  {user && (
                    <>
                      <div className="border-t border-gray-100 pt-3 mb-2"></div>
                      <h3 className="text-xs font-bold text-gray-500 uppercase mb-2 px-4">Empresa</h3>
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          navigate('/empresa/miembros');
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-primary/5 hover:text-primary transition-colors text-sm font-medium rounded-lg"
                      >
                        <Users size={18} />
                        Miembros de empresa
                      </button>
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          navigate('/empresa/plan');
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-primary/5 hover:text-primary transition-colors text-sm font-medium rounded-lg"
                      >
                        <Shield size={18} />
                        Mi membresía
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('/descargar');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-primary/5 hover:text-primary transition-colors text-sm font-medium rounded-lg"
                  >
                    <Download size={18} />
                    Descargar app
                    <span className="ml-auto text-[10px] font-black bg-[#1a6b3c] text-white px-1.5 py-0.5 rounded">
                      SIN PLAY STORE
                    </span>
                  </button>
                  <a
                    href="/icons/Manual_de_uso_Agrilux_mejorado.pdf"
                    onClick={() => setMenuOpen(false)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-primary/5 hover:text-primary transition-colors text-sm font-medium rounded-lg"
                  >
                    <BookOpen size={18} />
                    Manual usuario
                  </a>
                  {user && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        navigate('/eliminar-cuenta');
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors text-sm font-medium rounded-lg"
                    >
                      <Trash2 size={18} />
                      Eliminar cuenta
                    </button>
                  )}
                  {user ? (
                    <>
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          setModalClave(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-amber-50 hover:text-amber-700 transition-colors text-sm font-medium rounded-lg"
                      >
                        <Key size={18} />
                        Cambiar contraseña
                      </button>
                      {esAdmin && (
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            setAdminModal(true);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors text-sm font-medium rounded-lg"
                        >
                          <Shield size={18} />
                          Actuar como administrador
                        </button>
                      )}
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors text-sm font-medium rounded-lg"
                      >
                        <LogOut size={18} />
                        Cerrar sesión
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        navigate('/registro');
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-primary hover:bg-primary/5 transition-colors text-sm font-medium rounded-lg"
                    >
                      <User size={18} />
                      Iniciar sesión
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </header>

        {/* Área de contenido */}
        <main className="flex-1 px-6 py-5 overflow-y-auto">
          <div className="w-full max-w-none">
            <div className="mb-4">
              <AgentStatus />
            </div>
            {children}
          </div>
        </main>
      </div>
      </div>

      {/* ── Modales compartidos ─────────────────────────────────── */}
      <LocationSelectorModal open={mostrarUbicacion} onClose={() => setMostrarUbicacion(false)} />
      <AdminAccessModal open={adminModal} onClose={() => setAdminModal(false)} />
      <ChangePasswordModal open={modalClave} onClose={() => setModalClave(false)} initialEmail={user?.email || ''} />
    </div>
  );
}
