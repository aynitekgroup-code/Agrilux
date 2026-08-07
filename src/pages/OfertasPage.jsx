import React, { useState, useEffect } from 'react';
import { Tag, Store, MapPin, Phone, ExternalLink, Loader2, Filter, RefreshCw, Plus, Clock } from 'lucide-react';
import { useAgentes } from '../lib/AgentContext';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, where, limit } from 'firebase/firestore';

export default function OfertasPage() {
  const { coords, ubicacion } = useAgentes();
  const [ofertas, setOfertas] = useState([]);
  const [preciosReales, setPreciosReales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('todas');
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);
  const [tab, setTab] = useState('ofertas'); // ofertas | precios

  // Cargar ofertas del scraper
  const cargarOfertas = async (forzar = false) => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (coords?.lat) params.append('lat', coords.lat);
      if (coords?.lon) params.append('lon', coords.lon);
      if (forzar) params.append('forzar', 'true');

      const res = await fetch(`/api/tiendas?type=ofertas&${params}`);
      const data = await res.json();
      setOfertas(data.ofertas || []);
      setUltimaActualizacion(data.ultimaActualizacion);
    } catch (e) {
      console.error('Error cargando ofertas:', e);
    }
    setCargando(false);
  };

  // Cargar precios reales de Firestore
  useEffect(() => {
    const q = query(
      collection(db, 'precios_historicos'),
      orderBy('fecha', 'desc'),
      limit(100)
    );

    const unsub = onSnapshot(q, (snap) => {
      const precios = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPreciosReales(precios);
    }, (error) => {
      console.warn('Error cargando precios:', error);
    });

    return () => unsub();
  }, []);

  useEffect(() => { cargarOfertas(); }, [coords]);

  // Combinar ofertas del scraper + precios reales
  const todasLasOfertas = [
    ...ofertas.map(o => ({
      ...o,
      fuente: 'scraper',
    })),
    ...preciosReales.map(p => ({
      producto: p.productoNombre || p.producto,
      precio: p.precio,
      tienda: p.tiendaNombre || 'Tienda',
      region: p.departamento || p.distrito || '',
      whatsapp: p.tienda?.whatsapp || null,
      facebook: p.tienda?.facebook || null,
      lat: p.lat,
      lon: p.lon,
      fecha: p.fecha,
      fuente: 'comunidad',
      distanciaKm: null,
    })),
  ];

  const ofertasFiltradas = filtro === 'todas'
    ? todasLasOfertas
    : todasLasOfertas.filter(o => o.region?.toLowerCase().includes(filtro));

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
              <h1 className="text-xl font-bold">Precios Agrícolas</h1>
              <p className="text-orange-100 text-sm">Ofertas e historial de precios</p>
            </div>
          </div>
          <button onClick={() => cargarOfertas(true)}
            className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors">
            <RefreshCw size={18} className={cargando ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 rounded-xl p-1 mb-4">
        <button
          onClick={() => setTab('ofertas')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
            tab === 'ofertas' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'
          }`}
        >
          <Tag size={14} className="inline mr-1" />
          Ofertas
        </button>
        <button
          onClick={() => setTab('precios')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
            tab === 'precios' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'
          }`}
        >
          <Clock size={14} className="inline mr-1" />
          Historial
        </button>
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
          <p className="text-gray-500 text-sm">Buscando precios...</p>
        </div>
      ) : ofertasFiltradas.length === 0 ? (
        <div className="text-center py-12">
          <Tag size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No hay precios disponibles</p>
          <p className="text-gray-400 text-xs mt-1">Registra una tienda para agregar precios</p>
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
                  {o.descuento && (
                    <p className="text-xs text-orange-600 font-semibold mt-0.5">{o.descuento}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    📍 {o.tienda} · {o.region} {o.distanciaKm ? `· ${o.distanciaKm}km` : ''}
                  </p>
                  {o.fecha && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      📅 {new Date(o.fecha).toLocaleDateString('es-PE')}
                    </p>
                  )}
                  {o.fuente === 'comunidad' && (
                    <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full mt-1 inline-block">
                      ✓ Precio verificado
                    </span>
                  )}
                </div>
              </div>

              {/* Links de contacto */}
              <div className="flex gap-2 mt-3">
                {o.whatsapp && (
                  <a href={`https://wa.me/${o.whatsapp}?text=Hola, ¿cuánto cuesta ${o.producto}?`}
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

      {/* Stats */}
      <div className="mt-6 bg-gray-50 rounded-2xl p-4">
        <p className="text-xs font-bold text-gray-400 uppercase mb-2">📊 Estadísticas</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-orange-600">{ofertas.length}</p>
            <p className="text-[10px] text-gray-400">Ofertas del día</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-green-600">{preciosReales.length}</p>
            <p className="text-[10px] text-gray-400">Precios guardados</p>
          </div>
        </div>
      </div>
    </div>
  );
}
