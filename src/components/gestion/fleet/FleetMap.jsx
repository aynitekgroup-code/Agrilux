import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, GeoJSON, MapContainer, Popup, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
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
import {
  crearGeocerca,
  guardarGeocerca,
  importarGeocercasZip,
  listarGeocercas,
  quitarGeocerca,
} from '../../../lib/agrotrackGeocercas';
import {
  contarVertices,
  insertarVerticeEnBorde,
  moverVertice,
  poligonoDePuntos,
  quitarVertice,
  rellenarHueco,
} from '../../../lib/geocercasGeometria';
import { GeocercaEditorPanel, GeocercaVertexLayer } from './GeocercaEditor';
import AsistenteMapa from './AsistenteMapa';
import { ControlVistaSatelite, FichaGeocerca, LeyendaGrupos } from './MapaControles';
import { COLORES_GRUPO, ETIQUETAS_GRUPO, resumenGeocercasParaIA } from '../../../lib/asistenteMapa';
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

/** Mensaje de éxito de la importación por grupos (FASE 3.7). */
function textoResumenImportacion(resumen) {
  const partes = (resumen?.grupos || []).map((grupo) => {
    const poligonos = `${grupo.procesadas} polígono${grupo.procesadas === 1 ? '' : 's'}`;
    if (grupo.omitidas && grupo.guardadas) {
      return `${grupo.etiqueta}: ${poligonos} · ${grupo.guardadas} nuevas y ${grupo.omitidas} ya existentes (sin modificar)`;
    }
    if (grupo.omitidas) {
      return `${grupo.etiqueta}: ${poligonos} · todos ya existían, no se modificó ninguno`;
    }
    return `${grupo.etiqueta}: ${poligonos} guardados`;
  });
  if (resumen?.excluidas?.length) partes.push(`capa ${resumen.excluidas.join(', ')} ignorada (divisiones)`);
  if (resumen?.ignoradas?.length) partes.push(`capas sin reconocer: ${resumen.ignoradas.join(', ')}`);
  return `Importación correcta: ${partes.join(' · ')}.`;
}

function FitMapToGeofences({ geoJson, vehicles = [], focusRequest, fitToken = 0 }) {
  const map = useMap();

  // Firma estable de las posiciones de las unidades: evita re-encuadrar en
  // cada render (el arreglo de vehículos puede cambiar de referencia sin
  // cambiar coordenadas) y permite encuadrar también las máquinas al abrir
  // (pedido del Ing. Carlos Perez: "al abrir se vea todas las unidades").
  const unidadesFirma = useMemo(() => (
    vehicles
      .filter((v) => (
        v?.lat != null && v?.lng != null
        && Number.isFinite(Number(v.lat)) && Number.isFinite(Number(v.lng))
        && Number(v.lat) !== 0 && Number(v.lng) !== 0
      ))
      .map((v) => `${v.id}:${Number(v.lat).toFixed(5)},${Number(v.lng).toFixed(5)}`)
      .join('|')
  ), [vehicles]);

  // Encuadra geocercas + unidades cuando cambian los datos (o cuando el
  // asistente JARVIS pide "ajustar todo": fitToken cambia y re-encuadra).
  useEffect(() => {
    const bounds = L.latLngBounds([]);
    const geoBounds = L.geoJSON(geoJson).getBounds();
    if (geoBounds.isValid()) bounds.extend(geoBounds);
    vehicles.forEach((v) => {
      const lat = Number(v?.lat);
      const lng = Number(v?.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
        bounds.extend([lat, lng]);
      }
    });
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.08), { maxZoom: 16, animate: false });
    } else {
      map.setView([-6.78, -79.83], 13, { animate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoJson, unidadesFirma, fitToken, map]);

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

// Tooltip del polígono (FASE 3.8): HTML con el nombre destacado y el grupo
// coloreado; queda pegado al cursor para que sea fácil de leer.
function featureTooltip(feature, layer) {
  const properties = feature.properties || {};
  const tipo = properties.tipo && COLORES_GRUPO[properties.tipo] ? properties.tipo : 'poligono';
  const grupo = ETIQUETAS_GRUPO[tipo];
  const color = COLORES_GRUPO[tipo].borde;
  const extras = [properties.division, properties.anexo, properties.distrito]
    .filter(Boolean)
    .join(' · ');
  const html = `
    <div style="font-family:inherit;line-height:1.35;min-width:120px">
      <p style="font-weight:700;font-size:12.5px;color:#0F172A;margin:0">${properties.nombre || '(sin nombre)'}</p>
      <p style="margin:2px 0 0;font-size:10.5px">
        <span style="display:inline-block;padding:1px 7px;border-radius:999px;background:${color};color:#fff;font-weight:700">${grupo}</span>
        ${extras ? `<span style="color:#475569;margin-left:4px">${extras}</span>` : ''}
      </p>
    </div>`;
  if (properties.nombre) {
    layer.bindTooltip(html, { sticky: true, direction: 'top', opacity: 1, className: 'fleet-geocerca-tooltip' });
    layer.bindPopup(html);
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

export default function FleetMap({ empresaId, userId, canImport = false, canDelete = false, vehicles = [], selectedId, onSelect, fuentePosiciones = 'demo', periodo = null }) {
  const [rawGeofences, setRawGeofences] = useState([]);
  const [loading, setLoading] = useState(Boolean(empresaId));
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mapRevision, setMapRevision] = useState(0);
  // FASE 3.7: editor de geocercas (renombrar, mover/insertar/quitar puntos,
  // rellenar huecos, dibujar y eliminar).
  const [editando, setEditando] = useState(false);
  const [editModo, setEditModo] = useState('mover'); // mover | insertar | quitar | dibujo
  const [editNombre, setEditNombre] = useState('');
  const [editGeo, setEditGeo] = useState(null);           // geometría en borrador
  const [editOriginal, setEditOriginal] = useState(null); // { nombre, geometria } guardados
  const [editRevision, setEditRevision] = useState(0);
  const [editGuardando, setEditGuardando] = useState(false);
  const [editEliminando, setEditEliminando] = useState(false);
  const [editMensaje, setEditMensaje] = useState(null);   // { tipo, texto }
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [dibujo, setDibujo] = useState([]);               // [[lat, lng], ...]
  const [showGeofenceList, setShowGeofenceList] = useState(false);
  const [geofenceSearch, setGeofenceSearch] = useState('');
  const [resultsOpen, setResultsOpen] = useState(false);
  const [selectedGeofenceId, setSelectedGeofenceId] = useState('');
  const [focusRequest, setFocusRequest] = useState(null);
  const [listening, setListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState('');
  // FASE 3.8: mapa llamativo — filtro por grupo (leyenda / JARVIS) y vista satélite.
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const [vistaSatelite, setVistaSatelite] = useState(false);
  const [fitToken, setFitToken] = useState(0);
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
  // Nombre que tenía el borrador antes de entrar en modo "dibujar nueva".
  const nombreAntesDeDibujar = useRef('');

  const geofences = useMemo(() => rawGeofences.map(normalizeGeofence), [rawGeofences]);
  const withoutGeometry = useMemo(
    () => geofences.filter((geofence) => !geofence.geometria).length,
    [geofences],
  );

  // Solo los datos guardados: el encuadre del mapa no debe saltar cuando se
  // edita un polígono (FitMapToGeofences usa esta colección).
  const geoJsonBase = useMemo(
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

  // Lo que se pinta: los datos guardados + el borrador de la geocerca en
  // edición, para ver el resultado de mover/insertar/quitar puntos en vivo.
  const geoJson = useMemo(() => {
    if (!editando || !editGeo || !selectedGeofenceId) return geoJsonBase;
    return {
      type: 'FeatureCollection',
      features: geoJsonBase.features.map((feature) =>
        feature.properties?.id === selectedGeofenceId ? { ...feature, geometry: editGeo } : feature,
      ),
    };
  }, [editando, editGeo, geoJsonBase, selectedGeofenceId]);

  // FASE 3.8: lo visible = pintado menos el filtro de grupo (si lo hay).
  const geoJsonVisible = useMemo(() => {
    if (!filtroGrupo) return geoJson;
    return {
      ...geoJson,
      features: geoJson.features.filter((feature) => {
        const tipo = feature.properties?.tipo;
        return (tipo && COLORES_GRUPO[tipo] ? tipo : 'poligono') === filtroGrupo;
      }),
    };
  }, [geoJson, filtroGrupo]);

  // Resumen compacto (id/nombre/centro) para la IA que propone geocercas
  // por instrucción: NUNCA se envía la geometría completa.
  const geocercasIA = useMemo(() => resumenGeocercasParaIA(geofences), [geofences]);

  const geofenceSummary = useMemo(() => {
    const grupos = new Map();
    geofences.forEach((geofence) => {
      // Las geocercas sin división (oficinas / distritos cargados en la
      // FASE 3.7) se cuentan por su grupo para no mezclarlas con lotes.
      const etiqueta = geofence.division
        || (geofence.tipo === 'oficina' ? 'Oficinas'
          : geofence.tipo === 'distrito' ? 'Distritos'
            : 'Sin división');
      grupos.set(etiqueta, (grupos.get(etiqueta) || 0) + 1);
    });
    return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'));
  }, [geofences]);

  const filteredGeofences = useMemo(
    () => searchGeofences(geofences, geofenceSearch),
    [geofenceSearch, geofences],
  );
  const selectedGeofence = geofences.find((geofence) => geofence.id === selectedGeofenceId);
  const searchResults = geofenceSearch.trim() ? filteredGeofences.slice(0, 8) : [];
  const showResults = Boolean(geofenceSearch.trim()) && resultsOpen;

  /* ----- Derivados del editor (FASE 3.7) ----- */
  const seleccionEdicion = editando ? selectedGeofence : undefined;
  // Geometría por referencia: cada operación del editor crea una copia nueva.
  const sucio = Boolean(
    seleccionEdicion
    && (editNombre !== (editOriginal?.nombre ?? '')
      || editGeo !== (editOriginal?.geometria ?? null)),
  );
  const editVertices = editGeo ? contarVertices(editGeo) : 0;

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
    setEditando(false);
    setEditModo('mover');
    setEditNombre('');
    setEditGeo(null);
    setEditOriginal(null);
    setEditMensaje(null);
    setConfirmarEliminar(false);
    setDibujo([]);
    refreshGeofences();
  }, [empresaId, refreshGeofences]);

  /* ----- Borrador del editor (FASE 3.7) ----- */

  // Borrador nuevo al cambiar de geocerca seleccionada. NO borra el mensaje:
  // tras "Guardar" o "Crear" la selección cambia y el mensaje debe seguir.
  useEffect(() => {
    const geofence = geofences.find((item) => item.id === selectedGeofenceId);
    setEditNombre(geofence?.nombre || '');
    setEditGeo(geofence?.geometria || null);
    setEditOriginal(geofence ? { nombre: geofence.nombre, geometria: geofence.geometria } : null);
    setEditModo('mover');
    setDibujo([]);
    setConfirmarEliminar(false);
    // geofences se omite a propósito: solo interesa el cambio de selección.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGeofenceId]);

  // Tras recargar los datos (importar / guardar / eliminar) el borrador se
  // sincroniza con lo que quedó guardado en la base.
  useEffect(() => {
    if (!selectedGeofenceId) return;
    const geofence = geofences.find((item) => item.id === selectedGeofenceId);
    if (!geofence) return;
    setEditNombre(geofence.nombre);
    setEditGeo(geofence.geometria);
    setEditOriginal({ nombre: geofence.nombre, geometria: geofence.geometria });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geofences]);

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
    setEditMensaje(null);
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
    setEditMensaje(null);
  };

  /* ----- Acciones del asistente JARVIS (FASE 3.8) -----
   * El chat le pide a la IA una acción; este callback la ejecuta en el mapa
   * y devuelve una nota corta que JARVIS muestra debajo de su respuesta. */
  const ejecutarAccionAsistente = useCallback((accion) => {
    if (!accion || typeof accion !== 'object') return '';
    if (accion.tipo === 'enfocar' || accion.tipo === 'seleccionar') {
      const objetivo = geofences.find((g) => g.id === accion.geocerca_id);
      if (!objetivo) throw new Error('No encontré esa geocerca en la empresa.');
      focusGeofence(objetivo);
      if (accion.tipo === 'seleccionar') setGeofenceSearch(objetivo.nombre || '');
      return accion.tipo === 'enfocar'
        ? `Llevándote a «${objetivo.nombre}».`
        : `Seleccionada «${objetivo.nombre}».`;
    }
    if (accion.tipo === 'filtrar_grupo') {
      const grupo = accion.grupo;
      if (!grupo || !COLORES_GRUPO[grupo]) throw new Error('Ese grupo no existe.');
      setFiltroGrupo(grupo);
      return `Mostrando solo: ${ETIQUETAS_GRUPO[grupo]}.`;
    }
    if (accion.tipo === 'limpiar') {
      setFiltroGrupo('');
      clearSelection();
      return 'Filtros y selección limpiados.';
    }
    if (accion.tipo === 'ajustar_todo') {
      setFiltroGrupo('');
      setFitToken(Date.now());
      return 'Encuadrando todas las geocercas.';
    }
    return '';
  }, [geofences, focusGeofence]);

  /* ----- Editor de geocercas (FASE 3.7) ----- */

  const aplicarGeo = (nueva) => {
    setEditGeo(nueva);
    setEditRevision((revision) => revision + 1);
  };

  const entrarEdicion = () => {
    setEditando(true);
    setEditModo('mover');
    setEditMensaje(null);
    setConfirmarEliminar(false);
  };

  const salirEdicion = () => {
    setEditando(false);
    setEditModo('mover');
    setDibujo([]);
    setEditMensaje(null);
    setConfirmarEliminar(false);
    setEditNombre(editOriginal?.nombre ?? '');
    setEditGeo(editOriginal?.geometria ?? null);
    setEditRevision((revision) => revision + 1);
  };

  const cambiarModoEdicion = (modo) => {
    setConfirmarEliminar(false);
    if (modo === 'dibujo') {
      nombreAntesDeDibujar.current = editNombre;
      setDibujo([]);
      setEditNombre('');
      setEditModo('dibujo');
      setEditMensaje(null);
      return;
    }
    setEditModo((anterior) => (anterior === modo ? 'mover' : modo));
    setEditMensaje(null);
  };

  const cancelarDibujo = () => {
    setDibujo([]);
    setEditModo('mover');
    setEditNombre(nombreAntesDeDibujar.current);
    setEditMensaje(null);
    setEditRevision((revision) => revision + 1);
  };

  const agregarPuntoDibujo = (punto) => {
    setDibujo((puntos) => [...puntos, punto]);
    setEditMensaje(null);
  };

  const guardarCambios = async () => {
    if (!seleccionEdicion || !empresaId) return;
    const cambios = {};
    if (editNombre !== (editOriginal?.nombre ?? '')) cambios.nombre = editNombre;
    if (editGeo !== (editOriginal?.geometria ?? null)) cambios.geometria = editGeo;
    if (!Object.keys(cambios).length) {
      setEditMensaje({ tipo: 'info', texto: 'No hay cambios para guardar.' });
      return;
    }

    setEditGuardando(true);
    setEditMensaje(null);
    try {
      await guardarGeocerca(empresaId, { id: seleccionEdicion.id, ...cambios });
      await refreshGeofences();
      setEditMensaje({
        tipo: 'ok',
        texto: 'Cambios guardados: la geocerca ya se usa en el mapa y en los reportes.',
      });
    } catch (guardadoError) {
      setEditMensaje({ tipo: 'error', texto: guardadoError.message || 'No se pudieron guardar los cambios.' });
    } finally {
      setEditGuardando(false);
    }
  };

  const descartarCambios = () => {
    setEditNombre(editOriginal?.nombre ?? '');
    aplicarGeo(editOriginal?.geometria ?? null);
    setEditMensaje(null);
    setConfirmarEliminar(false);
  };

  // Rellena los huecos (anillos interiores) con el mismo reparador de la
  // exportación a Zonar: sirve para arreglar geocercas como "Medano".
  const rellenarHuecoSeleccion = () => {
    if (!editGeo) return;
    const { geometria, report } = rellenarHueco(editGeo);
    if (!geometria) {
      setEditMensaje({ tipo: 'error', texto: 'No se pudo rellenar: la geometría no es válida.' });
      return;
    }
    aplicarGeo(geometria);
    if (report.huecosRellenados > 0) {
      setEditMensaje({
        tipo: 'ok',
        texto:
          `Se rellenaron ${report.huecosRellenados} hueco(s): ${report.verticesAntes} → ` +
          `${report.verticesDespues} vértices${report.partesDescartadas ? ` · ${report.partesDescartadas} parte(s) descartada(s) por ser muy pequeña(s)` : ''}. ` +
          'Pulsa Guardar para conservarlo.',
      });
    } else {
      setEditMensaje({
        tipo: 'info',
        texto:
          `Esta geocerca no tiene huecos; se limpió la geometría (${report.verticesAntes} → ` +
          `${report.verticesDespues} vértices). Pulsa Guardar para conservarlo o Descartar para deshacer.`,
      });
    }
  };

  const moverPunto = (parte, anillo, indice, punto) => {
    if (!editGeo) return;
    const nueva = moverVertice(editGeo, parte, anillo, indice, punto);
    if (!nueva) {
      setEditMensaje({ tipo: 'error', texto: 'No se pudo mover ese punto.' });
      return;
    }
    aplicarGeo(nueva);
  };

  const insertarPunto = (punto) => {
    if (!editGeo) return;
    const resultado = insertarVerticeEnBorde(editGeo, punto);
    if (!resultado) {
      setEditMensaje({
        tipo: 'info',
        texto: 'No hay ningún borde cerca de ese clic (se busca hasta 400 m). Acércate al borde e inténtalo otra vez.',
      });
      return;
    }
    aplicarGeo(resultado.geometria);
    setEditMensaje(null);
  };

  const quitarPunto = (parte, anillo, indice) => {
    if (!editGeo) return;
    const nueva = quitarVertice(editGeo, parte, anillo, indice);
    if (!nueva) {
      setEditMensaje({
        tipo: 'error',
        texto: 'Un polígono necesita al menos 3 puntos: ya no se puede quitar ningún punto.',
      });
      return;
    }
    aplicarGeo(nueva);
    setEditMensaje(null);
  };

  // Propuesta de la IA (FASE: IA en Gestión): entra como BORRADOR en modo
  // "dibujar" con el nombre precargado. La creación sigue siendo humana
  // (el usuario revisa el polígono y pulsa "Crear geocerca").
  const aplicarPropuestaIA = ({ nombre, puntos }) => {
    if (!Array.isArray(puntos) || puntos.length < 3) return;
    nombreAntesDeDibujar.current = editNombre;
    setDibujo(puntos);
    setEditNombre(nombre);
    setEditModo('dibujo');
    setEditMensaje({
      tipo: 'info',
      texto:
        `Propuesta de la IA: "${nombre}" con ${puntos.length} puntos. Revísala en el mapa `
        + '(puedes cambiar el nombre) y pulsa "Crear geocerca" para guardarla: la IA no escribe en la base.',
    });
    setEditRevision((revision) => revision + 1);
  };

  const crearNueva = async () => {
    if (!empresaId) return;
    // Los puntos del dibujo van en [lat, lng] (orden del mapa); la geometría
    // GeoJSON va en [lon, lat].
    const geometria = poligonoDePuntos(dibujo.map(([lat, lng]) => [lng, lat]));
    if (!geometria) {
      setEditMensaje({ tipo: 'error', texto: 'La geocerca nueva necesita al menos 3 puntos.' });
      return;
    }
    if (!editNombre.trim()) {
      setEditMensaje({ tipo: 'error', texto: 'Escribe un nombre para la geocerca nueva.' });
      return;
    }

    setEditGuardando(true);
    setEditMensaje(null);
    try {
      const creada = await crearGeocerca(empresaId, { nombre: editNombre.trim(), geometria });
      await refreshGeofences();
      setDibujo([]);
      setEditModo('mover');
      setSelectedGeofenceId(creada.id);
      setEditMensaje({ tipo: 'ok', texto: `Se creó la geocerca "${creada.nombre}".` });
    } catch (creadoError) {
      setEditMensaje({ tipo: 'error', texto: creadoError.message || 'No se pudo crear la geocerca.' });
    } finally {
      setEditGuardando(false);
    }
  };

  const eliminarSeleccion = async () => {
    if (!seleccionEdicion || !empresaId) return;
    // Confirmación en dos pasos: un DELETE no se puede deshacer.
    if (!confirmarEliminar) {
      setConfirmarEliminar(true);
      setEditMensaje({
        tipo: 'info',
        texto: 'Vuelve a pulsar "Eliminar" para confirmar. Esta acción no se puede deshacer.',
      });
      return;
    }

    setEditEliminando(true);
    setEditMensaje(null);
    try {
      await quitarGeocerca(empresaId, seleccionEdicion.id);
      setConfirmarEliminar(false);
      await refreshGeofences();
      setSelectedGeofenceId('');
      setEditMensaje({ tipo: 'ok', texto: 'Geocerca eliminada.' });
    } catch (eliminadoError) {
      setConfirmarEliminar(false);
      setEditMensaje({ tipo: 'error', texto: eliminadoError.message || 'No se pudo eliminar la geocerca.' });
    } finally {
      setEditEliminando(false);
    }
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
      const resumen = await importarGeocercasZip(file, empresaId, userId);
      if (empresaId) {
        await refreshGeofences(empresaId);
        setNotice(textoResumenImportacion(resumen));
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

      <GeocercaEditorPanel
        puedeEditar={canImport}
        editando={editando}
        onEntrar={entrarEdicion}
        onSalir={salirEdicion}
        modo={editModo}
        onModo={cambiarModoEdicion}
        seleccion={seleccionEdicion}
        nombre={editNombre}
        onNombre={setEditNombre}
        sucio={sucio}
        guardando={editGuardando}
        mensaje={editMensaje}
        onGuardar={guardarCambios}
        onDescartar={descartarCambios}
        onRellenar={rellenarHuecoSeleccion}
        cantidadVertices={editVertices}
        dibujo={dibujo}
        onCrear={crearNueva}
        onCancelarDibujo={cancelarDibujo}
        puedeEliminar={canDelete}
        confirmarEliminar={confirmarEliminar}
        eliminando={editEliminando}
        onEliminar={eliminarSeleccion}
        onDibujar={() => cambiarModoEdicion('dibujo')}
        geocercasIA={geocercasIA}
        onPropuestaIA={aplicarPropuestaIA}
      />

      {canImport ? (
        <p className="px-4 sm:px-5 pb-3 text-[11px] text-slate-500">
          ZIP con las capas <code>linderos</code>, <code>oficinas</code> y <code>distritos</code>
          (.shp, .shx, .dbf, .prj y .cpg): solo se usa el campo nombre. Los campos que ya
          existen no se modifican (los 129 cargados) y la capa <code>divisiones</code> se ignora.
          Oficinas y distritos se ven en el mapa pero no entran en los reportes.
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
              className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-full transition-all hover:scale-105 focus:outline-none focus:ring-4 ${
                listening
                  ? 'animate-pulse bg-gradient-to-br from-red-400 to-red-600 text-white shadow-[0_0_18px_rgba(239,68,68,0.6)] focus:ring-red-200'
                  : 'bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 text-white shadow-[0_4px_16px_rgba(16,185,129,0.5)] focus:ring-emerald-200'
              }`}
              aria-label={listening ? 'Detener búsqueda por voz' : 'Buscar geocerca por voz'}
              aria-pressed={listening}
              title={SpeechRecognitionCtor ? 'Buscar por voz' : 'Tu navegador no soporta voz'}
            >
              {SpeechRecognitionCtor ? <Mic size={21} /> : <MicOff size={21} />}
              {!listening && SpeechRecognitionCtor ? (
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" aria-hidden="true" />
              ) : null}
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

      <div className="relative px-3 sm:px-5 pb-2">
        <MapContainer
          center={[-6.78, -79.83]}
          zoom={12}
          scrollWheelZoom
          style={{ width: '100%', height: 440, borderRadius: 14, background: '#E7EDE1' }}
        >
          <TileLayer
            key={vistaSatelite ? 'satelite' : 'calle'}
            attribution={
              vistaSatelite
                ? 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
                : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }
            url={
              vistaSatelite
                ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            }
          />
          <GeoJSON
            key={`${empresaId || 'none'}-${mapRevision}-${editRevision}-${filtroGrupo || 'todos'}`}
            data={geoJsonVisible}
            style={(feature) => {
              const properties = feature?.properties || {};
              const selected = properties.id === selectedGeofenceId;
              const tipo = properties.tipo && COLORES_GRUPO[properties.tipo] ? properties.tipo : 'poligono';
              const paleta = selected ? COLORES_GRUPO.seleccion : COLORES_GRUPO[tipo];
              return {
                color: paleta.borde,
                weight: selected ? 4 : 2,
                opacity: 0.95,
                fillColor: paleta.relleno,
                fillOpacity: selected ? 0.4 : 0.22,
              };
            }}
            onEachFeature={(feature, layer) => {
              featureTooltip(feature, layer);
              layer.on('click', () => {
                // En modo "insertar" o "dibujar" el clic lo maneja el mapa
                // (agrega el punto): la selección no cambia.
                if (editModo === 'insertar' || editModo === 'dibujo') return;
                setEditMensaje(null);
                setSelectedGeofenceId(feature.properties?.id || '');
              });
            }}
          />
          {editando ? (
            <GeocercaVertexLayer
              modo={editModo}
              geometria={editGeo}
              dibujo={dibujo}
              onMover={moverPunto}
              onInsertar={insertarPunto}
              onQuitar={quitarPunto}
              onPuntoDibujo={agregarPuntoDibujo}
            />
          ) : null}
          {geoJsonBase.features.length > 0 || vehicles.length > 0 ? (
            <FitMapToGeofences geoJson={geoJsonBase} vehicles={vehicles} focusRequest={focusRequest} fitToken={fitToken} />
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
                {/* Ventana flotante (popup) con las características de la
                    máquina al hacer clic. Se pintan solo los campos que
                    existan: sirve igual para datos reales (placa, modelo,
                    estado, velocidad, km, último evento) que para la demo. */}
                <Popup className="fleet-unit-popup" maxWidth={260}>
                  <div className="text-[12px] leading-snug space-y-1.5 min-w-[200px]">
                    <p className="font-bold text-slate-900 text-[13px]">{vehicle.placa}</p>
                    <p className="text-slate-600">{vehicle.descripcion || vehicle.modelo || '—'}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: meta.dot }} />
                      <span className="text-slate-700 font-medium">{meta.label}</span>
                      {Number.isFinite(velocidad) && velocidad > 0 ? (
                        <span className="text-slate-500">· {velocidad} km/h</span>
                      ) : null}
                    </div>
                    {vehicle.marca || vehicle.tipo || vehicle.anio ? (
                      <p className="text-slate-500">
                        {[vehicle.marca, vehicle.tipo, vehicle.anio].filter(Boolean).join(' · ')}
                      </p>
                    ) : null}
                    {vehicle.conductor_nombre ? (
                      <p className="text-slate-500">Conductor: <span className="text-slate-700">{vehicle.conductor_nombre}</span></p>
                    ) : null}
                    {vehicle.ultimo_evento ? (
                      <p className="text-slate-500">Último evento: <span className="text-slate-700">{vehicle.ultimo_evento}</span></p>
                    ) : null}
                    {Number.isFinite(Number(vehicle.km_recorridos)) && Number(vehicle.km_recorridos) > 0 ? (
                      <p className="text-slate-500">Km recorridos: <span className="text-slate-700">{Number(vehicle.km_recorridos).toLocaleString('es-PE')} km</span></p>
                    ) : null}
                    {Number.isFinite(Number(vehicle.odometro_km)) && Number(vehicle.odometro_km) > 0 ? (
                      <p className="text-slate-500">Odómetro: <span className="text-slate-700">{Number(vehicle.odometro_km).toLocaleString('es-PE')} km</span></p>
                    ) : null}
                    {vehicle.ultima_ubicacion ? (
                      <p className="text-slate-500">Ubicación: <span className="text-slate-700">{vehicle.ultima_ubicacion}</span></p>
                    ) : null}
                    {vehicle.nivel_tanque_pct != null ? (
                      <p className="text-slate-500">Tanque: <span className="text-slate-700">{vehicle.nivel_tanque_pct}%</span></p>
                    ) : null}
                    {fechaPosicion ? <p className="text-slate-500">{fechaPosicion}</p> : null}
                    {fuentePosiciones !== 'real' ? (
                      <p className="text-slate-400">GPS de demostración</p>
                    ) : null}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
          {/* FASE 3.8: controles flotantes del mapa (leyenda, ficha, satélite, JARVIS). */}
          {geofences.length > 0 ? (
            <>
              <LeyendaGrupos geofences={geofences} />
              <ControlVistaSatelite
                satelite={vistaSatelite}
                onToggle={() => setVistaSatelite((valor) => !valor)}
              />
            </>
          ) : null}
          <FichaGeocerca
            geocerca={selectedGeofence}
            onCerrar={() => setSelectedGeofenceId('')}
          />
          <AsistenteMapa
            geofences={geofences}
            seleccion={selectedGeofence || null}
            onAccion={ejecutarAccionAsistente}
          />
        </MapContainer>
      </div>

      {geofences.length > 0 ? (
        <div className="px-4 sm:px-5 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-slate-700">
              {geofences.length} geocercas · {geofenceSummary.length} grupos
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