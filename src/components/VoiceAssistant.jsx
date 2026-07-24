import React, { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2, Loader2 } from 'lucide-react';

/**
 * VoiceAssistant — Botón flotante de voz para Agrilux
 * 
 * Permite al agricultor:
 * 1. Hablar para hacer preguntas ("¿Mis hojas están amarillas?")
 * 2. Escuchar respuestas en español peruano
 * 
 * Uso:
 *   <VoiceAssistant onPregunta={(texto) => procesar(texto)} />
 */

export default function VoiceAssistant({ onPregunta, onResultado, disabled = false }) {
  const [escuchando, setEscuchando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [transcripcion, setTranscripcion] = useState('');
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);

  const iniciarEscucha = useCallback(() => {
    setError('');

    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      setError('Tu navegador no soporta reconocimiento de voz. Usa Chrome.');
      return;
    }

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
        setProcesando(true);
        onPregunta?.(finalTranscript);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setEscuchando(false);
      if (event.error === 'no-speech') {
        setError('No te escuché. Intenta de nuevo.');
      } else if (event.error === 'audio-capture') {
        setError('No se pudo acceder al micrófono.');
      } else {
        setError('Error de voz. Intenta de nuevo.');
      }
    };

    recognition.onend = () => {
      setEscuchando(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [onPregunta]);

  const detenerEscucha = useCallback(() => {
    recognitionRef.current?.stop();
    setEscuchando(false);
  }, []);

  const escuchar = useCallback((texto) => {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(texto);
    utter.lang = 'es-PE';
    utter.rate = 0.9;
    utter.pitch = 1.0;

    // Buscar voz femenina en español si disponible
    const voces = window.speechSynthesis.getVoices();
    const vozES = voces.find(v => v.lang.startsWith('es') && v.name.includes('female'))
      || voces.find(v => v.lang.startsWith('es'))
      || voces[0];
    if (vozES) utter.voice = vozES;

    window.speechSynthesis.speak(utter);
  }, []);

  // Exponer función escuchar para que el padre pueda llamarla
  React.useImperativeHandle(
    React.useRef(),
    () => ({ escuchar }),
    [escuchar]
  );

  if (disabled) return null;

  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-2">
      {/* Transcripción visible */}
      {transcripcion && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 max-w-[250px] text-sm text-gray-700">
          {transcripcion}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 rounded-xl shadow-lg border border-red-200 p-3 max-w-[250px] text-xs text-red-600">
          {error}
        </div>
      )}

      {/* Botón principal */}
      <button
        onClick={escuchando ? detenerEscucha : iniciarEscucha}
        disabled={procesando}
        className={`
          w-14 h-14 rounded-full shadow-lg flex items-center justify-center
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
          <Loader2 size={24} className="animate-spin" />
        ) : escuchando ? (
          <MicOff size={24} />
        ) : (
          <Mic size={24} />
        )}
      </button>

      {/* Label */}
      <span className="text-[10px] text-gray-400 text-center">
        {escuchando ? 'Escuchando...' : procesando ? 'Analizando...' : 'Hablar'}
      </span>
    </div>
  );
}
