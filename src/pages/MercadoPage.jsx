import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Store, Tag, Mic, Loader2, RefreshCw, MapPin, Plus,
  MessageCircle, ExternalLink, ShoppingBag, Trash2, AlertTriangle, Pencil,
} from 'lucide-react';
import { useAgentes } from '../lib/AgentContext';
import { useAuth } from '../lib/AuthContext';
import { cargarOfertasRegistradas } from '../lib/ofertasRegistradas';
import VoiceAssistant from '../components/VoiceAssistant';
import RegistroTienda from '../components/RegistroTienda';
import { supabase } from '../lib/supabase';

const FILTROS_REGION = ['todas', 'cajamarca', 'lambayeque', 'piura', 'ica', 'junín'];

export default function MercadoPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tabInicial = searchParams.get('tab') || 'ofertas';
  const { coords, ubicacion, productoRecomendado, tiendasEncontradas } = useAgentes();
  const { user } = useAuth();

  const [tab, setTab] = useState(tabInicial);
  const [ofertas, setOfertas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('todas');
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);
  const [mostrarRegistro, setMostrarRegistro] = useState(false);
  const [tiendaEditando, setTiendaEditando] = useState(null);
  const [misTiendas, setMisTiendas] = useState([]);
  const [cargandoTiendas, setCargandoTiendas] = useState(false);
  const [eliminandoId, setEliminandoId] = useState(null);
  const [confirmEliminar, setConfirmEliminar] = useState(null);

  const abrirRegistro = useCallback(() => {
    if (!(user?.id || user?.uid)) {
      navigate('/registro?redirect=/mercado&tab=mitienda');
      return;
    }
    setTiendaEditando(null);
    setMostrarRegistro(true);
  }, [user?.id, user?.uid, navigate]);

  const abrirEdicion = useCallback((tienda) => {
    if (!(user?.id || user?.uid)) {
      navigate('/registro?redirect=/mercado&tab=mitienda');
      return;
    }
    setTiendaEditando(tienda);
    setMostrarRegistro(true);
  }, [user?.id, user?.uid, navigate]);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && ['ofertas', 'agente', 'mitienda'].includes(t)) setTab(t);
  }, [searchParams]);

  const recargarOfertas = useCallback(async (forzar = false) => {
    setCargando(true);
    try {
      const data = await cargarOfertasRegistradas({
        lat: coords?.lat,
        lon: coords?.lon,
        cultivo: productoRecomendado?.cultivo || '',
      });
      setOfertas(data.ofertas);
      setUltimaActualizacion(data.timestamp);
    } catch (e) {
      console.error(e);
      setOfertas([]);
    }
    setCargando(false);
  }, [coords?.lat, coords?.lon, productoRecomendado?.cultivo]);

  useEffect(() => { recargarOfertas(); }, [recargarOfertas]);

  const cargarMisTiendas = useCallback(async () => {
    const uid = user?.id || user?.uid;
    if (!uid) {
      setMisTiendas([]);
      return;
    }
    setCargandoTiendas(true);
    try {
      const { data: porUidData, error } = await supabase.from('tiendas_comunidad').select('*').eq('propietarioId', uid);
      if (error) throw error;
      let tiendas = (porUidData || []).filter((t) => t.activa !== false);

      if (tiendas.length === 0 && user.email) {
        const { data: porEmailData } = await supabase.from('tiendas_comunidad').select('*').eq('propietarioEmail', user.email);
        tiendas = (porEmailData || []).filter((t) => t.activa !== false);
      }

      tiendas.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setMisTiendas(tiendas);
    } catch (e) {
      console.error(e);
      setMisTiendas([]);
    }
    setCargandoTiendas(false);
  }, [user?.id, user?.uid, user?.email]);

  useEffect(() => {
    cargarMisTiendas();
  }, [cargarMisTiendas, mostrarRegistro]);

  const eliminarTienda = async (tienda) => {
    setEliminandoId(tienda.id);
    try {
      await supabase.from('tiendas_comunidad').update({
        activa: false,
        eliminadaAt: new Date().toISOString(),
        eliminadaPor: user?.id || user?.uid,
      }).eq('id', tienda.id);
      setMisTiendas((prev) => prev.filter((t) => t.id !== tienda.id));
      setConfirmEliminar(null);
      recargarOfertas(true);
    } catch (e) {
      console.error(e);
      alert('No se pudo eliminar la tienda. Intenta de nuevo.');
    }
    setEliminandoId(null);
  };

  const ofertasFiltradas = filtro === 'todas'
    ? ofertas
    : ofertas.filter(o => o.region?.toLowerCase().includes(filtro));

  const tabs = [
    { id: 'ofertas', icon: Tag, label: 'Ofertas' },
    { id: 'agente', icon: Mic, label: 'Agente' },
    { id: 'mitienda', icon: Store, label: 'Mi tienda' },
  ];

  return (
    <div className="min-h-[calc(100vh-120px)]">
      {/* Header unificado */}
      <div className="bg-gradient-to-r from-emerald-600 to-green-700 text-white p-6 rounded-b-3xl -mx-4 -mt-2 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <Store size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold">Mercado Agrilux</h1>
              <p className="text-green-100 text-sm">Ofertas, agente y tiendas registradas</p>
            </div>
          </div>
          {tab === 'ofertas' && (
            <button onClick={() => recargarOfertas(true)}
              className="p-2 bg-white/20 rounded-full hover:bg-white/30">
              <RefreshCw size={18} className={cargando ? 'animate-spin' : ''} />
            </button>
          )}
        </div>
        {ubicacion && (
          <p className="text-green-100/80 text-xs mt-3 flex items-center gap-1">
            <MapPin size={12} /> {ubicacion}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
        {tabs.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
              tab === id ? 'bg-white text-primary shadow-sm' : 'text-gray-500'
            }`}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB OFERTAS ── */}
      {tab === 'ofertas' && (
        <>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
            <p className="text-xs text-blue-800">
              <strong>Solo tiendas registradas en Agrilux.</strong> Precios verificados por la comunidad.
            </p>
          </div>

          {productoRecomendado?.nombre && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-4 flex items-center gap-2">
              <ShoppingBag size={16} className="text-primary" />
              <p className="text-xs text-primary font-medium">
                Recomendado por diagnóstico: <strong>{productoRecomendado.nombre}</strong>
              </p>
            </div>
          )}

          <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
            {FILTROS_REGION.map(r => (
              <button key={r} onClick={() => setFiltro(r)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${
                  filtro === r ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                {r === 'todas' ? 'Todas' : r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>

          {cargando ? (
            <div className="flex flex-col items-center py-12">
              <Loader2 size={32} className="animate-spin text-primary mb-3" />
              <p className="text-gray-500 text-sm">Cargando ofertas registradas...</p>
            </div>
          ) : ofertasFiltradas.length === 0 ? (
            <div className="text-center py-12">
              <Tag size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">Aún no hay ofertas registradas</p>
              <p className="text-gray-400 text-xs mt-1 mb-4">Registra tu tienda en la pestaña Mi tienda</p>
              <button onClick={() => { setTab('mitienda'); abrirRegistro(); }}
                className="bg-primary text-white font-bold px-6 py-3 rounded-2xl text-sm">
                Registrar mi tienda
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {ofertasFiltradas.map((o, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Tag size={18} className="text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-gray-800">{o.producto}</p>
                        {o.precio != null && (
                          <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                            S/ {o.precio}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        🏪 {o.tienda} · 📍 {o.region || 'Perú'}
                        {o.distanciaKm != null && ` · ${o.distanciaKm} km`}
                      </p>
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full mt-1 inline-block">
                        ✓ Tienda registrada Agrilux
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {o.whatsapp && (
                      <a href={`https://wa.me/51${String(o.whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, vi en Agrilux que tienen ${o.producto}. ¿Está disponible?`)}`}
                        target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-[10px] font-bold bg-green-500 text-white px-2.5 py-1.5 rounded-full">
                        <MessageCircle size={10} /> WhatsApp
                      </a>
                    )}
                    {o.facebook && (
                      <a href={`https://www.facebook.com/${o.facebook}`}
                        target="_blank" rel="noreferrer"
                        className="text-[10px] font-bold bg-blue-600 text-white px-2.5 py-1.5 rounded-full">
                        📘 Facebook
                      </a>
                    )}
                    <a href={`https://www.google.com/maps/search/${encodeURIComponent(`${o.tienda} ${o.region}`)}`}
                      target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-[10px] font-bold bg-gray-100 text-gray-700 px-2.5 py-1.5 rounded-full">
                      <ExternalLink size={10} /> Maps
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {ultimaActualizacion && (
            <p className="text-[10px] text-gray-300 text-center mt-4">
              Actualizado: {new Date(ultimaActualizacion).toLocaleString('es-PE')}
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-primary">{ofertas.length}</p>
              <p className="text-[10px] text-gray-400">Ofertas activas</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-green-600">{tiendasEncontradas?.length || '—'}</p>
              <p className="text-[10px] text-gray-400">Tiendas cercanas</p>
            </div>
          </div>
        </>
      )}

      {/* ── TAB AGENTE ── */}
      {tab === 'agente' && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { e: '💬', t: 'Precios', d: 'Ofertas registradas' },
              { e: '📍', t: 'Tiendas', d: 'Solo en Agrilux' },
              { e: '🛒', t: 'Comprar', d: 'WhatsApp directo' },
            ].map(({ e, t, d }) => (
              <div key={t} className="bg-white rounded-xl p-2.5 text-center border border-gray-100">
                <span className="text-lg">{e}</span>
                <p className="text-xs font-bold text-gray-700">{t}</p>
                <p className="text-[10px] text-gray-400">{d}</p>
              </div>
            ))}
          </div>
          {ofertas.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-4">
              <p className="text-xs font-bold text-emerald-800 mb-1">
                El agente conoce {ofertas.length} oferta(s) de tiendas registradas
              </p>
              <p className="text-[10px] text-emerald-700">
                Pregúntale: "¿Dónde compro Mancozeb cerca?" o "¿Qué ofertas hay?"
              </p>
            </div>
          )}
          <VoiceAssistant fullPage agentType="ventas" misTiendas={misTiendas} />
        </>
      )}

      {/* ── TAB MI TIENDA ── */}
      {tab === 'mitienda' && (
        <div>
          {!(user?.id || user?.uid) ? (
            <div className="text-center py-8 mb-4 bg-white rounded-2xl border border-gray-100 p-6">
              <Store size={40} className="text-gray-300 mx-auto mb-3" />
              <h2 className="font-bold text-gray-700 mb-1">Inicia sesión</h2>
              <p className="text-gray-400 text-sm">
                Necesitas una cuenta para ver y gestionar tus tiendas registradas.
              </p>
            </div>
          ) : cargandoTiendas ? (
            <div className="flex flex-col items-center py-12">
              <Loader2 size={32} className="animate-spin text-primary mb-3" />
              <p className="text-gray-500 text-sm">Cargando tus tiendas...</p>
            </div>
          ) : misTiendas.length > 0 ? (
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-gray-500">
                  {misTiendas.length} tienda{misTiendas.length !== 1 ? 's' : ''} registrada{misTiendas.length !== 1 ? 's' : ''}
                </p>
                <button
                  onClick={abrirRegistro}
                  className="text-xs font-bold text-primary flex items-center gap-1"
                >
                  <Plus size={14} /> Agregar
                </button>
              </div>

              {misTiendas.map((tienda) => (
                <div key={tienda.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  {tienda.fotos?.length > 0 && (
                    <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                      {tienda.fotos.map((foto, idx) => (
                        <img
                          key={idx}
                          src={foto}
                          alt={`${tienda.nombre} - foto ${idx + 1}`}
                          className="w-24 h-24 object-cover rounded-xl border border-gray-100 flex-shrink-0"
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Store size={22} className="text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-bold text-gray-800">{tienda.nombre}</h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        📍 {[tienda.direccion, tienda.distrito, tienda.departamento].filter(Boolean).join(', ')}
                      </p>
                      {tienda.horario && (
                        <p className="text-xs text-gray-400 mt-1">🕐 {tienda.horario}</p>
                      )}
                      {tienda.createdAt && (
                        <p className="text-[10px] text-gray-300 mt-1">
                          Registrada: {new Date(tienda.createdAt).toLocaleDateString('es-PE')}
                        </p>
                      )}
                    </div>
                  </div>

                  {tienda.descripcion && (
                    <p className="text-sm text-gray-600 mb-3">{tienda.descripcion}</p>
                  )}

                  {tienda.especialidades?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {tienda.especialidades.map((e) => (
                        <span key={e} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{e}</span>
                      ))}
                    </div>
                  )}

                  <p className="text-[10px] text-gray-400 mb-3">
                    {tienda.verificada ? '✓ Tienda verificada' : '⏳ Pendiente de verificación'}
                  </p>

                  <div className="flex gap-2">
                    {tienda.whatsapp && (
                      <a
                        href={`https://wa.me/51${String(tienda.whatsapp).replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 text-center bg-green-500 text-white text-xs font-bold py-2.5 rounded-xl"
                      >
                        💬 WhatsApp
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => abrirEdicion(tienda)}
                      className="flex items-center justify-center gap-1 px-4 bg-gray-100 text-gray-700 text-xs font-bold py-2.5 rounded-xl"
                    >
                      <Pencil size={14} />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmEliminar(tienda)}
                      disabled={eliminandoId === tienda.id}
                      className="flex items-center justify-center gap-1 px-4 bg-red-50 text-red-600 text-xs font-bold py-2.5 rounded-xl disabled:opacity-50"
                    >
                      {eliminandoId === tienda.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 mb-4">
              <Store size={48} className="text-gray-300 mx-auto mb-3" />
              <h2 className="font-bold text-gray-700 mb-1">¿Tienes una tienda agrícola?</h2>
              <p className="text-gray-400 text-sm mb-4">
                Regístrala gratis y tus ofertas aparecerán en Agrilux y en el agente de ventas.
              </p>
              <button onClick={abrirRegistro}
                className="inline-flex items-center gap-2 bg-primary text-white font-bold px-6 py-3 rounded-2xl text-sm">
                <Plus size={18} /> Registrar mi tienda
              </button>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <p className="text-xs font-bold text-amber-800 mb-2">Beneficios de registrarte</p>
            <ul className="text-xs text-amber-700 space-y-1">
              <li>• Tus productos aparecen en Ofertas</li>
              <li>• El agente de ventas recomienda tu tienda</li>
              <li>• Los agricultores te contactan por WhatsApp</li>
              <li>• Solo tiendas verificadas en Agrilux</li>
            </ul>
          </div>
        </div>
      )}

      {confirmEliminar && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle size={24} className="text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 text-center">¿Eliminar tienda?</h3>
            <p className="text-sm text-gray-500 text-center">
              Se ocultará <strong>{confirmEliminar.nombre}</strong> del mercado y de las ofertas. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmEliminar(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => eliminarTienda(confirmEliminar)}
                disabled={!!eliminandoId}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold disabled:opacity-50"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarRegistro && (
        <RegistroTienda
          tienda={tiendaEditando}
          onCerrado={() => {
            setMostrarRegistro(false);
            setTiendaEditando(null);
          }}
          onRegistrada={(tienda) => {
            setMostrarRegistro(false);
            setTiendaEditando(null);
            cargarMisTiendas();
            recargarOfertas(true);
            setTab('mitienda');
          }}
        />
      )}
    </div>
  );
}
