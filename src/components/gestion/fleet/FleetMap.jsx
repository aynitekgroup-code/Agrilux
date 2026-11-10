import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, GeoJSON, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Info,
  LoaderCircle,
  MapPin,
  Mic,
  MicOff,
  RefreshCw,
  Search,
  Upload,
  X,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { importarGeocercasZip, listarGeocercas } from '../../../lib/agrotrackGeocercas';
import {
  formatearFechaHora,
  obtenerRecorridoFlota,
  rangoDiaLima,
  ultimoDiaLima,
} from '../../../lib/agrotrackFlota';
import { STATUS_META } from './fleetTokens';
import PosicionesImport from './PosicionesImport';

const SpeechRecognitionCtor =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

/* ---------- Utilidades ---------- */

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Acepta la geometría como objeto GeoJSON, como texto JSON o como Feature.
// Soporta tanto la columna `geometria` como `poligono` (o `geom`).
function parseGeometry(value) {
  if (!value) return null;
  let geometry = value;
  if (typeof value === 'string') {
    try {
      geometry = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (geometry?.type === 'Feature') geometry = geometry.geometry;
  return geometry?.type && geometry.coordinates ? geometry : null;
}

function normalizeGeofence(row) {
  return { ...row, geometria: parseGeometry(row.geometria ?? row.poligono ?? row.geom) };
}

// Busca por todas las palabras (en cualquier orden) y ordena: nombre exacto,
// nombre que empieza con la consulta, nombre que la contiene, otros campos.
function searchGeofences(list, rawQuery) {
  const query = normalizeText(rawQuery);
  if (!query) return list;
  const tokens = query.split(/\s+/).filter(Boolean);
  const scored = [];
  list.forEach((geofence) => {
    const name = normalizeText(geofence.nombre);
    const haystack = normalizeText(
      [geofence.nombre, geofence.division, geofence.anexo, geofence.distrito, geofence.provincia]
        .filter(Boolean)
        .join(' '),
    );
    if (!tokens.every((token) => haystack.includes(token))) return;
    let score = 3;
    if (name === query) score = 0;
    else if (name.startsWith(query)) score = 1;
    else if (name.includes(query)) score = 2;
    scored.push({ geofence, score });
  });
  return scored
    .sort(
      (a, b) =>
        a.score - b.score ||
        String(a.geofence.nombre).localeCompare(String(b.geofence.nombre), 'es'),
    )
    .map((item) => item.geofence);
}

// Quita frases de comando al inicio: "busca la geocerca Gregorio" -> "gregorio".
function stripVoiceCommand(transcript) {
  const text = normalizeText(transcript).replace(/[.,;:!?¿¡]/g, ' ').replace(/\s+/g, ' ').trim();
  const cleaned = text
    .replace(
      /^(?:(?:busca|buscar|buscame|llevame|muestrame|muestra|mostrar|ubica|ubicame|quiero ver|ir|ve|vamos)\s+)?(?:(?:a|al|a la|hacia|en)\s+)?(?:(?:la|el)\s+)?(?:(?:geocerca|zona|lote|division)\s+)?/,
      '',
    )
    .trim();
  return cleaned || text;
}

/* ---------- Mapa ---------- */

function FitMapToGeofences({ geoJson, focusRequest }) {
  const map = useMap();

  // Encuadra todas las geocercas cuando cambian los datos.
  useEffect(() => {
    const bounds = L.geoJSON(geoJson).getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.06), { maxZoom: 16, animate: false });
    } else {
      map.setView([-6.78, -79.83], 13, { animate: false });
    }
  }, [geoJson, map]);

  // Hace zoom a la geocerca elegida cada vez que el usuario la selecciona
  // (aunque sea la misma que ya estaba seleccionada).
  useEffect(() => {
    if (!focusRequest?.geometry) return;
    const bounds = L.geoJSON(focusRequest.geometry).getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.2), { maxZoom: 16, animate: true });
    }
  }, [map, focusRequest]);

  return null;
}

function featureTooltip(feature, layer) {
  const properties = feature.properties || {};
  const details = [properties.nombre, properties.division, properties.anexo, properties.distrito]
    .filter(Boolean)
    .join(' · ');
  if (details) {
    layer.bindTooltip(details);
    layer.bindPopup(details);
  }
}

/** Encuadra el mapa sobre el recorrido cargado (FASE 2).
 *  `puntos` es una lista de pares [lat, lng]. */
function FitMapToRoute({ puntos, token }) {
  const map = useMap();
  useEffect(() => {
    if (!puntos?.length) return;
    try {
      const bounds = L.latLngBounds(puntos);
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.12), { maxZoom: 16, animate: false });
      }
    } catch {
      // Un punto malformado no debe tumbar la consola entera.
    }
  }, [map, puntos, token]);
  return null;
}

/* ---------- Componente ---------- */

export default function FleetMap({ empresaId, userId, canImport = false, vehicles = [], selectedId, onSelect, fuentePosiciones = 'demo', periodo = null }) {
  const [rawGeofences, setRawGeofences] = useState([]);
  const [loading, setLoading] = useState(Boolean(empresaId));
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mapRevision, setMapRevision] = useState(0);
  const [showGeofenceList, setShowGeofenceList] = useState(false);
  const [geofenceSearch, setGeofenceSearch] = useState('');
  const [resultsOpen, setResultsOpen] = useState(false);
  const [selectedGeofenceId, setSelectedGeofenceId] = useState('');
  const [focusRequest, setFocusRequest] = useState(null);
  const [listening, setListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState('');
  // FASE 2: recorrido de la unidad seleccionada en un día calendario de Perú.
  const [rutaFecha, setRutaFecha] = useState('');
  const [rutaPuntos, setRutaPuntos] = useState(null); // null = sin cargar
  const [rutaCargando, setRutaCargando] = useState(false);
  const [rutaError, setRutaError] = useState('');
  const [rutaFitToken, setRutaFitToken] = useState(0);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const applyVoiceRef = useRef(null);
  const activeCompanyRef = useRef(empresaId);
  activeCompanyRef.current = empresaId;
  const activePlacaRef = useRef(selectedId);
  activePlacaRef.current = selectedId;

  const geofences = useMemo(() => rawGeofences.map(normalizeGeofence), [rawGeofences]);
  const withoutGeometry = useMemo(
    () => geofences.filter((geofence) => !geofence.geometria).length,
    [geofences],
  );

  const geoJson = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: geofences
        .filter((geofence) => geofence.geometria)
        .map((geofence) => ({
          type: 'Feature',
          geometry: geofence.geometria,
          properties: geofence,
        })),
    }),
    [geofences],
  );

  const geofenceSummary = useMemo(() => {
    const divisions = new Map();
    geofences.forEach((geofence) => {
      const division = geofence.division || 'Sin división';
      divisions.set(division, (divisions.get(division) || 0) + 1);
    });
    return [...divisions.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'));
  }, [geofences]);

  const filteredGeofences = useMemo(
    () => searchGeofences(geofences, geofenceSearch),
    [geofenceSearch, geofences],
  );
  const selectedGeofence = geofences.find((geofence) => geofence.id === selectedGeofenceId);
  const searchResults = geofenceSearch.trim() ? filteredGeofences.slice(0, 8) : [];
  const showResults = Boolean(geofenceSearch.trim()) && resultsOpen;

  const refreshGeofences = useCallback(async (targetCompanyId = empresaId) => {
    if (targetCompanyId !== activeCompanyRef.current) return;
    if (!targetCompanyId) {
      setRawGeofences([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const rows = await listarGeocercas(targetCompanyId);
      if (targetCompanyId === activeCompanyRef.current) {
        setRawGeofences(rows);
        setMapRevision((revision) => revision + 1);
      }
    } catch (loadError) {
      if (targetCompanyId === activeCompanyRef.current) {
        setRawGeofences([]);
        setError(loadError.message || 'No se pudieron cargar las geocercas.');
      }
    } finally {
      if (targetCompanyId === activeCompanyRef.current) setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    setNotice('');
    setError('');
    setRawGeofences([]);
    setSelectedGeofenceId('');
    setFocusRequest(null);
    setGeofenceSearch('');
    setResultsOpen(false);
    refreshGeofences();
  }, [empresaId, refreshGeofences]);

  // Avisa en consola si hay geocercas sin geometría legible (ayuda a diagnosticar
  // si la columna es `geometria` o `poligono`).
  useEffect(() => {
    if (rawGeofences.length && withoutGeometry) {
      console.warn(
        `[FleetMap] ${withoutGeometry} de ${rawGeofences.length} geocercas no tienen geometría legible. Campos de la primera fila:`,
        Object.keys(rawGeofences[0] || {}),
      );
    }
  }, [rawGeofences, withoutGeometry]);

  const focusGeofence = useCallback((geofence) => {
    setSelectedGeofenceId(geofence.id);
    if (geofence.geometria) {
      setFocusRequest({ geometry: geofence.geometria, token: Date.now() });
    }
  }, []);

  /* ----- Recorrido (FASE 2) ----- */

  // Por defecto, el último día con datos del periodo cargado.
  useEffect(() => {
    setRutaFecha((prev) => prev || ultimoDiaLima(periodo?.hasta) || ultimoDiaLima(periodo?.desde) || '');
  }, [periodo]);

  // Al cambiar de empresa se limpia todo lo del recorrido anterior.
  useEffect(() => {
    setRutaPuntos(null);
    setRutaError('');
    setRutaCargando(false);
  }, [empresaId]);

  // El recorrido dibujado pertenece a una unidad: si cambia la selección, se limpia.
  useEffect(() => {
    setRutaPuntos(null);
    setRutaError('');
  }, [selectedId]);

  const cargarRecorrido = useCallback(async () => {
    if (!empresaId || !selectedId || !rutaFecha) return;
    const placa = selectedId;
    const { desde, hasta } = rangoDiaLima(rutaFecha);
    if (!desde) {
      setRutaError('Elige un día válido para ver el recorrido.');
      return;
    }
    setRutaCargando(true);
    setRutaError('');
    try {
      const puntos = await obtenerRecorridoFlota(empresaId, { placa, desde, hasta });
      // Si mientras cargaba cambió la unidad, se descarta la respuesta vieja.
      if (placa === activePlacaRef.current) {
        setRutaPuntos(puntos || []);
        setRutaFitToken(Date.now());
      }
    } catch (routeError) {
      setRutaPuntos(null);
      setRutaError(routeError.message || 'No se pudo cargar el recorrido.');
    } finally {
      setRutaCargando(false);
    }
  }, [empresaId, selectedId, rutaFecha]);

  const limpiarRecorrido = () => {
    setRutaPuntos(null);
    setRutaError('');
  };

  // Puntos con coordenadas numéricas: un NaN o undefined rompe Leaflet.
  const rutaValidos = useMemo(
    () =>
      (rutaPuntos || []).filter(
        (punto) => Number.isFinite(Number(punto.latitud)) && Number.isFinite(Number(punto.longitud)),
      ),
    [rutaPuntos],
  );

  const handleSelectGeofence = (geofence) => {
    focusGeofence(geofence);
    setGeofenceSearch(geofence.nombre || '');
    setResultsOpen(false);
  };

  const handleSearchChange = (event) => {
    setGeofenceSearch(event.target.value);
    setResultsOpen(true);
    setVoiceMessage('');
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === 'Enter' && searchResults[0]) {
      event.preventDefault();
      handleSelectGeofence(searchResults[0]);
    }
    if (event.key === 'Escape') setResultsOpen(false);
  };

  const clearSelection = () => {
    setSelectedGeofenceId('');
    setGeofenceSearch('');
    setResultsOpen(false);
    setVoiceMessage('');
  };

  /* ----- Búsqueda por voz ----- */

  const applyVoiceResult = (transcript) => {
    const cleaned = stripVoiceCommand(transcript);
    let matches = searchGeofences(geofences, cleaned);
    let usedQuery = cleaned;
    if (!matches.length) {
      matches = searchGeofences(geofences, transcript);
      usedQuery = transcript;
    }
    setGeofenceSearch(usedQuery);
    if (!matches.length) {
      setResultsOpen(true);
      setVoiceMessage(`No encontré geocercas para "${transcript}". Intenta decir solo el nombre.`);
      return;
    }
    const [best] = matches;
    focusGeofence(best);
    if (matches.length > 1) {
      setResultsOpen(true);
      setVoiceMessage(`Seleccioné "${best.nombre}". Hay ${matches.length - 1} coincidencias más en la lista.`);
    } else {
      setResultsOpen(false);
      setVoiceMessage(`Seleccioné "${best.nombre}".`);
    }
  };
  applyVoiceRef.current = applyVoiceResult;

  const toggleVoiceSearch = () => {
    if (!SpeechRecognitionCtor) {
      setVoiceMessage('Tu navegador no soporta búsqueda por voz. Usa Chrome o Edge.');
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'es-PE';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setVoiceMessage('Escuchando… di el nombre de la geocerca.');
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim();
      if (!transcript) return;
      const isFinal = event.results[event.results.length - 1]?.isFinal;
      if (isFinal) {
        applyVoiceRef.current?.(transcript);
      } else {
        setGeofenceSearch(transcript);
        setResultsOpen(false);
      }
    };
    recognition.onerror = (event) => {
      const messages = {
        'not-allowed': 'Permite el acceso al micrófono en el navegador para usar la voz.',
        'service-not-allowed': 'Permite el acceso al micrófono en el navegador para usar la voz.',
        'no-speech': 'No te escuché. Toca el micrófono e inténtalo de nuevo.',
        'audio-capture': 'No se detectó ningún micrófono.',
        network: 'La búsqueda por voz necesita conexión a internet.',
      };
      setVoiceMessage(messages[event.error] || 'No se pudo reconocer la voz. Inténtalo de nuevo.');
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setListening(false);
      recognitionRef.current = null;
    }
  };

  useEffect(() => () => recognitionRef.current?.abort?.(), []);

  /* ----- Importación ----- */

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !empresaId) return;

    setImporting(true);
    setError('');
    setNotice('');
    try {
      const saved = await importarGeocercasZip(file, empresaId, userId);
      if (empresaId) {
        await refreshGeofences(empresaId);
        setNotice(`Se importaron correctamente ${saved} geocercas para esta empresa.`);
      }
    } catch (importError) {
      setError(importError.message || 'No se pudo importar el archivo de geocercas.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-w-0">
      <div className="p-4 sm:p-5 flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900">Geocercas de la empresa</h2>
          <p className="text-xs text-slate-500">
            {loading ? 'Cargando límites reales…' : `${geoJson.features.length} polígonos reales · WGS84`}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => refreshGeofences()}
            disabled={loading || importing || !empresaId}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
          {canImport ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing || !empresaId}
              className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-3 py-1.5 text-xs font-semibold text-white hover:bg-forest-dark disabled:opacity-50"
            >
              {importing ? <LoaderCircle size={14} className="animate-spin" /> : <Upload size={14} />}
              {importing ? 'Importando…' : 'Importar ZIP'}
            </button>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={handleImport}
            aria-label="Seleccionar ZIP de geocercas"
          />
        </div>
      </div>

      {canImport ? (
        <p className="px-4 sm:px-5 pb-3 text-[11px] text-slate-500">
          ZIP con los archivos de la capa <code>linderos</code> (.shp, .shx, .dbf, .prj y .cpg).
          La carga actualiza únicamente polígonos con la misma división, anexo y nombre.
        </p>
      ) : null}

      {canImport ? (
        <div className="px-4 sm:px-5 pb-3 flex flex-wrap items-center gap-2">
          <PosicionesImport empresaId={empresaId} userId={userId} disabled={importing} />
          <span className="text-[11px] text-slate-500">
            ZIP o Excel del “Reporte por placa” de Zonar (un punto GPS cada 2 minutos por unidad).
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="mx-4 sm:mx-5 mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {notice ? (
        <p className="mx-4 sm:mx-5 mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800" role="status">
          {notice}
        </p>
      ) : null}
      {!empresaId && !loading ? (
        <p className="mx-4 sm:mx-5 mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Inicia sesión y selecciona la empresa para ver sus geocercas.
        </p>
      ) : null}
      {!loading && empresaId && geofences.length === 0 && !error ? (
        <p className="mx-4 sm:mx-5 mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Esta empresa aún no tiene geocercas cargadas.
        </p>
      ) : null}
      {!loading && geofences.length > 0 && withoutGeometry > 0 ? (
        <p className="mx-4 sm:mx-5 mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" role="status">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>
            {withoutGeometry} de {geofences.length} geocercas no tienen una geometría legible y no se
            pueden dibujar. Revisa en Supabase que el polígono esté guardado en la columna
            <code className="mx-1">geometria</code> o <code className="mx-1">poligono</code>.
          </span>
        </p>
      ) : null}

      {geofences.length > 0 ? (
        <div className="px-4 sm:px-5 pb-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
            <Search size={17} className="shrink-0 text-slate-400" />
            <input
              type="text"
              value={geofenceSearch}
              onChange={handleSearchChange}
              onFocus={() => setResultsOpen(true)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Buscar geocerca por nombre o decirlo con voz…"
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              aria-label="Buscar geocercas por nombre"
              aria-controls="geofence-search-results"
              aria-expanded={showResults}
              autoComplete="off"
            />
            {geofenceSearch || selectedGeofenceId ? (
              <button
                type="button"
                onClick={clearSelection}
                className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Limpiar búsqueda"
              >
                <X size={15} />
              </button>
            ) : (
              <span className="shrink-0 text-[11px] text-slate-400">{geofences.length} geocercas</span>
            )}
            <button
              type="button"
              onClick={toggleVoiceSearch}
              className={`shrink-0 rounded-full p-1.5 transition-colors ${
                listening
                  ? 'animate-pulse bg-red-100 text-red-700'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
              aria-label={listening ? 'Detener búsqueda por voz' : 'Buscar geocerca por voz'}
              aria-pressed={listening}
              title={SpeechRecognitionCtor ? 'Buscar por voz' : 'Tu navegador no soporta voz'}
            >
              {SpeechRecognitionCtor ? <Mic size={16} /> : <MicOff size={16} />}
            </button>
          </div>

          {voiceMessage ? (
            <p className="mt-1.5 px-1 text-[11px] text-slate-500" role="status" aria-live="polite">
              {voiceMessage}
            </p>
          ) : null}

          {selectedGeofence && !selectedGeofence.geometria ? (
            <p className="mt-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800" role="status">
              La geocerca «{selectedGeofence.nombre}» no tiene geometría guardada, por eso el mapa no puede
              llevarte hasta ella.
            </p>
          ) : null}

          {showResults ? (
            <div id="geofence-search-results" className="mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg" role="listbox" aria-label="Resultados de geocercas">
              {searchResults.length ? (
                <>
                  {searchResults.map((geofence) => (
                    <button
                      key={geofence.id}
                      type="button"
                      role="option"
                      aria-selected={selectedGeofenceId === geofence.id}
                      onClick={() => handleSelectGeofence(geofence)}
                      className={`flex w-full items-start gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-emerald-50 ${
                        selectedGeofenceId === geofence.id ? 'bg-emerald-50' : ''
                      }`}
                    >
                      <MapPin size={15} className="mt-0.5 shrink-0 text-emerald-700" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-800">{geofence.nombre}</span>
                        <span className="mt-0.5 block text-[11px] text-slate-500">
                          {[geofence.division, geofence.anexo, geofence.distrito].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </button>
                  ))}
                  {filteredGeofences.length > searchResults.length ? (
                    <p className="px-3 py-2 text-[11px] text-slate-500">
                      Mostrando 8 de {filteredGeofences.length} coincidencias. Escribe más para afinar la búsqueda.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="px-3 py-3 text-xs text-slate-500">No encontramos geocercas con ese nombre.</p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {fuentePosiciones === 'real' && vehicles.length ? (
        <div className="px-4 sm:px-5 pb-3">
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-700">Recorrido de la unidad</p>
              <p className="text-[11px] text-slate-500">
                {selectedId ? `Unidad seleccionada: ${selectedId}` : 'Selecciona una unidad en el mapa o en la lista.'}
              </p>
            </div>
            <label className="ml-auto flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
              Día (hora de Perú)
              <input
                type="date"
                value={rutaFecha}
                onChange={(event) => {
                  setRutaFecha(event.target.value);
                  setRutaPuntos(null);
                  setRutaError('');
                }}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-normal text-slate-700 outline-none focus:border-emerald-500"
                aria-label="Día del recorrido"
              />
            </label>
            <button
              type="button"
              onClick={cargarRecorrido}
              disabled={rutaCargando || !selectedId || !rutaFecha}
              className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-3 py-2 text-xs font-semibold text-white hover:bg-forest-dark disabled:opacity-50"
            >
              {rutaCargando ? <LoaderCircle size={14} className="animate-spin" /> : <MapPin size={14} />}
              {rutaCargando ? 'Cargando…' : 'Ver recorrido'}
            </button>
            {rutaPuntos ? (
              <button
                type="button"
                onClick={limpiarRecorrido}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-white"
              >
                <X size={14} /> Limpiar
              </button>
            ) : null}
          </div>
          {rutaError ? (
            <p className="mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{rutaError}</span>
            </p>
          ) : null}
          {!rutaError && rutaPuntos && !rutaCargando && rutaPuntos.length === 0 ? (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800" role="status">
              No hay posiciones de {selectedId} el {rutaFecha}. Prueba con otro día dentro del periodo cargado.
            </p>
          ) : null}
          {!rutaError && rutaPuntos && rutaPuntos.length > 0 ? (
            <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800" role="status">
              Recorrido de {selectedId} · {rutaFecha} · {rutaPuntos.length} puntos GPS
              {rutaPuntos.some((punto) => punto.es_alerta)
                ? ` · ${rutaPuntos.filter((punto) => punto.es_alerta).length} con alerta de velocidad o pánico`
                : ''}
              .
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="px-3 sm:px-5 pb-2">
        <MapContainer
          center={[-6.78, -79.83]}
          zoom={12}
          scrollWheelZoom
          style={{ width: '100%', height: 440, borderRadius: 14, background: '#E7EDE1' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <GeoJSON
            key={`${empresaId || 'none'}-${mapRevision}`}
            data={geoJson}
            style={(feature) => {
              const selected = feature?.properties?.id === selectedGeofenceId;
              return {
                color: selected ? '#B45309' : '#15803D',
                weight: selected ? 4 : 1.5,
                opacity: 0.9,
                fillColor: selected ? '#F59E0B' : '#22C55E',
                fillOpacity: selected ? 0.35 : 0.16,
              };
            }}
            onEachFeature={(feature, layer) => {
              featureTooltip(feature, layer);
              layer.on('click', () => setSelectedGeofenceId(feature.properties?.id || ''));
            }}
          />
          {geoJson.features.length > 0 ? (
            <FitMapToGeofences geoJson={geoJson} focusRequest={focusRequest} />
          ) : null}
          {rutaValidos.length > 0 ? (
            <>
              <Polyline
                positions={rutaValidos.map((punto) => [Number(punto.latitud), Number(punto.longitud)])}
                pathOptions={{ color: '#2563EB', weight: 3, opacity: 0.85 }}
              />
              <CircleMarker
                center={[
                  Number(rutaValidos[0].latitud),
                  Number(rutaValidos[0].longitud),
                ]}
                radius={6}
                pathOptions={{ color: '#FFFFFF', weight: 2, fillColor: '#16A34A', fillOpacity: 1 }}
              >
                <Tooltip direction="top" offset={[0, -6]} opacity={1} className="fleet-unit-tooltip">
                  <div className="text-[11px] leading-snug">
                    <p className="font-bold text-slate-900">Inicio del recorrido</p>
                    <p className="text-slate-600">{formatearFechaHora(rutaValidos[0].fecha)}</p>
                  </div>
                </Tooltip>
              </CircleMarker>
              <CircleMarker
                center={[
                  Number(rutaValidos[rutaValidos.length - 1].latitud),
                  Number(rutaValidos[rutaValidos.length - 1].longitud),
                ]}
                radius={6}
                pathOptions={{ color: '#FFFFFF', weight: 2, fillColor: '#DC2626', fillOpacity: 1 }}
              >
                <Tooltip direction="top" offset={[0, -6]} opacity={1} className="fleet-unit-tooltip">
                  <div className="text-[11px] leading-snug">
                    <p className="font-bold text-slate-900">Fin del recorrido</p>
                    <p className="text-slate-600">
                      {formatearFechaHora(rutaValidos[rutaValidos.length - 1].fecha)}
                    </p>
                  </div>
                </Tooltip>
              </CircleMarker>
              {rutaValidos
                .filter((punto) => punto.es_alerta)
                .map((punto) => (
                  <CircleMarker
                    key={`alerta-${punto.id}`}
                    center={[Number(punto.latitud), Number(punto.longitud)]}
                    radius={5}
                    pathOptions={{ color: '#FFFFFF', weight: 2, fillColor: '#F59E0B', fillOpacity: 1 }}
                  >
                    <Tooltip direction="top" offset={[0, -6]} opacity={1} className="fleet-unit-tooltip">
                      <div className="text-[11px] leading-snug">
                        <p className="font-bold text-slate-900">{punto.evento}</p>
                        <p className="text-slate-600">{formatearFechaHora(punto.fecha)}</p>
                        {punto.velocidad != null ? (
                          <p className="text-slate-600">{punto.velocidad} km/h</p>
                        ) : null}
                      </div>
                    </Tooltip>
                  </CircleMarker>
                ))}
              <FitMapToRoute
                puntos={rutaValidos.map((punto) => [Number(punto.latitud), Number(punto.longitud)])}
                token={rutaFitToken}
              />
            </>
          ) : null}
          {vehicles.filter((vehicle) => (
            vehicle?.lat != null && vehicle?.lng != null
            && Number.isFinite(Number(vehicle.lat)) && Number.isFinite(Number(vehicle.lng))
            && Number(vehicle.lat) !== 0 && Number(vehicle.lng) !== 0
          )).map((vehicle) => {
            const meta = STATUS_META[vehicle.estado] || STATUS_META.offline;
            const latitud = Number(vehicle.lat);
            const longitud = Number(vehicle.lng);
            const fechaPosicion = fuentePosiciones === 'real'
              ? (vehicle.ultima_fecha ? formatearFechaHora(vehicle.ultima_fecha) : '')
              : vehicle.ultima_actualizacion;
            const velocidad = Number(vehicle.velocidad_kmh);
            return (
              <CircleMarker
                key={vehicle.id}
                center={[latitud, longitud]}
                radius={selectedId === vehicle.id ? 7 : 5}
                pathOptions={{ color: '#FFFFFF', weight: 2, fillColor: meta.dot, fillOpacity: 1 }}
                eventHandlers={onSelect ? { click: () => onSelect(vehicle.id) } : undefined}
              >
                <Tooltip direction="top" offset={[0, -6]} opacity={1} className="fleet-unit-tooltip">
                  <div className="text-[11px] leading-snug space-y-0.5">
                    <p className="font-bold text-slate-900">{vehicle.placa}</p>
                    <p className="text-slate-600">{vehicle.descripcion || vehicle.modelo || '—'}</p>
                    <p className="text-slate-700">
                      {meta.label}
                      {Number.isFinite(velocidad) && velocidad > 0 ? ` · ${velocidad} km/h` : ''}
                    </p>
                    {fechaPosicion ? <p className="text-slate-500">{fechaPosicion}</p> : null}
                    {fuentePosiciones !== 'real' ? (
                      <p className="text-slate-400">GPS de demostración</p>
                    ) : null}
                  </div>
                </Tooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      {geofences.length > 0 ? (
        <div className="px-4 sm:px-5 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-slate-700">
              {geofences.length} geocercas · {geofenceSummary.length} divisiones
            </p>
            <div className="flex flex-wrap gap-1.5">
              {geofenceSummary.map(([division, count]) => (
                <span key={division} className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-800">
                  {division}: {count}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowGeofenceList((visible) => !visible)}
              aria-expanded={showGeofenceList}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:ml-auto"
            >
              {showGeofenceList ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showGeofenceList ? 'Ocultar nombres' : `Ver los ${geofences.length} nombres`}
            </button>
          </div>
          {showGeofenceList ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
              <label className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
                <Search size={15} className="shrink-0 text-slate-400" />
                <input
                  type="text"
                  value={geofenceSearch}
                  onChange={handleSearchChange}
                  placeholder="Buscar por nombre, división, anexo o distrito"
                  className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
                  aria-label="Buscar geocercas"
                  autoComplete="off"
                />
              </label>
              <div className="max-h-80 overflow-y-auto">
                {filteredGeofences.length ? (
                  <ol className="divide-y divide-slate-100">
                    {filteredGeofences.map((geofence, index) => (
                      <li key={geofence.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectGeofence(geofence)}
                          className={`flex w-full items-start gap-3 px-3 py-2 text-left text-xs hover:bg-emerald-50 ${
                            selectedGeofenceId === geofence.id ? 'bg-emerald-50' : ''
                          }`}
                        >
                          <span className="w-7 shrink-0 text-right tabular-nums text-slate-400">
                            {index + 1}.
                          </span>
                          <span className="min-w-0 flex-1 font-semibold text-slate-800">{geofence.nombre}</span>
                          <span className="max-w-[48%] text-right text-slate-500">
                            {[geofence.division, geofence.anexo, geofence.distrito].filter(Boolean).join(' · ')}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="px-3 py-4 text-center text-xs text-slate-500">
                    No hay geocercas que coincidan con la búsqueda.
                  </p>
                )}
              </div>
              <p className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-[10px] text-slate-500">
                Mostrando {filteredGeofences.length} de {geofences.length} geocercas
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="px-4 sm:px-5 pb-4 pt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm border border-green-700 bg-green-500/30" />
          Límites reales importados
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin size={12} className="text-blue-600" />
          {fuentePosiciones === 'real'
            ? `Última posición real por unidad (${vehicles.length})`
            : fuentePosiciones === 'cargando'
              ? 'Cargando posiciones GPS…'
              : fuentePosiciones === 'ninguna'
                ? 'Sin posiciones disponibles'
                : 'Posiciones GPS simuladas'}
        </span>
        {rutaPuntos && rutaPuntos.length > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5 rounded bg-blue-600" />
            Recorrido de {selectedId} · {rutaFecha}
          </span>
        ) : null}
        {rutaPuntos && rutaPuntos.some((punto) => punto.es_alerta) ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-white" />
            Alertas sobre la ruta
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5 sm:ml-auto">
          <Info size={12} /> Haz clic en un polígono para ver sus atributos.
        </span>
      </div>
    </section>
  );
}