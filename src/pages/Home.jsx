import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { Camera, Leaf, Calendar } from 'lucide-react';

const modules = [
  { path: '/diagnostico', icon: Camera, label: 'Diagnóstico IA', desc: 'Identifica plagas y enfermedades', color: 'bg-blue-500', emoji: '🔬' },
  { path: '/ciclo', icon: Calendar, label: 'Ciclo del Cultivo', desc: 'Calendario y recomendaciones', color: 'bg-amber-500', emoji: '📅', requiresAuth: true },
  { path: '/parcela', icon: Leaf, label: 'Mi Parcela', desc: 'Clima, suelo y más', color: 'bg-emerald-500', emoji: '🌱' },
];

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-primary text-white px-6 pt-12 pb-8 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full" />
        <div className="absolute -right-4 top-12 w-20 h-20 bg-white/5 rounded-full" />
        <div className="relative z-10">
          <p className="text-white/70 text-sm">Bienvenido,</p>
          <h1 className="text-2xl font-display font-bold">{user?.nombre?.split(' ')[0]} 👋</h1>
          <p className="text-white/60 text-xs mt-1">{user?.ubicacion}</p>
        </div>
      </div>

      {/* Módulos */}
      <div className="px-4">
        <h2 className="font-display font-bold text-gray-800 mb-4">¿Qué deseas hacer?</h2>
        <div className="grid grid-cols-2 gap-3">
          {modules.map(({ path, icon: Icon, label, desc, color, emoji, disabled, requiresAuth }) => (
            <button key={path} onClick={() => {
              if (disabled) return;
              if (requiresAuth && !user) { navigate('/registro'); return; }
              navigate(path);
            }}
              className={`bg-white rounded-2xl p-4 text-left shadow-sm border border-gray-100 transition-all ${
                disabled ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-md hover:border-primary/20 active:scale-95'
              }`}>
              <div className={`${color} w-10 h-10 rounded-xl flex items-center justify-center mb-3`}>
                <span className="text-xl">{emoji}</span>
              </div>
              <p className="font-bold text-gray-800 text-sm">{label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              {disabled && <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full mt-2 inline-block">Próximamente</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
