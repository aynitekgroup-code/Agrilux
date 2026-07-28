import React, { useRef, useEffect, useState, useCallback } from 'react';
import { X, Undo2, Check, Upload } from 'lucide-react';
import { importarKmzKml } from '../lib/importKmz';

// Leaflet CDN
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

function calcularAreaHectareas(coordenadas) {
  if (coordenadas.length < 3) return 0;
  let area = 0;
  const n = coordenadas.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += coordenadas[i][0] * coordenadas[j][1];
    area -= coordenadas[j][0] * coordenadas[i][0];
  }
  area = Math.abs(area) / 2;
  const latMedia = coordenadas.reduce((s, c) => s + c[1], 0) / n;
  const metrosPorGradoLat = 111320;
  const metrosPorGradoLon = 111320 * Math.cos(latMedia * Math.PI / 180);
  const areaM2 = area * metrosPorGradoLat * metrosPorGradoLon;
  return (areaM2 / 10000).toFixed(2);
}

export default function MapaParcela({ onGuardar, onCerrar, coordenadasIniciales = [] }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const polygonRef = useRef(null);
  const markersRef = useRef([]);
  const [puntos, setPuntos] = useState(coordenadasIniciales);
  const [area, setArea] = useState('');
  const [ubicacionActual, setUbicacionActual] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUbicacionActual([pos.coords.latitude, pos.coords.longitude]),
      () => setUbicacionActual([-6.0, -78.5]),
      { timeout: 5000 }
    );
  }, []);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    if (!window.L) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = LEAFLET_JS;
      script.onload = () => initMap();
      document.head.appendChild(script);
    } else {
      initMap();
    }

    function initMap() {
      const L = window.L;
      const center = ubicacionActual || [-6.0, -78.5];

      const map = L.map(mapContainer.current, {
        center,
        zoom: 16,
        zoomControl: false,
      });

      L.control.zoom({ position: 'topright' }).addTo(map);

      // Capa satélite (ESRI - gratis, sin API key)
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri World Imagery',
        maxZoom: 19,
      }).addTo(map);

      // Capa de calles encima
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'OpenStreetMap',
        maxZoom: 19,
        opacity: 0.4,
      }).addTo(map);

      // Click para agregar puntos
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        setPuntos(prev => {
          const nuevos = [...prev, [lng, lat]];
          return nuevos;
        });
      });

      mapRef.current = map;
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [ubicacionActual]);

  // Actualizar polígono y marcadores
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.L) return;
    const L = window.L;

    // Limpiar marcadores anteriores
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    // Agregar marcadores
    puntos.forEach((p, i) => {
      const marker = L.circleMarker([p[1], p[0]], {
        radius: 8,
        color: '#fff',
        fillColor: '#22C55E',
        fillOpacity: 1,
        weight: 2,
      }).addTo(map);
      markersRef.current.push(marker);
    });

    // Actualizar polígono
    if (polygonRef.current) {
      map.removeLayer(polygonRef.current);
      polygonRef.current = null;
    }

    if (puntos.length >= 3) {
      const latLngs = puntos.map(p => [p[1], p[0]]);
      polygonRef.current = L.polygon(latLngs, {
        color: '#22C55E',
        fillColor: '#22C55E',
        fillOpacity: 0.2,
        weight: 2,
      }).addTo(map);
      const newArea = calcularAreaHectareas(puntos);
      setArea(newArea);
    } else {
      setArea('');
    }
  }, [puntos]);

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

      <div ref={mapContainer} className="flex-1" />

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
