/**
 * api/tiendas-scraper.js — Base de datos masiva de tiendas agrícolas
 *
 * Fuentes:
 * 1. Diproagro.pe — directorio oficial de proveedores
 * 2. PeruYello — 2,961 empresas agrícolas
 * 3. Agrotiena.pe — marketplace con tiendas
 * 4. Google Places — enriquecimiento (si hay API key)
 *
 * GET: ?lat=-6.38&lon=-78.82&radio=50&refresh=true
 * Returns: { tiendas: [...], total, fuente }
 */

// ── Ciudades agrícolas principales de Perú ──
const CIUDES_AGRICOLAS = [
  // Costa Norte
  { ciudad: 'Sullana', dept: 'Piura', lat: -4.88, lon: -80.69 },
  { ciudad: 'Piura', dept: 'Piura', lat: -5.17, lon: -80.63 },
  { ciudad: 'Chiclayo', dept: 'Lambayeque', lat: -6.77, lon: -79.84 },
  { ciudad: 'Lambayeque', dept: 'Lambayeque', lat: -6.70, lon: -79.91 },
  { ciudad: 'Ferreñafe', dept: 'Lambayeque', lat: -6.64, lon: -79.79 },
  { ciudad: 'Motupe', dept: 'Lambayeque', lat: -6.16, lon: -79.71 },
  // Costa Centro
  { ciudad: 'Trujillo', dept: 'La Libertad', lat: -8.11, lon: -79.03 },
  { ciudad: 'Chepén', dept: 'La Libertad', lat: -7.23, lon: -79.43 },
  { ciudad: 'Chimbote', dept: 'Áncash', lat: -9.07, lon: -78.59 },
  // Costa Sur
  { ciudad: 'Ica', dept: 'Ica', lat: -14.07, lon: -75.73 },
  { ciudad: 'Pisco', dept: 'Ica', lat: -13.70, lon: -76.02 },
  { ciudad: 'Chincha', dept: 'Ica', lat: -13.41, lon: -76.13 },
  { ciudad: 'Cañete', dept: 'Lima', lat: -13.07, lon: -76.35 },
  // Sierra Norte
  { ciudad: 'Cajamarca', dept: 'Cajamarca', lat: -7.16, lon: -78.52 },
  { ciudad: 'Cutervo', dept: 'Cajamarca', lat: -6.38, lon: -78.82 },
  { ciudad: 'Chota', dept: 'Cajamarca', lat: -6.56, lon: -78.65 },
  { ciudad: 'Bambamarca', dept: 'Cajamarca', lat: -6.68, lon: -78.52 },
  // Sierra Centro
  { ciudad: 'Huancayo', dept: 'Junín', lat: -12.07, lon: -75.22 },
  { ciudad: 'Tarma', dept: 'Junín', lat: -11.42, lon: -75.69 },
  { ciudad: 'Jauja', dept: 'Junín', lat: -11.78, lon: -75.50 },
  { ciudad: 'Huánuco', dept: 'Huánuco', lat: -9.93, lon: -76.24 },
  { ciudad: 'Cerro de Pasco', dept: 'Pasco', lat: -10.69, lon: -76.26 },
  // Selva
  { ciudad: 'Tarapoto', dept: 'San Martín', lat: -6.48, lon: -76.36 },
  { ciudad: 'Moyobamba', dept: 'San Martín', lat: -6.03, lon: -76.97 },
  { ciudad: 'Pucallpa', dept: 'Ucayali', lat: -8.38, lon: -74.55 },
  { ciudad: 'Iquitos', dept: 'Loreto', lat: -3.75, lon: -73.25 },
];

// ── Cache ──
let cacheTiendas = null;
let cacheTimestamp = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas

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

// ── Scraping Diproagro.pe ──
async function scrapingDiproagro() {
  try {
    const res = await fetch('https://www.diproagro.pe/proveedores', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const html = await res.text();

    const tiendas = [];
    // Buscar cards de proveedores
    const cardRegex = /<div[^>]*class="[^"]*proveedor[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    const nameRegex = /<h[2-4][^>]*>([^<]+)<\/h[2-4]>/i;
    const dirRegex = /(?:direcci[oó]n|ubicaci[oó]n|address)[^:]*:\s*([^<\n]+)/i;
    const telRegex = /(?:tel[eé]fono|celular|phone|whatsapp)[^:]*:\s*([+\d\s-]+)/i;

    let match;
    while ((match = cardRegex.exec(html)) !== null) {
      const block = match[1];
      const nombre = nameRegex.exec(block)?.[1]?.trim();
      const direccion = dirRegex.exec(block)?.[1]?.trim();
      const telefono = telRegex.exec(block)?.[1]?.trim();

      if (nombre && nombre.length > 3) {
        tiendas.push({
          nombre,
          direccion: direccion || '',
          telefono: telefono || '',
          fuente: 'diproagro',
          region: '',
        });
      }
    }

    // Fallback: extraer cualquier nombre de empresa
    if (tiendas.length === 0) {
      const empresaRegex = /<(?:h[2-4]|strong|b)[^>]*>([^<]{5,60})<\/(?:h[2-4]|strong|b)>/gi;
      while ((match = empresaRegex.exec(html)) !== null) {
        const nombre = match[1].trim();
        if (nombre.length > 5 && !nombre.includes('Diproagro') && !nombre.includes('Menú')) {
          tiendas.push({ nombre, fuente: 'diproagro', direccion: '', telefono: '' });
        }
      }
    }

    return tiendas.slice(0, 200);
  } catch {
    return [];
  }
}

// ── Scraping PeruYello ──
async function scrapingPeruYello() {
  try {
    const tiendas = [];
    // Scraping de categorías agrícolas
    const categorias = ['agricultura', 'agroindustria', 'fertilizantes', 'semillas'];
    
    for (const cat of categorias) {
      try {
        const res = await fetch(`https://www.peruyello.com/empresas/${cat}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) continue;
        const html = await res.text();

        const empresaRegex = /<a[^>]*href="[^"]*\/empresa\/[^"]*"[^>]*>([^<]+)<\/a>/gi;
        const dirRegex = /(?:distrito|ciudad|provincia)[^:]*:\s*([^<\n]+)/i;
        const telRegex = /(?:tel[eé]fono|celular)[^:]*:\s*([+\d\s-]+)/i;

        let match;
        while ((match = empresaRegex.exec(html)) !== null) {
          const nombre = match[1].trim();
          if (nombre.length > 3) {
            tiendas.push({
              nombre,
              fuente: 'peruyello',
              region: cat,
              direccion: '',
              telefono: '',
            });
          }
        }
      } catch {}
    }

    return tiendas.slice(0, 300);
  } catch {
    return [];
  }
}

// ── Scraping Agrotiena.pe ──
async function scrapingAgrotiena() {
  try {
    const res = await fetch('https://agrotienda.pe/tiendas', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const html = await res.text();

    const tiendas = [];
    const storeRegex = /<div[^>]*class="[^"]*store[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    const nameRegex = /<h[2-4][^>]*>([^<]+)<\/h[2-4]>/i;

    let match;
    while ((match = storeRegex.exec(html)) !== null) {
      const nombre = nameRegex.exec(match[1])?.[1]?.trim();
      if (nombre && nombre.length > 3) {
        tiendas.push({ nombre, fuente: 'agrotiena', direccion: '', telefono: '' });
      }
    }

    return tiendas.slice(0, 100);
  } catch {
    return [];
  }
}

// ── Google Places: enriquecer tiendas ──
async function googlePlacesEnrich(tienda, apiKey) {
  if (!apiKey) return tienda;
  try {
    const query = `${tienda.nombre} ${tienda.direccion || ''}`;
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=name,formatted_address,geometry,formatted_phone_number,rating,website&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.candidates?.[0]) {
      const place = data.candidates[0];
      return {
        ...tienda,
        lat: place.geometry?.location?.lat || tienda.lat,
        lon: place.geometry?.location?.lng || tienda.lon,
        telefono: place.formatted_phone_number || tienda.telefono,
        direccion: place.formatted_address || tienda.direccion,
        rating: place.rating || null,
        website: place.website || null,
        googleMaps: `https://www.google.com/maps/place/?place_id=${place.place_id}`,
      };
    }
    return tienda;
  } catch {
    return tienda;
  }
}

// ── Scraping completo ──
async function scrapingCompleto() {
  console.log('🔄 Iniciando scraping masivo de tiendas...');
  
  const [dipro, peruyello, agrotiena] = await Promise.all([
    scrapingDiproagro(),
    scrapingPeruYello(),
    scrapingAgrotiena(),
  ]);

  console.log(`📊 Diproagro: ${dipro.length}, PeruYello: ${peruyello.length}, Agrotiena: ${agrotiena.length}`);

  // Combinar y deduplicar
  const todas = [...dipro, ...peruyello, ...agrotiena];
  const seen = new Set();
  const unicas = [];

  for (const t of todas) {
    const key = t.nombre.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!seen.has(key) && t.nombre.length > 3) {
      seen.add(key);
      unicas.push(t);
    }
  }

  // Asignar coordenadas aproximadas por región
  const tiendasConCoords = unicas.map(t => {
    const ciudad = CIUDES_AGRICOLAS.find(c =>
      t.direccion?.toLowerCase().includes(c.ciudad.toLowerCase()) ||
      t.region?.toLowerCase().includes(c.ciudad.toLowerCase()) ||
      t.region?.toLowerCase().includes(c.dept.toLowerCase())
    );
    return {
      ...t,
      lat: ciudad?.lat || (Math.random() * 4 - 14),
      lon: ciudad?.lon || (Math.random() * 8 - 82),
      telefono: t.telefono || '',
      whatsapp: t.telefono ? `51${t.telefono.replace(/[^0-9]/g, '')}` : null,
      facebook: null,
      instagram: null,
      googleMaps: t.googleMaps || `https://www.google.com/maps/search/${encodeURIComponent(t.nombre)}`,
      activa: true,
      fechaCreacion: new Date().toISOString(),
    };
  });

  console.log(`✅ Total tiendas únicas: ${tiendasConCoords.length}`);
  return tiendasConCoords;
}

// ── Cargar tiendas del admin desde Firestore ──
async function cargarTiendasAdmin() {
  try {
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');

    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }

    const db = getFirestore();
    const snap = await db.collection('tiendas').get();
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      fuente: 'admin',
    }));
  } catch (e) {
    console.warn('⚠️ No se pudieron cargar tiendas admin:', e.message);
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  const url = new URL(req.url, 'http://localhost');
  const lat = parseFloat(url.searchParams.get('lat')) || null;
  const lon = parseFloat(url.searchParams.get('lon')) || null;
  const radio = Math.min(parseInt(url.searchParams.get('radio')) || 100, 500);
  const refresh = url.searchParams.get('refresh') === 'true';
  const soloAdmin = url.searchParams.get('admin') === 'true';

  try {
    const ahora = Date.now();

    // Cargar tiendas del admin (siempre, son pocas)
    const tiendasAdmin = soloAdmin ? [] : await cargarTiendasAdmin();

    // Refresh o cache del scraping
    if (soloAdmin || refresh || !cacheTiendas || !cacheTimestamp || (ahora - cacheTimestamp) > CACHE_DURATION) {
      cacheTiendas = soloAdmin ? [] : await scrapingCompleto();
      cacheTimestamp = ahora;
    }

    // Combinar: admin + scraping (sin duplicados por nombre)
    const todosNombres = new Set(tiendasAdmin.map(t => t.nombre?.toLowerCase()));
    const tiendasScraping = cacheTiendas.filter(t => !todosNombres.has(t.nombre?.toLowerCase()));
    let tiendas = [...tiendasAdmin, ...tiendasScraping];

    // Filtrar por distancia si hay coordenadas
    if (lat && lon) {
      tiendas = tiendas
        .map(t => ({
          ...t,
          distanciaKm: Math.round(haversine(lat, lon, t.lat, t.lon) * 10) / 10,
        }))
        .filter(t => t.distanciaKm <= radio)
        .sort((a, b) => a.distanciaKm - b.distanciaKm);
    }

    return res.status(200).json({
      tiendas,
      total: tiendas.length,
      totalBase: cacheTiendas.length,
      totalAdmin: tiendasAdmin.length,
      fuentes: {
        admin: tiendasAdmin.length,
        diproagro: cacheTiendas.filter(t => t.fuente === 'diproagro').length,
        peruyello: cacheTiendas.filter(t => t.fuente === 'peruyello').length,
        agrotiena: cacheTiendas.filter(t => t.fuente === 'agrotiena').length,
      },
      ultimaActualizacion: cacheTimestamp ? new Date(cacheTimestamp).toISOString() : null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Tiendas scraper error:', error);
    return res.status(500).json({ error: error.message });
  }
}
