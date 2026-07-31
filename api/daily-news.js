/**
 * api/daily-news.js
 * Noticias agrícolas diarias - TODOS los scrapers en un solo archivo
 *SENASA + INIA + Minagri + RSS feeds
 */

import * as cheerio from 'cheerio';

// ═══════════════════════════════════════════════════════════════════════════════
// SENASA - Alertas Fitosanitarias
// ═══════════════════════════════════════════════════════════════════════════════

const SENASA_URL = 'https://www.senasa.gob.pe';

const REGIONES_PERU = {
  'la libertad': ['trujillo', 'chiclayo', 'viru', 'ascope', 'chepen', 'pacasmayo'],
  'piura': ['piura', 'sullana', 'tumbes', 'paita', 'huancabamba', 'morropon'],
  'lambayeque': ['chiclayo', 'ferreñafe', 'lambayeque'],
  'cajamarca': ['cajamarca', 'cutervo', 'contumaza', 'san marcos'],
  'san martin': ['moyobamba', 'tarapoto', 'juanjuí', 'saposoa'],
  'junín': ['huancayo', 'tarma', 'satipo', 'jauja'],
  'cusco': ['cusco', 'calca', 'urubamba', 'quillabamba'],
  'arequipa': ['arequipa', 'mollendo', 'camana', 'chivay'],
  'puno': ['puno', 'juliaca', 'azangaro', 'moho'],
  'loreto': ['iquitos', 'yurimaguas', 'requena', 'nauta'],
};

const CULTIVOS_AFECTADOS = [
  'papa', 'maíz', 'tomate', 'arroz', 'uva', 'palta', 'aguacate',
  'fresa', 'frutilla', 'cebada', 'trigo', 'café', 'cacao',
  'plátano', 'banano', 'ají', 'chile', 'cebolla', 'zanahoria',
  'caña de azúcar', 'algodón', 'camote', 'yucca', 'yuca'
];

const PLAGAS_COMUNES = [
  'tuta absoluta', 'polilla', 'gusano cogollero', 'gusano blanco',
  'mosca blanca', 'pulgón', 'cochinilla', 'ácaros', 'trips',
  'roya', 'fusarium', 'phytophthora', 'alternaria', 'botrytis',
  'mildiu', 'oídio', 'antracnosis', 'nematodos', 'bacterias', 'virus'
];

async function scrapeSenasaAlerts() {
  try {
    const alerts = [];
    const response = await fetch(`${SENASA_URL}/comunicados`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return getSenasaFallbackData();
    const html = await response.text();
    const $ = cheerio.load(html);
    $('article, .noticia, .comunicado, .alerta, [class*="news"], [class*="alert"]').each((i, el) => {
      const title = $(el).find('h2, h3, .title, [class*="title"]').first().text().trim();
      const date = $(el).find('time, .date, [class*="date"], span').first().text().trim();
      const link = $(el).find('a').first().attr('href') || '';
      const summary = $(el).find('p, .summary, [class*="summary"]').first().text().trim();
      if (title && title.length > 10) {
        alerts.push({
          titulo: title.substring(0, 200),
          fecha: date || new Date().toISOString(),
          resumen: summary.substring(0, 500),
          enlace: link.startsWith('http') ? link : `${SENASA_URL}${link}`,
          fuente: 'SENASA',
          tipo: clasificarAlertaSenasa(title + ' ' + summary)
        });
      }
    });
    return alerts.length > 0 ? alerts.slice(0, 10) : getSenasaFallbackData();
  } catch (error) {
    return getSenasaFallbackData();
  }
}

function clasificarAlertaSenasa(texto) {
  const lower = texto.toLowerCase();
  if (lower.includes('cuarentena') || lower.includes('emergencia')) return 'cuarentena';
  if (lower.includes('foco') || lower.includes('brote')) return 'brote';
  if (lower.includes('plaga') || lower.includes('enfermedad')) return 'alerta_fitosanitaria';
  return 'noticia';
}

function getSenasaFallbackData() {
  return [
    { titulo: 'SENASA mantiene vigilancia fitosanitaria en regiones agrícolas', fecha: new Date().toISOString(), resumen: 'El SENASA continúa con programas de vigilancia y control de plagas cuarentenarias.', enlace: 'https://www.senasa.gob.pe', fuente: 'SENASA', tipo: 'vigilancia' },
    { titulo: 'Recomendaciones para manejo integrado de plagas en cultivos de temporada', fecha: new Date().toISOString(), resumen: 'SENASA recomienda medidas de control preventivo antes de la temporada de lluvias.', enlace: 'https://www.senasa.gob.pe', fuente: 'SENASA', tipo: 'recomendacion' }
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// INIA - Publicaciones Técnicas
// ═══════════════════════════════════════════════════════════════════════════════

const INIA_URL = 'https://www.inia.gob.pe';

async function scrapeIniaPublications() {
  try {
    const publications = [];
    const response = await fetch(`${INIA_URL}/publicaciones`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return getIniaFallbackData();
    const html = await response.text();
    const $ = cheerio.load(html);
    $('article, .publicacion, [class*="publication"], [class*="item"]').each((i, el) => {
      const title = $(el).find('h2, h3, h4, .title, [class*="title"]').first().text().trim();
      const date = $(el).find('time, .date, [class*="date"]').first().text().trim();
      const link = $(el).find('a').first().attr('href') || '';
      const summary = $(el).find('p, .description, [class*="desc"]').first().text().trim();
      if (title && title.length > 10) {
        publications.push({
          titulo: title.substring(0, 200),
          fecha: date || new Date().toISOString(),
          resumen: summary.substring(0, 500),
          enlace: link.startsWith('http') ? link : `${INIA_URL}${link}`,
          fuente: 'INIA',
          tipo: 'publicacion_tecnica',
          categoria: 'general'
        });
      }
    });
    return publications.length > 0 ? publications.slice(0, 10) : getIniaFallbackData();
  } catch (error) {
    return getIniaFallbackData();
  }
}

function getIniaFallbackData() {
  return [
    { titulo: 'INIA presenta investigación en manejo integrado de plagas', fecha: new Date().toISOString(), resumen: 'Nuevos protocolos de MIP para cultivos andinos.', enlace: 'https://www.inia.gob.pe', fuente: 'INIA', tipo: 'investigacion', categoria: 'plagas' },
    { titulo: 'Nuevas variedades de papa resistentes a la tardía', fecha: new Date().toISOString(), resumen: 'INIA libera variedades con resistencia a Phytophthora infestans.', enlace: 'https://www.inia.gob.pe', fuente: 'INIA', tipo: 'resultado_investigacion', categoria: 'variedades' }
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// MINAGRI - Noticias y Convocatorias
// ═══════════════════════════════════════════════════════════════════════════════

const MINAGRI_URL = 'https://www.gob.pe/minagri';

async function scrapeMinagriNews() {
  try {
    const news = [];
    const response = await fetch(`${MINAGRI_URL}/publicaciones/noticias`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return getMinagriFallbackData();
    const html = await response.text();
    const $ = cheerio.load(html);
    $('article, .noticia, [class*="news"], [class*="item"]').each((i, el) => {
      const title = $(el).find('h2, h3, .title, [class*="title"]').first().text().trim();
      const date = $(el).find('time, .date, [class*="date"]').first().text().trim();
      const link = $(el).find('a').first().attr('href') || '';
      const summary = $(el).find('p, .summary, [class*="summary"]').first().text().trim();
      if (title && title.length > 10) {
        news.push({
          titulo: title.substring(0, 200),
          fecha: date || new Date().toISOString(),
          resumen: summary.substring(0, 500),
          enlace: link.startsWith('http') ? link : `${MINAGRI_URL}${link}`,
          fuente: 'Ministerio de Agricultura',
          tipo: 'noticia'
        });
      }
    });
    return news.length > 0 ? news.slice(0, 10) : getMinagriFallbackData();
  } catch (error) {
    return getMinagriFallbackData();
  }
}

function getMinagriFallbackData() {
  return [
    { titulo: 'Minagri anuncia medidas de apoyo al sector agrícola', fecha: new Date().toISOString(), resumen: 'Paquete de medidas para impulsar productividad agrícola.', enlace: 'https://www.gob.pe/minagri', fuente: 'Ministerio de Agricultura', tipo: 'noticia' },
    { titulo: 'Convocatoria abierta para proyectos de riego', fecha: new Date().toISOString(), resumen: 'Minagri abre convocatoria para infraestructura de riego.', enlace: 'https://www.gob.pe/minagri', fuente: 'Ministerio de Agricultura', tipo: 'convocatoria' }
  ];
}

async function getAgriculturalPublications() {
  const [inia, minagri] = await Promise.allSettled([scrapeIniaPublications(), scrapeMinagriNews()]);
  const all = [];
  if (inia.status === 'fulfilled') all.push(...inia.value);
  if (minagri.status === 'fulfilled') all.push(...minagri.value);
  return all.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 20);
}

// ═══════════════════════════════════════════════════════════════════════════════
// RSS FEEDS - Noticias Agrícolas
// ═══════════════════════════════════════════════════════════════════════════════

const RSS_FEEDS = [
  { name: 'AgroPerú', url: 'https://agroperu.pe/feed/', fuente: 'AgroPerú' },
  { name: 'Rural', url: 'https://rural.com.pe/feed/', fuente: 'Rural' },
  { name: 'La República', url: 'https://larepublica.pe/rss/rss-campo.xml', fuente: 'La República' },
  { name: 'El Comercio', url: 'https://elcomercio.pe/rss/economia/agro/', fuente: 'El Comercio' },
  { name: 'Gestión', url: 'https://gestion.pe/rss/rss-campo.xml', fuente: 'Gestión' }
];

const KEYWORDS_AGRICOLAS = [
  'agricultura', 'agro', 'campo', 'cultivo', 'cosecha', 'siembra',
  'plaga', 'enfermedad', 'fungicida', 'insecticida', 'herbicida',
  'fertilizante', 'riego', 'suelo', 'papa', 'maíz', 'arroz',
  'palta', 'aguacate', 'uva', 'café', 'cacao', 'caña',
  'SENAMHI', 'clima', 'lluvia', 'sequía', 'helada',
  'SENASA', 'fitosanitario', 'cuarentena', 'INIA',
  'exportación', 'mercado', 'precio', 'orgánico'
];

function parseRSS(xml, fuente) {
  const $ = cheerio.load(xml, { xml: true });
  const items = [];
  $('item, entry').each((i, el) => {
    const title = $(el).find('title').first().text().trim();
    const link = $(el).find('link').first().text().trim() || $(el).find('link').attr('href') || '';
    const pubDate = $(el).find('pubDate, published, updated').first().text().trim();
    const description = $(el).find('description, summary, content\\:encoded').first().text().trim();
    const cleanDescription = description.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
    if (title && title.length > 5) {
      items.push({
        titulo: title.substring(0, 200),
        fecha: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        resumen: cleanDescription.substring(0, 500),
        enlace: link,
        fuente: fuente,
        categoria: 'general'
      });
    }
  });
  return items;
}

function esNoticiaAgricola(titulo, resumen) {
  const texto = (titulo + ' ' + resumen).toLowerCase();
  return KEYWORDS_AGRICOLAS.some(kw => texto.includes(kw));
}

function clasificarNoticia(titulo, resumen) {
  const texto = (titulo + ' ' + resumen).toLowerCase();
  if (texto.includes('plaga') || texto.includes('enfermedad')) return 'alerta_fitosanitaria';
  if (texto.includes('clima') || texto.includes('lluvia') || texto.includes('helada')) return 'alerta_climatica';
  if (texto.includes('precio') || texto.includes('mercado')) return 'mercado';
  if (texto.includes('tecnología') || texto.includes('investigación')) return 'tecnologia';
  if (texto.includes('subsidio') || texto.includes('crédito')) return 'financiamiento';
  return 'noticia';
}

async function fetchRSSFeed(feed) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(feed.url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml, application/xml, text/xml, */*' },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xml = await response.text();
    return parseRSS(xml, feed.fuente);
  } catch (error) {
    return [];
  }
}

async function scrapeAgriculturalNews() {
  const allNews = [];
  const results = await Promise.allSettled(RSS_FEEDS.map(feed => fetchRSSFeed(feed)));
  results.forEach(result => {
    if (result.status === 'fulfilled') allNews.push(...result.value);
  });
  const agriculturalNews = allNews.filter(n => esNoticiaAgricola(n.titulo, n.resumen));
  const classified = agriculturalNews.map(n => ({ ...n, tipo: clasificarNoticia(n.titulo, n.resumen), fecha: new Date(n.fecha) }));
  classified.sort((a, b) => b.fecha - a.fecha);
  return classified.slice(0, 30);
}

function filterNewsByRegion(news, region) {
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

function filterNewsByCrop(news, cultivo) {
  const cultivoLower = cultivo.toLowerCase();
  return news.filter(n => {
    const texto = (n.titulo + ' ' + n.resumen).toLowerCase();
    return texto.includes(cultivoLower);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

let newsCache = null;
let lastCacheTime = 0;
const CACHE_DURATION = 30 * 60 * 1000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { region, cultivo, force } = req.query;
    const now = Date.now();
    if (!force && newsCache && (now - lastCacheTime) < CACHE_DURATION) {
      return returnFilteredNews(newsCache, region, cultivo, res);
    }

    const [senasaAlerts, publicaciones, rssNews] = await Promise.allSettled([
      scrapeSenasaAlerts(),
      getAgriculturalPublications(),
      scrapeAgriculturalNews()
    ]);

    const allNews = [];
    if (senasaAlerts.status === 'fulfilled') allNews.push(...senasaAlerts.value);
    if (publicaciones.status === 'fulfilled') allNews.push(...publicaciones.value);
    if (rssNews.status === 'fulfilled') allNews.push(...rssNews.value);

    const uniqueNews = eliminarDuplicados(allNews);
    uniqueNews.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    newsCache = uniqueNews;
    lastCacheTime = now;

    return returnFilteredNews(uniqueNews, region, cultivo, res);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener noticias', mensaje: error.message });
  }
}

function returnFilteredNews(allNews, region, cultivo, res) {
  let filtered = [...allNews];
  if (region) { const r = filterNewsByRegion(filtered, region); if (r.length > 0) filtered = r; }
  if (cultivo) { const c = filterNewsByCrop(filtered, cultivo); if (c.length > 0) filtered = c; }
  filtered = filtered.slice(0, 20);
  const stats = { total: filtered.length, porFuente: {}, porTipo: {} };
  filtered.forEach(n => {
    stats.porFuente[n.fuente] = (stats.porFuente[n.fuente] || 0) + 1;
    stats.porTipo[n.tipo] = (stats.porTipo[n.tipo] || 0) + 1;
  });
  return res.status(200).json({ success: true, fecha: new Date().toISOString(), noticias: filtered, stats, filtros: { region: region || null, cultivo: cultivo || null } });
}

function eliminarDuplicados(news) {
  const seen = new Set();
  return news.filter(n => {
    const key = n.titulo.toLowerCase().substring(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
