import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Loader2, X, MessageCircle, Store, MapPin } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useAgentes } from '../lib/AgentContext';
import { guardarConversacion, getHistorialConversaciones } from '../lib/learningSystem';

/**
 * VoiceAssistant — Asistente agrícola inteligente por voz
 *
 * Flujo:
 * 1. Agricultor presiona micrófono y habla
 * 2. Se transcribe con Web Speech API (gratuito, offline)
 * 3. Se envía a /api/voice-assistant → IA responde con datos reales
 * 4. Se lee la respuesta en voz alta (es-PE)
 * 5. El agricultor puede seguir hablando (conversación continua)
 *
 * Datos disponibles para el agente:
 * - Ubicación del usuario (registrada en la app)
 * - Clima en tiempo real (Open-Meteo + SENAMHI scraping)
 * - Estación meteorológica más cercana (algoritmo de distancia)
 * - Datos de suelo (SoilGrids)
 * - Alertas NASA FIRMS
 * - NDVI satelital
 */

const WELCOME_MSG = '¡Hola! Soy tu asistente agrícola. Puedo darte información del clima de tu zona, recomendaciones para tus cultivos, o consultar el pronóstico del SENAMHI. ¿En qué te puedo ayudar?';

export default function VoiceAssistant({ disabled = false, fullPage = false }) {
  const { user } = useAuth();
  const { ubicacion, coords, productoRecomendado, problemaDetectado, tiendasCercanas } = useAgentes();
  const [abierto, setAbierto]             = useState(false);
  const [escuchando, setEscuchando]       = useState(false);
  const [procesando, setProcesando]       = useState(false);
  const [leyendo, setLeyendo]             = useState(false);
  const [transcripcion, setTranscripcion] = useState('');
  const [historial, setHistorial]         = useState([]);
  const [error, setError]                 = useState('');
  const [mostrarChat, setMostrarChat]     = useState(false);
  const [coordenadas, setCoordenadas]     = useState(null);
  const [guardando, setGuardando]         = useState(false);
  const [tiendasBusqueda, setTiendasBusqueda] = useState(null);
  const [enlacesBusqueda, setEnlacesBusqueda] = useState(null);

  const recognitionRef = useRef(null);
  const chatEndRef     = useRef(null);

  // Usar coordenadas guardadas del perfil o GPS como fallback
  useEffect(() => {
    if (coords?.lat && coords?.lon) {
      setCoordenadas({ lat: coords.lat, lon: coords.lon });
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoordenadas({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => {},
        { timeout: 5000 }
      );
    }
  }, [coords?.lat, coords?.lon]);

  // Guardar conversación cuando se cierra o hay 4+ mensajes
  const guardarConversacionActual = useCallback(async () => {
    if (!user?.uid || historial.length < 2) return;
    
    setGuardando(true);
    try {
      const mensajes = historial.map(m => ({
        role: m.rol === 'usuario' ? 'user' : 'assistant',
        content: m.texto
      }));
      await guardarConversacion(user.uid, mensajes);
    } catch (error) {
      console.error('Error guardando conversación:', error);
    } finally {
      setGuardando(false);
    }
  }, [user?.uid, historial]);

  // Guardar al cerrar panel
  useEffect(() => {
    if (!abierto && historial.length > 2) {
      guardarConversacionActual();
    }
  }, [abierto]);

  // Cargar historial previo al abrir
  useEffect(() => {
    if (abierto && user?.uid && historial.length === 0) {
      const cargarHistorial = async () => {
        try {
          const conversaciones = await getHistorialConversaciones(user.uid, 1);
          if (conversaciones.length > 0 && conversaciones[0].mensajes) {
            const mensajesPrevios = conversaciones[0].mensajes.slice(-6).map(m => ({
              rol: m.role === 'user' ? 'usuario' : 'asistente',
              texto: m.content
            }));
            if (mensajesPrevios.length > 0) {
              setHistorial([
                { rol: 'asistente', texto: '¡Hola de nuevo! Continuemos con tu consulta agrícola.' },
                ...mensajesPrevios
              ]);
            }
          }
        } catch (error) {
          console.error('Error cargando historial:', error);
        }
      };
      cargarHistorial();
    }
  }, [abierto, user?.uid]);

  // ── Enviar mensaje a la API y obtener respuesta ──
  const enviarAI = useCallback(async (mensaje, hist) => {
    setProcesando(true);
    setError('');
    setTiendasBusqueda(null);
    setEnlacesBusqueda(null);
    try {
      // Incluir contexto compartido de todos los agentes
      const contextoAgentes = {
        cultivoActivo: productoRecomendado?.cultivo || null,
        problemaDetectado: problemaDetectado?.nombre || null,
        productoRecomendado: productoRecomendado?.nombre || null,
        tiendasCercanas: tiendasCercanas.length > 0 ? tiendasCercanas.slice(0, 3).map(t => `${t.nombre} (${t.distanciaKm}km)`).join(', ') : null,
      };

      const r = await fetch('/api/voice-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje,
          historial: hist.slice(-10),
          lat: coordenadas?.lat || coords?.lat || null,
          lon: coordenadas?.lon || coords?.lon || null,
          ubicacion: ubicacion || user?.ubicacion || null,
          nombre: user?.nombre || null,
          contexto: contextoAgentes,
        }),
      });
      const data = await r.json();
      const respuesta = data.respuesta || 'No pude procesar tu pregunta. Intenta de nuevo.';

      // Si la respuesta incluye tiendas, mostrar sección de tiendas
      if (data.tiendas?.length > 0) {
        setTiendasBusqueda(data.tiendas);
        setEnlacesBusqueda(data.enlaces);
      } else {
        setTiendasBusqueda(null);
        setEnlacesBusqueda(null);
      }

      setHistorial(prev => [...prev, { rol: 'asistente', texto: respuesta }]);
      leerTexto(respuesta);
      return respuesta;
    } catch (e) {
      console.error('Voice assistant API error:', e);
      const fallback = 'Hubo un error de conexión. Verifica tu internet e intenta de nuevo.';
      setHistorial(prev => [...prev, { rol: 'asistente', texto: fallback }]);
      setError('Error de conexión');
      return fallback;
    } finally {
      setProcesando(false);
    }
  }, [coordenadas, user]);

  // ── Text-to-Speech en español peruano ──
  const leerTexto = useCallback((texto) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(texto);
    utter.lang = 'es-PE';
    utter.rate = 0.9;
    utter.pitch = 1.0;

    const voces = window.speechSynthesis.getVoices();
    const vozES = voces.find(v => v.lang.startsWith('es') && v.name.includes('female'))
      || voces.find(v => v.lang.startsWith('es'))
      || voces[0];
    if (vozES) utter.voice = vozES;

    utter.onstart = () => setLeyendo(true);
    utter.onend   = () => setLeyendo(false);
    utter.onerror = () => setLeyendo(false);

    window.speechSynthesis.speak(utter);
  }, []);

  const detenerVoz = useCallback(() => {
    window.speechSynthesis?.cancel();
    setLeyendo(false);
  }, []);

  // ── Speech Recognition ──
  const iniciarEscucha = useCallback(() => {
    setError('');

    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      setError('Tu navegador no soporta voz. Usa Chrome.');
      return;
    }

    detenerVoz(); // parar si estaba leyendo

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();

    recognition.lang = 'es-PE';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setEscuchando(true);
      setTranscripcion('');
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setTranscripcion(finalTranscript || interimTranscript);

      if (finalTranscript) {
        setEscuchando(false);
        const nuevoHistorial = [...historial, { rol: 'usuario', texto: finalTranscript }];
        setHistorial(nuevoHistorial);
        setMostrarChat(true);
        enviarAI(finalTranscript, nuevoHistorial);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech error:', event.error);
      setEscuchando(false);
      if (event.error === 'no-speech') {
        setError('No te escuché. Intenta de nuevo.');
      } else if (event.error === 'audio-capture') {
        setError('No se pudo acceder al micrófono.');
      } else if (event.error !== 'aborted') {
        setError('Error de voz. Intenta de nuevo.');
      }
    };

    recognition.onend = () => setEscuchando(false);

    recognitionRef.current = recognition;
    recognition.start();
  }, [historial, enviarAI, detenerVoz]);

  const detenerEscucha = useCallback(() => {
    recognitionRef.current?.stop();
    setEscuchando(false);
  }, []);

  // ── Auto-scroll chat ──
  React.useEffect(() => {
    if (mostrarChat) {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [historial, mostrarChat]);

  // ── Saludo de bienvenida al abrir ──
  React.useEffect(() => {
    if (abierto && historial.length === 0) {
      setHistorial([{ rol: 'asistente', texto: WELCOME_MSG }]);
      setTimeout(() => leerTexto(WELCOME_MSG), 500);
    }
  }, [abierto]); // eslint-disable-line

  if (disabled) return null;

  // Auto-abrir en modo fullPage
  useEffect(() => {
    if (fullPage && !abierto) {
      setAbierto(true);
    }
  }, [fullPage]); // eslint-disable-line

  // ── Panel de chat ──
  const chatPanel = (
    <div className={`bg-white rounded-3xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden ${
      fullPage ? 'w-full h-[calc(100vh-280px)]' : 'w-[320px] max-h-[55vh]'
    }`}>
          {/* Header */}
          <div className="bg-primary text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <MessageCircle size={16} />
              </div>
              <div>
                <p className="text-sm font-bold">Agente de Ventas</p>
                <p className="text-[10px] text-white/70">Asistente agrícola por voz</p>
              </div>
            </div>
            {!fullPage && (
              <button onClick={() => { setAbierto(false); detenerVoz(); }}
                className="text-white/70 hover:text-white p-1">
                <X size={18} />
              </button>
            )}
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ maxHeight: '350px' }}>
            {historial.map((m, i) => (
              <div key={i} className={`flex ${m.rol === 'usuario' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  m.rol === 'usuario'
                    ? 'bg-primary text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-800 rounded-bl-md'
                }`}>
                  {m.texto}
                </div>
              </div>
            ))}
            {procesando && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-md px-3 py-2 text-sm text-gray-500 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> Pensando...
                </div>
              </div>
            )}

            {/* Resultados de tiendas */}
            {tiendasBusqueda && tiendasBusqueda.length > 0 && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-3 border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <Store size={14} className="text-green-600" />
                  <p className="text-xs font-bold text-green-700">Tiendas encontradas</p>
                </div>
                <div className="space-y-2">
                  {tiendasBusqueda.slice(0, 3).map((t, i) => (
                    <div key={i} className="bg-white rounded-xl p-2.5 border border-green-100">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                          {t.nombre?.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-700 truncate">{t.nombre}</p>
                          <p className="text-[10px] text-gray-400">{t.distanciaKm}km · ⭐ {t.reputacion || 'N/A'}</p>
                        </div>
                      </div>
                      {/* Precio si existe */}
                      {t.precio && (
                        <div className="bg-green-50 rounded-lg px-2 py-1 mb-1.5">
                          <p className="text-[10px] text-green-700 font-bold">S/ {t.precio} por kg</p>
                        </div>
                      )}
                      {/* Enlaces directos */}
                      <div className="flex gap-1 flex-wrap">
                        {t.googleMaps && (
                          <a href={t.googleMaps} target="_blank" rel="noreferrer"
                            className="text-[9px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full hover:bg-blue-600">
                            📍 Maps
                          </a>
                        )}
                        {t.whatsapp && (
                          <a href={t.whatsapp} target="_blank" rel="noreferrer"
                            className="text-[9px] bg-green-500 text-white px-1.5 py-0.5 rounded-full hover:bg-green-600">
                            💬 WhatsApp
                          </a>
                        )}
                        {t.facebook && (
                          <a href={t.facebook} target="_blank" rel="noreferrer"
                            className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full hover:bg-blue-700">
                            📘 Facebook
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Enlaces de redes sociales */}
                {enlacesBusqueda && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    <a href={enlacesBusqueda.googleMaps} target="_blank" rel="noreferrer"
                      className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold hover:bg-blue-200">
                      🗺️ Maps
                    </a>
                    <a href={enlacesBusqueda.facebook} target="_blank" rel="noreferrer"
                      className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold hover:bg-blue-200">
                      📘 Facebook
                    </a>
                    <a href={enlacesBusqueda.tiktok} target="_blank" rel="noreferrer"
                      className="text-[10px] bg-gray-100 text-gray-700 px-2 py-1 rounded-full font-semibold hover:bg-gray-200">
                      🎵 TikTok
                    </a>
                    <a href={enlacesBusqueda.whatsapp} target="_blank" rel="noreferrer"
                      className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold hover:bg-green-200">
                      💬 WhatsApp
                    </a>
                  </div>
                )}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Transcripción en tiempo real */}
          {escuchando && transcripcion && (
            <div className="px-3 pb-2">
              <div className="bg-primary/10 rounded-xl p-2 text-xs text-primary italic">
                "{transcripcion}"
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-3 pb-2">
              <div className="bg-red-50 rounded-xl p-2 text-xs text-red-600">{error}</div>
            </div>
          )}

          {/* Controles inferiores */}
          <div className="border-t border-gray-100 p-3 flex items-center justify-center gap-4">
            {/* Botón detener voz */}
            {leyendo && (
              <button onClick={detenerVoz}
                className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                <VolumeX size={18} />
              </button>
            )}

            {/* Botón micrófono principal */}
            <button
              onClick={escuchando ? detenerEscucha : iniciarEscucha}
              disabled={procesando}
              className={`
                w-16 h-16 rounded-full shadow-lg flex items-center justify-center
                transition-all duration-200 active:scale-95
                ${escuchando
                  ? 'bg-red-500 text-white animate-pulse'
                  : procesando
                    ? 'bg-amber-500 text-white'
                    : 'bg-primary text-white hover:bg-primary/90'
                }
              `}
            >
              {procesando ? (
                <Loader2 size={28} className="animate-spin" />
              ) : escuchando ? (
                <MicOff size={28} />
              ) : (
                <Mic size={28} />
              )}
            </button>

            {leyendo && (
              <button onClick={() => leerTexto(historial[historial.length - 1]?.texto || '')}
                className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Volume2 size={18} />
              </button>
            )}
          </div>

          <p className="text-[10px] text-gray-400 text-center pb-2">
            {escuchando ? '🔴 Escuchando... habla ahora' :
             procesando ? '⏳ Consultando al agrónomo IA...' :
             'Toca el micrófono para hablar'}
          </p>
        </div>
  );

  // ── Modo fullPage (página dedicada) ──
  if (fullPage) {
    return (
      <div className="flex flex-col h-full">
        {chatPanel}
        {/* Controles grandes para fullPage */}
        <div className="flex items-center justify-center gap-6 py-6">
          {leyendo && (
            <button onClick={detenerVoz}
              className="w-14 h-14 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shadow-md">
              <VolumeX size={24} />
            </button>
          )}
          <button
            onClick={escuchando ? detenerEscucha : iniciarEscucha}
            disabled={procesando}
            className={`
              w-20 h-20 rounded-full shadow-xl flex items-center justify-center
              transition-all duration-200 active:scale-95
              ${escuchando
                ? 'bg-red-500 text-white animate-pulse'
                : procesando
                  ? 'bg-amber-500 text-white'
                  : 'bg-primary text-white hover:bg-primary/90'
              }
            `}
          >
            {procesando ? (
              <Loader2 size={36} className="animate-spin" />
            ) : escuchando ? (
              <MicOff size={36} />
            ) : (
              <Mic size={36} />
            )}
          </button>
          {leyendo && (
            <button onClick={() => leerTexto(historial[historial.length - 1]?.texto || '')}
              className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center shadow-md">
              <Volume2 size={24} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Modo flotante (modal) ──
  return (
    <>
      {abierto && (
        <div className="fixed bottom-40 right-4 z-50 flex flex-col">
          {chatPanel}
        </div>
      )}

      {/* ── Botón flotante ── */}
      <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-2">
        <button
          onClick={() => setAbierto(!abierto)}
          className={`
            w-14 h-14 rounded-full shadow-lg flex items-center justify-center
            transition-all duration-200 active:scale-95
            ${abierto
              ? 'bg-primary text-white'
              : escuchando
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-primary text-white hover:bg-primary/90'
            }
          `}
        >
          {abierto ? <X size={24} /> : <Mic size={24} />}
        </button>
        <span className="text-[10px] text-gray-400 text-center">
          {abierto ? 'Cerrar' : 'Hablar'}
        </span>
      </div>
    </>
  );
}
