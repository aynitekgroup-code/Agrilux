import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, GeoJSON, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { AlertCircle, Info, LoaderCircle, MapPin, RefreshCw, Upload } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { importarGeocercasZip, listarGeocercas } from '../../../lib/agrotrackGeocercas';
import { STATUS_META } from './fleetTokens';

function FitMapToGeofences({ geoJson }) {
  const map = useMap();

  useEffect(() => {
    const bounds = L.geoJSON(geoJson).getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.06), { maxZoom: 16, animate: false });
    } else {
      map.setView([-6.78, -79.83], 13, { animate: false });
    }
  }, [geoJson, map]);

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
    refreshGeofences();
  }, [empresaId, refreshGeofences]);

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
            style={() => ({
              color: '#15803D',
              weight: 1.5,
              opacity: 0.9,
              fillColor: '#22C55E',
              fillOpacity: 0.16,
            })}
            onEachFeature={featureTooltip}
          />
          {geoJson.features.length > 0 ? <FitMapToGeofences geoJson={geoJson} /> : null}
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
