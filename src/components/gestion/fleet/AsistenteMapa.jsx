import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Bot, LoaderCircle, Sparkles, X } from 'lucide-react';
import { resumenGeocercasParaIA } from '../../../lib/asistenteMapa';

/**
 * Asistente JARVIS del mapa (FASE 3.8): botón flotante grande y brillante que
 * abre un panel de chat (texto + voz). La IA responde Y pide acciones al mapa
 * (enfocar, seleccionar, filtrar por grupo, limpiar, ajustar), que ejecuta el
 * padre a través de `onAccion`.
 *
 * Va DENTRO del contenedor del mapa (position absolute) para no tapar la página.
 */

const SpeechRecognitionCtor =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

const SUGERENCIAS = [
  '¿Cuántas geocercas hay y de qué grupos?',
  'Llévame a la oficina central',
  'Muestra solo los distritos',
];

function burbujasCargando() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}

export default function AsistenteMapa({ geofences = [], seleccion = null, onAccion }) {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState([
    {
      rol: 'asistente',
      texto: 'Hola, soy JARVIS. Pregúntame por las geocercas o dime qué hacer: "llévame a Medano", "solo oficinas", "¿cuántos campos hay?".',
      notas: [],
    },
  ]);
  const [entrada, setEntrada] = useState('');
  const [cargando, setCargando] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);
  const listaRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight, behavior: 'smooth' });
  }, [mensajes, cargando, abierto]);

  useEffect(() => () => recognitionRef.current?.abort?.(), []);

  useEffect(() => {
    if (abierto) setTimeout(() => inputRef.current?.focus(), 120);
  }, [abierto]);

  const enviar = async (texto) => {
    const pregunta = String(texto || '').trim();
    if (!pregunta || cargando) return;
    setError('');
    setEntrada('');
    setMensajes((prev) => [...prev, { rol: 'usuario', texto: pregunta, notas: [] }]);
    setCargando(true);
    try {
      const res = await fetch('/api/voice-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modo: 'mapa',
          mensaje: pregunta,
          historial: mensajes.slice(-6).map((m) => ({ rol: m.rol, texto: m.texto })),
          geocercas: resumenGeocercasParaIA(geofences),
          seleccion: seleccion
            ? { id: seleccion.id, nombre: seleccion.nombre }
            : null,
        }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      const notas = [];
      for (const accion of data.acciones || []) {
        try {
          const nota = await onAccion?.(accion);
          if (nota) notas.push(nota);
        } catch (accionError) {
          notas.push(`⚠️ ${accionError.message || 'No se pudo ejecutar la acción'}`);
        }
      }
      setMensajes((prev) => [
        ...prev,
        { rol: 'asistente', texto: data.respuesta || 'Listo.', notas },
      ]);
    } catch (envioError) {
      setError(envioError.message || 'No pude conectar con el asistente.');
    } finally {
      setCargando(false);
    }
  };

  /* ----- Voz del chat ----- */

  const toggleVoz = () => {
    if (!SpeechRecognitionCtor) {
      setError('Tu navegador no soporta voz. Usa Chrome o Edge.');
      return;
    }
    if (escuchando) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'es-PE';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0]?.transcript || '')
        .join(' ')
        .trim();
      if (!transcript) return;
      setEntrada(transcript);
      if (event.results[event.results.length - 1]?.isFinal) {
        recognition.stop();
        enviar(transcript);
      }
    };
    recognition.onerror = (event) => {
      const mensajes = {
        'not-allowed': 'Permite el micrófono para hablar con JARVIS.',
        'no-speech': 'No te escuché. Toca el micrófono e inténtalo otra vez.',
        network: 'La voz necesita conexión a internet.',
      };
      setError(mensajes[event.error] || 'No se pudo reconocer la voz.');
      setEscuchando(false);
    };
    recognition.onend = () => {
      setEscuchando(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setEscuchando(true);
    } catch {
      setEscuchando(false);
      recognitionRef.current = null;
    }
  };

  /* ----- Botón flotante ----- */

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="group absolute bottom-3 right-3 z-[1200] grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 text-white shadow-[0_6px_24px_rgba(16,185,129,0.55)] ring-2 ring-white/70 transition-transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-emerald-300/60"
        aria-label="Abrir asistente JARVIS del mapa"
        title="JARVIS · asistente del mapa"
      >
        <Bot size={26} className="drop-shadow" />
        <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-amber-400" />
        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" />
      </button>
    );
  }

  /* ----- Panel de chat ----- */

  return (
    <div
      className="absolute bottom-3 right-3 z-[1200] flex h-[440px] max-h-[75%] w-[min(370px,calc(100%-24px))] flex-col overflow-hidden rounded-2xl border border-emerald-500/40 bg-slate-950/95 shadow-[0_10px_40px_rgba(15,23,42,0.55)] backdrop-blur"
      role="dialog"
      aria-label="Asistente JARVIS del mapa"
    >
      {/* Cabecera */}
      <div className="flex items-center gap-2 border-b border-emerald-500/25 bg-gradient-to-r from-emerald-600/90 via-emerald-700/90 to-teal-800/90 px-3 py-2.5">
        <span className="relative grid h-8 w-8 place-items-center rounded-full bg-white/15 text-emerald-100">
          <Sparkles size={16} />
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-300/30" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-white">JARVIS</p>
          <p className="text-[10px] text-emerald-100/80">
            Asistente del mapa · {geofences.length} geocercas
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-lg p-1.5 text-emerald-100/90 transition-colors hover:bg-white/15 hover:text-white"
          aria-label="Cerrar asistente"
        >
          <X size={16} />
        </button>
      </div>

      {/* Mensajes */}
      <div ref={listaRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {mensajes.map((mensaje, index) => (
          <div key={index} className={`flex ${mensaje.rol === 'usuario' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed ${
                mensaje.rol === 'usuario'
                  ? 'rounded-br-sm bg-emerald-600 text-white'
                  : 'rounded-tl-sm bg-slate-800/95 text-slate-100'
              }`}
            >
              <p className="whitespace-pre-wrap">{mensaje.texto}</p>
              {mensaje.notas?.length ? (
                <ul className="mt-1.5 space-y-0.5 border-t border-emerald-500/25 pt-1.5">
                  {mensaje.notas.map((nota, i) => (
                    <li key={i} className="flex items-start gap-1 text-[11px] text-emerald-300">
                      <span>▸</span>
                      <span>{nota}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ))}
        {cargando ? (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-tl-sm bg-slate-800/95 px-3 py-2.5 text-emerald-300">
              {burbujasCargando()}
            </div>
          </div>
        ) : null}
        {error ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/15 px-2.5 py-2 text-[11.5px] text-red-200" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {/* Sugerencias */}
      {mensajes.length <= 1 ? (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {SUGERENCIAS.map((sugerencia) => (
            <button
              key={sugerencia}
              type="button"
              onClick={() => enviar(sugerencia)}
              className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200 transition-colors hover:bg-emerald-500/25"
            >
              {sugerencia}
            </button>
          ))}
        </div>
      ) : null}

      {/* Entrada */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          enviar(entrada);
        }}
        className="flex items-center gap-2 border-t border-slate-700/80 bg-slate-900/90 px-2.5 py-2.5"
      >
        <input
          ref={inputRef}
          type="text"
          value={entrada}
          onChange={(event) => setEntrada(event.target.value)}
          placeholder="Pregúntale a JARVIS…"
          className="min-w-0 flex-1 rounded-full border border-slate-700 bg-slate-950/80 px-3.5 py-2 text-[12.5px] text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-500"
          aria-label="Mensaje para JARVIS"
        />
        <button
          type="button"
          onClick={toggleVoz}
          aria-label={escuchando ? 'Detener escucha' : 'Hablar con JARVIS'}
          aria-pressed={escuchando}
          title={SpeechRecognitionCtor ? 'Hablar con JARVIS' : 'Tu navegador no soporta voz'}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition-all ${
            escuchando
              ? 'animate-pulse bg-gradient-to-br from-red-400 to-red-600 text-white shadow-[0_0_16px_rgba(239,68,68,0.6)]'
              : 'bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.45)] hover:scale-105'
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        </button>
        <button
          type="submit"
          disabled={cargando || !entrada.trim()}
          aria-label="Enviar mensaje"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-500 text-white transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {cargando ? <LoaderCircle size={17} className="animate-spin" /> : <ArrowUp size={18} />}
        </button>
      </form>
    </div>
  );
}
