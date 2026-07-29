import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, useMap, useMapEvents } from 'react-leaflet';
import { X, Undo2, Check, Upload, Locate } from 'lucide-react';
import { importarKmzKml } from '../lib/importKmz';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const MARKER_ICON = new L.DivIcon({
  className: '',
  html: `<div style="width:24px;height:24px;background:#22C55E;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function calcularAreaHectareas(coordenadas) {
  if (coordenadas.length < 3) return 0;
  let area = 0;
  const n = coordenadas.length;
  // Coordenadas están en formato [lng, lat]
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const x1 = coordenadas[i][0]; // lng
    const y1 = coordenadas[i][1]; // lat
    const x2 = coordenadas[j][0]; // lng
    const y2 = coordenadas[j][1]; // lat
    area += x1 * y2;
    area -= x2 * y1;
  }
  area = Math.abs(area) / 2;
  // Promedio de latitudes para conversión
  const latMedia = coordenadas.reduce((s, c) => s + c[1], 0) / n;
  const metrosPorGradoLat = 111320;
  const metrosPorGradoLon = 111320 * Math.cos(latMedia * Math.PI / 180);
  const areaM2 = area * metrosPorGradoLat * metrosPorGradoLon;
  return Math.round((areaM2 / 10000) * 100) / 100;
}

function MapClickHandler({ onAddPunto }) {
  useMapEvents({
    click(e) {
      onAddPunto(e.latlng.lng, e.latlng.lat);
    },
  });
  return null;
}

function CenterUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function MapaParcela({ onGuardar, onCerrar, coordenadasIniciales = [] }) {
  const [puntos, setPuntos] = useState(coordenadasIniciales);
  const [area, setArea] = useState('');
  const [center, setCenter] = useState([-6.0, -78.5]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { timeout: 5000 }
    );
  }, []);

  useEffect(() => {
    if (puntos.length >= 3) {
      setArea(calcularAreaHectareas(puntos));
    } else {
      setArea('');
    }
  }, [puntos]);

  const handleAddPunto = useCallback((lng, lat) => {
    setPuntos(prev => [...prev, [lng, lat]]);
  }, []);

  const deshacer = () => setPuntos(prev => prev.slice(0, -1));
  const limpiar = () => { setPuntos([]); setArea(''); };
  const confirmar = () => {
    if (puntos.length < 3) return;
    onGuardar({ coordenadas: puntos, area: parseFloat(area) || 0 });
  };

  const handleKmzImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const resultado = await importarKmzKml(file);
      setPuntos(resultado.coordenadas);
    } catch (err) {
      alert('Error al importar: ' + err.message);
    }
  };

  const polygonLatLngs = puntos.length >= 3
    ? puntos.map(p => [p[1], p[0]])
    : [];

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="bg-primary text-white px-4 py-3 flex items-center justify-between shrink-0">
        <div>
          <p className="font-bold text-sm">Mapear parcela</p>
          <p className="text-white/70 text-xs">
            {puntos.length === 0 ? 'Toca el mapa para iniciar' :
             puntos.length < 3 ? `${puntos.length} puntos — faltan ${3 - puntos.length} para cerrar` :
             `${puntos.length} puntos · ${area} ha`}
          </p>
        </div>
        <button onClick={onCerrar} className="text-white/70 hover:text-white">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 relative">
        <MapContainer
          center={center}
          zoom={16}
          className="w-full h-full"
          zoomControl={false}
          style={{ background: '#e5e7eb' }}
        >
          <TileLayer
            attribution='&copy; Esri'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            opacity={0.3}
          />
          <MapClickHandler onAddPunto={handleAddPunto} />
          <CenterUpdater center={center} />
          {puntos.map((p, i) => (
            <Marker key={i} position={[p[1], p[0]]} icon={MARKER_ICON} />
          ))}
          {polygonLatLngs.length >= 3 && (
            <Polygon
              positions={polygonLatLngs}
              pathOptions={{ color: '#22C55E', fillColor: '#22C55E', fillOpacity: 0.2, weight: 2 }}
            />
          )}
        </MapContainer>
      </div>

      <div className="bg-white border-t border-gray-200 p-4 space-y-3 shrink-0">
        {area && (
          <div className="bg-green-50 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-green-600 font-semibold">Área calculada</p>
              <p className="text-lg font-bold text-green-700">{area} hectáreas</p>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={deshacer} disabled={puntos.length === 0}
            className="flex-1 flex items-center justify-center gap-2 border border-gray-200 text-gray-600 font-bold py-3 rounded-xl text-sm disabled:opacity-40">
            <Undo2 size={16} /> Deshacer
          </button>
          <button onClick={limpiar} disabled={puntos.length === 0}
            className="flex-1 flex items-center justify-center gap-2 border border-red-200 text-red-500 font-bold py-3 rounded-xl text-sm disabled:opacity-40">
            <X size={16} /> Limpiar
          </button>
          <button onClick={confirmar} disabled={puntos.length < 3}
            className="flex-1 flex items-center justify-center gap-2 bg-primary text-white font-bold py-3 rounded-xl text-sm disabled:opacity-40">
            <Check size={16} /> Guardar
          </button>
        </div>

        <p className="text-[10px] text-gray-400 text-center">
          Toca el mapa para colocar puntos. Mínimo 3 puntos para formar la parcela.
        </p>

        <label className="w-full flex items-center justify-center gap-2 border border-dashed border-primary/30 text-primary/70 font-bold py-2.5 rounded-xl text-xs cursor-pointer hover:bg-primary/5 transition-colors">
          <Upload size={14} /> Importar archivo KMZ/KML
          <input type="file" accept=".kmz,.kml" onChange={handleKmzImport} className="hidden" />
        </label>
      </div>
    </div>
  );
}
