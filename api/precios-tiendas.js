/**
 * api/precios-tiendas.js — Historial de precios por tienda
 *
 * GET:    Consultar precios actuales o históricos
 * POST:   Guardar nuevo precio
 * PUT:    Actualizar precio de una tienda
 *
 * GET: ?lat=-6.38&lon=-78.82&producto=urea&dias=30
 * POST: { tiendaId, producto, precio, unidad, notas }
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
  imidacloprid: { nombre: 'Imidacloprid', unidad: 'S/por litro' },
  cipermetrina: { nombre: 'Cipermetrina', unidad: 'S/por litro' },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') return await consultarPrecios(req, res);
    if (req.method === 'POST') return await guardarPrecio(req, res);
    if (req.method === 'PUT') return await actualizarPrecio(req, res);
    return res.status(405).json({ error: 'Método no permitido' });
  } catch (error) {
    console.error('Precios tiendas error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ── Consultar precios ──
async function consultarPrecios(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const tiendaId = url.searchParams.get('tiendaId');
  const producto = url.searchParams.get('producto');
  const lat = parseFloat(url.searchParams.get('lat')) || null;
  const lon = parseFloat(url.searchParams.get('lon')) || null;
  const dias = parseInt(url.searchParams.get('dias')) || 30;
  const departamento = url.searchParams.get('departamento');

  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - dias);

  // Consultar precios
  let query = db.collection('precios_historicos')
    .where('fecha', '>=', fechaLimite.toISOString());

  if (tiendaId) {
    query = query.where('tiendaId', '==', tiendaId);
  }

  if (producto) {
    query = query.where('producto', '==', producto);
  }

  const snapshot = await query.orderBy('fecha', 'desc').get();
  let precios = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Si hay ubicación, filtrar por tiendas cercanas
  if (lat && lon) {
    // Obtener tiendas cercanas
    const tiendasSnap = await db.collection('tiendas_comunidad')
      .where('activa', '==', true)
      .get();

    const tiendasCercanas = tiendasSnap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .map(t => ({
        ...t,
        distancia: t.lat && t.lon
          ? haversine(lat, lon, t.lat, t.lon)
          : Infinity,
      }))
      .filter(t => t.distancia <= 50)
      .map(t => t.id);

    precios = precios.filter(p => tiendasCercanas.includes(p.tiendaId));
  }

  // Agrupar por tienda y producto (último precio)
  const preciosActuales = {};
  for (const p of precios) {
    const key = `${p.tiendaId}_${p.producto}`;
    if (!preciosActuales[key] || new Date(p.fecha) > new Date(preciosActuales[key].fecha)) {
      preciosActuales[key] = p;
    }
  }

  // Obtener info de tiendas
  const tiendaIds = [...new Set(precios.map(p => p.tiendaId))];
  const tiendasData = {};
  for (const id of tiendaIds) {
    const doc = await db.collection('tiendas_comunidad').doc(id).get();
    if (doc.exists) tiendasData[id] = { id: doc.id, ...doc.data() };
  }

  // Formatear respuesta
  const resultado = Object.values(preciosActuales).map(p => ({
    ...p,
    tienda: tiendasData[p.tiendaId] || null,
  }));

  return res.status(200).json({
    precios: resultado,
    total: resultado.length,
    productos: PRODUCTOS,
    timestamp: new Date().toISOString(),
  });
}

// ── Guardar precio ──
async function guardarPrecio(req, res) {
  const data = req.body;

  if (!data.tiendaId) return res.status(400).json({ error: 'tiendaId requerido' });
  if (!data.producto) return res.status(400).json({ error: 'producto requerido' });
  if (!data.precio && data.precio !== 0) return res.status(400).json({ error: 'precio requerido' });

  const precio = {
    tiendaId: data.tiendaId,
    tiendaNombre: data.tiendaNombre || null,
    producto: data.producto,
    productoNombre: PRODUCTOS[data.producto]?.nombre || data.producto,
    precio: parseFloat(data.precio),
    unidad: data.unidad || PRODUCTOS[data.producto]?.unidad || 'S/',
    moneda: 'PEN',
    notas: data.notas || null,
    fuente: data.fuente || 'manual', // manual, whatsapp, scraping
    verificado: data.verificado || false,
    fecha: new Date().toISOString(),
    // Datos de ubicación de la tienda
    lat: data.lat || null,
    lon: data.lon || null,
    departamento: data.departamento || null,
    distrito: data.distrito || null,
  };

  const docRef = await db.collection('precios_historicos').add(precio);

  // Actualizar precio actual en la tienda
  await db.collection('tiendas_comunidad').doc(data.tiendaId).update({
    [`preciosActuales.${data.producto}`]: {
      precio: precio.precio,
      unidad: precio.unidad,
      fecha: precio.fecha,
    },
    ultimaActualizacion: precio.fecha,
  });

  return res.status(201).json({
    id: docRef.id,
    ...precio,
    mensaje: 'Precio guardado exitosamente',
  });
}

// ── Actualizar precio ──
async function actualizarPrecio(req, res) {
  const { id, ...data } = req.body;

  if (!id) return res.status(400).json({ error: 'ID requerido' });

  const updateData = {};
  if (data.precio !== undefined) updateData.precio = parseFloat(data.precio);
  if (data.notas !== undefined) updateData.notas = data.notas;
  if (data.verificado !== undefined) updateData.verificado = data.verificado;
  updateData.actualizadoEn = new Date().toISOString();

  await db.collection('precios_historicos').doc(id).update(updateData);

  return res.status(200).json({ id, ...updateData });
}

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
