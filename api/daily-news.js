/**
 * api/daily-news.js
 * Noticias agrícolas diarias - SIN cheerio (usa regex/string parsing)
 * SENASA + INIA + Minagri + RSS feeds
 */

const SENASA_URL = 'https://www.senasa.gob.pe';
const INIA_URL = 'https://www.inia.gob.pe';
const MINAGRI_URL = 'https://www.gob.pe/minagri';

const RSS_FEEDS = [
  { name: 'AgroPerú', url: 'https://agroperu.pe/feed/', fuente: 'AgroPerú' },
  { name: 'Rural', url: 'https://rural.com.pe/feed/', fuente: 'Rural' },
  { name: 'La República', url: 'https://larepublica.pe/rss/rss-campo.xml', fuente: 'La República' },
  { name: 'El Comercio', url: 'https://elcomercio.pe/rss/economia/agro/', fuente: 'El Comercio' },
  { name: 'Gestión', url: 'https://gestion.pe/rss/rss-campo.xml', fuente: 'Gestión' }
];

const KEYWORDS_AGRICOLAS = [
  'agricultura', 'agro', 'campo', 'cultivo', 'cosecha', 'siembra',
  'plaga', 'enfermedad', 'fungicida', 'insecticida', 'fertilizante',
  'riego', 'suelo', 'papa', 'maíz', 'arroz', 'palta', 'café',
  'SENAMHI', 'clima', 'lluvia', 'sequía', 'SENASA', 'INIA',
  'exportación', 'mercado', 'precio', 'orgánico'
];

function extraerEntre(texto, inicio, fin) {
  const i = texto.indexOf(inicio);
  if (i === -1) return '';
  const start = i + inicio.length;
  const j = texto.indexOf(fin, start);
  if (j === -1) return texto.substring(start, start + 200);
  return texto.substring(start, j);
}

function limpiarHTML(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}

function extraerTitulos(html, fuente) {
  const noticias = [];
  const h2Regex = /<h[23][^>]*>(.*?)<\/h[23]>/gi;
  let match;
  while ((match = h2Regex.exec(html)) !== null) {
    const titulo = limpiarHTML(match[1]);
    if (titulo.length > 15 && titulo.length < 200) {
      const linkMatch = html.substring(Math.max(0, match.index - 500), match.index).match(/href=["']([^"']+)["'][^>]*$/);
      const link = linkMatch ? linkMatch[1] : '';
      noticias.push({
        titulo,
        fecha: new Date().toISOString(),
        resumen: '',
        enlace: link.startsWith('http') ? link : `${fuente === 'SENASA' ? SENASA_URL : fuente === 'INIA' ? INIA_URL : MINAGRI_URL}${link}`,
        fuente,
        tipo: clasificarNoticia(titulo)
      });
    }
  }
  return noticias;
}

function clasificarNoticia(titulo) {
  const t = titulo.toLowerCase();
  if (t.includes('plaga') || t.includes('enfermedad') || t.includes('foco')) return 'alerta_fitosanitaria';
  if (t.includes('clima') || t.includes('lluvia') || t.includes('helada')) return 'alerta_climatica';
  if (t.includes('precio') || t.includes('mercado')) return 'mercado';
  if (t.includes('convocatoria') || t.includes('subsidio')) return 'convocatoria';
  return 'noticia';
}

function esNoticiaAgricola(titulo, resumen) {
  const texto = (titulo + ' ' + resumen).toLowerCase();
  return KEYWORDS_AGRICOLAS.some(kw => texto.includes(kw));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCRAPERS
// ═══════════════════════════════════════════════════════════════════════════════

async function scrapeSenasa() {
  try {
    const r = await fetch(`${SENASA_URL}/comunicados`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return getSenasaFallback();
    const html = await r.text();
    const noticias = extraerTitulos(html, 'SENASA');
    return noticias.length > 0 ? noticias.slice(0, 10) : getSenasaFallback();
  } catch { return getSenasaFallback(); }
}

function getSenasaFallback() {
  return [
    { titulo: 'SENASA mantiene vigilancia fitosanitaria en regiones agrícolas', fecha: new Date().toISOString(), resumen: 'Programas de vigilancia y control de plagas cuarentenarias.', enlace: 'https://www.senasa.gob.pe', fuente: 'SENASA', tipo: 'vigilancia' },
    { titulo: 'Recomendaciones para manejo integrado de plagas', fecha: new Date().toISOString(), resumen: 'Control preventivo antes de temporada de lluvias.', enlace: 'https://www.senasa.gob.pe', fuente: 'SENASA', tipo: 'recomendacion' }
  ];
}

async function scrapeInia() {
  try {
    const r = await fetch(`${INIA_URL}/publicaciones`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return getIniaFallback();
    const html = await r.text();
    const noticias = extraerTitulos(html, 'INIA');
    return noticias.length > 0 ? noticias.slice(0, 10) : getIniaFallback();
  } catch { return getIniaFallback(); }
}

function getIniaFallback() {
  return [
    { titulo: 'INIA presenta investigación en manejo integrado de plagas', fecha: new Date().toISOString(), resumen: 'Nuevos protocolos MIP para cultivos andinos.', enlace: 'https://www.inia.gob.pe', fuente: 'INIA', tipo: 'investigacion' }
  ];
}

async function scrapeMinagri() {
  try {
    const r = await fetch(`${MINAGRI_URL}/publicaciones/noticias`, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return getMinagriFallback();
    const html = await r.text();
    const noticias = extraerTitulos(html, 'Minagri');
    return noticias.length > 0 ? noticias.slice(0, 10) : getMinagriFallback();
  } catch { return getMinagriFallback(); }
}

function getMinagriFallback() {
  return [
    { titulo: 'Minagri anuncia medidas de apoyo al sector agrícola', fecha: new Date().toISOString(), resumen: 'Medidas para impulsar productividad agrícola.', enlace: 'https://www.gob.pe/minagri', fuente: 'Ministerio de Agricultura', tipo: 'noticia' }
  ];
}

async function scrapeRSS() {
  const allNews = [];
  const results = await Promise.allSettled(RSS_FEEDS.map(async (feed) => {
    try {
      const r = await fetch(feed.url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml, application/xml, text/xml' }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) return [];
      const xml = await r.text();
      const noticias = [];
      const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
      let match;
      while ((match = itemRegex.exec(xml)) !== null) {
        const block = match[1];
        const titulo = extraerEntre(block, '<title>', '</title>');
        const link = extraerEntre(block, '<link>', '</link>');
        const desc = limpiarHTML(extraerEntre(block, '<description>', '</description>'));
        if (titulo.length > 5) {
          noticias.push({
            titulo: titulo.substring(0, 200),
            fecha: new Date().toISOString(),
            resumen: desc.substring(0, 500),
            enlace: link,
            fuente: feed.fuente,
            tipo: clasificarNoticia(titulo)
          });
        }
      }
      return noticias;
    } catch { return []; }
  }));
  results.forEach(r => { if (r.status === 'fulfilled') allNews.push(...r.value); });
  return allNews.filter(n => esNoticiaAgricola(n.titulo, n.resumen)).slice(0, 30);
}

function filterNewsByRegion(news, region) {
  const keywords = {
    'la libertad': ['trujillo', 'chiclayo', 'viru'],
    'piura': ['piura', 'tumbes', 'sullana'],
    'lambayeque': ['chiclayo', 'ferreñafe'],
    'cajamarca': ['cajamarca', 'cutervo'],
    'san martin': ['moyobamba', 'tarapoto'],
    'junín': ['huancayo', 'tarma', 'satipo'],
    'cusco': ['cusco', 'calca', 'urubamba'],
    'arequipa': ['arequipa', 'mollendo'],
    'puno': ['puno', 'juliaca'],
    'loreto': ['loreto', 'iquitos']
  };
  const kws = keywords[region.toLowerCase()] || [region.toLowerCase()];
  return news.filter(n => { const t = (n.titulo + ' ' + n.resumen).toLowerCase(); return kws.some(k => t.includes(k)); });
}

function filterNewsByCrop(news, cultivo) {
  const c = cultivo.toLowerCase();
  return news.filter(n => (n.titulo + ' ' + n.resumen).toLowerCase().includes(c));
}

function eliminarDuplicados(news) {
  const seen = new Set();
  return news.filter(n => { const key = n.titulo.toLowerCase().substring(0, 50); if (seen.has(key)) return false; seen.add(key); return true; });
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER
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
      return returnFiltered(newsCache, region, cultivo, res);
    }

    const [senasa, inia, minagri, rss] = await Promise.allSettled([scrapeSenasa(), scrapeInia(), scrapeMinagri(), scrapeRSS()]);
    const allNews = [];
    if (senasa.status === 'fulfilled') allNews.push(...senasa.value);
    if (inia.status === 'fulfilled') allNews.push(...inia.value);
    if (minagri.status === 'fulfilled') allNews.push(...minagri.value);
    if (rss.status === 'fulfilled') allNews.push(...rss.value);

    const unique = eliminarDuplicados(allNews);
    unique.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    newsCache = unique;
    lastCacheTime = now;
    return returnFiltered(unique, region, cultivo, res);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener noticias', mensaje: error.message });
  }
}

function returnFiltered(allNews, region, cultivo, res) {
  let filtered = [...allNews];
  if (region) { const r = filterNewsByRegion(filtered, region); if (r.length > 0) filtered = r; }
  if (cultivo) { const c = filterNewsByCrop(filtered, cultivo); if (c.length > 0) filtered = c; }
  filtered = filtered.slice(0, 20);
  const stats = { total: filtered.length, porFuente: {}, porTipo: {} };
  filtered.forEach(n => { stats.porFuente[n.fuente] = (stats.porFuente[n.fuente] || 0) + 1; stats.porTipo[n.tipo] = (stats.porTipo[n.tipo] || 0) + 1; });
  return res.status(200).json({ success: true, fecha: new Date().toISOString(), noticias: filtered, stats, filtros: { region: region || null, cultivo: cultivo || null } });
}
