/**
 * api/tiendas-comunidad.js — Gestión de tiendas registradas por la comunidad
 *
 * GET: Buscar tiendas cercanas
 * POST: Registrar nueva tienda
 * PUT: Actualizar tienda
 *
 * GET: ?lat=-6.38&lon=-78.82&radio=50&especialidad=fertilizantes
 * POST: { nombre, whatsapp, departamento, distrito, ... }
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ── Inicializar Firebase Admin ──
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      return await buscarTiendas(req, res);
    } else if (req.method === 'POST') {
      return await registrarTienda(req, res);
    } else if (req.method === 'PUT') {
      return await actualizarTienda(req, res);
    } else {
      return res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Tiendas comunidad error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ── Buscar tiendas ──
async function buscarTiendas(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const lat = parseFloat(url.searchParams.get('lat')) || null;
  const lon = parseFloat(url.searchParams.get('lon')) || null;
  const radio = Math.min(parseInt(url.searchParams.get('radio')) || 50, 200);
  const departamento = url.searchParams.get('departamento') || null;
  const especialidad = url.searchParams.get('especialidad') || null;
  const busqueda = url.searchParams.get('q')?.toLowerCase() || null;

  let query = db.collection('tiendas_comunidad')
    .where('activa', '==', true);

  // Filtrar por departamento
  if (departamento) {
    query = query.where('departamento', '==', departamento);
  }

  const snapshot = await query.get();
  let tiendas = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));

  // Filtrar por especialidad
  if (especialidad) {
    tiendas = tiendas.filter(t =>
      t.especialidades?.some(e => e.toLowerCase().includes(especialidad.toLowerCase()))
    );
  }

  // Filtrar por búsqueda de texto
  if (busqueda) {
    tiendas = tiendas.filter(t =>
      t.nombre?.toLowerCase().includes(busqueda) ||
      t.distrito?.toLowerCase().includes(busqueda) ||
      t.descripcion?.toLowerCase().includes(busqueda)
    );
  }

  // Calcular distancia y filtrar por radio
  if (lat && lon) {
    tiendas = tiendas
      .map(t => ({
        ...t,
        distanciaKm: t.lat && t.lon
          ? Math.round(haversine(lat, lon, t.lat, t.lon) * 10) / 10
          : null,
      }))
      .filter(t => t.distanciaKm === null || t.distanciaKm <= radio)
      .sort((a, b) => (a.distanciaKm || 999) - (b.distanciaKm || 999));
  }

  return res.status(200).json({
    tiendas,
    total: tiendas.length,
    timestamp: new Date().toISOString(),
  });
}

// ── Registrar tienda ──
async function registrarTienda(req, res) {
  const data = req.body;

  if (!data.nombre?.trim()) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }
  if (!data.whatsapp?.trim()) {
    return res.status(400).json({ error: 'El WhatsApp es obligatorio' });
  }

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
    propietarioEmail: data.propietarioEmail || null,
    fuente: 'comunidad',
    verificada: false,
    activa: true,
    ventas: 0,
    ultimaConsulta: null,
    createdAt: new Date().toISOString(),
  };

  const docRef = await db.collection('tiendas_comunidad').add(tienda);

  return res.status(201).json({
    id: docRef.id,
    ...tienda,
    mensaje: 'Tienda registrada exitosamente. Será verificada por nuestro equipo.',
  });
}

// ── Actualizar tienda ──
async function actualizarTienda(req, res) {
  const { id, ...data } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'ID de tienda requerido' });
  }

  const updateData = {};
  if (data.nombre) updateData.nombre = data.nombre;
  if (data.direccion !== undefined) updateData.direccion = data.direccion;
  if (data.distrito !== undefined) updateData.distrito = data.distrito;
  if (data.departamento !== undefined) updateData.departamento = data.departamento;
  if (data.lat !== undefined) updateData.lat = data.lat;
  if (data.lon !== undefined) updateData.lon = data.lon;
  if (data.whatsapp) {
    updateData.whatsapp = data.whatsapp.replace(/\D/g, '');
    updateData.whatsappFormateado = `51${data.whatsapp.replace(/\D/g, '')}`;
  }
  if (data.facebook !== undefined) updateData.facebook = data.facebook;
  if (data.instagram !== undefined) updateData.instagram = data.instagram;
  if (data.web !== undefined) updateData.web = data.web;
  if (data.especialidades) updateData.especialidades = data.especialidades;
  if (data.horario !== undefined) updateData.horario = data.horario;
  if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
  if (data.ventas !== undefined) updateData.ventas = data.ventas;
  if (data.ultimaConsulta !== undefined) updateData.ultimaConsulta = data.ultimaConsulta;

  updateData.actualizadoEn = new Date().toISOString();

  await db.collection('tiendas_comunidad').doc(id).update(updateData);

  return res.status(200).json({
    id,
    ...updateData,
    mensaje: 'Tienda actualizada',
  });
}
