import React, { useState, useEffect } from 'react';
import { MapPin, Star, ExternalLink, Store, Tag, Search, Loader2, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';

const ICONOS_REDES = {
  google: '🔍',
  googleMaps: '🗺️',
  facebook: '📘',
  facebookGrupos: '👥',
  tiktok: '🎵',
  youtube: '📺',
  whatsapp: '💬',
};

const NOMBRES_REDES = {
  google: 'Google',
  googleMaps: 'Google Maps',
  facebook: 'Facebook Marketplace',
  facebookGrupos: 'Grupos de Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  whatsapp: 'Compartir por WhatsApp',
};

export default function BuscadorInsumos({ producto, cultivo, ubicacion, lat, lon, onResultados }) {
  const [cargando, setCargando] = useState(false);
  const [resultados, setResultados] = useState(null);
  const [expandido, setExpandido] = useState(false);
  const [tiendaSeleccionada, setTiendaSeleccionada] = useState(null);

  const buscar = async () => {
    if (!producto) return;
    setCargando(true);
    try {
      const params = new URLSearchParams({
        lat: (lat || -12.05).toString(),
        lon: (lon || -77.04).toString(),
        producto,
        cultivo: cultivo || '',
        ubicacion: ubicacion || '',
        radio: '30',
      });
      const res = await fetch(`/api/buscar-insumos?${params}`);
      const data = await res.json();
      setResultados(data);
      if (onResultados) onResultados(data);
    } catch (e) {
      console.error('Error buscando insumos:', e);
    }
    setCargando(false);
  };

  useEffect(() => {
    if (producto) buscar();
  }, [producto]);

  if (!producto) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-3">
        <div className="flex items-center gap-2">
          <Store size={18} className="text-white" />
          <div className="flex-1">
            <p className="text-white font-bold text-sm">¿Dónde comprar {producto}?</p>
            <p className="text-white/70 text-xs">Tiendas cerca de ti + ofertas en redes</p>
          </div>
          {cargando && <Loader2 size={18} className="text-white animate-spin" />}
        </div>
      </div>

      {resultados && (
        <div className="p-4 space-y-4">

          {/* Enlaces de búsqueda rápida */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">📱 Buscar ofertas en</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(resultados.enlaces || {}).map(([key, url]) => (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 rounded-xl px-3 py-2.5 transition-colors group"
                >
                  <span className="text-lg">{ICONOS_REDES[key]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 truncate">{NOMBRES_REDES[key]}</p>
                    <p className="text-[10px] text-gray-400">Abrir búsqueda →</p>
                  </div>
                  <ExternalLink size={12} className="text-gray-400 group-hover:text-primary" />
                </a>
              ))}
            </div>
          </div>

          {/* Productos relacionados */}
          {resultados.productos?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">💊 Productos similares</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {resultados.productos.map((p, i) => (
                  <div key={i} className="flex-shrink-0 bg-blue-50 rounded-xl px-3 py-2 border border-blue-100 min-w-[140px]">
                    <p className="text-xs font-bold text-blue-800">{p.nombre}</p>
                    {p.ingrediente && <p className="text-[10px] text-blue-500 mt-0.5">{p.ingrediente}</p>}
                    {p.usos?.length > 0 && (
                      <p className="text-[10px] text-gray-500 mt-1">{p.usos.slice(0, 2).join(', ')}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tiendas encontradas */}
          {resultados.tiendas?.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">🏪 Tiendas en tu zona ({resultados.totalTiendas})</p>
                {resultados.tiendas.length > 3 && (
                  <button onClick={() => setExpandido(!expandido)} className="text-xs text-primary flex items-center gap-1">
                    {expandido ? 'Ver menos' : `Ver todas`}
                    {expandido ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {(expandido ? resultados.tiendas : resultados.tiendas.slice(0, 3)).map((t, i) => (
                  <div
                    key={i}
                    onClick={() => setTiendaSeleccionada(tiendaSeleccionada?.nombre === t.nombre ? null : t)}
                    className={`bg-gray-50 rounded-xl p-3 border cursor-pointer transition-all ${
                      tiendaSeleccionada?.nombre === t.nombre ? 'border-primary ring-1 ring-primary/20' : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${
                        t.source === 'google' ? 'bg-blue-500' : 'bg-green-500'
                      }`}>
                        {t.source === 'google' ? 'G' : t.nombre.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-gray-800 truncate">{t.nombre}</p>
                          {t.tieneProducto && (
                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">
                              ✓ Producto
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{t.direccion || `${t.prov}, ${t.dept}`}</p>
                        <div className="flex items-center gap-3 mt-1">
                          {t.rating > 0 && (
                            <div className="flex items-center gap-1">
                              <Star size={10} className="text-yellow-400 fill-yellow-400" />
                              <span className="text-[10px] text-gray-600 font-semibold">{t.rating}</span>
                              {t.totalRatings > 0 && (
                                <span className="text-[10px] text-gray-400">({t.totalRatings})</span>
                              )}
                            </div>
                          )}
                          <span className="text-[10px] text-primary font-semibold">{t.distanciaKm} km</span>
                          {t.abierto === true && (
                            <span className="text-[10px] text-green-600 font-semibold">● Abierto</span>
                          )}
                          {t.abierto === false && (
                            <span className="text-[10px] text-red-500 font-semibold">● Cerrado</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Detalles expandidos */}
                    {tiendaSeleccionada?.nombre === t.nombre && (
                      <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                        {t.especialidades?.length > 0 && (
                          <div>
                            <p className="text-[10px] text-gray-400 mb-1">Especialidades:</p>
                            <div className="flex flex-wrap gap-1">
                              {t.especialidades.map((e, j) => (
                                <span key={j} className="text-[10px] bg-white text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
                                  {e}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {t.telefono && (
                          <a href={`tel:${t.telefono}`} className="flex items-center gap-1 text-xs text-primary font-semibold">
                            📞 Llamar: {t.telefono}
                          </a>
                        )}
                        {t.placeId && (
                          <a
                            href={`https://www.google.com/maps/place/?place_id=${t.placeId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 font-semibold"
                          >
                            🗺️ Ver en Google Maps →
                          </a>
                        )}
                        {t.source === 'comunidad' && (
                          <a
                            href={`https://www.google.com/maps/search/${encodeURIComponent(t.nombre + ' ' + t.prov)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 font-semibold"
                          >
                            🗺️ Cómo llegar →
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sin resultados */}
          {resultados.tiendas?.length === 0 && (
            <div className="text-center py-4">
              <p className="text-gray-400 text-sm">No se encontraron tiendas en tu zona</p>
              <p className="text-gray-400 text-xs mt-1">Usa los enlaces de arriba para buscar en redes sociales</p>
            </div>
          )}

          {/* Timestamp */}
          <p className="text-[10px] text-gray-300 text-center">
            Búsqueda: {new Date(resultados.timestamp).toLocaleString('es-PE')} · Radio: {resultados.busqueda?.radioKm}km
          </p>
        </div>
      )}
    </div>
  );
}
