/**
 * Ofertas exclusivamente de tiendas registradas en Agrilux (tiendas_comunidad).
 */
export async function cargarOfertasRegistradas({ lat, lon, cultivo = '' } = {}) {
  const params = new URLSearchParams();
  if (lat) params.append('lat', lat);
  if (lon) params.append('lon', lon);
  if (cultivo) params.append('cultivo', cultivo);

  const res = await fetch(`/api/tiendas?type=ofertas&${params}`);
  if (!res.ok) throw new Error('No se pudieron cargar las ofertas');
  const data = await res.json();
  return {
    ofertas: data.ofertas || [],
    total: data.total || 0,
    timestamp: data.timestamp || null,
  };
}

export function formatearOfertasParaAgente(ofertas = [], max = 8) {
  if (!ofertas.length) {
    return 'No hay ofertas de tiendas registradas en Agrilux en este momento.';
  }
  return ofertas.slice(0, max).map((o, i) => {
    const dist = o.distanciaKm != null ? ` · ${o.distanciaKm}km` : '';
    const precio = o.precio != null ? `S/ ${o.precio}` : 'consultar precio';
    const wa = o.whatsapp ? ` · WhatsApp ${o.whatsapp}` : '';
    return `${i + 1}. ${o.producto} en ${o.tienda} (${o.region || 'Perú'})${dist} — ${precio}${wa}`;
  }).join('\n');
}
