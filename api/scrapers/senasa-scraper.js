import * as cheerio from 'cheerio';

const SENASA_URL = 'https://www.senasa.gob.pe';

const REGIONES_PERU = {
  'la libertad': ['trujillo', 'chiclayo', 'viru', 'ascope', 'chepen', 'pacasmayo', 'san pedro de locuto'],
  'piura': ['piura', 'sullana', 'tumbes', 'paita', 'huancabamba', 'morropon'],
  'lambayeque': ['chiclayo', 'ferreñafe', 'lambayeque', 'ochocelaya', 'san jose de los molinos'],
  'cajamarca': ['cajamarca', 'cutervo', 'contumaza', 'san marcos'],
  'san martin': ['moyobamba', 'tarapoto', 'juanjuí', 'saposoa'],
  'junín': ['huancayo', 'tarma', 'satipo', 'jauja'],
  'cusco': ['cusco', 'calca', 'urubamba', 'quillabamba'],
  'arequipa': ['arequipa', 'mollendo', 'camana', 'chivay'],
  'puno': ['puno', 'juliaca', 'azangaro', 'moho'],
  'loreto': ['iquitos', 'yurimaguas', 'requena', 'nauta'],
  'uzcayo': ['pucallpa', 'tingo maria', 'aguaruto'],
};

const CULTIVOS_AFECTADOS = [
  'papa', 'maíz', 'tomate', 'arroz', 'uva', 'palta', 'aguacate',
  'fresa', 'frutilla', 'cebada', 'trigo', 'café', 'cacao',
  'plátano', 'banano', 'maní', 'ají', 'chile', 'cebolla',
  'zanahoria', 'repollo', 'lechuga', 'apio', 'pepino', 'sandía',
  'melón', 'mango', 'piña', 'limón', 'naranja', 'mandarina',
  'caña de azúcar', 'algodón', 'camote', 'yucca', 'yuca'
];

const PLAGAS_COMUNES = [
  'tuta absoluta', 'polilla', 'gusano cogollero', 'gusano blanco',
  'mosca blanca', 'pulgón', 'cochinilla', 'ácaros', 'trips',
  'minador', ' barrenador', 'barrenador del tallo',
  'roya', 'fusarium', 'phytophthora', 'alternaria', 'botrytis',
  'mildiu', 'oídio', 'antracnosis', 'ticosis',
  'nematodos', 'bacterias', 'virus'
];

/**
 * Scraping de SENASA - Alertas Fitosanitarias
 */
export async function scrapeSenasaAlerts() {
  try {
    const alerts = [];
    
    // Intentar obtener la página principal
    const response = await fetch(`${SENASA_URL}/comunicados`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      console.log('[SENASA] Página no disponible, usando datos de respaldo');
      return getSenasaFallbackData();
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Buscar artículos/alertas
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
    
    // Si no encontró artículos, intentar otros selectores
    if (alerts.length === 0) {
      $('a').each((i, el) => {
        const text = $(el).text().trim();
        const href = $(el).attr('href') || '';
        if (text.length > 20 && (
          text.toLowerCase().includes('alerta') ||
          text.toLowerCase().includes('foco') ||
          text.toLowerCase().includes('plaga') ||
          text.toLowerCase().includes('enfermedad')
        )) {
          alerts.push({
            titulo: text.substring(0, 200),
            fecha: new Date().toISOString(),
            resumen: '',
            enlace: href.startsWith('http') ? href : `${SENASA_URL}${href}`,
            fuente: 'SENASA',
            tipo: 'alerta_fitosanitaria'
          });
        }
      });
    }
    
    return alerts.length > 0 ? alerts.slice(0, 10) : getSenasaFallbackData();
    
  } catch (error) {
    console.error('[SENASA] Error:', error.message);
    return getSenasaFallbackData();
  }
}

function clasificarAlertaSenasa(texto) {
  const lower = texto.toLowerCase();
  
  if (lower.includes('cuarentena') || lower.includes('emergencia')) return 'cuarentena';
  if (lower.includes('foco') || lower.includes('brote')) return 'brote';
  if (lower.includes('regulación') || lower.includes('resolución')) return 'regulacion';
  if (lower.includes('capacitación') || lower.includes('taller')) return 'capacitacion';
  if (lower.includes('plaga') || lower.includes('enfermedad')) return 'alerta_fitosanitaria';
  
  return 'noticia';
}

function getSenasaFallbackData() {
  return [
    {
      titulo: 'SENASA mantiene vigilancia fitosanitaria en regiones agrícolas',
      fecha: new Date().toISOString(),
      resumen: 'El Servicio Nacional de Sanidad Agraria continúa con los programas de vigilancia y control de plagas cuarentenarias en las principales zonas agrícolas del país.',
      enlace: 'https://www.senasa.gob.pe',
      fuente: 'SENASA',
      tipo: 'vigilancia'
    },
    {
      titulo: 'Recomendaciones para el manejo integrado de plagas en cultivos de temporada',
      fecha: new Date().toISOString(),
      resumen: 'SENASA recomienda implementar medidas de control preventivo antes del inicio de la temporada de lluvias para reducir la proliferación de plagas.',
      enlace: 'https://www.senasa.gob.pe',
      fuente: 'SENASA',
      tipo: 'recomendacion'
    }
  ];
}

/**
 * Busca alertas de SENASA por región específica
 */
export async function getSenasaAlertsByRegion(region) {
  const allAlerts = await scrapeSenasaAlerts();
  const regionLower = region.toLowerCase();
  
  return allAlerts.filter(alert => {
    const text = (alert.titulo + ' ' + alert.resumen).toLowerCase();
    return Object.keys(REGIONES_PERU).some(r => 
      regionLower.includes(r) || text.includes(r)
    );
  });
}

/**
 * Busca alertas por cultivo específico
 */
export async function getSenasaAlertsByCrop(cultivo) {
  const allAlerts = await scrapeSenasaAlerts();
  const cultivoLower = cultivo.toLowerCase();
  
  return allAlerts.filter(alert => {
    const text = (alert.titulo + ' ' + alert.resumen).toLowerCase();
    return text.includes(cultivoLower) || 
           CULTIVOS_AFECTADOS.some(c => text.includes(c));
  });
}
