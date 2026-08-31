/**
 * Ofertas de tiendas registradas en Agrilux (tiendas_comunidad + precios_historicos).
 * Intenta API server-side; si no disponible, usa Supabase directo.
 */
import { supabase } from './supabase';

const PRODUCTOS = {
  urea: 'Urea 46-0-0',
  fosfato: 'Fosfato 15-15-15',
  mancozeb: 'Mancozeb 80%',
  clorotalonil: 'Clorotalonil 72%',
  glifosato: 'Glifosato 48%',
  abono: 'Abono orgánico',
  semilla_papa: 'Semilla papa',
  semilla_maiz: 'Semilla maíz',
};

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function filtrarOfertas(ofertas, { lat, lon, cultivo }) {
  let result = ofertas;

  if (lat && lon) {
    result = result
      .map((o) => ({
        ...o,
        distanciaKm: o.lat && o.lon
          ? Math.round(haversine(lat, lon, o.lat, o.lon) * 10) / 10
          : null,
      }))
      .filter((o) => o.distanciaKm === null || o.distanciaKm <= 100)
      .sort((a, b) => (a.distanciaKm || 999) - (b.distanciaKm || 999));
  }

  if (cultivo) {
    result = result.filter((o) =>
      o.producto?.toLowerCase().includes(cultivo.toLowerCase()),
    );
  }

  return result;
}

async function cargarOfertasFirestore({ lat, lon, cultivo = '' } = {}) {
  const ofertas = [];

  try {
    const { data: preciosData, error: preciosError } = await supabase.from('precios_historicos').select('*').order('fecha', { ascending: false }).limit(100);
    if (preciosError) throw preciosError;

    const tiendaIds = [...new Set((preciosData || []).map((d) => d.tiendaId).filter(Boolean))];
    const tiendasMap = {};
    await Promise.all(tiendaIds.map(async (id) => {
      const { data } = await supabase.from('tiendas_comunidad').select('*').eq('id', id).single();
      if (data && data.propietarioId) tiendasMap[id] = data;
    }));

    for (const p of (preciosData || [])) {
      const tienda = tiendasMap[p.tiendaId];
      ofertas.push({
        tienda: p.tiendaNombre || tienda?.nombre || 'Tienda',
        producto: p.productoNombre || PRODUCTOS[p.producto] || p.producto,
        precio: p.precio,
        region: p.departamento || tienda?.departamento || '',
        whatsapp: tienda?.whatsapp || null,
        facebook: tienda?.facebook || null,
        lat: p.lat || tienda?.lat || null,
        lon: p.lon || tienda?.lon || null,
        fecha: p.fecha,
        descuento: null,
      });
    }
  } catch {
    // Sin datos precios_historicos — seguir con tiendas
  }

  if (ofertas.length === 0) {
    try {
      const { data: tiendasData, error } = await supabase.from('tiendas_comunidad').select('*').eq('activa', true).limit(50);
      if (error) throw error;

      for (const tienda of (tiendasData || [])) {
        if (!tienda.propietarioId) continue;
        const preciosActuales = tienda.preciosActuales || {};
        const entries = Object.entries(preciosActuales);

        if (entries.length === 0) {
          ofertas.push({
            tienda: tienda.nombre,
            producto: tienda.especialidades?.[0] || 'Insumos agrícolas',
            precio: null,
            region: tienda.departamento || '',
            whatsapp: tienda.whatsapp || null,
            facebook: tienda.facebook || null,
            lat: tienda.lat || null,
            lon: tienda.lon || null,
            fecha: tienda.createdAt || null,
            descuento: null,
          });
          continue;
        }

        for (const [producto, info] of entries) {
          ofertas.push({
            tienda: tienda.nombre,
            producto: PRODUCTOS[producto] || producto,
            precio: info?.precio ?? null,
            region: tienda.departamento || '',
            whatsapp: tienda.whatsapp || null,
            facebook: tienda.facebook || null,
            lat: tienda.lat || null,
            lon: tienda.lon || null,
            fecha: info?.fecha || tienda.ultimaActualizacion || null,
            descuento: null,
          });
        }
      }
    } catch (e) {
      console.warn('Supabase ofertas fallback:', e.message);
    }
  }

  const filtradas = filtrarOfertas(ofertas, { lat, lon, cultivo });
  return {
    ofertas: filtradas,
    total: filtradas.length,
    timestamp: new Date().toISOString(),
    source: 'supabase-client',
  };
}

export async function cargarOfertasRegistradas({ lat, lon, cultivo = '' } = {}) {
  const params = new URLSearchParams({ type: 'ofertas' });
  if (lat) params.append('lat', lat);
  if (lon) params.append('lon', lon);
  if (cultivo) params.append('cultivo', cultivo);

  try {
    const res = await fetch(`/api/tiendas?${params}`);
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.firebase_ok !== false && data.supabase_ok !== false) {
      return {
        ofertas: data.ofertas || [],
        total: data.total || 0,
        timestamp: data.timestamp || null,
        source: 'api',
      };
    }
  } catch {
    // API no disponible — fallback abajo
  }

  return cargarOfertasFirestore({ lat, lon, cultivo });
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
