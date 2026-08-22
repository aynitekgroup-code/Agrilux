/**
 * api/tiendas.js — API unificada de tiendas agrícolas
 *
 * Combina: scraper + comunidad + precios + ofertas
 *
 * Endpoints:
 *   GET  /api/tiendas?type=scraper     → Scraping de tiendas
 *   GET  /api/tiendas?type=comunidad   → Tiendas de la comunidad
 *   GET  /api/tiendas?type=precios     → Precios históricos
 *   GET  /api/tiendas?type=ofertas     → Ofertas del día
 *   GET  /api/tiendas?type=admin&key=X → Ver tiendas (admin)
 *   POST /api/tiendas?type=comunidad   → Registrar tienda
 *   POST /api/tiendas?type=precios     → Guardar precio
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ── Firebase Admin (lazy init + manejo de errores) ──
let db = null;
let firebaseInitError = null;

function normalizePrivateKey(raw) {
  if (!raw) return null;
  const key = raw.replace(/\\n/g, '\n').trim();
  return key.includes('BEGIN PRIVATE KEY') ? key : null;
}

function initFirebaseAdmin() {
  if (db) return db;
  if (firebaseInitError) return null;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) {
    firebaseInitError = 'missing_env';
    return null;
  }

  try {
    if (!getApps().length) {
      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
    }
    db = getFirestore();
    return db;
  } catch (err) {
    firebaseInitError = err.message;
    console.error('Firebase Admin init error:', err.message);
    return null;
  }
}

function firebaseReady() {
  return !!initFirebaseAdmin();
}

function respuestaFirebaseNoDisponible(res, type) {
  const hint = 'Agrega FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY en Vercel (Settings → Environment Variables).';
  const base = {
    firebase_ok: false,
    hint,
    total: 0,
  };

  if (type === 'ofertas') {
    return res.status(200).json({
      ...base,
      ofertas: [],
      timestamp: new Date().toISOString(),
    });
  }
  if (type === 'comunidad') {
    return res.status(200).json({ ...base, tiendas: [] });
  }
  if (type === 'precios') {
    return res.status(200).json({ ...base, precios: [], productos: PRODUCTOS });
  }
  if (type === 'admin') {
    return res.status(503).json({ error: hint });
  }

  return res.status(503).json({ error: hint });
}

// ── Ciudades agrícolas ──
const CIUDES_AGRICOLAS = [
  { ciudad: 'Sullana', dept: 'Piura', lat: -4.88, lon: -80.69 },
  { ciudad: 'Piura', dept: 'Piura', lat: -5.17, lon: -80.63 },
  { ciudad: 'Chiclayo', dept: 'Lambayeque', lat: -6.77, lon: -79.84 },
  { ciudad: 'Lambayeque', dept: 'Lambayeque', lat: -6.70, lon: -79.91 },
  { ciudad: 'Ferreñafe', dept: 'Lambayeque', lat: -6.64, lon: -79.79 },
  { ciudad: 'Motupe', dept: 'Lambayeque', lat: -6.16, lon: -79.71 },
  { ciudad: 'Trujillo', dept: 'La Libertad', lat: -8.11, lon: -79.03 },
  { ciudad: 'Chepén', dept: 'La Libertad', lat: -7.23, lon: -79.43 },
  { ciudad: 'Ica', dept: 'Ica', lat: -14.07, lon: -75.73 },
  { ciudad: 'Cajamarca', dept: 'Cajamarca', lat: -7.16, lon: -78.52 },
  { ciudad: 'Cutervo', dept: 'Cajamarca', lat: -6.38, lon: -78.82 },
  { ciudad: 'Chota', dept: 'Cajamarca', lat: -6.56, lon: -78.65 },
  { ciudad: 'Huancayo', dept: 'Junín', lat: -12.07, lon: -75.22 },
  { ciudad: 'Cusco', dept: 'Cusco', lat: -13.53, lon: -71.97 },
  { ciudad: 'Arequipa', dept: 'Arequipa', lat: -16.41, lon: -71.54 },
];

// ── Productos estándar ──
const PRODUCTOS = {
  urea: { nombre: 'Urea 46-0-0', unidad: 'S/por saco 50kg' },
  fosfato: { nombre: 'Fosfato 15-15-15', unidad: 'S/por saco 50kg' },
  mancozeb: { nombre: 'Mancozeb 80%', unidad: 'S/por kg' },
  clorotalonil: { nombre: 'Clorotalonil 72%', unidad: 'S/por kg' },
  glifosato: { nombre: 'Glifosato 48%', unidad: 'S/por litro' },
  abono: { nombre: 'Abono orgánico', unidad: 'S/por saco' },
  semilla_papa: { nombre: 'Semilla papa', unidad: 'S/por kg' },
  semilla_maiz: { nombre: 'Semilla maíz', unidad: 'S/por kg' },
};

// ── Cache ──
let cacheTiendas = null;
let cacheTimestamp = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000;

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

// ═══════════════════════════════════════════════════════════════════
// SCRAPING
// ═══════════════════════════════════════════════════════════════════

async function scrapingDiproagro() {
  try {
    const res = await fetch('https://www.diproagro.pe/proveedores', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const tiendas = [];
    const regex = /<h[2-4][^>]*>([^<]*(?:agro|insumo|fertilizante|semilla)[^<]*)<\/h[2-4]>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const nombre = match[1].trim();
      if (nombre.length > 3) tiendas.push({ nombre, fuente: 'diproagro' });
    }
    return tiendas.slice(0, 200);
  } catch { return []; }
}

async function scrapingPeruYello() {
  try {
    const res = await fetch('https://www.peruyello.com/empresas/agricola', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const tiendas = [];
    const regex = /<a[^>]*href="\/empresa\/[^"]*"[^>]*>([^<]+)<\/a>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const nombre = match[1].trim();
      if (nombre.length > 3) tiendas.push({ nombre, fuente: 'peruyello' });
    }
    return tiendas.slice(0, 300);
  } catch { return []; }
}

async function scrapingAgrotiena() {
  try {
    const res = await fetch('https://agrotienda.pe/tiendas', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const tiendas = [];
    const regex = /<h[2-4][^>]*>([^<]+)<\/h[2-4]>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const nombre = match[1].trim();
      if (nombre.length > 3 && /agro|insumo|semilla|fertil/i.test(nombre)) {
        tiendas.push({ nombre, fuente: 'agrotiena' });
      }
    }
    return tiendas.slice(0, 100);
  } catch { return []; }
}

async function buscarGoogleMaps(ciudad, dept) {
  const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
  if (!API_KEY) return [];
  const tiendas = [];
  const queries = [`tienda agrícola ${ciudad} ${dept}`, `insumos agrícolas ${ciudad}`];
  for (const query of queries) {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${API_KEY}&language=es`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const data = await res.json();
      for (const place of data.results || []) {
        if (place.business_status !== 'OPERATIONAL') continue;
        tiendas.push({
          nombre: place.name,
          direccion: place.formatted_address,
          lat: place.geometry?.location?.lat,
          lon: place.geometry?.location?.lng,
          rating: place.rating,
          fuente: 'google_maps',
        });
      }
    } catch {}
  }
  return tiendas;
}

async function scrapingCompleto() {
  console.log('🔄 Scraping masivo de tiendas...');
  const [dipro, peruyello, agrotiena] = await Promise.all([
    scrapingDiproagro(), scrapingPeruYello(), scrapingAgrotiena(),
  ]);

  // Google Maps para ciudades principales
  const googleMaps = [];
  if (process.env.GOOGLE_PLACES_API_KEY) {
    for (const c of CIUDES_AGRICOLAS.slice(0, 8)) {
      const tiendas = await buscarGoogleMaps(c.ciudad, c.dept);
      googleMaps.push(...tiendas);
    }
  }

  const todas = [...dipro, ...peruyello, ...agrotiena, ...googleMaps];
  const seen = new Set();
  const unicas = [];
  for (const t of todas) {
    const key = t.nombre.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!seen.has(key) && t.nombre.length > 3) {
      seen.add(key);
      unicas.push(t);
    }
  }

  return unicas.map(t => {
    const ciudad = CIUDES_AGRICOLAS.find(c =>
      t.direccion?.toLowerCase().includes(c.ciudad.toLowerCase()) ||
      t.region?.toLowerCase().includes(c.ciudad.toLowerCase())
    );
    return {
      ...t,
      lat: t.lat || ciudad?.lat || null,
      lon: t.lon || ciudad?.lon || null,
      whatsapp: t.telefono ? `51${t.telefono.replace(/[^0-9]/g, '')}` : null,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const url = new URL(req.url, 'http://localhost');
    const type = url.searchParams.get('type') || 'comunidad';

    if (!firebaseReady() && type !== 'scraper') {
      if (req.method === 'GET') {
        return respuestaFirebaseNoDisponible(res, type);
      }
      return res.status(503).json({
        error: 'Firebase no configurado en el servidor. Agrega FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY en Vercel.',
        firebase_ok: false,
      });
    }

    db = initFirebaseAdmin();

    // ── SCRAPING ──
    if (type === 'scraper') {
      const ahora = Date.now();
      if (!cacheTiendas || !cacheTimestamp || (ahora - cacheTimestamp) > CACHE_DURATION) {
        cacheTiendas = await scrapingCompleto();
        cacheTimestamp = ahora;
      }

      let tiendas = cacheTiendas;
      const lat = parseFloat(url.searchParams.get('lat'));
      const lon = parseFloat(url.searchParams.get('lon'));
      const radio = Math.min(parseInt(url.searchParams.get('radio')) || 100, 500);

      if (lat && lon) {
        tiendas = tiendas
          .map(t => ({ ...t, distanciaKm: t.lat && t.lon ? Math.round(haversine(lat, lon, t.lat, t.lon) * 10) / 10 : null }))
          .filter(t => t.distanciaKm === null || t.distanciaKm <= radio)
          .sort((a, b) => (a.distanciaKm || 999) - (b.distanciaKm || 999));
      }

      return res.status(200).json({ tiendas, total: tiendas.length, timestamp: new Date().toISOString() });
    }

    // ── COMUNIDAD ──
    if (type === 'comunidad') {
      if (req.method === 'GET') {
        const lat = parseFloat(url.searchParams.get('lat'));
        const lon = parseFloat(url.searchParams.get('lon'));
        const radio = Math.min(parseInt(url.searchParams.get('radio')) || 50, 200);
        const dept = url.searchParams.get('departamento');
        const busqueda = url.searchParams.get('q')?.toLowerCase();

        let query = db.collection('tiendas_comunidad').where('activa', '==', true);
        if (dept) query = query.where('departamento', '==', dept);

        const snap = await query.get();
        let tiendas = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (busqueda) {
          tiendas = tiendas.filter(t =>
            t.nombre?.toLowerCase().includes(busqueda) ||
            t.distrito?.toLowerCase().includes(busqueda)
          );
        }

        if (lat && lon) {
          tiendas = tiendas
            .map(t => ({ ...t, distanciaKm: t.lat && t.lon ? Math.round(haversine(lat, lon, t.lat, t.lon) * 10) / 10 : null }))
            .filter(t => t.distanciaKm === null || t.distanciaKm <= radio)
            .sort((a, b) => (a.distanciaKm || 999) - (b.distanciaKm || 999));
        }

        return res.status(200).json({ tiendas, total: tiendas.length, firebase_ok: true });
      }

      if (req.method === 'POST') {
        const data = req.body;
        if (!data.nombre?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
        if (!data.whatsapp?.trim()) return res.status(400).json({ error: 'WhatsApp requerido' });

        const tienda = {
          nombre: data.nombre.trim(),
          direccion: data.direccion?.trim() || null,
          distrito: data.distrito?.trim() || null,
          departamento: data.departamento || null,
          lat: data.lat || null,
          lon: data.lon || null,
          whatsapp: data.whatsapp.replace(/\D/g, ''),
          whatsappFormateado: `51${data.whatsapp.replace(/\D/g, '')}`,
          facebook: data.facebook?.trim() || null,
          instagram: data.instagram?.trim() || null,
          web: data.web?.trim() || null,
          especialidades: data.especialidades || [],
          horario: data.horario?.trim() || null,
          descripcion: data.descripcion?.trim() || null,
          propietarioId: data.propietarioId || null,
          propietarioNombre: data.propietarioNombre || null,
          fuente: 'comunidad',
          verificada: false,
          activa: true,
          preciosActuales: {},
          createdAt: new Date().toISOString(),
        };

        const docRef = await db.collection('tiendas_comunidad').add(tienda);
        return res.status(201).json({ id: docRef.id, ...tienda });
      }
    }

    // ── PRECIOS ──
    if (type === 'precios') {
      if (req.method === 'GET') {
        const tiendaId = url.searchParams.get('tiendaId');
        const producto = url.searchParams.get('producto');
        const dias = parseInt(url.searchParams.get('dias')) || 30;

        const fechaLimite = new Date();
        fechaLimite.setDate(fechaLimite.getDate() - dias);

        let query = db.collection('precios_historicos').where('fecha', '>=', fechaLimite.toISOString());
        if (tiendaId) query = query.where('tiendaId', '==', tiendaId);
        if (producto) query = query.where('producto', '==', producto);

        const snap = await query.orderBy('fecha', 'desc').limit(100).get();
        const precios = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        return res.status(200).json({ precios, total: precios.length, productos: PRODUCTOS });
      }

      if (req.method === 'POST') {
        const data = req.body;
        if (!data.tiendaId) return res.status(400).json({ error: 'tiendaId requerido' });
        if (!data.producto) return res.status(400).json({ error: 'producto requerido' });
        if (data.precio === undefined) return res.status(400).json({ error: 'precio requerido' });

        const precio = {
          tiendaId: data.tiendaId,
          tiendaNombre: data.tiendaNombre || null,
          producto: data.producto,
          productoNombre: PRODUCTOS[data.producto]?.nombre || data.producto,
          precio: parseFloat(data.precio),
          unidad: data.unidad || PRODUCTOS[data.producto]?.unidad || 'S/',
          notas: data.notas || null,
          fuente: data.fuente || 'manual',
          lat: data.lat || null,
          lon: data.lon || null,
          departamento: data.departamento || null,
          fecha: new Date().toISOString(),
        };

        const docRef = await db.collection('precios_historicos').add(precio);

        // Actualizar precio actual en la tienda
        await db.collection('tiendas_comunidad').doc(data.tiendaId).update({
          [`preciosActuales.${data.producto}`]: { precio: precio.precio, fecha: precio.fecha },
          ultimaActualizacion: precio.fecha,
        });

        return res.status(201).json({ id: docRef.id, ...precio });
      }
    }

    // ── OFERTAS ──
    if (type === 'ofertas') {
      const lat = parseFloat(url.searchParams.get('lat'));
      const lon = parseFloat(url.searchParams.get('lon'));
      const cultivo = url.searchParams.get('cultivo') || '';

      // Buscar precios recientes de tiendas cercanas
      let query = db.collection('precios_historicos')
        .orderBy('fecha', 'desc')
        .limit(100);

      const snap = await query.get();
      let precios = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Obtener info de tiendas
      const tiendaIds = [...new Set(precios.map(p => p.tiendaId))];
      const tiendasMap = {};
      for (const id of tiendaIds) {
        const doc = await db.collection('tiendas_comunidad').doc(id).get();
        if (doc.exists) tiendasMap[id] = { id: doc.id, ...doc.data() };
      }

      // Formatear como ofertas
      let ofertas = precios.map(p => ({
        tienda: p.tiendaNombre || tiendasMap[p.tiendaId]?.nombre || 'Tienda',
        producto: p.productoNombre || p.producto,
        precio: p.precio,
        region: p.departamento || tiendasMap[p.tiendaId]?.departamento || '',
        whatsapp: tiendasMap[p.tiendaId]?.whatsapp || null,
        facebook: tiendasMap[p.tiendaId]?.facebook || null,
        lat: p.lat || tiendasMap[p.tiendaId]?.lat || null,
        lon: p.lon || tiendasMap[p.tiendaId]?.lon || null,
        fecha: p.fecha,
        descuento: null,
      }));

      // Filtrar por distancia
      if (lat && lon) {
        ofertas = ofertas
          .map(o => ({ ...o, distanciaKm: o.lat && o.lon ? Math.round(haversine(lat, lon, o.lat, o.lon) * 10) / 10 : null }))
          .filter(o => o.distanciaKm === null || o.distanciaKm <= 100)
          .sort((a, b) => (a.distanciaKm || 999) - (b.distanciaKm || 999));
      }

      // Filtrar por cultivo
      if (cultivo) {
        ofertas = ofertas.filter(o =>
          o.producto?.toLowerCase().includes(cultivo.toLowerCase())
        );
      }

      return res.status(200).json({
        ofertas,
        total: ofertas.length,
        timestamp: new Date().toISOString(),
        firebase_ok: true,
      });
    }

    // ── ADMIN: Ver tiendas registradas ──
    if (type === 'admin') {
      const key = url.searchParams.get('key');
      if (key !== process.env.ADMIN_KEY) {
        return res.status(403).json({ error: 'Clave incorrecta' });
      }

      const snap = await db.collection('tiendas_comunidad').orderBy('createdAt', 'desc').get();
      const tiendas = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      return res.status(200).json({
        tiendas,
        total: tiendas.length,
      });
    }

    return res.status(400).json({ error: 'type inválido. Usa: scraper, comunidad, precios, ofertas, admin' });
  } catch (error) {
    console.error('Tiendas error:', error);
    return res.status(500).json({ error: error.message });
  }
}
