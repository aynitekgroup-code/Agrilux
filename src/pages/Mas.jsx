import React, { useEffect, useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, LogOut, Shield, Save, ArrowLeft, Phone } from 'lucide-react';
import { WHATSAPP } from '../lib/constants';

export default function Mas() {
  const { user, logout, updatePerfil } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre: user?.nombre || '',
    ubicacion: user?.ubicacion || '',
    whatsapp: user?.whatsapp || '',
  });

  useEffect(() => {
    setForm({
      nombre: user?.nombre || '',
      ubicacion: user?.ubicacion || '',
      whatsapp: user?.whatsapp || '',
    });
  }, [user]);

  const redes = [
    { nombre: 'YouTube', desc: 'Videos de especialistas en cultivos', emoji: '📹', color: 'bg-red-500', url: 'https://youtube.com/@agrilux' },
    { nombre: 'TikTok', desc: 'Tips rápidos de agricultura', emoji: '🎵', color: 'bg-black', url: 'https://tiktok.com/@agrilux' },
    { nombre: 'Facebook', desc: 'Comunidad y noticias', emoji: '📘', color: 'bg-blue-600', url: 'https://facebook.com/agrilux' },
    { nombre: 'Instagram', desc: 'Fotos e historias de campo', emoji: '📸', color: 'bg-pink-500', url: 'https://instagram.com/agrilux' },
    { nombre: 'LinkedIn', desc: 'Red profesional agrícola', emoji: '💼', color: 'bg-blue-700', url: 'https://linkedin.com/company/agrilux' },
  ];

  const handleGuardar = async () => {
    try {
      setSaving(true);
      await updatePerfil({
        nombre: form.nombre,
        ubicacion: form.ubicacion,
        whatsapp: form.whatsapp,
      });
    } finally {
      setSaving(false);
    }
  };

  const whatsappNumero = user?.whatsapp ? `+${user.whatsapp.replace(/^51/, '51 ')}` : 'No registrado';

  return (
    <div className="min-h-screen pb-24 bg-[#0b1220] text-white">
      <div className="px-4 pt-5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/90">
            <ArrowLeft size={16} /> Volver
          </button>
          <button onClick={logout} className="inline-flex items-center gap-2 rounded-xl border border-orange-400/40 bg-orange-500/10 px-3 py-2 text-sm font-semibold text-orange-200">
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#111a2d] p-6 shadow-2xl shadow-black/30">
          <div className="flex items-center justify-center mb-6">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#f3c14f] text-4xl font-black text-[#1a1f2d] shadow-lg shadow-yellow-400/20">
              {user?.nombre?.[0]?.toUpperCase() || 'U'}
            </div>
          </div>

          <div className="text-center mb-6">
            <p className="text-2xl font-bold text-white">{user?.nombre || 'Usuario'}</p>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-sm text-yellow-300">
              <span>👑</span> Admin
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Nombres</label>
              <input
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-[#1a2438] px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-yellow-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Ubicación</label>
              <input
                value={form.ubicacion}
                onChange={e => setForm(f => ({ ...f, ubicacion: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-[#1a2438] px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-yellow-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">WhatsApp</label>
              <input
                value={form.whatsapp}
                onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
                placeholder="Ej: 987654321"
                className="w-full rounded-xl border border-white/10 bg-[#1a2438] px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-yellow-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Correo electrónico</label>
              <input
                value={user?.email || ''}
                readOnly
                className="w-full rounded-xl border border-white/10 bg-[#1a2438] px-4 py-3 text-base text-slate-400"
              />
            </div>

            {user?.whatsapp && (
              <a
                href={`https://wa.me/${user.whatsapp}?text=${encodeURIComponent('Hola, quería contactarte desde Agrilux.')}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200"
              >
                <Phone size={16} /> {whatsappNumero}
              </a>
            )}
          </div>

          <button
            onClick={handleGuardar}
            disabled={saving}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-[#f3c14f] px-5 py-4 text-lg font-bold text-[#1a1f2d] shadow-lg shadow-yellow-500/20 transition hover:brightness-105 disabled:opacity-70"
          >
            <Save size={20} /> {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>

        <div className="mt-6 rounded-[28px] border border-white/10 bg-[#111a2d] p-4 shadow-xl shadow-black/20">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Soporte</p>
          <button onClick={() => window.open(`https://wa.me/${WHATSAPP}?text=Hola Agrilux, necesito ayuda`, '_blank')} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left">
            <span className="text-xl">📲</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">WhatsApp Agrilux</p>
              <p className="text-xs text-slate-400">+51 935 211 605</p>
            </div>
            <ExternalLink size={16} className="text-slate-400" />
          </button>
        </div>

        <div className="mt-6 rounded-[28px] border border-white/10 bg-[#111a2d] p-4 shadow-xl shadow-black/20">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Nuestras Redes</p>
          <div className="space-y-2">
            {redes.map(r => (
              <button key={r.nombre} onClick={() => window.open(r.url, '_blank')} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${r.color} text-lg`}>
                  {r.emoji}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">{r.nombre}</p>
                  <p className="text-xs text-slate-400">{r.desc}</p>
                </div>
                <ExternalLink size={14} className="text-slate-400" />
              </button>
            ))}
          </div>
        </div>

        {user?.tipo === 'admin' && (
          <button onClick={() => navigate('/admin')} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-800 px-4 py-3 text-sm font-bold text-white">
            <Shield size={18} /> Panel de Administrador
          </button>
        )}

        <p className="mt-6 text-center text-xs text-slate-500">Agrilux v1.0 · Agricultura Inteligente del Perú</p>
      </div>
    </div>
  );
}
