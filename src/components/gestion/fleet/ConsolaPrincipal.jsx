import React, { useState, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  History,
  MapPin,
  Mic,
  MicOff,
  X,
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
  Truck,
  Users,
  Building2,
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

const SECCIONES = [
  { id: 'localizador', label: 'Localizador de Unidades', group: 'Flota', Icon: Search },
  { id: 'coordenadas', label: 'Coordenadas de Unidades', group: 'Flota', Icon: Table },
  { id: 'historicas', label: 'Ubicaciones Históricas', group: 'Flota', Icon: History },
  { id: 'direcciones', label: 'Localizador de Direcciones', group: 'Flota', Icon: MapPin },
  { id: 'mensajeria', label: 'Servicio de Mensajería', group: 'Comunicación', Icon: Mail },
  { id: 'seguimiento', label: 'Número de Seguimiento', group: 'Comunicación', Icon: Hash },
  { id: 'despachos', label: 'Director de Despachos', group: 'Operaciones', Icon: Warehouse },
  { id: 'cercano', label: 'Encuentre el más cercano', group: 'Operaciones', Icon: Navigation },
  { id: 'control-remoto', label: 'Control Remoto', group: 'Operaciones', Icon: Power },
  { id: 'ordenes', label: 'Órdenes de Trabajo', group: 'Operaciones', Icon: ClipboardList },
  { id: 'geocercas', label: 'Geocercas', group: 'Geocercas', Icon: Shapes },
  { id: 'configuracion', label: 'Configuración', group: 'Sistema', Icon: Settings },
];

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

function ContenidoConfiguracion() {
  const tarjetas = [
    {
      Icon: Truck,
      titulo: 'Máquinas / Unidades',
      descripcion: 'Cargar y editar el padrón de la flota: placa, área, estado operativo, movimiento y activa/inactiva.',
    },
    {
      Icon: Shapes,
      titulo: 'Geocercas',
      descripcion: 'Importar geocercas (ZIP/Shapefile), crear, editar y eliminar polígonos desde la aplicación.',
    },
    {
      Icon: Users,
      titulo: 'Choferes',
      descripcion: 'Registrar conductores, licencias y asignación a máquinas (tabla agrotrack_conductores pendiente).',
    },
    {
      Icon: Building2,
      titulo: 'Grupos',
      descripcion: 'Crear y reasignar grupos de unidades en bloque: seguridad, maquinaria, visitas, etc.',
    },
  ];
  return (
    <div className="grid gap-3">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-snug text-amber-800">
        <p className="font-semibold">Configuración pendiente de implementar</p>
        <p className="mt-1">Este apartado centralizará la administración de los datos maestros de la flota. Ninguno de los cuatro módulos tiene fuente real todavía en la base, por lo que no se habilitan acciones de edición aún.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {tarjetas.map(({ Icon, titulo, descripcion }) => (
          <div key={titulo} className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-white text-forest shadow-sm">
              <Icon size={18} aria-hidden="true" />
            </span>
            <h4 className="mt-3 text-sm font-bold text-slate-900">{titulo}</h4>
            <p className="mt-1 flex-1 text-[11px] leading-snug text-slate-500">{descripcion}</p>
            <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Pendiente
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContenidoSeccion({
  id, localizador, coordenadas, recorrido,
  unidad, setUnidad, aplicarBusqueda,
  ruta, setRuta,
  desde, setDesde, hasta, setHasta,
  pagina, setPagina,
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
        <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
          Ruta
          <select
            value={ruta}
            onChange={(event) => { setRuta(event.target.value); }}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-normal text-slate-700 outline-none focus:border-forest"
          >
            <option value="recorrido">Recorrido por unidad</option>
            <option value="personalizada" disabled>Ruta personalizada (próximamente)</option>
          </select>
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
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
            Página
            <button type="button" aria-label="Página anterior" onClick={() => setPagina((p) => Math.max(1, p - 1))} className="rounded p-1 hover:bg-slate-100"><ChevronLeft size={14} /></button>
            {pagina}/5
            <button type="button" aria-label="Página siguiente" onClick={() => setPagina((p) => Math.min(5, p + 1))} className="rounded p-1 hover:bg-slate-100"><ChevronRight size={14} /></button>
          </span>
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
  if (id === 'configuracion') {
    return <ContenidoConfiguracion />;
  }
  return (
    <Placeholder texto="Se ampliará en la siguiente iteración con las funciones de esta sección, manteniendo el mismo estilo de consola Agrilux." />
  );
}

export default function ConsolaPrincipal({
  localizador, coordenadas, buscarUnidades, elegirUnidad,
  unidadExterna, rutaDesde, rutaHasta, onRutaDesde, onRutaHasta,
  recorrido,
}) {
  const inicial = rangoDefault();
  const desdeControlado = rutaDesde !== undefined;
  const hastaControlado = rutaHasta !== undefined;
  const [colapsado, setColapsado] = useState(false);
  const [panelAbierto, setPanelAbierto] = useState(true);
  const [seccionId, setSeccionId] = useState('localizador');
  const [unidad, setUnidad] = useState(unidadExterna || '');
  const [ruta, setRuta] = useState('recorrido');
  const [desdeInterno, setDesdeInterno] = useState(inicial.desde);
  const [hastaInterno, setHastaInterno] = useState(inicial.hasta);
  const desde = desdeControlado ? rutaDesde : desdeInterno;
  const hasta = hastaControlado ? rutaHasta : hastaInterno;
  const setDesde = onRutaDesde || setDesdeInterno;
  const setHasta = onRutaHasta || setHastaInterno;
  const [pagina, setPagina] = useState(1);
  const [mensaje, setMensaje] = useState('');
  const [escuchandoUnidad, setEscuchandoUnidad] = useState(false);
  const [resultadosUnidad, setResultadosUnidad] = useState([]);
  const unidadRecognitionRef = useRef(null);

  useEffect(() => () => unidadRecognitionRef.current?.abort?.(), []);

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
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
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
        <div className={`grid grid-cols-1 gap-3 p-3 sm:p-4 ${panelAbierto ? 'lg:grid-cols-[240px_minmax(0,1fr)]' : 'lg:grid-cols-[88px_minmax(0,1fr)]'}`}>
          <nav className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3 transition-[width] duration-300 ease-in-out" aria-label="Secciones de la consola principal">
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
                {seccion.id === 'localizador' || seccion.id === 'coordenadas' ? 'Listo' : 'En preparación'}
              </span>
            </header>
            <div className="space-y-3">
              <ContenidoSeccion
                id={seccion.id}
                localizador={localizador}
                coordenadas={coordenadas}
                recorrido={recorrido}
                unidad={unidad}
                setUnidad={setUnidad}
                aplicarBusqueda={aplicarBusqueda}
                ruta={ruta}
                setRuta={setRuta}
                desde={desde}
                setDesde={setDesde}
                hasta={hasta}
                setHasta={setHasta}
                pagina={pagina}
                setPagina={setPagina}
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
