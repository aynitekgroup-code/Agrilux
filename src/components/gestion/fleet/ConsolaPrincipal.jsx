import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { COLORES_GRUPO, ETIQUETAS_GRUPO } from '../../../lib/asistenteMapa';
import { PanelUnidadesGeocerca } from './MapaControles';
import ConfiguracionPrincipal from './ConfiguracionPrincipal';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  History,
  MapPin,
  MapPinned,
  Mic,
  MicOff,
  X,
  Check,
  Mail,
  Hash,
  ClipboardList,
  Navigation,
  Power,
  Shapes,
  Warehouse,
  Search,
  Table,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ChevronRight,
} from 'lucide-react';

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

function normalizarPlacaBusqueda(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export const SECCIONES = [
  { id: 'localizador', label: 'Localizador de Unidades', group: 'Flota', Icon: Search },
  { id: 'historicas', label: 'Ubicaciones Históricas', group: 'Flota', Icon: History },
  { id: 'direcciones', label: 'Localizador de Direcciones', group: 'Flota', Icon: MapPin },
  { id: 'mensajeria', label: 'Servicio de Mensajería', group: 'Comunicación', Icon: Mail },
  { id: 'seguimiento', label: 'Número de Seguimiento', group: 'Comunicación', Icon: Hash },
  { id: 'despachos', label: 'Director de Despachos', group: 'Operaciones', Icon: Warehouse },
  { id: 'cercano', label: 'Encuentre el más cercano', group: 'Operaciones', Icon: Navigation },
  { id: 'control-remoto', label: 'Control Remoto', group: 'Operaciones', Icon: Power },
  { id: 'ordenes', label: 'Órdenes de Trabajo', group: 'Operaciones', Icon: ClipboardList },
  { id: 'zonas', label: 'Zonas', group: 'Geocercas', Icon: MapPinned },
  { id: 'geocercas', label: 'Geocercas', group: 'Geocercas', Icon: Shapes },
  { id: 'configuracion', label: 'Configuración', group: 'Sistema', Icon: Settings },
];

/** Menú de secciones reutilizable (Consola principal y panel Flota del mapa). */
export function MenuSecciones({ seccionId, onSeleccionar, compacto = false, amplio = false }) {
  const grupos = useMemo(() => SECCIONES.reduce((acc, item) => {
    (acc[item.group] = acc[item.group] || []).push(item);
    return acc;
  }, {}), []);
  return (
    <div className={`space-y-3 ${compacto ? '' : 'max-h-[560px] overflow-y-auto'}`}>
      {Object.entries(grupos).map(([group, items]) => (
        <div key={group}>
          <h4 className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{group}</h4>
          <div className="space-y-0.5">
            {items.map((item) => {
              const Icon = item.Icon;
              const activa = seccionId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSeleccionar?.(item.id)}
                  aria-current={activa ? 'page' : undefined}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-forest/20 ${amplio ? 'min-h-12 py-3 text-sm' : 'py-2 text-xs'} ${
                    activa
                      ? 'bg-forest text-white font-semibold shadow-sm'
                      : 'text-slate-600 hover:bg-emerald-50 hover:text-forest'
                  }`}
                >
                  <Icon size={amplio ? 18 : 14} className={`shrink-0 ${activa ? 'text-white' : 'text-forest'}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <ChevronRight size={13} className={`shrink-0 ${activa ? 'text-white/80' : 'text-slate-300'}`} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function pad(valor) {
  return String(valor).padStart(2, '0');
}

function fechaHoraLocal(valor) {
  return `${valor.getFullYear()}-${pad(valor.getMonth() + 1)}-${pad(valor.getDate())}T${pad(valor.getHours())}:${pad(valor.getMinutes())}`;
}

function rangoDefault() {
  const desde = new Date();
  desde.setHours(0, 0, 0, 0);
  const hasta = new Date();
  hasta.setHours(23, 59, 0, 0);
  return { desde: fechaHoraLocal(desde), hasta: fechaHoraLocal(hasta) };
}

function Placeholder({ texto }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-[11px] leading-snug text-slate-500">
      {texto}
    </p>
  );
}

/** Aviso para secciones que aún no están configuradas en el mapa. */
export function Proximamente({ etiqueta }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 px-4 py-8 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-emerald-100 text-emerald-600">
        <Clock size={20} aria-hidden="true" />
      </span>
      <p className="text-sm font-bold text-slate-800">Próximamente</p>
      <p className="max-w-xs text-[11px] leading-snug text-slate-500">
        La sección <b>{etiqueta}</b> estará disponible en breve, con el mismo estilo de consola Agrilux.
      </p>
    </div>
  );
}

// La sección Configuración usa ConfiguracionPrincipal: CRUD real sobre las
// tablas y RPC existentes en Supabase (máquinas, geocercas, choferes y grupos).

function normTexto(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Zonas: lista de geocercas (multiselección estilo Zonar) + unidades dentro. */
export function ZonasPanel({ geofences = [], selectedId, onSeleccionar, unidadesEnGeocerca, mostrarUnidades = true, onToggleMostrarUnidades, actualizarMapaCada = 30 * 1000, onActualizarMapaCada, compacto = false }) {
  const [busqueda, setBusqueda] = useState('');

  const grupos = useMemo(() => {
    const q = normTexto(busqueda);
    const filtradas = geofences.filter((g) => !q || normTexto([g.nombre, g.division, g.anexo, g.distrito, g.provincia].filter(Boolean).join(' · ')).includes(q));
    const porGrupo = new Map();
    filtradas.forEach((g) => {
      const tipo = g.tipo && COLORES_GRUPO[g.tipo] ? g.tipo : 'poligono';
      if (!porGrupo.has(tipo)) porGrupo.set(tipo, { tipo, items: [] });
      porGrupo.get(tipo).items.push(g);
    });
    const orden = ['autorizada', 'oficina', 'distrito', 'poligono'];
    return [...porGrupo.values()]
      .map((grupo) => ({
        ...grupo,
        etiqueta: ETIQUETAS_GRUPO[grupo.tipo] || 'Otras',
        items: [...grupo.items].sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es')),
      }))
      .sort((a, b) => (orden.indexOf(a.tipo) - orden.indexOf(b.tipo)) || a.etiqueta.localeCompare(b.etiqueta, 'es'));
  }, [geofences, busqueda]);

  const seleccionada = geofences.find((g) => g.id === selectedId) || null;
  const toggle = (id) => {
    if (typeof onSeleccionar === 'function') onSeleccionar(id === selectedId ? '' : id);
  };

  return (
    <div className={compacto ? 'grid gap-3' : 'grid gap-3 xl:grid-cols-[minmax(0,240px)_minmax(0,1fr)]'}>
      <div className="min-w-0">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Zonas · {geofences.length}</p>
        <label className="relative mb-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 focus-within:border-forest">
          <Search size={13} className="shrink-0 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar zona, división, distrito…"
            autoComplete="off"
            aria-label="Buscar zona"
            className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
          />
          {busqueda ? (
            <button type="button" onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda" className="shrink-0 text-slate-400 hover:text-slate-600">
              <X size={13} />
            </button>
          ) : null}
        </label>
        <div className="max-h-72 divide-y divide-slate-100 overflow-auto scroll-consola rounded-xl border border-slate-100">
          {grupos.length ? grupos.map((grupo) => (
            <div key={grupo.tipo}>
              <p className="sticky top-0 z-10 bg-slate-50 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <span className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: COLORES_GRUPO[grupo.tipo]?.borde || '#0F766E' }} aria-hidden="true" />
                {grupo.etiqueta} · {grupo.items.length}
              </p>
              {grupo.items.map((g) => {
                const activa = g.id === selectedId;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggle(g.id)}
                    aria-pressed={activa}
                    className={`flex w-full items-center gap-2 border-t border-slate-50 px-2.5 py-1.5 text-left text-[11px] transition-colors ${activa ? 'bg-emerald-50 font-semibold text-forest' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${activa ? 'border-forest bg-forest text-white' : 'border-slate-300 bg-white text-transparent'}`} aria-hidden="true">
                      <Check size={11} strokeWidth={3} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{g.nombre}</span>
                      {(g.division || g.anexo || g.distrito) ? (
                        <span className="block truncate text-[9px] font-normal text-slate-400">
                          {[g.division, g.anexo, g.distrito].filter(Boolean).join(' · ')}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          )) : (
            <p className="p-4 text-center text-[11px] text-slate-500">Ninguna zona coincide con “{busqueda.trim()}”.</p>
          )}
        </div>
        <p className="mt-1.5 text-[10px] text-slate-400">
          {seleccionada ? `Seleccionada: ${seleccionada.nombre}` : 'Toca una zona para verla entera en el mapa y sus unidades dentro.'}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
          <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={mostrarUnidades}
              onChange={(event) => onToggleMostrarUnidades?.(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-forest focus:ring-forest"
            />
            Mostrar Unidades Dentro
          </label>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
            Actualizar el mapa cada
            <select
              value={String(actualizarMapaCada)}
              onChange={(event) => onActualizarMapaCada?.(Number(event.target.value))}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-700 outline-none focus:border-forest"
              aria-label="Actualizar el mapa cada"
            >
              <option value="5000">5 S</option>
              <option value="15000">15 S</option>
              <option value="30000">30 S</option>
              <option value="60000">1 min</option>
              <option value="300000">5 min</option>
            </select>
          </label>
        </div>
      </div>
      <div className="min-w-0">
        {seleccionada ? (
          <PanelUnidadesGeocerca
            geocerca={seleccionada}
            estado={unidadesEnGeocerca?.estado || 'vacio'}
            unidades={unidadesEnGeocerca?.filas || []}
            error={unidadesEnGeocerca?.error || ''}
          />
        ) : (
          <Placeholder texto="Selecciona una geocerca arriba: el mapa te la pinta, la muestra completa en pantalla y aquí ves cuántas y cuáles unidades están dentro." />
        )}
      </div>
    </div>
  );
}

function ContenidoSeccion({
  id, localizador, coordenadas, recorrido, zonas, configuracion,
  unidad, setUnidad, aplicarBusqueda,
  desde, setDesde, hasta, setHasta,
  clickUbicaciones, ping,
  mensaje, setMensaje,
  escuchandoUnidad, toggleVozUnidad,
  resultadosUnidad, elegirDeLista,
}) {
  if (id === 'historicas') {
    return (
      <div className="grid gap-2">
        <label className="relative grid gap-1 text-[11px] font-semibold text-slate-600">
          Unidad
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 focus-within:border-forest">
            <Search size={13} className="shrink-0 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={unidad}
              onChange={(event) => aplicarBusqueda(event.target.value)}
              placeholder="TRF-0000, 1639-1K…"
              autoComplete="off"
              aria-label="Buscar unidad para el recorrido histórico"
              className="w-full bg-transparent text-xs font-normal text-slate-700 outline-none placeholder:text-slate-400"
            />
            {unidad ? (
              <button type="button" onClick={() => aplicarBusqueda('')} aria-label="Limpiar unidad" className="shrink-0 text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={toggleVozUnidad}
              className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-full transition-all hover:scale-105 focus:outline-none focus:ring-2 ${
                escuchandoUnidad
                  ? 'animate-pulse bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.6)] focus:ring-red-200'
                  : 'bg-emerald-500 text-white hover:bg-emerald-600 focus:ring-emerald-200'
              }`}
              aria-label={escuchandoUnidad ? 'Detener búsqueda por voz' : 'Buscar unidad por voz'}
              aria-pressed={escuchandoUnidad}
              title={Capacitor.isNativePlatform() || SpeechRecognitionCtor ? 'Buscar máquina por voz' : 'Tu navegador no soporta voz'}
            >
              {Capacitor.isNativePlatform() || SpeechRecognitionCtor ? <Mic size={15} /> : <MicOff size={15} />}
            </button>
          </div>
          {resultadosUnidad.length ? (
            <ul className="absolute left-0 top-full z-30 mt-1 max-h-56 w-80 max-w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg" role="listbox" aria-label="Coincidencias de la unidad">
              {resultadosUnidad.map((vehiculo) => (
                <li key={vehiculo.placa}>
                  <button
                    type="button"
                    role="option"
                    onClick={() => elegirDeLista(vehiculo.placa)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50"
                  >
                    <MapPin size={13} className="shrink-0 text-forest" />
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-800">{vehiculo.placa}{vehiculo.descripcion ? ` · ${vehiculo.descripcion}` : ''}</span>
                      <span className="block truncate text-[10px] text-slate-400">
                        {(Number(vehiculo.velocidad_kmh) || 0) > 0 ? `${Number(vehiculo.velocidad_kmh)} km/h` : 'Detenida / sin dato'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
            Desde
            <input
              type="datetime-local"
              value={desde}
              onChange={(event) => { setDesde(event.target.value); }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-normal text-slate-700 outline-none focus:border-forest"
            />
          </label>
          <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
            Hasta
            <input
              type="datetime-local"
              value={hasta}
              onChange={(event) => { setHasta(event.target.value); }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-normal text-slate-700 outline-none focus:border-forest"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={clickUbicaciones}
            className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-forest-light transition-colors"
          >
            <History size={13} aria-hidden="true" />
            Ubicaciones Históricas
          </button>
          <button
            type="button"
            onClick={ping}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:border-forest hover:text-forest transition-colors"
          >
            Ping
          </button>
        </div>
        {mensaje ? (
          <p className="text-[10px] leading-snug text-slate-500" role="status" aria-live="polite">
            {mensaje}
          </p>
        ) : null}
        {recorrido ? (
          <div className="pt-1">{recorrido}</div>
        ) : null}
      </div>
    );
  }
  if (id === 'localizador') {
    return localizador || (
      <Placeholder texto="No se recibió información del localizador de unidades." />
    );
  }
  if (id === 'coordenadas') {
    return coordenadas || (
      <Placeholder texto="No se recibió información de coordenadas de unidades." />
    );
  }
  if (id === 'zonas') {
    return (
      <ZonasPanel
        geofences={zonas?.geofences || []}
        selectedId={zonas?.selectedId || ''}
        onSeleccionar={zonas?.onSeleccionar}
        unidadesEnGeocerca={zonas?.unidadesEnGeocerca}
        mostrarUnidades={zonas?.mostrarUnidades !== false}
        onToggleMostrarUnidades={zonas?.onToggleMostrarUnidades}
        actualizarMapaCada={zonas?.actualizarMapaCada}
        onActualizarMapaCada={zonas?.onActualizarMapaCada}
      />
    );
  }
  if (id === 'configuracion') {
    return (
      <ConfiguracionPrincipal
        empresaId={configuracion?.empresaId}
        userId={configuracion?.userId}
        puedePosiciones={configuracion?.puedePosiciones !== false}
      />
    );
  }
  const etiqueta = SECCIONES.find((s) => s.id === id)?.label || 'Esta sección';
  return <Proximamente etiqueta={etiqueta} />;
}

export default function ConsolaPrincipal({
  localizador, coordenadas, buscarUnidades, elegirUnidad,
  unidadExterna, rutaDesde, rutaHasta, onRutaDesde, onRutaHasta,
  recorrido,
  zonas,
  configuracion,
  seccionActiva, onSeccionActiva, apertura = 0,
}) {
  const inicial = rangoDefault();
  const desdeControlado = rutaDesde !== undefined;
  const hastaControlado = rutaHasta !== undefined;
  const [colapsado, setColapsado] = useState(false);
  const [panelAbierto, setPanelAbierto] = useState(true);
  const [seccionInterna, setSeccionInterna] = useState('localizador');
  const seccionId = seccionActiva ?? seccionInterna;
  const setSeccionId = (id) => {
    setSeccionInterna(id);
    onSeccionActiva?.(id);
  };
  const [unidad, setUnidad] = useState(unidadExterna || '');
  const [desdeInterno, setDesdeInterno] = useState(inicial.desde);
  const [hastaInterno, setHastaInterno] = useState(inicial.hasta);
  const desde = desdeControlado ? rutaDesde : desdeInterno;
  const hasta = hastaControlado ? rutaHasta : hastaInterno;
  const setDesde = onRutaDesde || setDesdeInterno;
  const setHasta = onRutaHasta || setHastaInterno;
  const [mensaje, setMensaje] = useState('');
  const [escuchandoUnidad, setEscuchandoUnidad] = useState(false);
  const [resultadosUnidad, setResultadosUnidad] = useState([]);
  const unidadRecognitionRef = useRef(null);

  useEffect(() => () => unidadRecognitionRef.current?.abort?.(), []);

  // Apertura externa (por ejemplo desde «Ver recorrido detallado»): despliega
  // la consola y se desplaza hasta ella.
  useEffect(() => {
    if (apertura <= 0) return;
    setColapsado(false);
    setPanelAbierto(true);
    requestAnimationFrame(() => {
      document.getElementById('consola-principal')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [apertura]);

  // Unidad sincronizada con la placa seleccionada en el mapa/lista de unidades
  // y con la tarjeta «Recorrido histórico»: cambiarla allí también la cambia aquí.
  useEffect(() => {
    if (unidadExterna === undefined) return;
    setUnidad(unidadExterna || '');
    setResultadosUnidad([]);
  }, [unidadExterna]);

  const aplicarBusqueda = (texto) => {
    setUnidad(texto);
    setMensaje('');
    if (!buscarUnidades || !texto.trim()) {
      setResultadosUnidad([]);
      return [];
    }
    const matches = buscarUnidades(texto).slice(0, 8);
    setResultadosUnidad(matches);
    return matches;
  };

  const elegirDeLista = (placa) => {
    const respuesta = elegirUnidad?.(placa, { desde, hasta });
    setUnidad(placa);
    setResultadosUnidad([]);
    setMensaje(typeof respuesta === 'string' ? respuesta : `Recorrido de «${placa}» cargado.`);
  };

  const aplicarResultadoFinal = (texto) => {
    const matches = aplicarBusqueda(texto);
    if (matches.length === 1) {
      elegirDeLista(matches[0].placa);
      return;
    }
    if (!matches.length) {
      setMensaje(`No encontré una unidad para «${texto}». Intenta decir solo la placa.`);
      return;
    }
    setMensaje(`Hay ${matches.length} coincidencias. Elige la unidad en la lista.`);
  };

  const toggleColapsado = () => {
    setColapsado((prev) => !prev);
  };

  const toggleVozUnidad = async () => {
    if (Capacitor.isNativePlatform()) {
      if (escuchandoUnidad) {
        setEscuchandoUnidad(false);
        return;
      }
      const plugin = await loadNativeSpeech();
      if (!plugin) {
        setMensaje('Reconocimiento de voz no disponible en este dispositivo.');
        return;
      }
      try {
        const { available } = await plugin.available();
        if (!available) {
          setMensaje('Activa “Speech Services by Google” e intenta de nuevo.');
          return;
        }
        const perm = await plugin.requestPermissions().catch(() => null);
        if (perm?.speechRecognition === 'denied') {
          setMensaje('Permiso de micrófono denegado. Actívalo en Ajustes → Agrilux → Permisos.');
          return;
        }
        setEscuchandoUnidad(true);
        setMensaje('Escuchando… di la placa de la máquina.');
        const result = await plugin.start({
          language: 'es-PE',
          maxResults: 5,
          prompt: 'Di la placa de la máquina',
          popup: true,
          partialResults: false,
        });
        setEscuchandoUnidad(false);
        const match = (result?.matches || []).find((m) => m && m.trim())?.trim() || '';
        if (match) aplicarResultadoFinal(match);
        else setMensaje('No te escuché. Intenta de nuevo cerca del micrófono.');
      } catch (error) {
        setEscuchandoUnidad(false);
        setMensaje('No te escuché bien. Revisa internet y los permisos de micrófono.');
        console.warn('[Consola] dictado unidad falló:', error);
      }
      return;
    }
    if (!SpeechRecognitionCtor) {
      setMensaje('Tu navegador no soporta búsqueda por voz. Usa Chrome o Edge.');
      return;
    }
    if (escuchandoUnidad) {
      unidadRecognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'es-PE';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setEscuchandoUnidad(true);
      setMensaje('Escuchando… di la placa de la máquina.');
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();
      if (!transcript) return;
      const isFinal = event.results[event.results.length - 1]?.isFinal;
      if (isFinal) aplicarResultadoFinal(transcript);
      else setUnidad(transcript);
    };
    recognition.onerror = (event) => {
      const messages = {
        'not-allowed': 'Permite el acceso al micrófono en el navegador para usar la voz.',
        'service-not-allowed': 'Permite el acceso al micrófono en el navegador para usar la voz.',
        'no-speech': 'No te escuché. Toca el micrófono e inténtalo de nuevo.',
        'audio-capture': 'No se detectó ningún micrófono.',
        network: 'La búsqueda por voz necesita conexión a internet.',
      };
      setMensaje(messages[event.error] || 'No se pudo reconocer la voz. Inténtalo de nuevo.');
      setEscuchandoUnidad(false);
      unidadRecognitionRef.current = null;
    };
    recognition.onend = () => {
      setEscuchandoUnidad(false);
      unidadRecognitionRef.current = null;
    };
    unidadRecognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setEscuchandoUnidad(false);
      unidadRecognitionRef.current = null;
    }
  };

  const clickUbicaciones = () => {
    const texto = unidad.trim();
    if (!texto) {
      setMensaje('Escribe o dicta una placa de unidad.');
      return;
    }
    const matches = buscarUnidades ? buscarUnidades(texto) : [];
    if (matches.length === 1) {
      elegirDeLista(matches[0].placa);
      return;
    }
    if (matches.length > 1) {
      setResultadosUnidad(matches.slice(0, 8));
      setMensaje(`Hay ${matches.length} coincidencias. Elige la unidad en la lista.`);
      return;
    }
    setMensaje(`No encontré una unidad para «${texto}».`);
  };

  const ping = () => {
    setMensaje(unidad.trim() ? `Ping enviado a «${unidad.trim()}» (simulado en esta vista).` : 'Escribe una placa para hacer ping.');
  };

  const seccion = SECCIONES.find((item) => item.id === seccionId) || SECCIONES[0];
  const IconoSeccion = seccion.Icon;

  const grupos = SECCIONES.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  return (
    <section id="consola-principal" className="scroll-mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={toggleColapsado}
        aria-expanded={!colapsado}
        className="flex w-full items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-left hover:bg-slate-100 transition-colors"
      >
        <span className="text-xs font-bold uppercase tracking-wide text-slate-700">Principal</span>
        {colapsado
          ? <ChevronDown size={16} className="text-slate-500" />
          : <ChevronUp size={16} className="text-slate-500" />}
      </button>

      {!colapsado ? (
        <div className={`grid grid-cols-1 gap-3 p-3 sm:p-4 ${!panelAbierto ? 'lg:grid-cols-[88px_minmax(0,1fr)]' : 'lg:grid-cols-[240px_minmax(0,1fr)]'}`}>
          <nav className="rounded-2xl border border-slate-100 bg-slate-50/60 p-2 transition-[width] duration-300 ease-in-out" aria-label="Secciones de la consola principal">
            <div className={`mb-2 flex items-center ${panelAbierto ? 'justify-between px-2' : 'justify-center'}`}>
              {panelAbierto && (
                <h3 className="py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Secciones</h3>
              )}
              <button
                type="button"
                onClick={() => setPanelAbierto((open) => !open)}
                aria-label={panelAbierto ? 'Colapsar panel de secciones' : 'Expandir panel de secciones'}
                aria-expanded={panelAbierto}
                title={panelAbierto ? 'Colapsar panel de secciones' : 'Expandir panel de secciones'}
                className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <span className="absolute inset-1 rounded-full border border-primary/20" aria-hidden="true" />
                {panelAbierto ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
              </button>
            </div>
            {panelAbierto ? (
            <div className="space-y-3 max-h-[560px] overflow-y-auto">
              {Object.entries(grupos).map(([group, items]) => (
                <div key={group}>
                  <h4 className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{group}</h4>
                  <div className="space-y-0.5">
                    {items.map((item) => {
                      const Icon = item.Icon;
                      const activa = seccion.id === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSeccionId(item.id)}
                          aria-current={activa ? 'page' : undefined}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-forest/20 ${
                            activa
                              ? 'bg-forest text-white font-semibold shadow-sm'
                              : 'text-slate-600 hover:bg-emerald-50 hover:text-forest'
                          }`}
                        >
                          <Icon size={14} className={`shrink-0 ${activa ? 'text-white' : 'text-forest'}`} aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            ) : (
            <div className="flex flex-col items-center gap-1 py-1">
              {SECCIONES.map((item) => {
                const Icon = item.Icon;
                const activa = seccion.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSeccionId(item.id)}
                    aria-current={activa ? 'page' : undefined}
                    title={item.label}
                    aria-label={item.label}
                    className={`grid h-10 w-10 place-items-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-forest/20 ${
                      activa
                        ? 'bg-forest text-white shadow-sm'
                        : 'text-slate-600 hover:bg-emerald-50 hover:text-forest'
                    }`}
                  >
                    <Icon size={16} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
            )}
          </nav>

          <div className="min-w-0 space-y-3 overflow-hidden rounded-2xl border border-slate-100 bg-white p-3 sm:p-4">
            <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{seccion.group}</p>
                <h3 className="mt-0.5 text-base font-bold text-slate-900">{seccion.label}</h3>
              </div>
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                <IconoSeccion size={12} className="mr-1.5" />
                {seccion.id === 'localizador' || seccion.id === 'coordenadas' || seccion.id === 'zonas' || seccion.id === 'configuracion' ? 'Listo' : 'En preparación'}
              </span>
            </header>
            <div className="space-y-3">
              <ContenidoSeccion
                id={seccion.id}
                localizador={localizador}
                coordenadas={coordenadas}
                recorrido={recorrido}
                zonas={zonas}
                configuracion={configuracion}
                unidad={unidad}
                setUnidad={setUnidad}
                aplicarBusqueda={aplicarBusqueda}
                desde={desde}
                setDesde={setDesde}
                hasta={hasta}
                setHasta={setHasta}
                clickUbicaciones={clickUbicaciones}
                ping={ping}
                mensaje={mensaje}
                setMensaje={setMensaje}
                escuchandoUnidad={escuchandoUnidad}
                toggleVozUnidad={toggleVozUnidad}
                resultadosUnidad={resultadosUnidad}
                elegirDeLista={elegirDeLista}
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
