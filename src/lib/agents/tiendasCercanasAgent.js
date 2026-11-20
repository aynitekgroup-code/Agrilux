const TIENDAS_CERCANAS_DEFAULT = [
  { nombre: 'Agropapapa E.I.R.L.', direccion: 'Av. Riva Agüero 456, Cutervo', telefono: '923456781', especialidad: 'Semillas y fertilizantes' },
  { nombre: 'Agricola San Juan', direccion: 'Jr. San Martín 123, Cutervo', telefono: '923456782', especialidad: 'Insumos agrícolas' },
  { nombre: 'Ferretería Agrícola Los Andes', direccion: 'Av. Independencia 789, Cutervo', telefono: '923456783', especialidad: 'Herramientas y riego' },
  { nombre: 'Semillas La Perla', direccion: 'Jr. Bolognesi 321, Cutervo', telefono: '923456784', especialidad: 'Semillas certificadas' },
  { nombre: 'AgroInsumos Cutervo', direccion: 'Av. Progreso 654, Cutervo', telefono: '923456785', especialidad: 'Fertilizantes y plaguicidas' }
];

export async function buscarTiendasCercanas(lat = null, lng = null, radio = 10) {
  if (lat && lng) {
    try {
      const query = 'tienda agricola insumos';
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=10&lat=${lat}&lon=${lng}&radius=${radio * 1000}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Agrilux/1.0' }
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const tiendas = data.map((item, i) => ({
          id: i + 1,
          nombre: item.display_name.split(',')[0],
          direccion: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          fuente: 'OpenStreetMap'
        }));
        if (tiendas.length > 0) return tiendas;
      }
    } catch (e) {
      console.warn('[AgenteTiendas] Error OSM:', e.message);
    }
  }

  return TIENDAS_CERCANAS_DEFAULT.map((t, i) => ({
    id: i + 1,
    ...t,
    fuente: 'Base de datos Agrilux'
  }));
}

export function calcularDistancia(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function ordenarPorDistancia(tiendas, lat, lng) {
  return tiendas
    .map(t => ({
      ...t,
      distancia: t.lat && t.lng ? calcularDistancia(lat, lng, t.lat, t.lng) : null
    }))
    .sort((a, b) => (a.distancia || 999) - (b.distancia || 999));
}
