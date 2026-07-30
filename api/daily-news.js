import { scrapeSenasaAlerts, getSenasaAlertsByRegion } from './scrapers/senasa-scraper.js';
import { getAgriculturalPublications } from './scrapers/inia-minagri-scraper.js';
import { scrapeAgriculturalNews, filterNewsByRegion, filterNewsByCrop } from './scrapers/rss-scraper.js';

/**
 * API Endpoint: /api/daily-news
 * 
 * GET /api/daily-news?region=la+libertad&cultivo=papa
 * 
 * Retorna noticias agrícolas diarias de:
 * - SENASA (alertas fitosanitarias)
 * - INIA (publicaciones técnicas)
 * - Minagri (noticias y convocatorias)
 * - RSS feeds (noticias generales)
 */

// Cache simple en memoria (en producción usar Firestore o Redis)
let newsCache = null;
let lastCacheTime = 0;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutos

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }
  
  try {
    const { region, cultivo, force } = req.query;
    
    // Verificar cache (a menos que se pida forzar)
    const now = Date.now();
    if (!force && newsCache && (now - lastCacheTime) < CACHE_DURATION) {
      console.log('[Daily News] Usando cache...');
      return returnFilteredNews(newsCache, region, cultivo, res);
    }
    
    console.log('[Daily News] Obteniendo noticias frescas...');
    
    // Ejecutar todos los scrapers en paralelo
    const [senasaAlerts, publicaciones, rssNews] = await Promise.allSettled([
      scrapeSenasaAlerts(),
      getAgriculturalPublications(),
      scrapeAgriculturalNews()
    ]);
    
    // Combinar resultados
    const allNews = [];
    
    if (senasaAlerts.status === 'fulfilled') {
      allNews.push(...senasaAlerts.value);
    } else {
      console.log('[Daily News] Error en SENASA:', senasaAlerts.reason);
    }
    
    if (publicaciones.status === 'fulfilled') {
      allNews.push(...publicaciones.value);
    } else {
      console.log('[Daily News] Error en INIA/Minagri:', publicaciones.reason);
    }
    
    if (rssNews.status === 'fulfilled') {
      allNews.push(...rssNews.value);
    } else {
      console.log('[Daily News] Error en RSS:', rssNews.reason);
    }
    
    // Eliminar duplicados por título
    const uniqueNews = eliminarDuplicados(allNews);
    
    // Ordenar por fecha
    uniqueNews.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    
    // Actualizar cache
    newsCache = uniqueNews;
    lastCacheTime = now;
    
    console.log(`[Daily News] Total noticias: ${uniqueNews.length}`);
    
    return returnFilteredNews(uniqueNews, region, cultivo, res);
    
  } catch (error) {
    console.error('[Daily News] Error general:', error);
    return res.status(500).json({ 
      error: 'Error al obtener noticias',
      mensaje: error.message 
    });
  }
}

function returnFilteredNews(allNews, region, cultivo, res) {
  let filtered = [...allNews];
  
  // Filtrar por región si se especifica
  if (region) {
    const regionNews = filterNewsByRegion(filtered, region);
    if (regionNews.length > 0) {
      filtered = regionNews;
    }
  }
  
  // Filtrar por cultivo si se especifica
  if (cultivo) {
    const cropNews = filterNewsByCrop(filtered, cultivo);
    if (cropNews.length > 0) {
      filtered = cropNews;
    }
  }
  
  // Limitar a 20 noticias
  filtered = filtered.slice(0, 20);
  
  // Calcular estadísticas
  const stats = {
    total: filtered.length,
    porFuente: {},
    porTipo: {}
  };
  
  filtered.forEach(n => {
    stats.porFuente[n.fuente] = (stats.porFuente[n.fuente] || 0) + 1;
    stats.porTipo[n.tipo] = (stats.porTipo[n.tipo] || 0) + 1;
  });
  
  return res.status(200).json({
    success: true,
    fecha: new Date().toISOString(),
    noticias: filtered,
    stats,
    filtros: { region: region || null, cultivo: cultivo || null }
  });
}

function eliminarDuplicados(news) {
  const seen = new Set();
  
  return news.filter(n => {
    const key = n.titulo.toLowerCase().substring(0, 50);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
