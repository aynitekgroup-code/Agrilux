import React, { useRef, useEffect, useState, useCallback } from 'react';
import { X, MapPin, Undo2, Check } from 'lucide-react';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoiYXluaXRlay1ncm91cCIsImEiOiJjbG93Z3F5ZmowMDF4Mmt0Z2RqZnI3Z3Y5In0.placeholder';

// Calcular área de polígono (Shoelace formula) en hectáreas
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
  // Convertir grados² a hectáreas (aproximado para latitudes tropicales)
  const latMedia = coordenadas.reduce((s, c) => s + c[1], 0) / n;
  const metrosPorGradoLat = 111320;
  const metrosPorGradoLon = 111320 * Math.cos(latMedia * Math.PI / 180);
  const areaM2 = area * metrosPorGradoLat * metrosPorGradoLon;
  return (areaM2 / 10000).toFixed(2);
}

export default function MapaParcela({ onGuardar, onCerrar, coordenadasIniciales = [] }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [puntos, setPuntos] = useState(coordenadasIniciales);
  const [area, setArea] = useState('');
  const [ubicacionActual, setUbicacionActual] = useState(null);

  // Obtener ubicación actual
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUbicacionActual([pos.coords.longitude, pos.coords.latitude]),
      () => setUbicacionActual([-78.5, -6.0]), // Default: Cutervo
      { timeout: 5000 }
    );
  }, []);

  // Inicializar mapa
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const center = ubicacionActual || [-78.5, -6.0];

    const script = document.createElement('script');
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js';
    script.onload = () => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css';
      document.head.appendChild(link);

      window.mapboxgl.accessToken = MAPBOX_TOKEN;
      const map = new window.mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center,
        zoom: 16,
      });

      map.on('load', () => {
        // Capa para líneas del polígono
        map.addSource('polygon', {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[]] } },
        });
        map.addLayer({
          id: 'polygon-fill',
          type: 'fill',
          source: 'polygon',
          paint: { 'fill-color': '#22C55E', 'fill-opacity': 0.2 },
        });
        map.addLayer({
          id: 'polygon-line',
          type: 'line',
          source: 'polygon',
          paint: { 'line-color': '#22C55E', 'line-width': 2 },
        });

        // Marcadores de puntos
        map.addSource('points', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        map.addLayer({
          id: 'points-layer',
          type: 'circle',
          source: 'points',
          paint: {
            'circle-radius': 8,
            'circle-color': '#22C55E',
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 2,
          },
        });
      });

      // Click en el mapa para agregar puntos
      map.on('click', (e) => {
        const { lng, lat } = e.lngLat;
        setPuntos(prev => {
          const nuevos = [...prev, [lng, lat]];
          actualizarMapa(map, nuevos);
          return nuevos;
        });
      });

      mapRef.current = map;
    };
    document.head.appendChild(script);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [ubicacionActual]);

  const actualizarMapa = useCallback((map, nuevosPuntos) => {
    if (!map || !map.isStyleLoaded()) return;

    // Actualizar puntos
    const features = nuevosPuntos.map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: p },
    }));
    map.getSource('points')?.setData({ type: 'FeatureCollection', features });

    // Actualizar polígono
    if (nuevosPuntos.length >= 3) {
      const coords = [...nuevosPuntos, nuevosPuntos[0]]; // cerrar polígono
      map.getSource('polygon')?.setData({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [coords] },
      });
      setArea(calcularAreaHectareas(nuevosPuntos));
    } else {
      map.getSource('polygon')?.setData({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[]] },
      });
      setArea('');
    }
  }, []);

  // Actualizar mapa cuando cambian los puntos
  useEffect(() => {
    if (mapRef.current) actualizarMapa(mapRef.current, puntos);
  }, [puntos, actualizarMapa]);

  const deshacer = () => {
    const nuevos = puntos.slice(0, -1);
    setPuntos(nuevos);
  };

  const limpiar = () => {
    setPuntos([]);
    setArea('');
  };

  const confirmar = () => {
    if (puntos.length < 3) return;
    onGuardar({ coordenadas: puntos, area: parseFloat(area) || 0 });
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="bg-primary text-white px-4 py-3 flex items-center justify-between">
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

      {/* Mapa */}
      <div ref={mapContainer} className="flex-1" />

      {/* Controles inferiores */}
      <div className="bg-white border-t border-gray-200 p-4 space-y-3">
        {area && (
          <div className="bg-green-50 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-green-600 font-semibold">Área calculada</p>
              <p className="text-lg font-bold text-green-700">{area} hectáreas</p>
            </div>
            <div className="text-3xl">📐</div>
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
      </div>
    </div>
  );
}
