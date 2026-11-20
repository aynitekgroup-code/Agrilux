import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, MessageSquareText, RefreshCw, Send, Sparkles, X } from 'lucide-react';

import { resolverPregunta, armarContextoIa, TEXTO_AYUDA, sugerencias } from '../../lib/preguntarAgrilux';
import { obtenerEstadoUnidadesFlota } from '../../lib/agrotrackReportesGeocerca';
import { cargarGruposUnidades } from '../../lib/agrotrackGrupos';
import { llamarIaGestion } from '../../lib/agrotrackIa';

/**
 * src/components/gestion/PreguntarAgrilux.jsx
 * Chat "Preguntar a Agrilux" (asistente tipo Alexa/Siri de la flota).
 *
 * - Texto con respuestas INSTANTÁNEAS: el parser determinista
 *   (src/lib/preguntarAgrilux.js) resuelve placas, grupos, geocercas y
 *   resumen contra las filas de estado + grupos ya cargadas (gratis).
 * - La IA (llamarIaGestion, modo 'preguntar') entra SOLO de fallback cuando
 *   el parser no entiende la pregunta; nunca calcula cifras.
 * - Mobile-friendly: FAB + hoja inferior en móvil, panel lateral en
 *   escritorio; estados cargando / error / vacío siempre visibles.
 * - Voz: pendiente (fase 2, junto con la retroalimentación de Carlos).
 *
 * Z-index: 1300 (FAB y panel) por encima de los controles del mapa
 * (leaflet: 400-800) y de los widgets internos del mapa (1100-1200); el
 * toast de la página queda en 1400.
 */

let contadorMensajes = 0;
const nuevoId = () => {
  contadorMensajes += 1;
  return contadorMensajes;
};

const BIENVENIDA = {
  id: 0,
  rol: 'bot',
  fuente: 'ayuda',
  titulo: 'Preguntar a Agrilux',
  lineas: TEXTO_AYUDA,
};

function Burbuja({ mensaje }) {
  if (mensaje.rol === 'user') {
    return (
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-[13px] leading-snug text-white whitespace-pre-wrap"
        style={{ background: '#0F4C3A' }}>
        {mensaje.texto}
      </div>
    );
  }

  if (mensaje.pensando) {
    return (
      <div className="mr-auto inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm">
        <Loader2 size={14} className="animate-spin text-emerald-600" />
        <span className="text-[12.5px] text-slate-500">Pensando…</span>
      </div>
    );
  }

  const esError = mensaje.fuente === 'error';
  return (
    <div className={`mr-auto max-w-[92%] rounded-2xl rounded-bl-md border px-3.5 py-2.5 shadow-sm ${
      esError ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
      {mensaje.titulo ? (
        <p className={`mb-1 flex items-center gap-1.5 text-[12px] font-bold ${esError ? 'text-red-700' : 'text-slate-800'}`}>
          {mensaje.fuente === 'ia' ? <Sparkles size={12} className="shrink-0 text-emerald-600" /> : null}
          {mensaje.titulo}
        </p>
      ) : null}
      {mensaje.lineas?.map((linea, i) => (
        <p key={`${i}-${linea.slice(0, 20)}`}
          className={`text-[12.5px] leading-relaxed whitespace-pre-wrap ${esError ? 'text-red-700' : 'text-slate-600'}`}>
          {linea}
        </p>
      ))}
      {mensaje.fuente === 'ia' ? (
        <p className="mt-1.5 border-t border-slate-100 pt-1.5 text-[10px] text-slate-400">
          Respuesta con IA · los datos del periodo siguen siendo los de la base.
        </p>
      ) : null}
    </div>
  );
}

export default function PreguntarAgrilux({ empresaId = null, empresaNombre = '' }) {
  const [abierto, setAbierto] = useState(false);
  const [datos, setDatos] = useState({ estado: 'inicial', filas: [], grupos: {}, error: null });
  const [mensajes, setMensajes] = useState([BIENVENIDA]);
  const [entrada, setEntrada] = useState('');
  const [pensando, setPensando] = useState(false);
  const refMensajes = useRef(null);

  const cargando = datos.estado === 'cargando';
  const conError = datos.estado === 'error';
  const listo = datos.estado === 'listo';

  const cargar = useCallback(async () => {
    if (!empresaId) return;
    setDatos((prev) => ({ ...prev, estado: 'cargando', error: null }));
    try {
      // Último estado de TODAS las placas (sin rango) + grupos por placa.
      const [filas, gruposRes] = await Promise.all([
        obtenerEstadoUnidadesFlota(empresaId, { desde: null, hasta: null }),
        cargarGruposUnidades(empresaId),
      ]);
      setDatos({
        estado: 'listo',
        filas: filas || [],
        grupos: gruposRes?.grupos || {},
        gruposAviso: gruposRes?.aviso || null,
        error: null,
      });
    } catch (e) {
      setDatos((prev) => ({
        ...prev,
        estado: 'error',
        error: e?.message || 'No se pudo cargar el estado de la flota.',
      }));
    }
  }, [empresaId]);

  // Al abrir la primera vez: carga el estado + grupos.
  useEffect(() => {
    if (abierto && datos.estado === 'inicial') cargar();
  }, [abierto, datos.estado, cargar]);

  // Auto-scroll al final de la conversación.
  useEffect(() => {
    const el = refMensajes.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [mensajes, abierto]);

  const chips = useMemo(() => sugerencias({ estado: datos.filas }), [datos.filas]);

  const enviar = async (textoCrudo) => {
    const texto = String(textoCrudo ?? '').trim();
    if (!texto || pensando) return;
    setEntrada('');
    setMensajes((prev) => [...prev, { id: nuevoId(), rol: 'user', texto }]);

    const respuesta = resolverPregunta(texto, { estado: datos.filas, grupos: datos.grupos });
    if (respuesta.fuente !== 'ia') {
      setMensajes((prev) => [...prev, {
        id: nuevoId(),
        rol: 'bot',
        titulo: respuesta.titulo,
        lineas: respuesta.lineas,
        fuente: respuesta.fuente,
      }]);
      return;
    }

    // Último recurso: una llamada de IA con el estado ya agregado.
    const idPensando = nuevoId();
    setPensando(true);
    setMensajes((prev) => [...prev, { id: idPensando, rol: 'bot', pensando: true }]);
    try {
      const data = await llamarIaGestion({
        modo: 'preguntar',
        contexto: armarContextoIa(texto, { estado: datos.filas, grupos: datos.grupos }),
      });
      const lineas = String(data?.texto || '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      if (!lineas.length) throw new Error('La IA no devolvió una respuesta utilizable.');
      setMensajes((prev) => prev.map((m) => (m.id === idPensando
        ? { id: idPensando, rol: 'bot', titulo: 'Respuesta con IA', lineas, fuente: 'ia' }
        : m)));
    } catch (e) {
      setMensajes((prev) => prev.map((m) => (m.id === idPensando
        ? {
          id: idPensando,
          rol: 'bot',
          titulo: 'No se pudo responder con IA',
          lineas: [
            e?.message || 'Error consultando la IA.',
            'Prueba con una pregunta de datos: una placa, un grupo, una geocerca o "estado de la flota" (eso es instantáneo y sin IA).',
          ],
          fuente: 'error',
        }
        : m)));
    } finally {
      setPensando(false);
    }
  };

  const estadoSubtitulo = cargando
    ? 'Cargando estado de la flota…'
    : conError
      ? 'Sin datos de estado'
      : listo
        ? `${datos.filas.length} unidad${datos.filas.length === 1 ? '' : 'es'}${empresaNombre ? ` · ${empresaNombre}` : ''}`
        : 'Asistente de la flota';

  return (
    <>
      {/* FAB: móvil (subido sobre la navegación inferior) / escritorio. */}
      {!abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Preguntar a Agrilux"
          title="Preguntar a Agrilux"
          className="fixed right-4 bottom-20 sm:right-5 sm:bottom-5 z-[1300] grid h-12 w-12 place-items-center rounded-full text-white shadow-[0_6px_24px_rgba(15,76,58,0.45)] ring-2 ring-white/70 transition-transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-emerald-300/50"
          style={{ background: 'linear-gradient(135deg, #0F4C3A, #15803D)' }}
        >
          <MessageSquareText size={20} />
        </button>
      ) : null}

      {abierto ? (
        <div
          role="dialog"
          aria-label="Preguntar a Agrilux"
          className="fixed inset-x-0 bottom-0 z-[1300] flex h-[80vh] max-h-[80vh] flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-[0_12px_48px_rgba(15,23,42,0.35)] sm:inset-x-auto sm:right-5 sm:bottom-5 sm:h-[560px] sm:max-h-[75vh] sm:w-[380px] sm:rounded-2xl"
        >
          {/* Cabecera */}
          <div className="flex items-center gap-2.5 px-4 py-3 text-white" style={{ background: 'linear-gradient(135deg, #0F4C3A, #0B3A2B)' }}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15">
              <Sparkles size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-bold leading-tight">Preguntar a Agrilux</p>
              <p className="truncate text-[11px] text-white/70">{estadoSubtitulo}</p>
            </div>
            <button
              type="button"
              onClick={cargar}
              disabled={cargando}
              aria-label="Actualizar estado"
              title="Actualizar estado de la flota"
              className="rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white disabled:opacity-40"
            >
              <RefreshCw size={15} className={cargando ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar chat"
              className="rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
            >
              <X size={17} />
            </button>
          </div>

          {/* Estados de carga / error de los datos */}
          {cargando ? (
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
              <Loader2 size={13} className="animate-spin text-emerald-600" />
              <span className="text-[11.5px] text-slate-500">Consultando el estado de unidades y grupos…</span>
            </div>
          ) : null}

          {conError ? (
            <div className="flex items-start gap-2 border-b border-red-100 bg-red-50 px-4 py-2.5">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-600" />
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] font-semibold text-red-700">No se pudo cargar el estado de la flota</p>
                <p className="mt-0.5 break-words text-[11px] leading-relaxed text-red-600">{datos.error}</p>
              </div>
              <button
                type="button"
                onClick={cargar}
                className="shrink-0 rounded-lg border border-red-300 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100"
              >
                Reintentar
              </button>
            </div>
          ) : null}

          {listo && !datos.filas.length ? (
            <div className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-[11.5px] text-amber-700">
              Esta empresa todavía no tiene posiciones: las respuestas de datos estarán vacías.
            </div>
          ) : null}

          {listo && datos.filas.length > 0 && Object.keys(datos.grupos).length === 0 ? (
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11.5px] leading-relaxed text-slate-500">
              {datos.gruposAviso
                || 'Sin grupos asignados todavía: asigna grupos desde el mapa para preguntar por ellos.'}
            </div>
          ) : null}

          {/* Conversación */}
          <div ref={refMensajes} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-slate-50 px-3.5 py-3">
            {mensajes.map((m) => <Burbuja key={m.id} mensaje={m} />)}
          </div>

          {/* Sugerencias */}
          <div className="flex flex-wrap gap-1.5 border-t border-slate-100 bg-slate-50 px-3 pb-2">
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                disabled={pensando}
                onClick={() => enviar(chip)}
                className="rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-40"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Entrada */}
          <form
            onSubmit={(e) => { e.preventDefault(); enviar(entrada); }}
            className="flex items-center gap-2 border-t border-slate-100 bg-white px-3 py-2.5"
          >
            <input
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              disabled={pensando}
              placeholder="Pregunta por placa, grupo o geocerca…"
              aria-label="Pregunta a Agrilux"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={pensando || !entrada.trim()}
              aria-label="Enviar pregunta"
              className="shrink-0 rounded-xl p-2.5 text-white transition-opacity disabled:opacity-40"
              style={{ background: '#0F4C3A' }}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
