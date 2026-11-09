import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, GeoJSON, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { AlertCircle, ChevronDown, ChevronUp, Info, LoaderCircle, MapPin, RefreshCw, Search, Upload } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { importarGeocercasZip, listarGeocercas } from '../../../lib/agrotrackGeocercas';
import { STATUS_META } from './fleetTokens';

function FitMapToGeofences({ geoJson, selectedGeofence }) {
  const map = useMap();

  useEffect(() => {
    const bounds = L.geoJSON(geoJson).getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.06), { maxZoom: 16, animate: false });
    } else {
      map.setView([-6.78, -79.83], 13, { animate: false });
    }
  }, [geoJson, map]);

  useEffect(() => {
    if (!selectedGeofence) return;
    const bounds = L.geoJSON(selectedGeofence.geometria).getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.2), { maxZoom: 16, animate: true });
    }
  }, [map, selectedGeofence]);

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

export default function FleetMap({ empresaId, userId, canImport = false, vehicles = [], selectedId, onSelect }) {
  const [geofences, setGeofences] = useState([]);
  const [loading, setLoading] = useState(Boolean(empresaId));
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mapRevision, setMapRevision] = useState(0);
  const [showGeofenceList, setShowGeofenceList] = useState(false);
  const [geofenceSearch, setGeofenceSearch] = useState('');
  const [selectedGeofenceId, setSelectedGeofenceId] = useState('');
  const fileInputRef = useRef(null);
  const activeCompanyRef = useRef(empresaId);
  activeCompanyRef.current = empresaId;
  const geoJson = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: geofences.map((geofence) => ({
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
  const filteredGeofences = useMemo(() => {
    const query = geofenceSearch
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
    if (!query) return geofences;
    return geofences.filter((geofence) =>
      [geofence.nombre, geofence.division, geofence.anexo, geofence.distrito, geofence.provincia]
        .filter(Boolean)
        .join(' ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .includes(query),
    );
  }, [geofenceSearch, geofences]);
  const selectedGeofence = geofences.find((geofence) => geofence.id === selectedGeofenceId);
  const searchResults = geofenceSearch.trim() ? filteredGeofences.slice(0, 8) : [];

  const refreshGeofences = useCallback(async (targetCompanyId = empresaId) => {
    if (targetCompanyId !== activeCompanyRef.current) return;
    if (!targetCompanyId) {
      setGeofences([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const rows = await listarGeocercas(targetCompanyId);
      if (targetCompanyId === activeCompanyRef.current) {
        setGeofences(rows);
        setMapRevision((revision) => revision + 1);
      }
    } catch (loadError) {
      if (targetCompanyId === activeCompanyRef.current) {
        setGeofences([]);
        setError(loadError.message || 'No se pudieron cargar las geocercas.');
      }
    } finally {
      if (targetCompanyId === activeCompanyRef.current) setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    setNotice('');
    setError('');
    setGeofences([]);
    setSelectedGeofenceId('');
    refreshGeofences();
  }, [empresaId, refreshGeofences]);

  const handleSelectGeofence = (geofence) => {
    setSelectedGeofenceId(geofence.id);
    setShowGeofenceList(true);
  };

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
            {loading ? 'Cargando límites reales…' : `${geofences.length} polígonos reales · WGS84`}
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

      {geofences.length > 0 ? (
        <div className="px-4 sm:px-5 pb-3">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
            <Search size={17} className="shrink-0 text-slate-400" />
            <input
              type="search"
              value={geofenceSearch}
              onChange={(event) => setGeofenceSearch(event.target.value)}
              placeholder="Buscar geocerca por nombre…"
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
              aria-label="Buscar geocercas por nombre"
              aria-controls="geofence-search-results"
              aria-expanded={searchResults.length > 0}
            />
            <span className="shrink-0 text-[11px] text-slate-400">{geofences.length} geocercas</span>
          </label>
          {geofenceSearch.trim() ? (
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
            <FitMapToGeofences geoJson={geoJson} selectedGeofence={selectedGeofence} />
          ) : null}
          {vehicles.filter((vehicle) => Number.isFinite(vehicle.lat) && Number.isFinite(vehicle.lng)).map((vehicle) => {
            const meta = STATUS_META[vehicle.estado] || STATUS_META.offline;
            return (
              <CircleMarker
                key={vehicle.id}
                center={[vehicle.lat, vehicle.lng]}
                radius={selectedId === vehicle.id ? 8 : 6}
                pathOptions={{ color: '#FFFFFF', weight: 2, fillColor: meta.dot, fillOpacity: 1 }}
                eventHandlers={onSelect ? { click: () => onSelect(vehicle.id) } : undefined}
              >
                <Tooltip>{vehicle.placa} · GPS de demostración</Tooltip>
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
                  type="search"
                  value={geofenceSearch}
                  onChange={(event) => setGeofenceSearch(event.target.value)}
                  placeholder="Buscar por nombre, división, anexo o distrito"
                  className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
                  aria-label="Buscar geocercas"
                />
              </label>
              <div className="max-h-80 overflow-y-auto">
                {filteredGeofences.length ? (
                  <ol className="divide-y divide-slate-100">
                    {filteredGeofences.map((geofence, index) => (
                      <li key={geofence.id} className="flex items-start gap-3 px-3 py-2 text-xs">
                        <span className="w-7 shrink-0 text-right tabular-nums text-slate-400">
                          {index + 1}.
                        </span>
                        <span className="min-w-0 flex-1 font-semibold text-slate-800">{geofence.nombre}</span>
                        <span className="max-w-[48%] text-right text-slate-500">
                          {[geofence.division, geofence.anexo, geofence.distrito].filter(Boolean).join(' · ')}
                        </span>
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
          <MapPin size={12} className="text-blue-600" /> Posiciones GPS simuladas
        </span>
        <span className="inline-flex items-center gap-1.5 sm:ml-auto">
          <Info size={12} /> Haz clic en un polígono para ver sus atributos.
        </span>
      </div>
    </section>
  );
}
