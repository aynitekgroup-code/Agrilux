import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, useMap } from 'react-leaflet';
import { MapPin } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const MARKER_ICON = new L.DivIcon({
  className: '',
  html: `<div style="width:14px;height:14px;background:#22C55E;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function FitBounds({ bounds }) {
  const map = useMap();
  useMemo(() => {
    if (bounds) map.fitBounds(bounds, { padding: [30, 30] });
  }, [bounds, map]);
  return null;
}

export default function VistaMapaParcela({ coordenadas, nombre }) {
  const latLngs = Array.isArray(coordenadas) && coordenadas.length >= 3
    ? coordenadas.map(p => [p[1], p[0]])
    : [];

  const bounds = latLngs.length >= 3 ? L.latLngBounds(latLngs) : null;

  if (latLngs.length < 3) {
    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <MapPin size={18} className="text-primary" />
          <p className="text-sm font-semibold text-gray-600">Esta parcela no tiene polígono mapeado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <MapPin size={18} className="text-primary" />
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Mapa de la parcela</p>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ height: 280 }}>
        <MapContainer
          bounds={bounds}
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
          <FitBounds bounds={bounds} />
          {latLngs.map((p, i) => (
            <Marker key={i} position={p} icon={MARKER_ICON} />
          ))}
          <Polygon
            positions={latLngs}
            pathOptions={{ color: '#22C55E', fillColor: '#22C55E', fillOpacity: 0.2, weight: 2 }}
          />
        </MapContainer>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        {coordenadas.length} puntos mapeados · {nombre}
      </p>
    </div>
  );
}
