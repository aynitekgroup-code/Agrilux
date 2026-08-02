import React, { useState, useEffect } from 'react';
import { Tag, Store, MapPin, Phone, ExternalLink, Loader2, Filter, RefreshCw } from 'lucide-react';
import { useAgentes } from '../lib/AgentContext';

export default function OfertasPage() {
  const { coords, ubicacion } = useAgentes();
  const [ofertas, setOfertas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('todas');
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);

  const cargarOfertas = async (forzar = false) => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (coords?.lat) params.append('lat', coords.lat);
      if (coords?.lon) params.append('lon', coords.lon);
      if (forzar) params.append('forzar', 'true');

      const res = await fetch(`/api/ofertas-scraper?${params}`);
      const data = await res.json();
      setOfertas(data.ofertas || []);
      setUltimaActualizacion(data.ultimaActualizacion);
    } catch (e) {
      console.error('Error cargando ofertas:', e);
    }
    setCargando(false);
  };

  useEffect(() => { cargarOfertas(); }, [coords]);

  const ofertasFiltradas = filtro === 'todas'
    ? ofertas
    : ofertas.filter(o => o.region?.toLowerCase().includes(filtro));

  return (
    <div className="min-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 rounded-b-3xl -mx-4 -mt-2 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <Tag size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold">Ofertas del Día</h1>
              <p className="text-orange-100 text-sm">Descuentos en tiendas agrícolas</p>
            </div>
          </div>
          <button onClick={() => cargarOfertas(true)}
            className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors">
            <RefreshCw size={18} className={cargando ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
        {['todas', 'cajamarca', 'lambayeque', 'piura', 'ica', 'junín'].map(r => (
          <button key={r} onClick={() => setFiltro(r)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filtro === r ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {r === 'todas' ? 'Todas' : r.charAt(0).toUpperCase() + r.slice(1)}
          </button>
        ))}
      </div>

      {cargando ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-primary mb-3" />
          <p className="text-gray-500 text-sm">Buscando ofertas en tiendas...</p>
        </div>
      ) : ofertasFiltradas.length === 0 ? (
        <div className="text-center py-12">
          <Tag size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No hay ofertas disponibles</p>
          <p className="text-gray-400 text-xs mt-1">Intenta recambiar o cambiar el filtro</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ofertasFiltradas.map((o, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Tag size={18} className="text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-gray-800">{o.producto}</p>
                    {o.precio && (
                      <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                        S/ {o.precio}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-orange-600 font-semibold mt-0.5">{o.descuento}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    📍 {o.tienda} · {o.region} {o.distanciaKm ? `· ${o.distanciaKm}km` : ''}
                  </p>
                </div>
              </div>

              {/* Links de contacto */}
              <div className="flex gap-2 mt-3">
                {o.whatsapp && (
                  <a href={`https://wa.me/${o.whatsapp}?text=Hola, ¿tienen ${o.producto} en oferta?`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-[10px] font-bold bg-green-500 text-white px-2.5 py-1.5 rounded-full hover:bg-green-600">
                    💬 WhatsApp
                  </a>
                )}
                {o.facebook && (
                  <a href={`https://www.facebook.com/${o.facebook}`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-[10px] font-bold bg-blue-600 text-white px-2.5 py-1.5 rounded-full hover:bg-blue-700">
                    📘 Facebook
                  </a>
                )}
                <a href={`https://www.google.com/maps/search/${encodeURIComponent(o.tienda + ' ' + o.region)}`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-[10px] font-bold bg-blue-500 text-white px-2.5 py-1.5 rounded-full hover:bg-blue-600">
                  🗺️ Maps
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info */}
      {ultimaActualizacion && (
        <p className="text-[10px] text-gray-300 text-center mt-4">
          Última actualización: {new Date(ultimaActualizacion).toLocaleString('es-PE')}
        </p>
      )}
    </div>
  );
}
