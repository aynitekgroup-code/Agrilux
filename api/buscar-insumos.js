/**
 * api/buscar-insumos.js
 * Agente de búsqueda local: encuentra tiendas de insumos agrícolas, precios, ofertas.
 * Fuentes: Google Places + base de datos comunitaria + enlaces sociales.
 *
 * GET body: ?lat=X&lon=Y&producto=Mancozeb&cultivo=papa&radio=20
 * Returns: { tiendas: [], enlaces: {}, productos: [] }
 */

// ── Base de datos de tiendas por defecto (se enriquece con Firestore) ──
const TIENDAS_POR_DEFECTO = [
  // Costa Norte
  { nombre: 'AgroInsumos Sullana', dept: 'Piura', prov: 'Sullana', lat: -4.88, lon: -80.69, telefono: '', especialidades: ['fungicidas', 'insecticidas', 'fertilizantes'], reputacion: 4.5 },
  { nombre: 'Agropiura', dept: 'Piura', prov: 'Piura', lat: -5.19, lon: -80.62, telefono: '', especialidades: ['semillas', 'fertilizantes', 'herramientas'], reputacion: 4.2 },
  { nombre: 'La Favorita - Chiclayo', dept: 'Lambayeque', prov: 'Chiclayo', lat: -6.76, lon: -79.84, telefono: '', especialidades: ['insumos generales', 'maquinaria'], reputacion: 4.0 },
  // Costa Centro
  { nombre: 'AgroSemillas Trujillo', dept: 'La Libertad', prov: 'Trujillo', lat: -8.10, lon: -79.02, telefono: '', especialidades: ['semillas', 'fertilizantes', 'irrigación'], reputacion: 4.3 },
  { nombre: 'Insumos Agrícolas Chepén', dept: 'La Libertad', prov: 'Chepén', lat: -7.22, lon: -79.43, telefono: '', especialidades: ['fungicidas', 'insecticidas'], reputacion: 4.1 },
  // Sierra Norte
  { nombre: 'AgroCajamarca', dept: 'Cajamarca', prov: 'Cajamarca', lat: -7.15, lon: -78.52, telefono: '', especialidades: ['fertilizantes', 'semillas', 'maquinaria'], reputacion: 4.4 },
  { nombre: 'AgroCutervo', dept: 'Cajamarca', prov: 'Cutervo', lat: -6.37, lon: -78.82, telefono: '', especialidades: ['fungicidas', 'insecticidas', 'semillas'], reputacion: 4.0 },
  { nombre: 'Insumos Chota', dept: 'Cajamarca', prov: 'Chota', lat: -6.55, lon: -78.65, telefono: '', especialidades: ['fertilizantes', 'herramientas'], reputacion: 3.8 },
  // Sierra Centro
  { nombre: 'AgroHuanuco', dept: 'Huánuco', prov: 'Huánuco', lat: -9.93, lon: -76.24, telefono: '', especialidades: ['semillas', 'fertilizantes'], reputacion: 4.1 },
  { nombre: 'AgroHuancayo', dept: 'Junín', prov: 'Huancayo', lat: -12.07, lon: -75.22, telefono: '', especialidades: ['insumos generales', 'maquinaria', 'irrigación'], reputacion: 4.5 },
  { nombre: 'AgroTarma', dept: 'Junín', prov: 'Tarma', lat: -11.42, lon: -75.69, telefono: '', especialidades: ['fertilizantes', 'semillas'], reputacion: 4.0 },
  // Costa Sur
  { nombre: 'AgroIca', dept: 'Ica', prov: 'Ica', lat: -14.07, lon: -75.73, telefono: '', especialidades: ['semillas', 'irrigación', 'fertilizantes'], reputacion: 4.6 },
  { nombre: 'AgroPisco', dept: 'Ica', prov: 'Pisco', lat: -13.70, lon: -76.02, telefono: '', especialidades: ['insumos generales'], reputacion: 4.0 },
  { nombre: 'Insumos Nazca', dept: 'Ica', prov: 'Nazca', lat: -14.83, lon: -74.95, telefono: '', especialidades: ['fertilizantes', 'fungicidas'], reputacion: 3.9 },
  // Selva
  { nombre: 'AgroTarapoto', dept: 'San Martín', prov: 'Tarapoto', lat: -6.48, lon: -76.36, telefono: '', especialidades: ['insumos tropicales', 'semillas'], reputacion: 4.2 },
  { nombre: 'AgroPucallpa', dept: 'Ucayali', prov: 'Pucallpa', lat: -8.38, lon: -74.55, telefono: '', especialidades: ['insumos generales', 'maquinaria'], reputacion: 4.0 },
];

// ── Haversine ──
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Buscar en Google Places (si hay API key) ──
async function buscarGooglePlaces(lat, lon, query, radioKm, apiKey) {
  if (!apiKey) return [];
  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=${radioKm * 1000}&keyword=${encodeURIComponent(query)}&type=store&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK') return [];
    return (data.results || []).slice(0, 10).map(p => ({
      nombre: p.name,
      direccion: p.vicinity,
      lat: p.geometry?.location?.lat,
      lon: p.geometry?.location?.lng,
      rating: p.rating || 0,
      totalRatings: p.user_ratings_total || 0,
      abierto: p.opening_hours?.open_now ?? null,
      foto: p.photos?.[0] ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${p.photos[0].photo_reference}&key=${apiKey}` : null,
      source: 'google',
      placeId: p.place_id,
    }));
  } catch { return []; }
}

// ── Buscar en base de datos local ──
function buscarTiendasLocales(lat, lon, radioKm, producto) {
  const productoLower = (producto || '').toLowerCase();
  return TIENDAS_POR_DEFECTO
    .map(t => ({
      ...t,
      distanciaKm: Math.round(haversine(lat, lon, t.lat, t.lon) * 10) / 10,
      source: 'comunidad',
      tieneProducto: t.especialidades.some(e => productoLower.includes(e) || e.includes(productoLower)),
    }))
    .filter(t => t.distanciaKm <= radioKm)
    .sort((a, b) => a.distanciaKm - b.distanciaKm);
}

// ── Generar enlaces de búsqueda en redes sociales ──
function generarEnlacesBusqueda(producto, ubicacion, cultivo) {
  const q = `${producto} ${ubicacion || ''} tienda agricola`;
  const qOferta = `${producto} oferta descuento ${ubicacion || ''}`;
  const qCultivo = `${producto} ${cultivo || ''} ${ubicacion || ''}`;

  return {
    google: `https://www.google.com/search?q=${encodeURIComponent(q)}`,
    googleMaps: `https://www.google.com/maps/search/${encodeURIComponent(q)}`,
    facebook: `https://www.facebook.com/marketplace/search/?query=${encodeURIComponent(q)}`,
    facebookGrupos: `https://www.facebook.com/search/groups/?q=${encodeURIComponent(qCultivo)}`,
    tiktok: `https://www.tiktok.com/search?q=${encodeURIComponent(qOferta)}`,
    youtube: `https://www.youtube.com/results?search_query=${encodeURIComponent(q + ' tutorial')}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`¿Alguien sabe dónde comprar ${producto} en ${ubicacion || 'mi zona'}? 🌱`)}`,
  };
}

// ── Productos relacionados con el producto buscado ──
function productosRelacionados(producto) {
  const mapa = {
    'mancozeb': [
      { nombre: 'Mancozeb 80% WP', ingrediente: 'Mancozeb', tipo: 'Fungicida', usos: ['Tizón tardío', 'Roya', 'Mildiu'] },
      { nombre: 'Dithane M-45', ingrediente: 'Mancozeb', tipo: 'Fungicida', usos: ['Tizón tardío', 'Roya'] },
      { nombre: 'Indofil M-45', ingrediente: 'Mancozeb', tipo: 'Fungicida', usos: ['Tizón tardío'] },
    ],
    'clorotalonil': [
      { nombre: 'Bravo 720', ingrediente: 'Clorotalonil', tipo: 'Fungicida', usos: ['Tizón', 'Roya'] },
      { nombre: 'Daconil 720', ingrediente: 'Clorotalonil', tipo: 'Fungicida', usos: ['Tizón', 'Antracnosis'] },
    ],
    'urea': [
      { nombre: 'Urea 46-0-0', ingrediente: 'Nitrógeno 46%', tipo: 'Fertilizante', usos: ['Crecimiento vegetativo'] },
      { nombre: 'Urea granulada', ingrediente: 'Nitrógeno 46%', tipo: 'Fertilizante', usos: ['Fertilización de cobertura'] },
    ],
    'cobre': [
      { nombre: 'Oxicloruro de cobre', ingrediente: 'Cobre 50%', tipo: 'Fungicida/Bactericida', usos: ['Chancro', 'Tizón bacteriano'] },
      { nombre: 'Hidróxido de cobre', ingrediente: 'Cobre 40%', tipo: 'Fungicida', usos: ['Hongos bacterianos'] },
    ],
    'trichoderma': [
      { nombre: 'Trichoderma harzianum', ingrediente: 'Hongo benéfico', tipo: 'Biológico', usos: ['Fusarium', 'Rhizoctonia'] },
    ],
    'metarhizium': [
      { nombre: 'Metarhizium anisopliae', ingrediente: 'Hongo benéfico', tipo: 'Biológico', usos: ['Gusano blanco', 'Escarabajos'] },
    ],
    'glifosato': [
      { nombre: 'Glifosato 48%', ingrediente: 'Glifosato', tipo: 'Herbicida', usos: ['Malezas generalizadas'] },
    ],
    'imidacloprid': [
      { nombre: 'Imidacloprid 20%', ingrediente: 'Imidacloprid', tipo: 'Insecticida sistémico', usos: ['Pulgones', 'Mosca blanca', 'Trips'] },
    ],
    'abamectina': [
      { nombre: 'Abamectina 1.8%', ingrediente: 'Abamectina', tipo: 'Acaricida/Insecticida', usos: ['Araña roja', 'Minadores'] },
    ],
  };

  const lower = (producto || '').toLowerCase();
  for (const [key, prods] of Object.entries(mapa)) {
    if (lower.includes(key)) return prods;
  }
  return [{ nombre: producto, ingrediente: '', tipo: 'Insumo agrícola', usos: [] }];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const url = new URL(req.url, 'http://localhost');
  const lat = parseFloat(url.searchParams.get('lat')) || -12.05;
  const lon = parseFloat(url.searchParams.get('lon')) || -77.04;
  const producto = url.searchParams.get('producto') || '';
  const cultivo = url.searchParams.get('cultivo') || '';
  const radio = Math.min(parseInt(url.searchParams.get('radio')) || 50, 200);

  const ubicacion = url.searchParams.get('ubicacion') || '';

  try {
    const googleKey = process.env.GOOGLE_PLACES_API_KEY;

    const [tiendasGoogle, tiendasLocales] = await Promise.all([
      buscarGooglePlaces(lat, lon, `tienda agricola ${producto}`, radio, googleKey),
      Promise.resolve(buscarTiendasLocales(lat, lon, radio, producto)),
    ]);

    const tiendas = [...tiendasGoogle, ...tiendasLocales].slice(0, 15);

    const enlaces = generarEnlacesBusqueda(producto, ubicacion || `${lat},${lon}`, cultivo);
    const productos = productosRelacionados(producto);

    return res.status(200).json({
      busqueda: { producto, cultivo, ubicacion, lat, lon, radioKm: radio },
      tiendas,
      enlaces,
      productos,
      totalTiendas: tiendas.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Buscar insumos error:', error);
    return res.status(500).json({ error: error.message });
  }
}
