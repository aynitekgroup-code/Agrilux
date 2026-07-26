import React, { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Loader2, X, MessageCircle } from 'lucide-react';

/**
 * VoiceAssistant — Asistente agrícola inteligente por voz
 *
 * Flujo:
 * 1. Agricultor presiona micrófono y habla
 * 2. Se transcribe con Web Speech API (gratuito, offline)
 * 3. Se envía a /api/voice-assistant → IA responde
 * 4. Se lee la respuesta en voz alta (es-PE)
 * 5. El agricultor puede seguir hablando (conversación continua)
 */

const WELCOME_MSG = '¡Hola! Soy tu asistente agrícola. ¿En qué te puedo ayudar? Pregúntame sobre plagas, enfermedades, o qué aplicar en tu cultivo.';

export default function VoiceAssistant({ disabled = false }) {
  const [abierto, setAbierto]             = useState(false);
  const [escuchando, setEscuchando]       = useState(false);
  const [procesando, setProcesando]       = useState(false);
  const [leyendo, setLeyendo]             = useState(false);
  const [transcripcion, setTranscripcion] = useState('');
  const [historial, setHistorial]         = useState([]);
  const [error, setError]                 = useState('');
  const [mostrarChat, setMostrarChat]     = useState(false);
  const [coordenadas, setCoordenadas]     = useState(null);

  const recognitionRef = useRef(null);
  const chatEndRef     = useRef(null);

  // Obtener ubicación del navegador al montar
  React.useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoordenadas({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {},
      { timeout: 5000 }
    );
  }, []);

  // ── Enviar mensaje a la API y obtener respuesta ──
  const enviarAI = useCallback(async (mensaje, hist) => {
    setProcesando(true);
    setError('');
    try {
      const r = await fetch('/api/voice-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje,
          historial: hist.slice(-10),
          lat: coordenadas?.lat || null,
          lon: coordenadas?.lon || null,
        }),
      });
      const data = await r.json();
      const respuesta = data.respuesta || 'No pude procesar tu pregunta. Intenta de nuevo.';

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
  }, [coordenadas]);

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

  return (
    <>
      {/* ── Panel de chat (cuando está abierto) ── */}
      {abierto && (
        <div className="fixed bottom-40 right-4 z-50 w-[320px] max-h-[55vh] bg-white rounded-3xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-primary text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <MessageCircle size={16} />
              </div>
              <div>
                <p className="text-sm font-bold">PlaguIA Asistente</p>
                <p className="text-[10px] text-white/70">Agrónomo inteligente por voz</p>
              </div>
            </div>
            <button onClick={() => { setAbierto(false); detenerVoz(); }}
              className="text-white/70 hover:text-white p-1">
              <X size={18} />
            </button>
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
