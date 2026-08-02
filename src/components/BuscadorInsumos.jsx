import React, { useState, useEffect } from 'react';
import { MapPin, Star, ExternalLink, Store, Tag, Search, Loader2, ChevronDown, ChevronUp, MessageCircle, ShoppingCart } from 'lucide-react';

const ICONOS_REDES = {
  google: '🔍',
  googleMaps: '🗺️',
  facebook: '📘',
  facebookGrupos: '👥',
  instagram: '📸',
  tiktok: '🎵',
  whatsapp: '💬',
};

const NOMBRES_REDES = {
  google: 'Google',
  googleMaps: 'Google Maps',
  facebook: 'Facebook Marketplace',
  facebookGrupos: 'Grupos de Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
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
        radio: '50',
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
            <p className="text-white/70 text-xs">Precios reales + tiendas cercanas</p>
          </div>
          {cargando && <Loader2 size={18} className="text-white animate-spin" />}
        </div>
      </div>

      {resultados && (
        <div className="p-4 space-y-4">

          {/* Precios Fertisem */}
          {resultados.precios?.fertisem?.length > 0 && (
            <div className="bg-orange-50 rounded-xl p-3 border border-orange-200">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart size={14} className="text-orange-600" />
                <p className="text-xs font-bold text-orange-700">Precios en Fertisem.pe</p>
              </div>
              <div className="space-y-1.5">
                {resultados.precios.fertisem.slice(0, 4).map((p, i) => (
                  <div key={i} className="flex items-center justify-between bg-white rounded-lg px-2.5 py-1.5 border border-orange-100">
                    <p className="text-xs text-gray-700 font-medium truncate flex-1">{p.nombre}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-orange-600">S/ {p.precio}</span>
                      <a href={p.url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline">Ver →</a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Precio de referencia */}
          {resultados.precios?.referencia && (
            <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
              <p className="text-xs font-bold text-blue-700 mb-1">📊 Precio de referencia ({resultados.precios.referencia.region})</p>
              <p className="text-lg font-bold text-blue-800">S/ {resultados.precios.referencia.precio} <span className="text-xs font-normal text-blue-500">por kg</span></p>
            </div>
          )}

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
                          {t.precio && (
                            <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full flex-shrink-0">
                              S/ {t.precio}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{t.direccion || `${t.prov || ''}, ${t.dept || ''}`}</p>
                        <div className="flex items-center gap-3 mt-1">
                          {t.rating > 0 && (
                            <div className="flex items-center gap-1">
                              <Star size={10} className="text-yellow-400 fill-yellow-400" />
                              <span className="text-[10px] text-gray-600 font-semibold">{t.rating}</span>
                            </div>
                          )}
                          <span className="text-[10px] text-primary font-semibold">{t.distanciaKm} km</span>
                        </div>
                      </div>
                    </div>

                    {/* Detalles expandidos: Links directos */}
                    {tiendaSeleccionada?.nombre === t.nombre && (
                      <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                        {/* Links de contacto directo */}
                        <div className="flex flex-wrap gap-1.5">
                          {t.whatsappLink && (
                            <a href={t.whatsappLink} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-[10px] font-bold bg-green-500 text-white px-2.5 py-1.5 rounded-full hover:bg-green-600 transition-colors">
                              💬 WhatsApp
                            </a>
                          )}
                          {t.facebookLink && (
                            <a href={t.facebookLink} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-[10px] font-bold bg-blue-600 text-white px-2.5 py-1.5 rounded-full hover:bg-blue-700 transition-colors">
                              📘 Facebook
                            </a>
                          )}
                          {t.instagramLink && (
                            <a href={t.instagramLink} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-[10px] font-bold bg-pink-500 text-white px-2.5 py-1.5 rounded-full hover:bg-pink-600 transition-colors">
                              📸 Instagram
                            </a>
                          )}
                          {t.googleMapsLink && (
                            <a href={t.googleMapsLink} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-[10px] font-bold bg-blue-500 text-white px-2.5 py-1.5 rounded-full hover:bg-blue-600 transition-colors">
                              🗺️ Maps
                            </a>
                          )}
                        </div>

                        {/* Precios de la tienda */}
                        {t.precios && Object.keys(t.precios).length > 0 && (
                          <div className="bg-white rounded-lg p-2 border border-gray-100">
                            <p className="text-[10px] text-gray-400 mb-1">Precios en esta tienda:</p>
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(t.precios).map(([prod, precio]) => (
                                <span key={prod} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                  {prod}: S/ {precio}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Especialidades */}
                        {t.especialidades?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {t.especialidades.map((e, j) => (
                              <span key={j} className="text-[10px] bg-white text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
                                {e}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Llamar */}
                        {t.telefono && (
                          <a href={`tel:${t.telefono}`} className="flex items-center gap-1 text-xs text-primary font-semibold">
                            📞 Llamar: {t.telefono}
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
