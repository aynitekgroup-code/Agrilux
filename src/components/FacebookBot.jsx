import React, { useState, useEffect } from 'react';
import {
  Facebook, Send, Loader2, Check, Copy, ExternalLink, Image,
  Clock, Trash2, Plus, RefreshCw, AlertCircle, FileText, Zap
} from 'lucide-react';

const PLANTILLAS_FACEBOOK = [
  {
    id: 'diagnostico',
    titulo: 'Diagnóstico IA',
    emoji: '🤖',
    mensaje: '🌱 ¿Tu cultivo tiene problemas? Sube una foto y nuestra IA detecta plagas, enfermedades y malezas al instante.\n\n✅ Gratis\n✅ Funciona sin internet\n✅ 7 cultivos disponibles\n\nDescárgalo ahora: vitalfarmbright.store',
    imagen: null
  },
  {
    id: 'plagas',
    titulo: 'Alerta de plagas',
    emoji: '🐛',
    mensaje: '⚠️ ¿Ves manchas extrañas en tus hojas? No esperes a que se propague.\n\nCon Agrilux puedes diagnosticar plagas y enfermedades con solo una foto. 📸\n\n🚀 Prueba gratis: vitalfarmbright.store',
    imagen: null
  },
  {
    id: 'tips',
    titulo: 'Tip agrícola',
    emoji: '💡',
    mensaje: '💡 TIP PARA AGRICULTORES:\n\n¿Sabías que el 60% de las pérdidas en cultivos se pueden prevenir con detección temprana?\n\nAgrilux te ayuda a detectar problemas antes de que sea tarde. 🌿\n\nDescárgalo: vitalfarmbright.store',
    imagen: null
  },
  {
    id: 'testimonio',
    titulo: 'Testimonio',
    emoji: '⭐',
    mensaje: '⭐ "Agrilux me salvó mi cosecha de papa. Detecté la polilla a tiempo y pude actuar antes de que se propagara." — Agricultor de Cutervo\n\nTú también puedes proteger tus cultivos. 💪\n\nDescárgalo gratis: vitalfarmbright.store',
    imagen: null
  },
  {
    id: 'delivery',
    titulo: 'Delivery de insumos',
    emoji: '🏍️',
    mensaje: '🏍️ ¡Novedad! Ahora puedes pedir insumos agrícolas con delivery directo a tu zona.\n\nFertilizantes, fungicidas, semillas y más. 🌾\n\nHaz tu pedido en Agrilux: vitalfarmbright.store',
    imagen: null
  },
  {
    id: 'pregunta',
    titulo: 'Pregunta interactiva',
    emoji: '❓',
    mensaje: '❓ ¿Cuál es el mayor problema de tu cultivo este mes?\n\n🦠 Enfermedades fúngicas\n🐛 Plagas e insectos\n🌿 Malezas\n💧 Riego\n\nComenta y te ayudamos a diagnosticarlo con Agrilux. 🤖',
    imagen: null
  }
];

export default function FacebookBot() {
  const [token, setToken] = useState('');
  const [pageId, setPageId] = useState('');
  const [connected, setConnected] = useState(false);
  const [pageName, setPageName] = useState('');
  const [plantillas, setPlantillas] = useState(PLANTILLAS_FACEBOOK);
  const [publicando, setPublicando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [publicaciones, setPublicaciones] = useState([]);
  const [tab, setTab] = useState('config');
  const [customMessage, setCustomMessage] = useState('');
  const [customImage, setCustomImage] = useState('');
  const [scheduled, setScheduled] = useState([]);
  const [copiado, setCopiado] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('agrilux_fb_config');
    if (saved) {
      const config = JSON.parse(saved);
      setToken(config.token || '');
      setPageId(config.pageId || '');
      if (config.token && config.pageId) {
        verificarConexion(config.token, config.pageId);
      }
    }
    const savedPubs = localStorage.getItem('agrilux_fb_publicaciones');
    if (savedPubs) setPublicaciones(JSON.parse(savedPubs));
    const savedSchedule = localStorage.getItem('agrilux_fb_schedule');
    if (savedSchedule) setScheduled(JSON.parse(savedSchedule));
  }, []);

  const verificarConexion = async (t, pid) => {
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${pid}?fields=name&access_token=${t}`);
      const data = await res.json();
      if (data.name) {
        setConnected(true);
        setPageName(data.name);
      } else {
        setConnected(false);
      }
    } catch {
      setConnected(false);
    }
  };

  const guardarConfig = () => {
    localStorage.setItem('agrilux_fb_config', JSON.stringify({ token, pageId }));
    verificarConexion(token, pageId);
  };

  const publicar = async (mensaje, imagen = null) => {
    if (!connected) { setResultado({ ok: false, msg: 'No conectado a Facebook' }); return; }
    setPublicando(true);
    setResultado(null);
    try {
      let url, body;
      if (imagen) {
        url = `https://graph.facebook.com/v19.0/${pageId}/photos`;
        body = new FormData();
        body.append('message', mensaje);
        body.append('url', imagen);
        body.append('access_token', token);
      } else {
        url = `https://graph.facebook.com/v19.0/${pageId}/feed`;
        body = new URLSearchParams({ message: mensaje, access_token: token });
      }
      const res = await fetch(url, { method: 'POST', body });
      const data = await res.json();
      if (data.id) {
        setResultado({ ok: true, msg: '¡Publicado exitosamente!', id: data.id });
        const pub = { id: data.id, mensaje: mensaje.slice(0, 100), fecha: new Date().toISOString(), imagen: !!imagen };
        const updated = [pub, ...publicaciones];
        setPublicaciones(updated);
        localStorage.setItem('agrilux_fb_publicaciones', JSON.stringify(updated));
      } else {
        setResultado({ ok: false, msg: data.error?.message || 'Error al publicar' });
      }
    } catch (err) {
      setResultado({ ok: false, msg: err.message });
    }
    setPublicando(false);
  };

  const programarPublicacion = (plantilla, fecha) => {
    const sched = { ...plantilla, fechaProgramada: fecha, estado: 'programada' };
    const updated = [...scheduled, sched];
    setScheduled(updated);
    localStorage.setItem('agrilux_fb_schedule', JSON.stringify(updated));
  };

  const eliminarProgramada = (idx) => {
    const updated = scheduled.filter((_, i) => i !== idx);
    setScheduled(updated);
    localStorage.setItem('agrilux_fb_schedule', JSON.stringify(updated));
  };

  const copiarToken = () => {
    navigator.clipboard.writeText(token);
    setCopiado('token');
    setTimeout(() => setCopiado(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Estado', val: connected ? 'Conectado' : 'Desconectado', emoji: connected ? '✅' : '❌', color: connected ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700' },
          { label: 'Publicaciones', val: publicaciones.length, emoji: '📢', color: 'bg-blue-50 text-blue-700' },
          { label: 'Programadas', val: scheduled.length, emoji: '⏰', color: 'bg-purple-50 text-purple-700' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-3 text-center ${s.color}`}>
            <p className="text-lg">{s.emoji}</p>
            <p className="text-xs font-bold">{s.val}</p>
            <p className="text-xs opacity-70">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto scrollbar-hide">
        {[
          { id: 'config', label: 'Config', icon: Zap },
          { id: 'publicar', label: 'Publicar', icon: Send },
          { id: 'programar', label: 'Programar', icon: Clock },
          { id: 'historial', label: 'Historial', icon: FileText },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      {/* ── CONFIG ──────────────────────────────────────────── */}
      {tab === 'config' && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-gray-800">Conectar Facebook</h3>
          
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h4 className="font-bold text-sm text-gray-800 mb-2">Paso 1: Crear Facebook App</h4>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex gap-2">
                <span className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold flex-shrink-0">1</span>
                <p>Ve a <a href="https://developers.facebook.com" target="_blank" className="text-blue-600 underline">developers.facebook.com</a></p>
              </div>
              <div className="flex gap-2">
                <span className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold flex-shrink-0">2</span>
                <p>Crea una app → Tipo: Business → Nombre: Agrilux Bot</p>
              </div>
              <div className="flex gap-2">
                <span className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold flex-shrink-0">3</span>
                <p>Agrega producto: "Facebook Login" → Configura URL: https://www.vitalfarmbright.store</p>
              </div>
              <div className="flex gap-2">
                <span className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold flex-shrink-0">4</span>
                <p>Ve a "Token de acceso" → Genera token de página con permisos: <code className="bg-gray-100 px-1 rounded">pages_manage_posts, pages_read_engagement</code></p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h4 className="font-bold text-sm text-gray-800 mb-2">Paso 2: Ingresa tus credenciales</h4>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-1">Page Access Token</label>
                <div className="flex gap-2">
                  <input type="password" value={token} onChange={e => setToken(e.target.value)}
                    placeholder="EAAxxxxxxx..."
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
                  <button onClick={copiarToken} className="text-gray-400 hover:text-primary">
                    {copiado === 'token' ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-semibold block mb-1">Page ID</label>
                <input value={pageId} onChange={e => setPageId(e.target.value)}
                  placeholder="1234567890"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
              </div>
              <button onClick={guardarConfig}
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                {connected ? <><Check size={16} /> Conectado</> : <><Send size={16} /> Conectar</>}
              </button>
            </div>
          </div>

          {connected && (
            <div className="bg-green-50 rounded-2xl p-4 border border-green-200">
              <p className="text-sm font-bold text-green-800">✅ Conectado a: {pageName}</p>
              <p className="text-xs text-green-600 mt-1">Tu bot de Facebook está listo para publicar.</p>
            </div>
          )}
        </div>
      )}

      {/* ── PUBLICAR ────────────────────────────────────────── */}
      {tab === 'publicar' && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-gray-800">Publicar en Facebook</h3>

          {resultado && (
            <div className={`rounded-xl p-3 text-sm ${resultado.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {resultado.ok ? '✅' : '❌'} {resultado.msg}
            </div>
          )}

          {/* Publicar mensaje personalizado */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h4 className="font-bold text-sm text-gray-800 mb-2">Mensaje personalizado</h4>
            <textarea value={customMessage} onChange={e => setCustomMessage(e.target.value)}
              placeholder="Escribe tu mensaje para Facebook..."
              rows={4}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none" />
            <div className="mt-2">
              <label className="text-xs text-gray-500 font-semibold block mb-1">URL de imagen (opcional)</label>
              <input value={customImage} onChange={e => setCustomImage(e.target.value)}
                placeholder="https://ejemplo.com/imagen.jpg"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
            </div>
            <button onClick={() => publicar(customMessage, customImage || null)}
              disabled={!connected || publicando || !customMessage.trim()}
              className="mt-3 w-full bg-blue-600 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-40">
              {publicando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {publicando ? 'Publicando...' : 'Publicar ahora'}
            </button>
          </div>

          {/* Plantillas */}
          <h4 className="text-sm font-bold text-gray-800">Plantillas rápidas</h4>
          {plantillas.map(p => (
            <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{p.emoji}</span>
                  <h4 className="font-bold text-sm text-gray-800">{p.titulo}</h4>
                </div>
                <button onClick={() => publicar(p.mensaje)}
                  disabled={!connected || publicando}
                  className="flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-semibold disabled:opacity-40">
                  {publicando ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  Publicar
                </button>
              </div>
              <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-line">{p.mensaje}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── PROGRAMAR ───────────────────────────────────────── */}
      {tab === 'programar' && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-gray-800">Programar publicaciones</h3>
          <p className="text-xs text-gray-500">Selecciona una plantilla y fecha para programarla.</p>

          {plantillas.map(p => (
            <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{p.emoji}</span>
                <h4 className="font-bold text-sm text-gray-800">{p.titulo}</h4>
              </div>
              <p className="text-xs text-gray-500 mb-3 line-clamp-2">{p.mensaje.slice(0, 80)}...</p>
              <div className="flex gap-2">
                <input type="datetime-local"
                  id={`schedule-${p.id}`}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs" />
                <button onClick={() => {
                  const input = document.getElementById(`schedule-${p.id}`);
                  if (input.value) programarPublicacion(p, input.value);
                }}
                  className="bg-purple-600 text-white px-3 py-2 rounded-xl text-xs font-bold">
                  <Clock size={14} />
                </button>
              </div>
            </div>
          ))}

          {scheduled.length > 0 && (
            <>
              <h4 className="text-sm font-bold text-gray-800">Programadas</h4>
              {scheduled.map((s, idx) => (
                <div key={idx} className="bg-purple-50 rounded-xl p-3 flex items-center gap-3">
                  <span className="text-xl">{s.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{s.titulo}</p>
                    <p className="text-xs text-purple-600">📅 {new Date(s.fechaProgramada).toLocaleString('es-PE')}</p>
                  </div>
                  <button onClick={() => eliminarProgramada(idx)} className="text-gray-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── HISTORIAL ───────────────────────────────────────── */}
      {tab === 'historial' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800">Historial de publicaciones</h3>
            <button onClick={() => { setPublicaciones([]); localStorage.removeItem('agrilux_fb_publicaciones'); }}
              className="text-xs text-red-500 font-semibold">Limpiar</button>
          </div>

          {publicaciones.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-gray-500 text-sm">No hay publicaciones aún.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {publicaciones.map((pub, idx) => (
                <div key={idx} className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    {pub.imagen ? <Image size={16} className="text-blue-600" /> : <FileText size={16} className="text-blue-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{pub.mensaje}</p>
                    <p className="text-xs text-gray-500">{new Date(pub.fecha).toLocaleString('es-PE')}</p>
                  </div>
                  <a href={`https://facebook.com/${pub.id}`} target="_blank" className="text-blue-500">
                    <ExternalLink size={14} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
