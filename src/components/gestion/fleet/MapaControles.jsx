import React, { useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileSpreadsheet,
  Layers,
  LoaderCircle,
  MapPinned,
  Mic,
  MicOff,
  Search,
  Satellite,
  Table,
  X,
} from 'lucide-react';
import { COLORES_GRUPO, ETIQUETAS_GRUPO } from '../../../lib/asistenteMapa';
import { areaHectareas, contarVertices } from '../../../lib/geocercasGeometria';
import { agruparUnidades, grupoSugerido } from '../../../lib/agrotrackGrupos';
import { formatearFechaLarga } from '../../../lib/agrotrackFlota';
import { useLimiteFilas, BotonVerMas } from './reportesComunes';

/**
 * Controles flotantes del mapa de flota (FASE 3.8):
 *   * LeyendaGrupos    → leyenda con colores y conteos por grupo (abajo-izquierda).
 *   * FichaGeocerca    → ficha de la geocerca seleccionada con vértices y área (arriba-derecha).
 *   * ControlVistaSatelite → alterna vista satélite / calle (arriba-derecha).
 * Van DENTRO del contenedor del mapa (position absolute).
 *
 * Observaciones VI / VII / VIII (van FUERA del mapa, en la tarjeta FleetMap):
 *   * PanelGruposUnidades   → localizador con grupos colapsables y asignación.
 *   * TablaCoordenadas      → una fila por marcador visible, exportable.
 *   * TablaRecorrido        → página del recorrido histórico + paginación.
 *   * PanelUnidadesGeocerca → unidades dentro de la geocerca seleccionada.
 */

/* ------------------------------------------------------------------ */
/* Leyenda                                                             */
/* ------------------------------------------------------------------ */

const ORDEN_GRUPOS = ['autorizada', 'oficina', 'distrito', 'poligono'];

export function LeyendaGrupos({ geofences = [] }) {
  const conteos = useMemo(() => {
    const cuenta = {};
    for (const g of geofences) {
      const clave = g.tipo && COLORES_GRUPO[g.tipo] ? g.tipo : 'poligono';
      cuenta[clave] = (cuenta[clave] || 0) + 1;
    }
    return cuenta;
  }, [geofences]);

  const visibles = ORDEN_GRUPOS.filter((grupo) => conteos[grupo]);
  if (!visibles.length) return null;

  return (
    <div className="absolute bottom-3 left-3 z-[1100] rounded-xl border border-white/80 bg-white/95 px-3 py-2.5 shadow-[0_4px_18px_rgba(15,23,42,0.22)] backdrop-blur">
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        <Layers size={12} />
        Geocercas
      </p>
      <ul className="space-y-1">
        {visibles.map((grupo) => (
          <li key={grupo} className="flex items-center gap-2 text-[12px] text-slate-700">
            <span
              className="h-3 w-3 shrink-0 rounded-sm ring-1 ring-black/15"
              style={{ background: COLORES_GRUPO[grupo].relleno }}
              aria-hidden="true"
            />
            <span className="font-medium">{ETIQUETAS_GRUPO[grupo]}</span>
            <span className="ml-auto rounded-full bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-bold text-slate-600">
              {conteos[grupo]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ficha de la geocerca seleccionada                                   */
/* ------------------------------------------------------------------ */

export function FichaGeocerca({ geocerca, onCerrar, unidadesDentro = null }) {
  if (!geocerca) return null;

  const tipo = geocerca.tipo && COLORES_GRUPO[geocerca.tipo] ? geocerca.tipo : 'poligono';
  const etiqueta = ETIQUETAS_GRUPO[tipo];
  const vertices = geocerca.geometria ? contarVertices(geocerca.geometria) : 0;
  const area = geocerca.geometria ? areaHectareas(geocerca.geometria) : 0;
  const colores = COLORES_GRUPO[tipo];

  return (
    <div
      className="absolute top-3 right-3 z-[1100] w-[min(260px,calc(100%-24px))] overflow-hidden rounded-xl border border-white/80 bg-white/97 shadow-[0_6px_24px_rgba(15,23,42,0.25)] backdrop-blur"
      role="region"
      aria-label="Ficha de la geocerca seleccionada"
    >
      <div
        className="flex items-center gap-2 px-3 py-2 text-white"
        style={{ background: `linear-gradient(135deg, ${colores.borde}, ${colores.relleno})` }}
      >
        <span className="h-3 w-3 shrink-0 rounded-sm bg-white/85 ring-1 ring-black/15" aria-hidden="true" />
        <p className="min-w-0 flex-1 truncate text-[13px] font-bold" title={geocerca.nombre}>
          {geocerca.nombre || '(sin nombre)'}
        </p>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-lg p-1 transition-colors hover:bg-white/20"
          aria-label="Cerrar ficha de la geocerca"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 px-3 pt-2">
        <span
          className="rounded-full px-2 py-0.5 text-[10.5px] font-bold text-white ring-1 ring-black/10"
          style={{ background: colores.borde }}
        >
          {etiqueta}
        </span>
        {geocerca.division ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-600">
            {geocerca.division}
          </span>
        ) : null}
        {geocerca.incluir_reportes === false ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700">
            Fuera de reportes
          </span>
        ) : null}
      </div>

      <div
        className="mt-2 flex items-baseline justify-between gap-3 border-t border-slate-100 bg-emerald-50/70 px-3 py-2"
        title="Unidades cuya última posición cae dentro de este polígono"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
          Unidades dentro
        </span>
        <span className="text-[20px] font-extrabold leading-none tabular-nums text-forest">
          {Number.isFinite(unidadesDentro) ? unidadesDentro.toLocaleString('es-PE') : '—'}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-px bg-slate-100 border-t border-slate-100">
        <div className="bg-white px-3 py-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Vértices</dt>
          <dd className="text-[15px] font-bold text-slate-800">{vertices}</dd>
        </div>
        <div className="bg-white px-3 py-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Área</dt>
          <dd className="text-[15px] font-bold text-slate-800">
            {area >= 100
              ? `${Math.round(area).toLocaleString('es-PE')} ha`
              : `${area.toFixed(2)} ha`}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Control vista satélite                                              */
/* ------------------------------------------------------------------ */

export function ControlVistaSatelite({ satelite, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={satelite}
      className={`absolute left-3 top-[132px] z-[1100] flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-bold shadow-[0_4px_16px_rgba(15,23,42,0.25)] ring-1 ring-black/5 transition-all hover:scale-[1.03] ${
        satelite
          ? 'bg-slate-900 text-white'
          : 'bg-white/95 text-slate-700 backdrop-blur'
      }`}
      title={satelite ? 'Ver vista de calle' : 'Ver vista satélite'}
    >
      <Satellite size={15} />
      {satelite ? 'Calle' : 'Satélite'}
    </button>
  );
}

/* ================================================================== */
/* VI · Localizador de unidades con grupos (va fuera del mapa)        */
/* ================================================================== */

const SpeechRecognitionCtor =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

let nativeSpeechRecognition = null;
const loadNativeSpeech = async () => {
  if (!Capacitor.isNativePlatform()) return null;
  if (nativeSpeechRecognition) return nativeSpeechRecognition;
  try {
    const mod = await import('@capacitor-community/speech-recognition');
    nativeSpeechRecognition = mod.SpeechRecognition;
    return nativeSpeechRecognition;
  } catch {
    return null;
  }
};

function soloAlnum(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function normalizarTexto(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Fila de una unidad: clic = seleccionarla en el mapa; a la derecha, el input de grupo. */
function FilaUnidad({
  unidad,
  grupoActual,
  editable,
  gruposConocidos = [],
  guardando = false,
  seleccionada = false,
  onSeleccionar,
  onGuardar,
}) {
  const placa = String(unidad?.placa || unidad?.id || '');
  const [borrador, setBorrador] = useState(null);
  const valor = borrador !== null ? borrador : String(grupoActual || '');
  const sugerido = grupoSugerido(unidad?.descripcion);
  const sinCambios = valor.trim() === String(grupoActual || '').trim();

  const enviar = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setBorrador(null);
    if (!sinCambios) onGuardar(placa, valor);
  };

  return (
    <li
      className={`flex flex-wrap items-center gap-2 px-4 py-2 ${
        seleccionada ? 'bg-emerald-50' : 'hover:bg-slate-50'
      }`}
    >
      <button
        type="button"
        onClick={() => onSeleccionar(placa)}
        className="min-w-0 flex-1 text-left"
        title={`Ver ${placa} en el mapa`}
      >
        <span className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${seleccionada ? 'bg-emerald-600' : 'bg-slate-300'}`}
            aria-hidden="true"
          />
          <span className="text-xs font-bold text-forest">{placa}</span>
          <span className="truncate text-[11px] text-[#537665]">{unidad?.descripcion || '—'}</span>
        </span>
      </button>

      {editable ? (
        <form onSubmit={enviar} className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
          <input
            list="grupos-unidades-datalist"
            value={valor}
            onChange={(event) => setBorrador(event.target.value)}
            placeholder={sugerido || 'Sin grupo'}
            disabled={guardando}
            autoComplete="off"
            aria-label={`Grupo de ${placa}`}
            className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-forest outline-none focus:border-emerald-500 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={guardando || sinCambios}
            title={sinCambios ? 'Sin cambios' : `Guardar ${placa} en el grupo`}
            aria-label={`Guardar grupo de ${placa}`}
            className="rounded-lg border border-slate-200 p-1.5 text-[#537665] hover:border-emerald-500 hover:text-emerald-700 disabled:opacity-40"
          >
            {guardando ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />}
          </button>
        </form>
      ) : (
        <span className="max-w-[45%] truncate rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-[#426C50]">
          {String(grupoActual || '').trim() || 'Sin grupo'}
        </span>
      )}
    </li>
  );
}

/**
 * Localizador de unidades (VI): grupos colapsables con contador, buscador de
 * unidad/placa y asignación de grupo con guardado optimista (el guardado y el
 * rollback los hace FleetMap; aquí solo se pinta el estado).
 */
export function PanelGruposUnidades({
  unidades = [],
  gruposPorPlaca = {},
  gruposConocidos = [],
  editable = false,
  cargando = false,
  aviso = '',
  error = '',
  guardandoPlaca = null,
  seleccionadoId = '',
  modoDescripcion = false,
  reinicioBusqueda = 0,
  onSeleccionar = () => {},
  onGuardar = () => {},
}) {
  const [busqueda, setBusqueda] = useState('');
  useEffect(() => { setBusqueda(''); }, [reinicioBusqueda]);
  const [colapsados, setColapsados] = useState({});
  // Desglose visible por defecto: el panel muestra directamente la información.
  const [desgloseAbierto] = useState(true);
  const [escuchandoVoz, setEscuchandoVoz] = useState(false);
  const [vozAviso, setVozAviso] = useState('');
  const vozRecognitionRef = React.useRef(null);

  const grupos = useMemo(
    () => agruparUnidades(unidades, gruposPorPlaca, modoDescripcion),
    [unidades, gruposPorPlaca, modoDescripcion],
  );

  const visibles = useMemo(() => {
    const consulta = normalizarTexto(busqueda);
    const consultaAlnum = soloAlnum(busqueda);
    if (!consulta && !consultaAlnum) return grupos;
    return grupos
      .map((grupo) => ({
        ...grupo,
        unidades: grupo.unidades.filter((unidad) => {
          const texto = `${unidad?.placa || unidad?.id || ''} ${unidad?.descripcion || ''}`;
          if (consulta && normalizarTexto(texto).includes(consulta)) return true;
          return consultaAlnum.length >= 3 && soloAlnum(texto).includes(consultaAlnum);
        }),
      }))
      .filter((grupo) => grupo.unidades.length);
  }, [grupos, busqueda]);

  const totalVisibles = visibles.reduce((suma, grupo) => suma + grupo.unidades.length, 0);

  // Unidades sin grupo asignado: se listan por su descripción hasta que se
  // les asigne uno (el dato se guarda placa por placa en Supabase).
  const sinAsignar = useMemo(
    () => (editable
      ? unidades.filter((unidad) => {
        const placa = String(unidad?.placa || unidad?.id || '');
        return placa && !String(gruposPorPlaca[placa] ?? '').trim();
      }).length
      : 0),
    [unidades, gruposPorPlaca, editable],
  );

  const desgloseGrupos = useMemo(
    () => [...grupos].filter((g) => g.unidades.length).sort((a, b) => b.unidades.length - a.unidades.length),
    [grupos],
  );
  const desgloseEstados = useMemo(() => {
    const map = new Map();
    unidades.forEach((u) => {
      const key = String(u?.estado || 'sin_estado');
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [unidades]);

  const aplicarVoz = (transcript) => {
    if (!transcript) return;
    setBusqueda(transcript);
    setVozAviso('');
  };

  const toggleVoz = async () => {
    if (Capacitor.isNativePlatform()) {
      if (escuchandoVoz) {
        setEscuchandoVoz(false);
        return;
      }
      const plugin = await loadNativeSpeech();
      if (!plugin) {
        setVozAviso('Reconocimiento de voz no disponible en este dispositivo.');
        return;
      }
      try {
        const { available } = await plugin.available();
        if (!available) {
          setVozAviso('Activa “Speech Services by Google” e intenta de nuevo.');
          return;
        }
        const perm = await plugin.requestPermissions().catch(() => null);
        if (perm?.speechRecognition === 'denied') {
          setVozAviso('Permiso de micrófono denegado. Actívalo en Ajustes → Agrilux → Permisos.');
          return;
        }
        setEscuchandoVoz(true);
        setVozAviso('Escuchando… di la placa.');
        const result = await plugin.start({
          language: 'es-PE',
          maxResults: 5,
          prompt: 'Di la placa de la máquina',
          popup: true,
          partialResults: false,
        });
        setEscuchandoVoz(false);
        const match = (result?.matches || []).find((m) => m && m.trim())?.trim() || '';
        if (match) aplicarVoz(match);
        else setVozAviso('No te escuché. Intenta de nuevo cerca del micrófono.');
      } catch (error) {
        setEscuchandoVoz(false);
        setVozAviso('No te escuché bien. Revisa internet y los permisos de micrófono.');
        console.warn('[Localizador] dictado unidad falló:', error);
      }
      return;
    }
    if (!SpeechRecognitionCtor) {
      setVozAviso('Tu navegador no soporta búsqueda por voz. Usa Chrome o Edge.');
      return;
    }
    if (escuchandoVoz) {
      vozRecognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'es-PE';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setEscuchandoVoz(true);
      setVozAviso('Escuchando… di la placa.');
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();
      if (!transcript) return;
      const isFinal = event.results[event.results.length - 1]?.isFinal;
      if (isFinal) aplicarVoz(transcript);
      else setBusqueda(transcript);
    };
    recognition.onerror = (event) => {
      const messages = {
        'not-allowed': 'Permite el acceso al micrófono en el navegador para usar la voz.',
        'service-not-allowed': 'Permite el acceso al micrófono en el navegador para usar la voz.',
        'no-speech': 'No te escuché. Toca el micrófono e inténtalo de nuevo.',
        'audio-capture': 'No se detectó ningún micrófono.',
        network: 'La búsqueda por voz necesita conexión a internet.',
      };
      setVozAviso(messages[event.error] || 'No se pudo reconocer la voz. Inténtalo de nuevo.');
      setEscuchandoVoz(false);
      vozRecognitionRef.current = null;
    };
    recognition.onend = () => {
      setEscuchandoVoz(false);
      vozRecognitionRef.current = null;
    };
    vozRecognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setEscuchandoVoz(false);
      vozRecognitionRef.current = null;
    }
  };

  useEffect(() => () => vozRecognitionRef.current?.abort?.(), []);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm min-w-0">
      <div className="p-4 sm:p-5 border-b border-slate-50 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
              <Search size={15} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <h3 className="text-base font-bold text-forest">Localizador de unidades</h3>
              <p className="text-xs text-[#537665]">
                {cargando
                  ? 'Cargando grupos…'
                  : `${unidades.length} unidades en el mapa · ${grupos.length} grupo(s)${modoDescripcion ? ' (por descripción)' : ''}${sinAsignar ? ` · ${sinAsignar} sin grupo asignado (por descripción)` : ''}`}
              </p>
            </span>
          </div>
          <label className="ml-auto flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 focus-within:border-emerald-500">
            <Search size={14} className="shrink-0 text-[#6A8B76]" />
            <input
              type="text"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar unidad o placa…"
              className="w-36 bg-transparent text-xs text-forest outline-none placeholder:text-[#789683] sm:w-56"
              aria-label="Buscar unidad o placa"
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            onClick={toggleVoz}
            className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-full transition-all focus:outline-none focus:ring-2 ${
              escuchandoVoz
                ? 'animate-pulse bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.6)] focus:ring-red-200'
                : 'bg-emerald-500 text-white hover:bg-emerald-600 focus:ring-emerald-200'
            }`}
            aria-label={escuchandoVoz ? 'Detener búsqueda por voz' : 'Buscar unidad por voz'}
            aria-pressed={escuchandoVoz}
            title={Capacitor.isNativePlatform() || SpeechRecognitionCtor ? 'Buscar máquina por voz' : 'Tu navegador no soporta voz'}
          >
            {Capacitor.isNativePlatform() || SpeechRecognitionCtor ? <Mic size={15} /> : <MicOff size={15} />}
          </button>
        </div>

        {vozAviso ? (
          <p className="text-[10px] leading-snug text-[#537665]" role="status" aria-live="polite">{vozAviso}</p>
        ) : null}

        {aviso ? (
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800" role="status">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            <span>{aviso}</span>
          </p>
        ) : null}
        {error ? (
          <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800" role="alert">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}
      </div>

      {desgloseAbierto ? (
        <>
      <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-4 py-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-forest/30 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-forest">
          Total: {unidades.length}
        </span>
        {desgloseGrupos.map((g) => (
          <span
            key={g.clave}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-[#426C50]"
            title={`${g.unidades.length} unidad(es) en el grupo ${g.etiqueta}`}
          >
            {g.etiqueta}: <b className="text-forest">{g.unidades.length}</b>
          </span>
        ))}
        {desgloseEstados.map(([estado, total]) => (
          <span
            key={estado}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-[#537665]"
            title={`${total} unidad(es) en estado ${estado}`}
          >
            {estado.replace(/_/g, ' ')}: <b className="text-[#285D3B]">{total}</b>
          </span>
        ))}
      </div>
      <datalist id="grupos-unidades-datalist">
        {gruposConocidos.map((grupo) => (
          <option key={grupo} value={grupo} />
        ))}
      </datalist>

      <div className="max-h-[420px] overflow-y-auto">
        {cargando ? (
            <p className="flex items-center justify-center gap-2 p-6 text-xs text-[#537665]">
            <LoaderCircle size={15} className="animate-spin" /> Cargando grupos de unidades…
          </p>
        ) : !unidades.length ? (
          <p className="p-6 text-center text-xs text-[#537665]">
            Todavía no hay unidades con posición en el mapa.
          </p>
        ) : !visibles.length ? (
          <p className="p-6 text-center text-xs text-[#537665]">
            Ninguna unidad coincide con “{busqueda}”.
          </p>
        ) : (
          visibles.map((grupo) => {
            const colapsado = Boolean(colapsados[grupo.clave]);
            return (
              <div key={grupo.clave || 'sin-grupo'} className="border-b border-slate-100 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setColapsados((prev) => ({ ...prev, [grupo.clave]: !colapsado }))}
                  aria-expanded={!colapsado}
                  className="flex w-full items-center gap-2 bg-slate-50/70 px-4 py-2.5 text-left hover:bg-slate-50"
                >
                  {colapsado ? <ChevronDown size={14} className="text-[#6A8B76]" /> : <ChevronUp size={14} className="text-[#6A8B76]" />}
                  <span className="text-[10px] font-bold uppercase tracking-wide text-primary">Grupo</span>
                  <span className="truncate text-xs font-bold text-forest">{grupo.etiqueta}</span>
                  <span className="ml-auto rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#426C50]">
                    {grupo.unidades.length}
                  </span>
                </button>
                {!colapsado ? (
                  <ul className="divide-y divide-slate-50">
                    {grupo.unidades.map((unidad) => {
                      const placa = String(unidad?.placa || unidad?.id || '');
                      return (
                        <FilaUnidad
                          key={placa}
                          unidad={unidad}
                          grupoActual={gruposPorPlaca[placa] || ''}
                          editable={editable}
                          gruposConocidos={gruposConocidos}
                          guardando={guardandoPlaca === placa}
                          seleccionada={seleccionadoId === placa}
                          onSeleccionar={onSeleccionar}
                          onGuardar={onGuardar}
                        />
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <p className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-[10px] text-[#537665]">
        {busqueda
          ? `Mostrando ${totalVisibles} de ${unidades.length} unidades`
          : 'Clic en la unidad para llevar el mapa hasta su posición.'}
        {editable ? ' Escribe un grupo y pulsa ✓ para guardarlo (vacío = quitar).' : ''}
      </p>
        </>
        ) : null}
    </div>
  );
}

/* ================================================================== */
/* VI · Tabla de coordenadas (una fila por marcador visible)          */
/* ================================================================== */

export function TablaCoordenadas({
  filas = [],
  rangoTexto = '',
  exportando = false,
  errorExportar = '',
  onExportar = () => {},
  onEnfocar = () => {},
}) {
  const muchas = filas.length > 100;
  // Tabla limitada a 15 filas; el pie y el Excel usan el total completo.
  const { filasVistas, expandido, alternar, total } = useLimiteFilas(filas);
  // Desglose visible por defecto: el panel muestra directamente la información.
  const [busqueda, setBusqueda] = useState('');
  const [desgloseAbierto] = useState(true);
  const resultados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    if (!term) return [];
    return filas
      .filter((f) => [f.placa, f.descripcion, f.evento, f.direccion, f.geocerca]
        .filter(Boolean)
        .some((campo) => String(campo).toLowerCase().includes(term)))
      .slice(0, 8);
  }, [busqueda, filas]);
  const desgloseEventos = useMemo(() => {
    const map = new Map();
    filas.forEach((f) => {
      const key = String(f.evento || 'Sin evento');
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filas]);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm min-w-0">
      <div className="p-4 sm:p-5 border-b border-slate-50 flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
            <Table size={15} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <h3 className="text-base font-bold text-slate-900">Coordenadas de las unidades</h3>
            <p className="text-xs text-slate-500">
              {filas.length} posición(es) visible(s) en el mapa{rangoTexto ? ` · ${rangoTexto}` : ''}
            </p>
          </span>
        </div>
        <button
          type="button"
          onClick={onExportar}
          disabled={!filas.length || exportando}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-forest hover:text-forest disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {exportando ? <LoaderCircle size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
          Descargar Excel
        </button>
        </div>

      {desgloseAbierto ? (
        <>
      {desgloseEventos.length ? (
        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-4 py-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-forest/30 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-forest">
            Total: {filas.length}
          </span>
          {desgloseEventos.map(([evento, total]) => (
            <span
              key={evento}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600"
              title={`${total} posición(es) con evento ${evento}`}
            >
              {evento}: <b className="text-forest">{total}</b>
            </span>
          ))}
        </div>
      ) : null}
      {errorExportar ? (
        <p className="px-4 pt-2 text-[10px] text-red-600" role="alert">{errorExportar}</p>
      ) : null}

      <div className="relative border-b border-slate-100 px-4 py-2.5">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
          <Search size={13} className="shrink-0 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar unidad por placa, descripción, evento o geocerca…"
            aria-label="Buscar unidad en las coordenadas"
            className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
            autoComplete="off"
          />
          {busqueda ? (
            <button type="button" onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda" className="shrink-0 text-slate-400 hover:text-slate-600">
              <X size={13} />
            </button>
          ) : null}
        </div>
        {resultados.length ? (
          <ul className="absolute left-4 right-4 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {resultados.map((r) => (
              <li key={r.clave || r.placa}>
                <button
                  type="button"
                  onClick={() => { onEnfocar(r.placa); setBusqueda(''); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-slate-50"
                >
                  <MapPinned size={13} className="shrink-0 text-forest" />
                  <span className="min-w-0">
                    <span className="block font-semibold text-slate-800">{r.placa}{r.descripcion ? ` · ${r.descripcion}` : ''}</span>
                    <span className="block truncate text-[10px] text-slate-400">
                      {r.geocerca ? `Geocerca: ${r.geocerca}` : 'Fuera de geocercas'}{r.fechaTexto ? ` · ${r.fechaTexto}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : busqueda.trim() ? (
          <p className="absolute left-4 right-4 top-full z-20 mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-400 shadow-lg">
            Ninguna unidad coincide con «{busqueda.trim()}».
          </p>
        ) : null}
      </div>

      {filas.length ? (
        <>
          <div className="max-h-80 overflow-auto scroll-consola">
            <table className="w-full text-xs text-slate-700">
              {/* Orden de columnas como en Zonar: Unidad · Dirección · Velocidad
                  · Evento · Fecha · Último contacto · Geocerca (Lat/Lng al final). */}
              <thead className="sticky top-0 z-10 bg-slate-100">
                <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2.5 font-bold text-left">Unidad</th>
                  <th className="px-3 py-2.5 font-bold text-left">Dirección</th>
                  <th className="px-3 py-2.5 font-bold text-right">Velocidad</th>
                  <th className="px-3 py-2.5 font-bold text-left">Evento</th>
                  <th className="px-3 py-2.5 font-bold text-left">Fecha</th>
                  <th className="px-3 py-2.5 font-bold text-left">Último contacto</th>
                  <th className="px-3 py-2.5 font-bold text-left">Geocerca</th>
                  <th className="px-3 py-2.5 font-bold text-right">Latitud</th>
                  <th className="px-3 py-2.5 font-bold text-right">Longitud</th>
                </tr>
              </thead>
              <tbody>
                {filasVistas.map((fila) => (
                  <tr key={fila.clave || fila.placa} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => onEnfocar(fila.placa)}
                        title="Centrar en el mapa"
                        className="block text-left hover:text-forest focus:outline-none focus:ring-2 focus:ring-forest/30 rounded"
                      >
                        <span className="block font-semibold text-slate-800 hover:text-forest inline-flex items-center gap-1">
                          <MapPinned size={11} className="text-forest opacity-80" />
                          {fila.placa}
                        </span>
                        {fila.descripcion ? (
                          <span className="block text-[10px] text-slate-400">{fila.descripcion}</span>
                        ) : null}
                      </button>
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-slate-600" title={fila.direccion || ''}>
                      {fila.direccion || '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fila.velocidadTexto}</td>
                    <td className="px-3 py-2 text-slate-600">{fila.evento || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-600">{fila.fechaTexto || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-500">{fila.contactoTexto || '—'}</td>
                    <td className="max-w-[160px] truncate px-3 py-2 text-slate-600" title={fila.geocerca || '—'}>
                      {fila.geocerca || '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{fila.latTexto}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{fila.lngTexto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <BotonVerMas expandido={expandido} onAlternar={alternar} total={total} />
          <p className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-[10px] text-slate-500">
            {filas.length} fila(s) · una por marcador visible
            {muchas ? ' · la tabla tiene scroll, desplázate para verlas todas' : ''}
          </p>
        </>
      ) : (
        <p className="p-6 text-center text-xs text-slate-500">
          No hay posiciones que mostrar: espera a que carguen las unidades o revisa el mapa.
        </p>
      )}
        </>
        ) : null}
    </div>
  );
}

/* ================================================================== */
/* VII · Tabla del recorrido paginado                                  */
/* ================================================================== */

export function TablaRecorrido({
  puntos = [],
  placa = '',
  pagina = 1,
  totalPaginas = 1,
  ventanaTexto = '',
  muestreada = false,
  cargando = false,
  exportando = false,
  errorExportar = '',
  onPagina = () => {},
  onExportar = () => {},
  integrado = false,
}) {
  // Paginación interna de filas: 20 puntos por vista, como siempre.
  const POR_PAGINA = 20;
  const [filaPagina, setFilaPagina] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  useEffect(() => { setFilaPagina(1); setBusqueda(''); }, [puntos]);
  const puntosFiltrados = useMemo(() => {
    const q = String(busqueda || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    if (!q) return puntos;
    return puntos.filter((p) => [
      formatearFechaLarga(p.fecha),
      p.evento,
      p.direccion,
      p.geocerca,
    ].filter(Boolean).some((campo) => String(campo).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(q)));
  }, [puntos, busqueda]);
  const totalFilaPaginas = Math.max(1, Math.ceil(puntosFiltrados.length / POR_PAGINA));
  const paginaActual = Math.min(filaPagina, totalFilaPaginas);
  const inicio = (paginaActual - 1) * POR_PAGINA;
  const fin = Math.min(inicio + POR_PAGINA, puntosFiltrados.length);
  const puntosPagina = puntosFiltrados.slice(inicio, fin);
  const irAPagina = (n) => setFilaPagina(Math.min(Math.max(1, n), totalFilaPaginas));
  const filtrando = busqueda.trim().length > 0;
  return (
    <div className={integrado ? 'min-w-0' : 'bg-white rounded-2xl border border-slate-100 shadow-sm min-w-0'}>
      <div className={integrado ? 'flex flex-wrap items-center gap-2 pb-3' : 'p-4 sm:p-5 border-b border-slate-50 flex flex-wrap items-center gap-2'}>
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
            {cargando ? <LoaderCircle size={15} className="animate-spin text-forest" aria-hidden="true" /> : null}
            Coordenadas del recorrido
            {cargando ? <span className="sr-only">Cargando recorrido…</span> : null}
          </h3>
          <p className="text-xs text-slate-500">
            {placa ? `${placa} · ` : ''}
            {puntos.length} punto(s) en total{ventanaTexto ? ` · ${ventanaTexto}` : ''}
            {filtrando ? ` · ${puntosFiltrados.length} coinciden` : ''}
            {cargando ? ' · cargando…' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onExportar}
          disabled={!puntos.length || exportando}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-forest hover:text-forest disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {exportando ? <LoaderCircle size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
          Descargar Excel
        </button>
      </div>
      {errorExportar ? (
        <p className="px-4 pt-2 text-[10px] text-red-600" role="alert">{errorExportar}</p>
      ) : null}

      <div className={integrado ? 'border-b border-slate-100 bg-slate-50/60 px-3 py-2' : 'border-b border-slate-100 bg-slate-50 px-4 py-2.5'}>
        <label className="relative flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 focus-within:border-forest">
          <Search size={13} className="shrink-0 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={busqueda}
            onChange={(event) => { setBusqueda(event.target.value); setFilaPagina(1); }}
            placeholder="Buscar fecha, evento, dirección o geocerca…"
            autoComplete="off"
            aria-label="Buscar en los puntos del recorrido"
            className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
          />
          {busqueda ? (
            <button
              type="button"
              onClick={() => { setBusqueda(''); setFilaPagina(1); }}
              aria-label="Limpiar búsqueda"
              className="shrink-0 text-slate-400 hover:text-slate-600"
            >
              <X size={13} />
            </button>
          ) : null}
        </label>
      </div>

      <div className={integrado ? 'flex flex-wrap items-center gap-2 border-y border-slate-100 bg-slate-50/60 px-3 py-2' : 'flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2'}>
        <button
          type="button"
          onClick={() => irAPagina(paginaActual - 1)}
          disabled={cargando || paginaActual <= 1}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-forest hover:text-forest disabled:opacity-40"
        >
          <ChevronLeft size={13} /> Anterior
        </button>
        <span className="text-[11px] font-bold text-slate-600">
          Página {paginaActual} de {totalFilaPaginas}
        </span>
        <button
          type="button"
          onClick={() => irAPagina(paginaActual + 1)}
          disabled={cargando || paginaActual >= totalFilaPaginas}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-forest hover:text-forest disabled:opacity-40"
        >
          Siguiente <ChevronRight size={13} />
        </button>
        {cargando ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            <LoaderCircle size={13} className="animate-spin" /> Cargando recorrido…
          </span>
        ) : null}
        <span className="ml-auto text-[10px] text-slate-400">
          {puntos.length ? `${inicio + 1}–${fin} de ${puntosFiltrados.length} · máx. 20 puntos por página` : 'máx. 20 puntos por página'}
        </span>
      </div>

      {puntosFiltrados.length ? (
        <div className="max-h-80 overflow-auto scroll-consola">
          <table className="w-full text-xs text-slate-700">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2.5 font-bold text-right">N°</th>
                <th className="px-3 py-2.5 font-bold text-left">Fecha</th>
                <th className="px-3 py-2.5 font-bold text-left">Evento</th>
                <th className="px-3 py-2.5 font-bold text-left">Dirección</th>
                <th className="px-3 py-2.5 font-bold text-left">Geocerca</th>
                <th className="px-3 py-2.5 font-bold text-right">Vel.</th>
                <th className="px-3 py-2.5 font-bold text-right">Latitud</th>
                <th className="px-3 py-2.5 font-bold text-right">Longitud</th>
                <th className="px-3 py-2.5 font-bold text-center">Alerta</th>
              </tr>
            </thead>
            <tbody>
              {puntosPagina.map((punto) => (
                <tr key={punto.id ?? `${punto.fecha}-${punto.latitud}`} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-500">{punto.orden}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600">{formatearFechaLarga(punto.fecha)}</td>
                  <td className="px-3 py-2 text-slate-700">{punto.evento || '—'}</td>
                  <td className="max-w-[220px] truncate px-3 py-2 text-slate-600" title={punto.direccion || ''}>
                    {punto.direccion || '—'}
                  </td>
                  <td className="max-w-[140px] truncate px-3 py-2 text-slate-600" title={punto.geocerca || '—'}>
                    {punto.geocerca || '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {punto.velocidad == null ? '—' : `${Number(punto.velocidad)} km/h`}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">{Number(punto.latitud).toFixed(5)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">{Number(punto.longitud).toFixed(5)}</td>
                  <td className="px-3 py-2 text-center">
                    {punto.es_alerta ? (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">Sí</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="p-6 text-center text-xs text-slate-500">
          {cargando
            ? 'Cargando los puntos de este rango…'
            : filtrando
              ? `Ningún punto coincide con «${busqueda.trim()}».`
              : 'No hay puntos GPS en este rango.'}
        </p>
      )}

      <p className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-[10px] text-slate-500">
        {muestreada
          ? 'Esta ventana superó el tope de 900 puntos y la RPC la muestreó (conserva inicio, fin y alertas). Reduce el rango para ver todos los puntos.'
          : 'Se muestran 20 puntos por página; usa Anterior / Siguiente para moverte.'}
      </p>
    </div>
  );
}

/* ================================================================== */
/* VIII · Unidades dentro de la geocerca seleccionada                  */
/* ================================================================== */

export function PanelUnidadesGeocerca({
  geocerca,
  estado = 'vacio', // cargando | ok | vacio | error
  unidades = [],
  error = '',
  aviso = '',
}) {
  // Tabla limitada a 15 filas (ganchos antes del return anticipado).
  const { filasVistas, expandido, alternar, total } = useLimiteFilas(unidades);
  if (!geocerca) return null;

  const cabecera = (
    <div className="p-4 sm:p-5 border-b border-slate-50">
      <h3 className="text-base font-bold text-slate-900">
        {geocerca.nombre || '(sin nombre)'} – Unidades: {estado === 'cargando' ? '…' : unidades.length}
      </h3>
      <p className="text-xs text-slate-500">
        Últimas posiciones dentro del polígono; una posición antigua no confirma presencia actual.
      </p>
      {unidades.length ? <p className="mt-1 text-[11px] text-slate-600">
        {unidades.filter((u) => u.posicionReciente).length} con reporte reciente · {unidades.filter((u) => !u.posicionReciente).length} con posición antigua o sin fecha
      </p> : null}
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm min-w-0">
      {cabecera}
      {aviso ? (
        <p className="mx-4 sm:mx-5 mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800" role="status">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <span>{aviso}</span>
        </p>
      ) : null}

      {estado === 'cargando' ? (
        <p className="flex items-center justify-center gap-2 p-6 text-xs text-slate-500">
          <LoaderCircle size={15} className="animate-spin" /> Calculando qué unidades están dentro…
        </p>
      ) : estado === 'error' ? (
        <p className="flex items-start gap-2 p-6 text-xs text-red-700" role="alert">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error || 'No se pudieron calcular las unidades dentro de la geocerca.'}</span>
        </p>
      ) : !unidades.length ? (
        <p className="p-6 text-center text-xs font-semibold text-slate-500">Ninguna unidad dentro</p>
      ) : (
        <>
        <div className="max-h-72 overflow-auto scroll-consola">
          <table className="w-full text-xs text-slate-700">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2.5 font-bold text-left">Unidad</th>
                <th className="px-3 py-2.5 font-bold text-left">Dirección</th>
                <th className="px-3 py-2.5 font-bold text-left">Últ. fecha</th>
                <th className="px-3 py-2.5 font-bold text-right">Vel.</th>
              </tr>
            </thead>
            <tbody>
              {filasVistas.map((unidad) => (
                <tr key={unidad.placa} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-3 py-2">
                    <span className="block font-semibold text-slate-800">{unidad.placa}</span>
                    {unidad.descripcion ? (
                      <span className="block text-[10px] text-slate-400">{unidad.descripcion}</span>
                    ) : null}
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2 text-slate-600" title={unidad.direccion || ''}>
                    {unidad.direccion || '—'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                    {unidad.fechaTexto || '—'}
                    {unidad.posicionAviso ? <span className="block text-[10px] text-amber-700">{unidad.posicionAviso}</span> : null}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{unidad.velocidadTexto}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <BotonVerMas expandido={expandido} onAlternar={alternar} total={total} />
        </>
      )}
    </div>
  );
}
