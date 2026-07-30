import * as cheerio from 'cheerio';

const RSS_FEEDS = [
  {
    name: 'AgroPerú',
    url: 'https://agroperu.pe/feed/',
    fuente: 'AgroPerú'
  },
  {
    name: 'Rural',
    url: 'https://rural.com.pe/feed/',
    fuente: 'Rural'
  },
  {
    name: 'La República - Campo',
    url: 'https://larepublica.pe/rss/rss-campo.xml',
    fuente: 'La República'
  },
  {
    name: 'El Comercio - Agrícola',
    url: 'https://elcomercio.pe/rss/economia/agro/',
    fuente: 'El Comercio'
  },
  {
    name: 'Gestión - Campo',
    url: 'https://gestion.pe/rss/rss-campo.xml',
    fuente: 'Gestión'
  }
];

const KEYWORDS_AGRICOLAS = [
  'agricultura', 'agro', 'campo', 'cultivo', 'cosecha', 'siembra',
  'plaga', 'enfermedad', 'fungicida', 'insecticida', 'herbicida',
  'fertilizante', 'riego', 'suelo', 'nutrientes',
  'papa', 'maíz', 'arroz', 'trigo', 'cebada',
  'palta', 'aguacate', 'uva', 'fresa', 'frutilla',
  'tomate', 'cebolla', 'zanahoria', 'lechuga', 'repollo',
  'café', 'cacao', 'caña', 'algodón',
  'ganadería', 'vacuno', 'ovino', 'porcino', 'avicola',
  'SENAMHI', 'clima', 'lluvia', 'sequía', 'helada',
  'SENASA', 'fitosanitario', 'cuarentena',
  'INIA', 'investigación', 'tecnología',
  'exportación', 'mercado', 'precio', 'comercialización',
  'orgánico', 'sostenible', 'agroecología'
];

/**
 * Parsea RSS XML y extrae items
 */
function parseRSS(xml, fuente) {
  const $ = cheerio.load(xml, { xml: true });
  const items = [];
  
  $('item, entry').each((i, el) => {
    const title = $(el).find('title').first().text().trim();
    const link = $(el).find('link').first().text().trim() || 
                 $(el).find('link').attr('href') || '';
    const pubDate = $(el).find('pubDate, published, updated').first().text().trim();
    const description = $(el).find('description, summary, content\\:encoded').first().text().trim();
    const category = $(el).find('category').first().text().trim();
    
    // Limpiar HTML de la descripción
    const cleanDescription = description
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
    
    if (title && title.length > 5) {
      items.push({
        titulo: title.substring(0, 200),
        fecha: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        resumen: cleanDescription.substring(0, 500),
        enlace: link,
        fuente: fuente,
        categoria: category || 'general'
      });
    }
  });
  
  return items;
}

/**
 * Verifica si una noticia es relevante para agricultura
 */
function esNoticiaAgricola(titulo, resumen) {
  const texto = (titulo + ' ' + resumen).toLowerCase();
  
  return KEYWORDS_AGRICOLAS.some(keyword => 
    texto.includes(keyword.toLowerCase())
  );
}

/**
 * Clasifica el tipo de noticia agrícola
 */
function clasificarNoticia(titulo, resumen) {
  const texto = (titulo + ' ' + resumen).toLowerCase();
  
  if (texto.includes('plaga') || texto.includes('enfermedad') || texto.includes('foco')) {
    return 'alerta_fitosanitaria';
  }
  if (texto.includes('clima') || texto.includes('lluvia') || texto.includes('helada') || texto.includes('sequía')) {
    return 'alerta_climatica';
  }
  if (texto.includes('precio') || texto.includes('mercado') || texto.includes('exportación')) {
    return 'mercado';
  }
  if (texto.includes('tecnología') || texto.includes('investigación') || texto.includes('innovación')) {
    return 'tecnologia';
  }
  if (texto.includes('subsidio') || texto.includes('crédito') || texto.includes('financiamiento')) {
    return 'financiamiento';
  }
  if (texto.includes('capacitación') || texto.includes('taller') || texto.includes('curso')) {
    return 'capacitacion';
  }
  
  return 'noticia';
}

/**
 * Obtiene noticias de un feed RSS con retry
 */
async function fetchRSSFeed(feed, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(feed.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const xml = await response.text();
      return parseRSS(xml, feed.fuente);
      
    } catch (error) {
      console.log(`[RSS] Intento ${attempt + 1} fallido para ${feed.name}: ${error.message}`);
      if (attempt === retries) {
        return [];
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  return [];
}

/**
 * Obtiene todas las noticias agrícolas de RSS feeds
 */
export async function scrapeAgriculturalNews() {
  console.log('[RSS] Iniciando scraping de feeds agrícolas...');
  
  const allNews = [];
  
  // Ejecutar todos los feeds en paralelo
  const results = await Promise.allSettled(
    RSS_FEEDS.map(feed => fetchRSSFeed(feed))
  );
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      allNews.push(...result.value);
    } else {
      console.log(`[RSS] Error en feed ${RSS_FEEDS[index].name}:`, result.reason);
    }
  });
  
  // Filtrar solo noticias agrícolas relevantes
  const agriculturalNews = allNews.filter(news => 
    esNoticiaAgricola(news.titulo, news.resumen)
  );
  
  // Clasificar cada noticia
  const classifiedNews = agriculturalNews.map(news => ({
    ...news,
    tipo: clasificarNoticia(news.titulo, news.resumen),
    fecha: new Date(news.fecha)
  }));
  
  // Ordenar por fecha (más reciente primero)
  classifiedNews.sort((a, b) => b.fecha - a.fecha);
  
  console.log(`[RSS] Obtenidas ${classifiedNews.length} noticias agrícolas de ${allNews.length} totales`);
  
  return classifiedNews.slice(0, 30);
}

/**
 * Busca noticias por región (basado en keywords)
 */
export function filterNewsByRegion(news, region) {
  const regionLower = region.toLowerCase();
  
  const keywordsRegion = {
    'la libertad': ['trujillo', 'chiclayo', 'viru', 'la libertad'],
    'piura': ['piura', 'tumbes', 'sullana'],
    'lambayeque': ['chiclayo', 'ferreñafe', 'lambayeque'],
    'cajamarca': ['cajamarca', 'cutervo'],
    'san martin': ['san martin', 'moyobamba', 'tarapoto'],
    'junín': ['junín', 'huancayo', 'tarma', 'satipo'],
    'cusco': ['cusco', 'calca', 'urubamba'],
    'arequipa': ['arequipa', 'mollendo'],
    'puno': ['puno', 'juliaca'],
    'loreto': ['loreto', 'iquitos']
  };
  
  const keywords = keywordsRegion[regionLower] || [regionLower];
  
  return news.filter(n => {
    const texto = (n.titulo + ' ' + n.resumen).toLowerCase();
    return keywords.some(kw => texto.includes(kw));
  });
}

/**
 * Busca noticias por cultivo
 */
export function filterNewsByCrop(news, cultivo) {
  const cultivoLower = cultivo.toLowerCase();
  
  return news.filter(n => {
    const texto = (n.titulo + ' ' + n.resumen).toLowerCase();
    return texto.includes(cultivoLower);
  });
}
