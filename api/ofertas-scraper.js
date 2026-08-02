/**
 * api/ofertas-scraper.js — Agente que busca ofertas en tiendas web
 *
 * Scraping de tiendas agrícolas conocidas: busca "ofertas", "descuentos", "promociones"
 * Cachea resultados en memoria (se actualiza cada 6 horas)
 *
 * GET: ?lat=-6.38&lon=-78.82&cultivo=papa
 * Returns: { ofertas: [...], tiendas: [...], ultimaActualizacion }
 */

// ── Tiendas agrícolas conocidas con URLs de ofertas ──
const TIENDAS_FONT = [
  {
    nombre: 'AgroInsumos Sullana',
    url: 'https://www.google.com/search?q=agroinsumos+sullana+ofertas+descuentos+insumos+agricolas',
    whatsapp: '51945123456',
    facebook: 'agroinsumossullana',
    region: 'Piura',
    lat: -4.88, lon: -80.69,
  },
  {
    nombre: 'La Favorita Chiclayo',
    url: 'https://www.google.com/search?q=la+favorita+chiclayo+ofertas+fertilizantes+insumos',
    whatsapp: '51944789123',
    facebook: 'lafavoritachiclayo',
    region: 'Lambayeque',
    lat: -6.76, lon: -79.84,
  },
  {
    nombre: 'AgroCajamarca',
    url: 'https://www.google.com/search?q=agrocajamarca+ofertas+descuentos+semillas+fertilizantes',
    whatsapp: '51941234567',
    facebook: 'agrocajamarca',
    region: 'Cajamarca',
    lat: -7.15, lon: -78.52,
  },
  {
    nombre: 'AgroCutervo',
    url: 'https://www.google.com/search?q=agrocutervo+ofertas+mancozeb+urea+descuento',
    whatsapp: '51941345678',
    facebook: 'agrocutervo',
    region: 'Cajamarca',
    lat: -6.37, lon: -78.82,
  },
  {
    nombre: 'AgroIca',
    url: 'https://www.google.com/search?q=agroica+ofertas+fertilizantes+semillas+ica+descuento',
    whatsapp: '51943123456',
    facebook: 'agroica',
    region: 'Ica',
    lat: -14.07, lon: -75.73,
  },
  {
    nombre: 'AgroHuancayo',
    url: 'https://www.google.com/search?q=agrohuancayo+ofertas+fertilizantes+papa+descuento',
    whatsapp: '51942234567',
    facebook: 'agrohuancayo',
    region: 'Junín',
    lat: -12.07, lon: -75.22,
  },
];

// ── Productos comunes agrícolas ──
const PRODUCTOS_AGRICOLAS = [
  'urea', 'fosfato', 'mancozeb', 'clorotalonil', 'glifosato',
  'imidacloprid', 'cipermetrina', 'abono', 'estiércol',
  'semilla papa', 'semilla maíz', 'semilla arándano',
  'fertilizante', 'fungicida', 'insecticida', 'herbicida',
  'goteo', 'riego', 'pala', 'azadón', 'manguera',
];

// ── Cache en memoria (se actualiza cada 6 horas) ──
let cacheOfertas = null;
let cacheTimestamp = null;
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 horas

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

// ── Detectar ofertas en texto ──
function detectarOfertas(texto, tienda) {
  const ofertas = [];
  const textoLower = texto.toLowerCase();

  // Patrones de ofertas
  const patrones = [
    /(?:oferta|descuento|promo|rebaja|baja[zs]\s+precio|precio\s+especial|liquidaci[oó]n|happy\s*hour|2x1|3x2|10%\s*off|20%\s*off|30%\s*off|50%\s*off)/gi,
    /(?:desde\s+S\/?\s*\d+|por\s+S\/?\s*\d+|a\s+precio\s+de\s+S\/?\s*\d+)/gi,
    /(?:saco|bulto|kg|litro|gal[oó]n)\s*(?:de|con)?\s*(?:\d+\s*)?(?:descuento|oferta|promo)/gi,
  ];

  for (const patron of patrones) {
    const matches = texto.match(patron);
    if (matches) {
      for (const match of matches) {
        // Buscar producto relacionado
        const productoDetectado = PRODUCTOS_AGRICOLAS.find(p =>
          textoLower.includes(p.toLowerCase())
        ) || 'insumo agrícola';

        // Extraer precio si existe
        const precioMatch = texto.match(/S\/?\s*(\d+(?:\.\d+)?)/);
        const precio = precioMatch ? parseFloat(precioMatch[1]) : null;

        ofertas.push({
          tienda: tienda.nombre,
          producto: productoDetectado,
          descuento: match,
          precio: precio,
          region: tienda.region,
          whatsapp: tienda.whatsapp,
          facebook: tienda.facebook,
          lat: tienda.lat,
          lon: tienda.lon,
          fechaDetectada: new Date().toISOString(),
          fuente: 'scraping',
        });
      }
    }
  }

  return ofertas;
}

// ── Scraping de Google Search (resultados de ofertas) ──
async function scrapingGoogle(tienda) {
  try {
    const res = await fetch(tienda.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'es-PE,es;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return [];
    const html = await res.text();

    // Extraer snippets de resultados
    const snippets = [];
    const snippetRegex = /<span[^>]*>([^<]{20,200})<\/span>/gi;
    let match;
    while ((match = snippetRegex.exec(html)) !== null) {
      const text = match[1].replace(/<[^>]+>/g, '').trim();
      if (text.length > 20) snippets.push(text);
    }

    // Buscar ofertas en snippets
    const ofertas = [];
    for (const snippet of snippets.slice(0, 20)) {
      const ofertasDetectadas = detectarOfertas(snippet, tienda);
      ofertas.push(...ofertasDetectadas);
    }

    return ofertas;
  } catch {
    return [];
  }
}

// ── Scraping de Facebook público (posts recientes) ──
async function scrapingFacebook(tienda) {
  if (!tienda.facebook) return [];
  try {
    const url = `https://m.facebook.com/${tienda.facebook}/posts/`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept-Language': 'es-PE,es;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];
    const html = await res.text();

    // Extraer texto de posts
    const posts = [];
    const postRegex = /<div[^>]*data-ad-preview="message"[^>]*>([\s\S]*?)<\/div>/gi;
    let match;
    while ((match = postRegex.exec(html)) !== null) {
      const text = match[1].replace(/<[^>]+>/g, '').trim();
      if (text.length > 10) posts.push(text);
    }

    // Buscar ofertas en posts
    const ofertas = [];
    for (const post of posts.slice(0, 10)) {
      const ofertasDetectadas = detectarOfertas(post, tienda);
      ofertas.push(...ofertasDetectadas);
    }

    return ofertas;
  } catch {
    return [];
  }
}

// ── Scraping principal: todas las tiendas ──
async function scrapingCompleto() {
  console.log('🔄 Iniciando scraping de ofertas...');
  const todasLasOfertas = [];

  for (const tienda of TIENDAS_FONT) {
    try {
      const [ofertasGoogle, ofertasFB] = await Promise.all([
        scrapingGoogle(tienda),
        scrapingFacebook(tienda),
      ]);
      todasLasOfertas.push(...ofertasGoogle, ...ofertasFB);
      console.log(`✅ ${tienda.nombre}: ${ofertasGoogle.length + ofertasFB.length} ofertas`);
    } catch (e) {
      console.warn(`⚠️ Error en ${tienda.nombre}:`, e.message);
    }
  }

  // Deduplicar ofertas
  const ofertasUnicas = [];
  const seen = new Set();
  for (const o of todasLasOfertas) {
    const key = `${o.tienda}-${o.producto}-${o.descuento}`;
    if (!seen.has(key)) {
      seen.add(key);
      ofertasUnicas.push(o);
    }
  }

  console.log(`📊 Total ofertas únicas: ${ofertasUnicas.length}`);
  return ofertasUnicas;
}

// ── Generar ofertas de ejemplo (fallback cuando no hay scraping) ──
function generarOfertasEjemplo() {
  return [
    { tienda: 'AgroCutervo', producto: 'Mancozeb 80%', descuento: 'Oferta especial', precio: 78, region: 'Cajamarca', whatsapp: '51941345678', facebook: 'agrocutervo', lat: -6.37, lon: -78.82, fechaDetectada: new Date().toISOString(), fuente: 'ejemplo' },
    { tienda: 'La Favorita Chiclayo', producto: 'Urea 46-0-0', descuento: '20% off sacos grandes', precio: 135, region: 'Lambayeque', whatsapp: '51944789123', facebook: 'lafavoritachiclayo', lat: -6.76, lon: -79.84, fechaDetectada: new Date().toISOString(), fuente: 'ejemplo' },
    { tienda: 'AgroIca', producto: 'Fosfato', descuento: 'Precio especial temporada', precio: 160, region: 'Ica', whatsapp: '51943123456', facebook: 'agroica', lat: -14.07, lon: -75.73, fechaDetectada: new Date().toISOString(), fuente: 'ejemplo' },
    { tienda: 'AgroHuancayo', producto: 'Semilla papa', descuento: 'Promo pre-siembra', precio: 270, region: 'Junín', whatsapp: '51942234567', facebook: 'agrohuancayo', lat: -12.07, lon: -75.22, fechaDetectada: new Date().toISOString(), fuente: 'ejemplo' },
    { tienda: 'AgroInsumos Sullana', producto: 'Glifosato 48%', descuento: '3x2 en 5 litros', precio: 40, region: 'Piura', whatsapp: '51945123456', facebook: 'agroinsumossullana', lat: -4.88, lon: -80.69, fechaDetectada: new Date().toISOString(), fuente: 'ejemplo' },
  ];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  const url = new URL(req.url, 'http://localhost');
  const lat = parseFloat(url.searchParams.get('lat')) || null;
  const lon = parseFloat(url.searchParams.get('lon')) || null;
  const cultivo = url.searchParams.get('cultivo') || '';
  const forzar = url.searchParams.get('forzar') === 'true';

  try {
    // Verificar cache
    const ahora = Date.now();
    if (!forzar && cacheOfertas && cacheTimestamp && (ahora - cacheTimestamp) < CACHE_DURATION) {
      // Usar cache
    } else {
      // Scraping completo
      cacheOfertas = await scrapingCompleto();
      if (cacheOfertas.length === 0) {
        cacheOfertas = generarOfertasEjemplo();
      }
      cacheTimestamp = ahora;
    }

    let ofertas = cacheOfertas;

    // Filtrar por región cercana si hay coordenadas
    if (lat && lon) {
      ofertas = ofertas
        .map(o => ({
          ...o,
          distanciaKm: Math.round(haversine(lat, lon, o.lat, o.lon) * 10) / 10,
        }))
        .filter(o => o.distanciaKm <= 100)
        .sort((a, b) => a.distanciaKm - b.distanciaKm);
    }

    // Filtrar por cultivo si se especifica
    if (cultivo) {
      const cultivoLower = cultivo.toLowerCase();
      ofertas = ofertas.filter(o =>
        o.producto.toLowerCase().includes(cultivoLower) ||
        cultivoLower.includes(o.producto.toLowerCase()) ||
        o.producto.toLowerCase().includes('insumo')
      );
    }

    return res.status(200).json({
      ofertas,
      total: ofertas.length,
      tiendas: TIENDAS_FONT.map(t => ({
        nombre: t.nombre,
        region: t.region,
        whatsapp: t.whatsapp,
        facebook: t.facebook,
      })),
      ultimaActualizacion: cacheTimestamp ? new Date(cacheTimestamp).toISOString() : null,
      cacheHoras: Math.round((ahora - (cacheTimestamp || 0)) / (60 * 60 * 1000) * 10) / 10,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Ofertas scraper error:', error);
    return res.status(500).json({ error: error.message });
  }
}
