import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useAgentes } from '../lib/AgentContext';
import { guardarConversacion } from '../lib/learningSystem';
import { Capacitor } from '@capacitor/core';

// SpeechRecognition se carga dinámicamente solo en plataforma nativa
let SpeechRecognition = null;
(async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      const mod = await import('@capacitor-community/speech-recognition');
      SpeechRecognition = mod.SpeechRecognition;
    } catch {}
  }
})();

const WELCOME_VENTAS = '¡Hola! Soy tu agente de ventas Agrilux. Conozco las ofertas de tiendas registradas en la app. Pregúntame por productos, precios o dónde comprar cerca. ¿Qué necesitas?';
const WELCOME_PLAGAS = '¡Hola! Soy tu asistente técnico. Puedo ayudarte con diagnóstico de plagas, recomendaciones de productos y consejos para tus cultivos. ¿En qué te puedo ayudar?';
const WELCOME_PARCELA = '¡Hola! Soy tu agente de parcela. Conozco tu cultivo, los índices satelitales MSAVI2, NDVI y NDRE, y el riesgo de plagas. Pregúntame por riego, fertilización, etapa del cultivo o qué índice revisar. ¿En qué te ayudo?';

export default function VoiceAssistant({
  disabled = false,
  fullPage = false,
  embedded = false,
  agentType = 'ventas',
  parcelaContext = null,
  misTiendas = [],
}) {
  const { user } = useAuth();
  const { ubicacion, coords, ofertasRegistradas, productoRecomendado } = useAgentes();
  const [escuchando, setEscuchando]       = useState(false);
  const [procesando, setProcesando]       = useState(false);
  const [transcripcion, setTranscripcion] = useState('');
  const [respuesta, setRespuesta]         = useState('');
  const [error, setError]                 = useState('');
  const [coordenadas, setCoordenadas]     = useState(null);
  const [historial, setHistorial]         = useState([]);
  const [started, setStarted]             = useState(false);

  const recognitionRef = useRef(null);

  useEffect(() => {
    if (coords?.lat && coords?.lon) {
      setCoordenadas({ lat: coords.lat, lon: coords.lon });
    } else {
      (async () => {
        try {
          if (window.Capacitor?.isNativePlatform?.()) {
            const { Geolocation } = await import('@capacitor/geolocation');
            const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 5000 });
            setCoordenadas({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          } else if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => setCoordenadas({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
              () => {},
              { timeout: 5000 }
            );
          }
        } catch {}
      })();
    }
  }, [coords?.lat, coords?.lon]);

  const welcomeMsg = agentType === 'ventas' ? WELCOME_VENTAS
    : agentType === 'parcela' ? WELCOME_PARCELA
    : WELCOME_PLAGAS;

  const leerTexto = useCallback((texto) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(texto);
    utter.lang = 'es-PE';
    utter.rate = 0.9;
    utter.pitch = 1.0;
    const voces = window.speechSynthesis.getVoices();
    const vozES = voces.find(v => v.lang.startsWith('es')) || voces[0];
    if (vozES) utter.voice = vozES;
    window.speechSynthesis.speak(utter);
  }, []);

  const detenerVoz = useCallback(() => {
    window.speechSynthesis?.cancel();
  }, []);

  const enviarAI = useCallback(async (mensaje, hist) => {
    setProcesando(true);
    setError('');
    const endpoint = '/api/voice-assistant';
    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje,
          historial: hist.slice(-10),
          lat: coordenadas?.lat || coords?.lat || parcelaContext?.lat || null,
          lon: coordenadas?.lon || coords?.lon || parcelaContext?.lon || null,
          ubicacion: ubicacion || user?.ubicacion || parcelaContext?.gps || null,
          nombre: user?.nombre || null,
          agentType,
          parcelaContext,
          ofertasRegistradas: ofertasRegistradas.slice(0, 12),
          productoRecomendado: productoRecomendado?.nombre || null,
          misTiendas: misTiendas.slice(0, 10),
        }),
      });
      const data = await r.json();
      const resp = data.respuesta || 'No pude procesar tu pregunta. Intenta de nuevo.';
      setRespuesta(resp);
      leerTexto(resp);
      return resp;
    } catch {
      const fallback = 'Hubo un error de conexión. Verifica tu internet e intenta de nuevo.';
      setRespuesta(fallback);
      setError('Error de conexión');
      return fallback;
    } finally {
      setProcesando(false);
    }
  }, [coordenadas, user, agentType, ubicacion, coords, leerTexto, ofertasRegistradas, productoRecomendado, parcelaContext, misTiendas]);

  const iniciarEscucha = useCallback(async () => {
    // Toggle: si ya está escuchando, detiene y sale
    if (escuchando) {
      await detenerEscucha();
      return;
    }
    if (!SpeechRecognition) {
      // Reintento de carga tardía (por si el import dinámico aún no terminó)
      if (Capacitor.isNativePlatform()) {
        try {
          const mod = await import('@capacitor-community/speech-recognition');
          SpeechRecognition = mod.SpeechRecognition;
        } catch {}
      }
    }
    if (!SpeechRecognition) {
      setError('Reconocimiento de voz solo disponible en app nativa Android');
      return;
    }
    try {
      const { available } = await SpeechRecognition.available();
      if (!available) { setError('Reconocimiento de voz no disponible (available=false). Activa “Speech Services by Google”.'); return; }
      await SpeechRecognition.requestPermissions();
      setEscuchando(true);
      setTranscripcion('');
      const result = await SpeechRecognition.start({
        language: 'es-PE',
        maxResults: 5,
        prompt: 'Habla ahora...',
        popup: true,
        partialResults: false,
      });
      setEscuchando(false);
      const finalText = (result.matches || []).find((m) => m && m.trim())?.trim() || '';
      if (finalText) {
        setTranscripcion(finalText);
        const nuevoHistorial = [...historial, { rol: 'usuario', texto: finalText }];
        setHistorial(nuevoHistorial);
        enviarAI(finalText, nuevoHistorial);
      } else {
        setError('No te escuché bien. Habla más fuerte y cerca del micrófono. (matches vacío)');
      }
    } catch (e) {
      try { await SpeechRecognition?.stop?.(); } catch {}
      setEscuchando(false);
      console.warn('[Voz] start falló:', e);
      const msg = String(e?.message || '');
      const code = String(e?.code || '');
      if (code === 'permission' || /permission|denied|RECORD_AUDIO/i.test(msg)) setError('Permiso de micrófono denegado');
      else setError(`Error de voz. Intenta de nuevo. (diag: ${code || 'sin-code'} ${msg.slice(0, 120)})`);
    }
  }, [historial, enviarAI]);

  const detenerEscucha = useCallback(async () => {
    // Fuerza el estado a false INMEDIATAMENTE para UI responsiva
    setEscuchando(false);
    
    if (!SpeechRecognition) return;
    
    try {
      console.log('[Voz] detenerEscucha llamado');
      await SpeechRecognition.stop();
      console.log('[Voz] stop() completado');
    } catch (e) {
      console.warn('[Voz] Error en stop():', e);
    }
  }, []);

  // Auto-start welcome on mount (fullPage or embedded mode)
  useEffect(() => {
    if ((fullPage || embedded) && !started) {
      setRespuesta(welcomeMsg);
      if (embedded) {
        setStarted(true);
      } else {
        setTimeout(() => leerTexto(welcomeMsg), 500);
        setStarted(true);
      }
    }
  }, [fullPage, embedded]);

  // Limpieza al desmontar o si se deshabilita
  useEffect(() => {
    return () => {
      if (SpeechRecognition && escuchando) {
        SpeechRecognition.stop().catch(() => {});
      }
    };
  }, [escuchando, disabled]);

  if (disabled) {
    if (escuchando) setEscuchando(false);
    return null;
  }

  // ── Embedded mode (inline card, e.g. Mi Parcela) ──
  if (embedded) {
    return (
      <div className="space-y-4">
        {respuesta && (
          <div className="bg-primary/5 rounded-xl p-3 border border-primary/10">
            <p className="text-sm text-gray-700 leading-relaxed">{respuesta}</p>
          </div>
        )}

        {escuchando && transcripcion && (
          <div className="bg-primary/10 rounded-xl px-3 py-2">
            <p className="text-sm text-primary italic">"{transcripcion}"</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 rounded-xl px-3 py-2">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex flex-col items-center gap-3 py-2">
          <button
            onClick={escuchando ? detenerEscucha : iniciarEscucha}
            disabled={procesando}
            className={`
              w-20 h-20 rounded-full shadow-lg flex items-center justify-center
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
          <p className="text-xs text-gray-500 text-center">
            {escuchando ? '🔴 Escuchando... habla ahora' :
             procesando ? '⏳ Consultando...' :
             'Toca el micrófono para preguntar sobre tu parcela'}
          </p>
        </div>
      </div>
    );
  }

  // ── Full Page mode ──
  if (fullPage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        {/* Última respuesta */}
        {respuesta && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 max-w-md w-full">
            <p className="text-sm text-gray-700 leading-relaxed">{respuesta}</p>
          </div>
        )}

        {/* Transcripción en tiempo real */}
        {escuchando && transcripcion && (
          <div className="bg-primary/10 rounded-xl px-4 py-2 max-w-md w-full">
            <p className="text-sm text-primary italic">"{transcripcion}"</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 rounded-xl px-4 py-2 max-w-md w-full">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Micrófono grande */}
        <button
          onClick={escuchando ? detenerEscucha : iniciarEscucha}
          disabled={procesando}
          className={`
            w-24 h-24 rounded-full shadow-xl flex items-center justify-center
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
            <Loader2 size={40} className="animate-spin" />
          ) : escuchando ? (
            <MicOff size={40} />
          ) : (
            <Mic size={40} />
          )}
        </button>

        <p className="text-sm text-gray-400">
          {escuchando ? '🔴 Escuchando... habla ahora' :
           procesando ? '⏳ Consultando...' :
           'Toca el micrófono para hablar'}
        </p>
      </div>
    );
  }

  // ── Floating mode (default) ──
  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-2">
      <button
        onClick={escuchando ? detenerEscucha : iniciarEscucha}
        disabled={procesando}
        className={`
          w-16 h-16 rounded-full shadow-xl flex items-center justify-center
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

      <span className="text-[10px] text-gray-400 text-center">
        {escuchando ? '🔴 Hablando...' : procesando ? '⏳' : 'Hablar'}
      </span>

      {/* Transcripción flotante */}
      {escuchando && transcripcion && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-3 py-2 max-w-[250px]">
          <p className="text-xs text-gray-600 italic">"{transcripcion}"</p>
        </div>
      )}

      {/* Respuesta flotante */}
      {respuesta && !escuchando && !procesando && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 px-3 py-2 max-w-[280px]">
          <p className="text-xs text-gray-700">{respuesta}</p>
        </div>
      )}
    </div>
  );
}
