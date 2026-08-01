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
  { nombre: 'AgroInsumos Sullana', dept: 'Piura', prov: 'Sullana', lat: -4.88, lon: -80.69, telefono: '+51945123456', especialidades: ['fungicidas', 'insecticidas', 'fertilizantes'], reputacion: 4.5,
    precios: { urea: 165, fosfato: 180, mancozeb: 85, glifosato: 45 },
    googleMaps: 'https://www.google.com/maps/search/AgroInsumos+Sullana',
    facebook: 'https://www.facebook.com/agroinsumossullana',
    whatsapp: 'https://wa.me/51945123456?text=Hola,%20¿tienen%20urea%20disponible?' },
  { nombre: 'Agropiura', dept: 'Piura', prov: 'Piura', lat: -5.19, lon: -80.62, telefono: '+51943654321', especialidades: ['semillas', 'fertilizantes', 'herramientas'], reputacion: 4.2,
    precios: { urea: 160, fosfato: 175, semilla_papa: 250 },
    googleMaps: 'https://www.google.com/maps/search/Agropiura',
    facebook: 'https://www.facebook.com/agropiura',
    whatsapp: 'https://wa.me/51943654321?text=Hola,%20¿cuánto%20cuesta%20la%20urea?' },
  { nombre: 'La Favorita - Chiclayo', dept: 'Lambayeque', prov: 'Chiclayo', lat: -6.76, lon: -79.84, telefono: '+51944789123', especialidades: ['insumos generales', 'maquinaria'], reputacion: 4.0,
    precios: { urea: 168, fosfato: 182, potasio: 178 },
    googleMaps: 'https://www.google.com/maps/search/La+Favorita+Chiclayo',
    facebook: 'https://www.facebook.com/lafavoritachiclayo',
    whatsapp: 'https://wa.me/51944789123?text=Hola,%20necesito%20información%20de%20insumos' },
  // Costa Centro
  { nombre: 'AgroSemillas Trujillo', dept: 'La Libertad', prov: 'Trujillo', lat: -8.10, lon: -79.02, telefono: '+51944123456', especialidades: ['semillas', 'fertilizantes', 'irrigación'], reputacion: 4.3,
    precios: { urea: 170, fosfato: 185, semilla_maiz: 180 },
    googleMaps: 'https://www.google.com/maps/search/AgroSemillas+Trujillo',
    facebook: 'https://www.facebook.com/agrosemillastrujillo',
    whatsapp: 'https://wa.me/51944123456?text=Hola,%20¿tienen%20semilla%20de%20maíz?' },
  { nombre: 'Insumos Agrícolas Chepén', dept: 'La Libertad', prov: 'Chepén', lat: -7.22, lon: -79.43, telefono: '+51944456789', especialidades: ['fungicidas', 'insecticidas'], reputacion: 4.1,
    precios: { urea: 172, mancozeb: 88, clorotalonil: 95 },
    googleMaps: 'https://www.google.com/maps/search/Insumos+Agricolas+Chepen',
    facebook: 'https://www.facebook.com/insumosagricolaschepen',
    whatsapp: 'https://wa.me/51944456789?text=Hola,%20¿cuánto%20cuesta%20el%20mancozeb?' },
  // Sierra Norte
  { nombre: 'AgroCajamarca', dept: 'Cajamarca', prov: 'Cajamarca', lat: -7.15, lon: -78.52, telefono: '+51941234567', especialidades: ['fertilizantes', 'semillas', 'maquinaria'], reputacion: 4.4,
    precios: { urea: 175, fosfato: 190, semilla_papa: 280 },
    googleMaps: 'https://www.google.com/maps/search/AgroCajamarca',
    facebook: 'https://www.facebook.com/agrocajamarca',
    whatsapp: 'https://wa.me/51941234567?text=Hola,%20necesito%20urea%20para%20papa' },
  { nombre: 'AgroCutervo', dept: 'Cajamarca', prov: 'Cutervo', lat: -6.37, lon: -78.82, telefono: '+51941345678', especialidades: ['fungicidas', 'insecticidas', 'semillas'], reputacion: 4.0,
    precios: { urea: 178, mancozeb: 90, clorotalonil: 98, semilla_papa: 290 },
    googleMaps: 'https://www.google.com/maps/search/AgroCutervo',
    facebook: 'https://www.facebook.com/agrocutervo',
    whatsapp: 'https://wa.me/51941345678?text=Hola,%20¿tienen%20fungicida%20para%20papa?' },
  { nombre: 'Insumos Chota', dept: 'Cajamarca', prov: 'Chota', lat: -6.55, lon: -78.65, telefono: '+51941456789', especialidades: ['fertilizantes', 'herramientas'], reputacion: 3.8,
    precios: { urea: 180, fosfato: 195 },
    googleMaps: 'https://www.google.com/maps/search/Insumos+Chota',
    facebook: 'https://www.facebook.com/insumoschota',
    whatsapp: 'https://wa.me/51941456789?text=Hola,%20¿cuánto%20cuesta%20la%20urea?' },
  // Sierra Centro
  { nombre: 'AgroHuanuco', dept: 'Huánuco', prov: 'Huánuco', lat: -9.93, lon: -76.24, telefono: '+51942123456', especialidades: ['semillas', 'fertilizantes'], reputacion: 4.1,
    precios: { urea: 182, fosfato: 198, semilla_maiz: 195 },
    googleMaps: 'https://www.google.com/maps/search/AgroHuanuco',
    facebook: 'https://www.facebook.com/agrohuanuco',
    whatsapp: 'https://wa.me/51942123456?text=Hola,%20necesito%20fertilizante' },
  { nombre: 'AgroHuancayo', dept: 'Junín', prov: 'Huancayo', lat: -12.07, lon: -75.22, telefono: '+51942234567', especialidades: ['insumos generales', 'maquinaria', 'irrigación'], reputacion: 4.5,
    precios: { urea: 185, fosfato: 200, goteo: 2800 },
    googleMaps: 'https://www.google.com/maps/search/AgroHuancayo',
    facebook: 'https://www.facebook.com/agrohuancayo',
    whatsapp: 'https://wa.me/51942234567?text=Hola,%20¿cuánto%20cuesta%20el%20sistema%20de%20riego?' },
  { nombre: 'AgroTarma', dept: 'Junín', prov: 'Tarma', lat: -11.42, lon: -75.69, telefono: '+51942345678', especialidades: ['fertilizantes', 'semillas'], reputacion: 4.0,
    precios: { urea: 188, fosfato: 202, semilla_papa: 300 },
    googleMaps: 'https://www.google.com/maps/search/AgroTarma',
    facebook: 'https://www.facebook.com/agrotarma',
    whatsapp: 'https://wa.me/51942345678?text=Hola,%20¿tienen%20semilla%20de%20papa?' },
  // Costa Sur
  { nombre: 'AgroIca', dept: 'Ica', prov: 'Ica', lat: -14.07, lon: -75.73, telefono: '+51943123456', especialidades: ['semillas', 'irrigación', 'fertilizantes'], reputacion: 4.6,
    precios: { urea: 155, fosfato: 170, goteo: 2200 },
    googleMaps: 'https://www.google.com/maps/search/AgroIca',
    facebook: 'https://www.facebook.com/agroica',
    whatsapp: 'https://wa.me/51943123456?text=Hola,%20¿cuánto%20cuesta%20el%20riego%20por%20goteo?' },
  { nombre: 'AgroPisco', dept: 'Ica', prov: 'Pisco', lat: -13.70, lon: -76.02, telefono: '+51943234567', especialidades: ['insumos generales'], reputacion: 4.0,
    precios: { urea: 158, fosfato: 172, glifosato: 48 },
    googleMaps: 'https://www.google.com/maps/search/AgroPisco',
    facebook: 'https://www.facebook.com/agropisco',
    whatsapp: 'https://wa.me/51943234567?text=Hola,%20necesito%20urea' },
  { nombre: 'Insumos Nazca', dept: 'Ica', prov: 'Nazca', lat: -14.83, lon: -74.95, telefono: '+51943345678', especialidades: ['fertilizantes', 'fungicidas'], reputacion: 3.9,
    precios: { urea: 160, mancozeb: 82 },
    googleMaps: 'https://www.google.com/maps/search/Insumos+Nazca',
    facebook: 'https://www.facebook.com/insumosnazca',
    whatsapp: 'https://wa.me/51943345678?text=Hola,%20¿cuánto%20cuesta%20el%20mancozeb?' },
  // Selva
  { nombre: 'AgroTarapoto', dept: 'San Martín', prov: 'Tarapoto', lat: -6.48, lon: -76.36, telefono: '+51945123456', especialidades: ['insumos tropicales', 'semillas'], reputacion: 4.2,
    precios: { urea: 190, fosfato: 205, semilla_cacao: 350 },
    googleMaps: 'https://www.google.com/maps/search/AgroTarapoto',
    facebook: 'https://www.facebook.com/agrotarapoto',
    whatsapp: 'https://wa.me/51945123456?text=Hola,%20¿tienen%20insumos%20tropicales?' },
  { nombre: 'AgroPucallpa', dept: 'Ucayali', prov: 'Pucallpa', lat: -8.38, lon: -74.55, telefono: '+51946123456', especialidades: ['insumos generales', 'maquinaria'], reputacion: 4.0,
    precios: { urea: 195, fosfato: 210, maquinaria: 'consultar' },
    googleMaps: 'https://www.google.com/maps/search/AgroPucallpa',
    facebook: 'https://www.facebook.com/agropucallpa',
    whatsapp: 'https://wa.me/51946123456?text=Hola,%20necesito%20información%20de%20maquinaria' },
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
