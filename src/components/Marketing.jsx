import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, onSnapshot } from 'firebase/firestore';
import {
  Megaphone, Hash, MessageSquare, Users, Download, Copy, Check,
  Loader2, Plus, Trash2, ExternalLink, Search, X, FileText,
  Send, BarChart3, Target, Zap, Facebook
} from 'lucide-react';
import FacebookBot from './FacebookBot';

const HASHTAGS_DEFAULT = [
  { tag: '#agriculturaPeru', activo: true },
  { tag: '#campesinos', activo: true },
  { tag: '#cultivos', activo: true },
  { tag: '#papa', activo: true },
  { tag: '#maiz', activo: true },
  { tag: '#agro', activo: true },
  { tag: '#siembra', activo: true },
  { tag: '#agricultura', activo: true },
  { tag: '#campo', activo: true },
  { tag: '#plagas', activo: true },
  { tag: '#enfermedadesPlanta', activo: true },
  { tag: '#fertilizantes', activo: false },
  { tag: '#agroquimicos', activo: false },
  { tag: '#palta', activo: true },
  { tag: '#arandano', activo: true },
  { tag: '#canadeazucar', activo: true },
  { tag: '#platanos', activo: true },
  { tag: '#papaya', activo: true },
];

const PLANTILLAS_MENSAJE = [
  {
    id: 'plagas',
    titulo: 'Plagas detectadas',
    emoji: '🐛',
    mensaje: 'Hola {nombre}, vi tu publicación sobre plagas en {cultivo}. ¿Sabías que puedes diagnosticarlas con solo una foto? 📸 Descarga Agrilux: {link}',
    hashtags: ['#plagas', '#agriculturaPeru']
  },
  {
    id: 'enfermedades',
    titulo: 'Enfermedades fúngicas',
    emoji: '🦠',
    mensaje: 'Hola {nombre}, las enfermedades fúngicas pueden arruinar tu cosecha. Detecta plagas y enfermedades con IA en Agrilux. ¡Es gratis! 🌱 {link}',
    hashtags: ['#enfermedadesPlanta', '#cultivos']
  },
  {
    id: 'precios',
    titulo: 'Precios de insumos',
    emoji: '💰',
    mensaje: 'Hola {nombre}, ¿buscas precios de insumos agrícolas? Compara precios en la tienda de Agrilux. ¡Ahorra en tu inversión! 💰 {link}',
    hashtags: ['#fertilizantes', '#agroquimicos']
  },
  {
    id: 'diagnostico',
    titulo: 'Diagnóstico IA',
    emoji: '🤖',
    mensaje: 'Hola {nombre}, ¿necesitas diagnosticar tu cultivo? Agrilux detecta plagas, enfermedades y malezas con inteligencia artificial. ¡Prueba gratis! 🤖 {link}',
    hashtags: ['#agricultura', '#campo']
  },
  {
    id: 'delivery',
    titulo: 'Delivery de insumos',
    emoji: '🏍️',
    mensaje: 'Hola {nombre}, ¿necesitas insumos agrícolas? En Agrilux tenemos delivery rápido a tu zona. ¡Pide ahora! 🏍️ {link}',
    hashtags: ['#agriculturaPeru', '#campesinos']
  }
];

export default function Marketing() {
  const [tab, setTab] = useState('hashtags');
  const [hashtags, setHashtags] = useState([]);
  const [plantillas, setPlantillas] = useState(PLANTILLAS_MENSAJE);
  const [contactos, setContactos] = useState([]);
  const [nuevoHashtag, setNuevoHashtag] = useState('');
  const [copiado, setCopiado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ hashtags: 0, plantillas: 5, contactos: 0 });

  useEffect(() => {
    const saved = localStorage.getItem('agrilux_hashtags');
    if (saved) {
      setHashtags(JSON.parse(saved));
    } else {
      setHashtags(HASHTAGS_DEFAULT);
      localStorage.setItem('agrilux_hashtags', JSON.stringify(HASHTAGS_DEFAULT));
    }

    const unsub = onSnapshot(
      query(collection(db, 'contactos_marketing'), orderBy('createdAt', 'desc')),
      snap => {
        setContactos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, []);

  useEffect(() => {
    setStats({
      hashtags: hashtags.filter(h => h.activo).length,
      plantillas: plantillas.length,
      contactos: contactos.length,
    });
  }, [hashtags, plantillas, contactos]);

  const toggleHashtag = (idx) => {
    const updated = [...hashtags];
    updated[idx].activo = !updated[idx].activo;
    setHashtags(updated);
    localStorage.setItem('agrilux_hashtags', JSON.stringify(updated));
  };

  const agregarHashtag = () => {
    if (!nuevoHashtag.trim()) return;
    const tag = nuevoHashtag.startsWith('#') ? nuevoHashtag : `#${nuevoHashtag}`;
    const updated = [...hashtags, { tag, activo: true }];
    setHashtags(updated);
    localStorage.setItem('agrilux_hashtags', JSON.stringify(updated));
    setNuevoHashtag('');
  };

  const eliminarHashtag = (idx) => {
    const updated = hashtags.filter((_, i) => i !== idx);
    setHashtags(updated);
    localStorage.setItem('agrilux_hashtags', JSON.stringify(updated));
  };

  const copiarMensaje = (plantilla) => {
    const texto = plantilla.mensaje.replace('{nombre}', '[Nombre]').replace('{cultivo}', '[Cultivo]').replace('{link}', 'https://www.vitalfarmbright.store');
    navigator.clipboard.writeText(texto);
    setCopiado(plantilla.id);
    setTimeout(() => setCopiado(null), 2000);
  };

  const copiarTodosHashtags = () => {
    const activos = hashtags.filter(h => h.activo).map(h => h.tag).join(' ');
    navigator.clipboard.writeText(activos);
    setCopiado('all');
    setTimeout(() => setCopiado(null), 2000);
  };

  const eliminarContacto = async (id) => {
    if (!confirm('¿Eliminar este contacto?')) return;
    await deleteDoc(doc(db, 'contactos_marketing', id));
  };

  const exportarContactos = () => {
    const csv = [
      'Nombre,Ubicación,Cultivo,Plataforma,Fecha',
      ...contactos.map(c => `"${c.nombre || ''}","${c.ubicacion || ''}","${c.cultivo || ''}","${c.plataforma || ''}","${c.createdAt?.toDate?.() || ''}"`)
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agrilux_contactos_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Hashtags', val: stats.hashtags, emoji: '📊', color: 'bg-blue-50 text-blue-700' },
          { label: 'Plantillas', val: stats.plantillas, emoji: '💬', color: 'bg-green-50 text-green-700' },
          { label: 'Contactos', val: stats.contactos, emoji: '👥', color: 'bg-purple-50 text-purple-700' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-3 text-center ${s.color}`}>
            <p className="text-lg">{s.emoji}</p>
            <p className="text-lg font-bold">{s.val}</p>
            <p className="text-xs opacity-70">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto scrollbar-hide">
        {[
          { id: 'hashtags', label: 'Hashtags', icon: Hash },
          { id: 'plantillas', label: 'Plantillas', icon: MessageSquare },
          { id: 'facebook', label: 'Facebook', icon: Facebook },
          { id: 'contactos', label: 'Contactos', icon: Users },
          { id: 'guia', label: 'Guía Setup', icon: FileText },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      {/* ── HASHTAGS ───────────────────────────────────────── */}
      {tab === 'hashtags' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800">Hashtags a Monitorear</h3>
            <button onClick={copiarTodosHashtags}
              className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-semibold">
              {copiado === 'all' ? <Check size={12} /> : <Copy size={12} />}
              {copiado === 'all' ? '¡Copiado!' : 'Copiar activos'}
            </button>
          </div>

          <div className="flex gap-2">
            <input value={nuevoHashtag} onChange={e => setNuevoHashtag(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && agregarHashtag()}
              placeholder="Agregar hashtag..."
              className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            <button onClick={agregarHashtag}
              className="bg-primary text-white px-4 rounded-xl text-sm font-bold">
              <Plus size={16} />
            </button>
          </div>

          <div className="space-y-1.5">
            {hashtags.map((h, idx) => (
              <div key={idx} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${h.activo ? 'bg-primary/5 border border-primary/20' : 'bg-white border border-gray-100'}`}>
                <button onClick={() => toggleHashtag(idx)}
                  className={`w-10 h-6 rounded-full transition-all flex-shrink-0 ${h.activo ? 'bg-primary' : 'bg-gray-300'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${h.activo ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
                <span className={`text-sm flex-1 ${h.activo ? 'font-semibold text-gray-800' : 'text-gray-400'}`}>{h.tag}</span>
                <button onClick={() => eliminarHashtag(idx)} className="text-gray-400 hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PLANTILLAS ─────────────────────────────────────── */}
      {tab === 'plantillas' && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-gray-800">Mensajes Predefinidos</h3>
          <p className="text-xs text-gray-500">Copia y personaliza estos mensajes para enviar a agricultores potenciales.</p>

          {plantillas.map(p => (
            <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{p.emoji}</span>
                  <h4 className="font-bold text-sm text-gray-800">{p.titulo}</h4>
                </div>
                <button onClick={() => copiarMensaje(p)}
                  className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-lg font-semibold">
                  {copiado === p.id ? <Check size={12} /> : <Copy size={12} />}
                  {copiado === p.id ? '¡Copiado!' : 'Copiar'}
                </button>
              </div>
              <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 mb-2 whitespace-pre-line">{p.mensaje}</p>
              <div className="flex flex-wrap gap-1">
                {p.hashtags.map((tag, i) => (
                  <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{tag}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── CONTACTOS ──────────────────────────────────────── */}
      {tab === 'contactos' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800">Agricultores Contactados</h3>
            <button onClick={exportarContactos}
              className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg font-semibold">
              <Download size={12} /> Exportar CSV
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : contactos.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-gray-500 text-sm">No hay contactos aún.</p>
              <p className="text-xs text-gray-400 mt-1">Los contactos aparecerán cuando uses el agente de marketing.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {contactos.map(c => (
                <div key={c.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-sm font-bold text-green-700">
                    {c.nombre?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{c.nombre || 'Sin nombre'}</p>
                    <p className="text-xs text-gray-500">{c.ubicacion || 'Sin ubicación'} · {c.cultivo || 'Sin cultivo'}</p>
                  </div>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{c.plataforma || 'N/A'}</span>
                  <button onClick={() => eliminarContacto(c.id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── FACEBOOK BOT ────────────────────────────────────── */}
      {tab === 'facebook' && <FacebookBot />}

      {/* ── GUÍA SETUP ─────────────────────────────────────── */}
      {tab === 'guia' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-800">Guía de Configuración</h3>

          {/* SendPulse */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Send size={16} className="text-blue-600" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-gray-800">SendPulse (TikTok Bot)</h4>
                <p className="text-xs text-gray-500">Auto-respuestas en comentarios de TikTok</p>
              </div>
            </div>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex gap-2">
                <span className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold flex-shrink-0">1</span>
                <p>Crea una cuenta gratis en <a href="https://sendpulse.com" target="_blank" className="text-blue-600 underline">sendpulse.com</a></p>
              </div>
              <div className="flex gap-2">
                <span className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold flex-shrink-0">2</span>
                <p>Convierte tu TikTok a cuenta Business (Configuración → Cambiar a cuenta Business)</p>
              </div>
              <div className="flex gap-2">
                <span className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold flex-shrink-0">3</span>
                <p>En SendPulse: Chatbots → Agregar bot → Selecciona TikTok</p>
              </div>
              <div className="flex gap-2">
                <span className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold flex-shrink-0">4</span>
                <p>Crea flujos de auto-respuesta usando las plantillas de la pestaña "Plantillas"</p>
              </div>
              <div className="flex gap-2">
                <span className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold flex-shrink-0">5</span>
                <p>Configura respuestas para comentarios con palabras clave: plaga, enfermedad, problema, cultivo</p>
              </div>
            </div>
            <a href="https://sendpulse.com/features/chatbot/tiktok" target="_blank"
              className="mt-3 flex items-center gap-1 text-xs text-blue-600 font-semibold">
              <ExternalLink size={12} /> Ver documentación de SendPulse
            </a>
          </div>

          {/* n8n */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <Zap size={16} className="text-green-600" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-gray-800">n8n (Automatización)</h4>
                <p className="text-xs text-gray-500">Monitoreo de hashtags y scraping de agricultores</p>
              </div>
            </div>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex gap-2">
                <span className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold flex-shrink-0">1</span>
                <p>Crea una cuenta gratuita en Google Cloud</p>
              </div>
              <div className="flex gap-2">
                <span className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold flex-shrink-0">2</span>
                <p>Crea una VM e2-micro (free tier) en us-central1</p>
              </div>
              <div className="flex gap-2">
                <span className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold flex-shrink-0">3</span>
                <p>Instala Docker y n8n con un solo comando:</p>
              </div>
              <div className="bg-gray-900 rounded-lg p-3 text-green-400 font-mono text-xs overflow-x-auto">
                docker run -d --name n8n -p 5678:5678 -e N8N_HOST=0.0.0.0 docker.n8n.io/n8nio/n8n
              </div>
              <div className="flex gap-2">
                <span className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold flex-shrink-0">4</span>
                <p>Accede a n8n en http://[IP]:5678</p>
              </div>
              <div className="flex gap-2">
                <span className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold flex-shrink-0">5</span>
                <p>Crea un workflow: HTTP Request → Filtrar → Google Sheets</p>
              </div>
            </div>
            <a href="https://n8n.io/workflows" target="_blank"
              className="mt-3 flex items-center gap-1 text-xs text-green-600 font-semibold">
              <ExternalLink size={12} /> Ver templates de n8n
            </a>
          </div>

          {/* Meta Business Suite */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Target size={16} className="text-indigo-600" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-gray-800">Meta Business Suite (Facebook)</h4>
                <p className="text-xs text-gray-500">Auto-respuestas en Facebook/Instagram</p>
              </div>
            </div>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex gap-2">
                <span className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold flex-shrink-0">1</span>
                <p>Crea una Página de Facebook para Agrilux</p>
              </div>
              <div className="flex gap-2">
                <span className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold flex-shrink-0">2</span>
                <p>Abre <a href="https://business.facebook.com" target="_blank" className="text-indigo-600 underline">Meta Business Suite</a></p>
              </div>
              <div className="flex gap-2">
                <span className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold flex-shrink-0">3</span>
                <p>Ve a Automatización → Crear automatización</p>
              </div>
              <div className="flex gap-2">
                <span className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold flex-shrink-0">4</span>
                <p>Selecciona "Cuando alguien comente en tu publicación" → Responder con mensaje</p>
              </div>
              <div className="flex gap-2">
                <span className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold flex-shrink-0">5</span>
                <p>Usa las plantillas de la pestaña "Plantillas" para los mensajes</p>
              </div>
            </div>
          </div>

          {/* WhatsApp Business */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <MessageSquare size={16} className="text-emerald-600" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-gray-800">WhatsApp Business (Outreach)</h4>
                <p className="text-xs text-gray-500">Mensajes directos a agricultores</p>
              </div>
            </div>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex gap-2">
                <span className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold flex-shrink-0">1</span>
                <p>Descarga WhatsApp Business (no la app normal)</p>
              </div>
              <div className="flex gap-2">
                <span className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold flex-shrink-0">2</span>
                <p>Configura tu perfil: "Agrilux - Diagnóstico Agrícola con IA"</p>
              </div>
              <div className="flex gap-2">
                <span className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold flex-shrink-0">3</span>
                <p>Usa mensajes rápidos con las plantillas de la pestaña "Plantillas"</p>
              </div>
              <div className="flex gap-2">
                <span className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold flex-shrink-0">4</span>
                <p>Guarda contactos en la pestaña "Contactos" para dar seguimiento</p>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-yellow-50 rounded-2xl p-4 border border-yellow-200">
            <h4 className="font-bold text-sm text-yellow-800 mb-2">💡 Tips Importantes</h4>
            <ul className="space-y-1.5 text-xs text-yellow-700">
              <li>• <strong>No hagas spam:</strong> Contacta solo agricultores que muestren interés real</li>
              <li>• <strong>Personaliza:</strong> Menciona el cultivo específico del agricultor</li>
              <li>• <strong>Sé breve:</strong> Mensajes de máximo 2-3 líneas</li>
              <li>• <strong>Incluye link:</strong> Siempre comparte el link de Agrilux</li>
              <li>• <strong>Da seguimiento:</strong> Marca quiénes respondieron en la pestaña Contactos</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
