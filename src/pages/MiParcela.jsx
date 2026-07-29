import React, { useState, useEffect } from 'react';
import { Plus, Camera, Leaf, Calendar, TrendingUp, Loader2, Map, Download } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { CULTIVOS } from '../lib/constants';
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { invokeGemini } from '../lib/gemini';
import { useNavigate } from 'react-router-dom';
import MapaParcela from '../components/MapaParcela';
import { exportarParcelasExcel } from '../lib/exportExcel';
import { GraficoMonitoreo } from '../components/GraficosCultivo';

export default function MiParcela() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [parcelas, setParcelas] = useState([]);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [parcelaActiva, setParcelaActiva] = useState(null);
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [analizandoIA, setAnalizandoIA] = useState(false);
  const [recomendacion, setRecomendacion] = useState('');

  const [form, setForm] = useState({
    nombre: '', cultivo: 'papa', variedad: '', area: '', fechaSiembra: '', gps: ''
  });
  const [abrirMapa, setAbrirMapa] = useState(false);
  const [poligono, setPoligono] = useState(null);

  // Auto-fill GPS con ubicación del usuario al abrir modal
  useEffect(() => {
    if (modalNuevo && user?.ubicacion && !form.gps) {
      setForm(prev => ({ ...prev, gps: user.ubicacion }));
    }
  }, [modalNuevo, user?.ubicacion]);

  const cultivoObj = CULTIVOS.find(c => c.id === form.cultivo);

  useEffect(() => { cargarParcelas(); }, []);

  const cargarParcelas = async () => {
    try {
      const q = query(collection(db, 'parcelas'), where('userId', '==', user?.uid));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setParcelas(data);
      if (data.length > 0 && !parcelaActiva) {
        setParcelaActiva(data[0]);
        cargarRegistros(data[0].id);
      }
    } catch (e) { console.log(e); }
    setLoading(false);
  };

  const cargarRegistros = async (parcelaId) => {
    try {
      const q = query(collection(db, 'registrosParcela'), where('parcelaId', '==', parcelaId), orderBy('fecha', 'desc'));
      const snap = await getDocs(q);
      setRegistros(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { setRegistros([]); }
  };

  const crearParcela = async () => {
    if (!form.nombre || !form.fechaSiembra) { alert('Completa nombre y fecha de siembra'); return; }
    setGuardando(true);
    try {
      const cultObj = CULTIVOS.find(c => c.id === form.cultivo);
      const doc = await addDoc(collection(db, 'parcelas'), {
        userId: user?.uid, userName: user?.nombre,
        nombre: form.nombre, cultivo: form.cultivo, cultivoNombre: cultObj?.nombre,
        cultivoEmoji: cultObj?.emoji, variedad: form.variedad,
        area: poligono ? String(poligono.area) : form.area,
        fechaSiembra: form.fechaSiembra, gps: form.gps || user?.ubicacion || '',
        coordenadas: poligono?.coordenadas || [],
        createdAt: new Date().toISOString(),
      });
      const nueva = {
        id: doc.id, ...form, cultivoNombre: cultObj?.nombre, cultivoEmoji: cultObj?.emoji,
        area: poligono ? String(poligono.area) : form.area,
        coordenadas: poligono?.coordenadas || [],
      };
      setParcelas(prev => [...prev, nueva]);
      setParcelaActiva(nueva);
      setRegistros([]);
      setModalNuevo(false);
      setPoligono(null);
    } catch (e) { 
      console.error('Error crear parcela:', e);
      alert('Error al crear parcela: ' + e.message); 
    }
    setGuardando(false);
  };

  const registrarMonitoreo = async (e) => {
    const file = e.target.files[0];
    if (!file || !parcelaActiva) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      // Compress
      const compressed = await new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX = 600;
          let w = img.width, h = img.height;
          if (w > MAX) { h = h * MAX / w; w = MAX; }
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = dataUrl;
      });

      setAnalizandoIA(true);
      try {
        const diasDesdeSiembra = parcelaActiva.fechaSiembra
          ? Math.floor((new Date() - new Date(parcelaActiva.fechaSiembra)) / (1000 * 60 * 60 * 24))
          : 'desconocido';

        const resp = await invokeGemini({
          prompt: `Eres un agrónomo experto. Analiza esta imagen de ${parcelaActiva.cultivoNombre} y da recomendaciones preventivas.

Parcela: ${parcelaActiva.nombre}
Días desde siembra: ${diasDesdeSiembra} días
Ubicación: ${user?.ubicacion}
Variedad: ${parcelaActiva.variedad || 'No especificada'}

Da recomendaciones concretas y sencillas para optimizar el cultivo. Máximo 3-4 oraciones.`,
          file_urls: [compressed]
        });

        setRecomendacion(resp);

        await addDoc(collection(db, 'registrosParcela'), {
          parcelaId: parcelaActiva.id, userId: user?.uid,
          foto: compressed, recomendacion: resp,
          diasDesdeSiembra,
          fecha: new Date().toISOString(),
        });

        cargarRegistros(parcelaActiva.id);
      } catch (err) { setRecomendacion('Error al analizar la imagen.'); }
      setAnalizandoIA(false);
    };
    reader.readAsDataURL(file);
  };

  const diasDesdeSiembra = (fecha) => {
    if (!fecha) return 0;
    return Math.floor((new Date() - new Date(fecha)) / (1000 * 60 * 60 * 24));
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen pb-24">
      <div className="bg-primary text-white px-6 pt-12 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Mi Parcela</h1>
            <p className="text-white/70 text-sm mt-1">Gestiona y monitorea tus cultivos</p>
          </div>
          <button onClick={() => exportarParcelasExcel(parcelas, registros)}
            className="bg-white/20 text-white font-bold text-sm px-3 py-2 rounded-xl flex items-center gap-1 shadow-sm">
            <Download size={16} /> Excel
          </button>
          <button onClick={() => setModalNuevo(true)}
            className="bg-white text-primary font-bold text-sm px-4 py-2 rounded-xl flex items-center gap-1 shadow-sm">
            <Plus size={16} /> Nueva
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {parcelas.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <Leaf size={48} className="mx-auto text-gray-200 mb-4" />
            <p className="font-bold text-gray-700 mb-2">No tienes parcelas registradas</p>
            <p className="text-gray-400 text-sm mb-4">Registra tu primera parcela para comenzar a monitorear tu cultivo</p>
            <button onClick={() => setModalNuevo(true)}
              className="bg-primary text-white font-bold px-6 py-3 rounded-xl">
              + Crear mi primera parcela
            </button>
          </div>
        ) : (
          <>
            {/* Selector de parcelas */}
            {parcelas.length > 1 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {parcelas.map(p => (
                  <button key={p.id} onClick={() => { setParcelaActiva(p); cargarRegistros(p.id); setRecomendacion(''); }}
                    className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                      parcelaActiva?.id === p.id ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200'
                    }`}>
                    {p.cultivoEmoji} {p.nombre}
                  </button>
                ))}
              </div>
            )}

            {parcelaActiva && (
              <>
                {/* Info parcela */}
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="font-display font-bold text-lg text-gray-800">{parcelaActiva.nombre}</h2>
                      <p className="text-gray-500 text-sm">{parcelaActiva.cultivoEmoji} {parcelaActiva.cultivoNombre} {parcelaActiva.variedad && `- ${parcelaActiva.variedad}`}</p>
                    </div>
                    <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">Activa</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                      <Calendar size={16} className="mx-auto text-primary mb-1" />
                      <p className="text-xs text-gray-500">Días</p>
                      <p className="font-bold text-primary">{diasDesdeSiembra(parcelaActiva.fechaSiembra)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                      <Leaf size={16} className="mx-auto text-primary mb-1" />
                      <p className="text-xs text-gray-500">Área</p>
                      <p className="font-bold text-primary">{parcelaActiva.area || '-'} ha</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                      <TrendingUp size={16} className="mx-auto text-primary mb-1" />
                      <p className="text-xs text-gray-500">Registros</p>
                      <p className="font-bold text-primary">{registros.length}</p>
                    </div>
                  </div>
                  {parcelaActiva.coordenadas?.length >= 3 && (
                    <div className="mt-3 bg-blue-50 rounded-xl p-2.5 flex items-center gap-2">
                      <Map size={14} className="text-blue-600" />
                      <p className="text-xs text-blue-700 font-semibold">
                        {parcelaActiva.coordenadas.length} puntos mapeados · {parcelaActiva.area} ha
                      </p>
                    </div>
                  )}
                </div>

                {/* Botón ver ciclo */}
                <button onClick={() => navigate(`/ciclo?parcelaId=${parcelaActiva.id}`)}
                  className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 hover:bg-amber-100 transition-colors">
                  <div className="bg-amber-500 w-10 h-10 rounded-xl flex items-center justify-center text-white text-xl">
                    📅
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-bold text-amber-800 text-sm">Ver ciclo del cultivo</p>
                    <p className="text-xs text-amber-600">Calendario, etapas y recomendaciones personalizadas</p>
                  </div>
                  <span className="text-amber-400">›</span>
                </button>

                {/* Monitoreo */}
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">📸 Monitoreo con IA (cada 10 días)</p>
                  <p className="text-xs text-gray-500 mb-3">Sube una foto de tu cultivo y la IA te dará recomendaciones preventivas</p>
                  <label className="w-full flex items-center justify-center gap-2 bg-primary text-white font-bold py-3 rounded-xl cursor-pointer hover:bg-primary-dark transition-colors">
                    <Camera size={18} />
                    {analizandoIA ? 'Analizando...' : 'Subir foto de monitoreo'}
                    <input type="file" accept="image/*" capture="environment" onChange={registrarMonitoreo} className="hidden" disabled={analizandoIA} />
                  </label>
                  {analizandoIA && (
                    <div className="flex items-center gap-2 mt-3 text-primary text-sm">
                      <Loader2 size={16} className="animate-spin" /> Analizando con IA...
                    </div>
                  )}
                  {recomendacion && (
                    <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-3">
                      <p className="text-xs font-bold text-green-700 mb-1">💡 Recomendación IA</p>
                      <p className="text-sm text-green-800">{recomendacion}</p>
                    </div>
                  )}
                </div>

                {/* Gráfico de monitoreo */}
                {registros.length > 1 && <GraficoMonitoreo registros={registros} />}

                {/* Historial */}
                {registros.length > 0 && (
                  <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Historial de monitoreos</p>
                    <div className="space-y-3">
                      {registros.slice(0, 5).map(r => (
                        <div key={r.id} className="flex gap-3 border-b border-gray-50 pb-3 last:border-0">
                          {r.foto && <img src={r.foto} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-400">{new Date(r.fecha).toLocaleDateString('es-PE')} · Día {r.diasDesdeSiembra}</p>
                            <p className="text-xs text-gray-600 mt-1 line-clamp-2">{r.recomendacion}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Acciones rápidas */}
                <div className="grid grid-cols-1 gap-3">
                  <button onClick={() => navigate('/diagnostico')}
                    className="bg-white rounded-2xl p-4 shadow-sm text-center border border-gray-100 hover:border-primary transition-all">
                    <Camera size={24} className="mx-auto text-primary mb-2" />
                    <p className="text-sm font-bold text-gray-700">Diagnóstico IA</p>
                    <p className="text-xs text-gray-400">Identificar plaga</p>
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Modal nueva parcela — fullscreen */}
      {modalNuevo && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col max-w-[430px] mx-auto">
          {/* Header */}
          <div className="bg-primary text-white px-4 py-3 flex items-center gap-3 shrink-0">
            <button onClick={() => setModalNuevo(false)} className="text-white/70 hover:text-white text-lg font-bold">
              ←
            </button>
            <h3 className="font-display font-bold text-base">Nueva Parcela</h3>
          </div>

          {/* Contenido scrolleable */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Nombre de la parcela *</label>
              <input value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})}
                placeholder="Ej: Lote El Recuerdo"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Tipo de cultivo *</label>
              <select value={form.cultivo} onChange={e => setForm({...form, cultivo: e.target.value, variedad: ''})}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary bg-white">
                {CULTIVOS.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Variedad</label>
              <select value={form.variedad} onChange={e => setForm({...form, variedad: e.target.value})}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary bg-white">
                <option value="">Seleccionar variedad</option>
                {cultivoObj?.variedades.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Área (hectáreas)</label>
              <div className="flex gap-2">
                <input type="number" value={poligono ? poligono.area : form.area}
                  onChange={e => setForm({...form, area: e.target.value})}
                  placeholder="Ej: 1.5"
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
                  disabled={!!poligono} />
                <button type="button" onClick={() => setAbrirMapa(true)}
                  className="bg-primary text-white px-5 rounded-xl flex items-center gap-1.5 text-xs font-bold whitespace-nowrap">
                  <Map size={14} /> Mapear
                </button>
              </div>
              {poligono && (
                <p className="text-xs text-green-600 mt-1.5 font-semibold">
                  ✓ Área mapeada: {poligono.area} ha ({poligono.coordenadas.length} puntos)
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Fecha de siembra *</label>
              <input type="date" value={form.fechaSiembra} onChange={e => setForm({...form, fechaSiembra: e.target.value})}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Ubicación (opcional)</label>
              <input value={form.gps} onChange={e => setForm({...form, gps: e.target.value})}
                placeholder="Ej: Cutervo, Cajamarca"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary" />
              <p className="text-[10px] text-gray-400 mt-1">Si no ingresas, se usará tu ubicación del registro.</p>
            </div>
          </div>

          {/* Botones fijos abajo */}
          <div className="shrink-0 border-t border-gray-100 p-4 flex gap-3 bg-white">
            <button onClick={() => setModalNuevo(false)}
              className="flex-1 border border-gray-200 text-gray-600 font-bold py-3.5 rounded-xl text-sm">
              Cancelar
            </button>
            <button onClick={crearParcela} disabled={guardando}
              className="flex-1 bg-primary text-white font-bold py-3.5 rounded-xl text-sm disabled:opacity-50">
              {guardando ? 'Creando...' : 'Crear parcela →'}
            </button>
          </div>
        </div>
      )}

      {/* Mapa fullscreen */}
      {abrirMapa && (
        <MapaParcela
          coordenadasIniciales={poligono?.coordenadas || []}
          onGuardar={(data) => {
            setPoligono(data);
            setForm(prev => ({ ...prev, area: String(data.area) }));
            setAbrirMapa(false);
          }}
          onCerrar={() => setAbrirMapa(false)}
        />
      )}
    </div>
  );
}
