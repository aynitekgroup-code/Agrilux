/**
 * api/alertas-preventivas.js
 * Endpoints combinados:
 *   GET  /api/alertas-preventivas?type=auth           → Validar clave admin
 *   GET  /api/alertas-preventivas?lat=X&lon=Y&...     → Alertas preventivas
 */

const ALERTAS_POR_CULTIVO = {
  papa: {
    plagas: [
      { nombre: 'Tizón tardío', condicion: (c, d) => (c.humedad > 80 && c.temp >= 12 && c.temp <= 22 && c.lluvia > 5), etapas: ['crecimiento', 'floracion', 'tuberizacion'], gravedad: 'ALTA', preventivo: 'Aplicar Mancozeb 2kg/ha cada 7-14 días. Mantener deshierbe para mejorar ventilación.' },
      { nombre: 'Tizón temprano', condicion: (c, d) => (c.humedad > 85 && c.temp >= 15 && c.temp <= 25), etapas: ['crecimiento', 'floracion'], gravedad: 'MEDIA', preventivo: 'Aplicar Oxicloruro de cobre 3kg/ha. No regar por aspersión.' },
      { nombre: 'Polilla guatemalteca', condicion: (c, d) => (c.temp > 18 && d > 30 && d < 90), etapas: ['crecimiento', 'tuberizacion'], gravedad: 'ALTA', preventivo: 'Colocar trampas con feromonas (5/ha). Aplicar Clorpirifós al suelo.' },
      { nombre: 'Gusano blanco', condicion: (c, d) => (c.humedad > 70 && d > 45 && d < 120), etapas: ['crecimiento', 'tuberizacion'], gravedad: 'MEDIA', preventivo: 'Aplicar Metarhizium anisopliae al suelo. Rotar cultivos cada 2 años.' },
    ],
    enfermedades: [
      { nombre: 'Rizoctonia', condicion: (c, d) => (c.humedad > 85 && c.temp >= 18), etapas: ['siembra', 'germinacion'], gravedad: 'ALTA', preventivo: 'Tratar semilla con Fungicida antes de sembrar. Evitar suelos encharcados.' },
      { nombre: 'Verticillium', condicion: (c, d) => (c.temp >= 18 && c.temp <= 22 && d > 60), etapas: ['crecimiento', 'floracion'], gravedad: 'MEDIA', preventivo: 'Rotar con maíz o trigo. Aplicar Trichoderma al suelo.' },
    ],
  },
  maiz: {
    plagas: [
      { nombre: 'Gusano cogollero', condicion: (c, d) => (c.temp > 20 && d < 40), etapas: ['germinacion', 'crecimiento'], gravedad: 'ALTA', preventivo: 'Aplicar Bt (Bacillus thuringiensis) al primer síntoma. Monitorear hojas enrolladas.' },
      { nombre: 'Polilla del maíz', condicion: (c, d) => (c.temp > 22 && c.humedad > 70 && d > 50), etapas: ['floracion', 'fructificacion'], gravedad: 'MEDIA', preventivo: 'Colocar trampas con feromonas. Aplicar insecticida al 50% de floración.' },
      { nombre: 'Pulgón del maíz', condicion: (c, d) => (c.temp > 18 && c.humedad > 65), etapas: ['crecimiento', 'floracion'], gravedad: 'MEDIA', preventivo: 'Aplicar Imidacloprid si hay más de 50 pulgones/planta.' },
    ],
    enfermedades: [
      { nombre: 'Tizón de Stewart', condicion: (c, d) => (c.temp > 20 && c.humedad > 80), etapas: ['crecimiento', 'floracion'], gravedad: 'ALTA', preventivo: 'Controlar pulgón vector. Variedades resistentes. Rotar cultivos.' },
      { nombre: 'Royas', condicion: (c, d) => (c.humedad > 85 && c.temp >= 16 && c.temp <= 25), etapas: ['crecimiento', 'floracion'], gravedad: 'MEDIA', preventivo: 'Aplicar Azufre 5kg/ha o fungicida sistémico.' },
    ],
  },
  palta: {
    plagas: [
      { nombre: 'Gusano del brote', condicion: (c, d) => (c.temp > 18 && d > 60), etapas: ['crecimiento'], gravedad: 'MEDIA', preventivo: 'Poda de ramas dañadas. Aplicar Trichogramma parasitoide.' },
      { nombre: 'Trips del aguacate', condicion: (c, d) => (c.temp > 22 && c.humedad < 60), etapas: ['crecimiento', 'floracion'], gravedad: 'MEDIA', preventivo: 'Aplicar aceite de neem. Mantener humedad ambiental.' },
    ],
    enfermedades: [
      { nombre: 'Antracnosis', condicion: (c, d) => (c.humedad > 80 && c.temp >= 20), etapas: ['fructificacion', 'cosecha'], gravedad: 'ALTA', preventivo: 'Aplicar cobre preventivo en época húmeda. Cubrir frutos.' },
      { nombre: 'Phytophthora', condicion: (c, d) => (c.humedad > 90 && c.lluvia > 10), etapas: ['crecimiento', 'fructificacion'], gravedad: 'ALTA', preventivo: 'Mejorar drenaje. Aplicar Fosfito de potasio.' },
    ],
  },
  arandano: {
    plagas: [
      { nombre: 'Pájaros', condicion: (c, d) => (d > 150 && c.temp > 10), etapas: ['fructificacion', 'cosecha'], gravedad: 'ALTA', preventivo: 'Cubrir con malla azul antipájaros. Instalar espantapájaros.' },
      { nombre: 'Trips', condicion: (c, d) => (c.temp > 16 && c.humedad < 70), etapas: ['crecimiento', 'floracion'], gravedad: 'MEDIA', preventivo: 'Aplicar aceite mineral. Trampas azules pegajosas.' },
    ],
    enfermedades: [
      { nombre: 'Botrytis', condicion: (c, d) => (c.humedad > 85 && c.temp >= 10 && c.temp <= 20), etapas: ['floracion', 'fructificacion'], gravedad: 'ALTA', preventivo: 'Mejorar ventilación. Aplicar Fungicida biológico. No regar de noche.' },
      { nombre: 'Antracnosis', condicion: (c, d) => (c.lluvia > 8 && c.temp >= 18), etapas: ['fructificacion'], gravedad: 'ALTA', preventivo: 'Aplicar captan antes de lluvias. Cubrir frutos.' },
    ],
  },
  cana: {
    plagas: [
      { nombre: 'Gusano taladrador', condicion: (c, d) => (c.temp > 24 && c.humedad > 70 && d > 60), etapas: ['crecimiento'], gravedad: 'ALTA', preventivo: 'Trampas con feromonas (5/ha). Aplicar Clorpirifós al tallo.' },
      { nombre: 'Broca de la caña', condicion: (c, d) => (c.temp > 22 && d < 30), etapas: ['siembra', 'germinacion'], gravedad: 'MEDIA', preventivo: 'Insecticida al momento de siembra. Variedades resistentes.' },
      { nombre: 'Mosca blanca', condicion: (c, d) => (c.temp > 26 && c.humedad < 65), etapas: ['crecimiento'], gravedad: 'MEDIA', preventivo: 'Aceites minerales. Control biológico con enemigos naturales.' },
    ],
    enfermedades: [
      { nombre: 'Roya', condicion: (c, d) => (c.humedad > 85 && c.temp >= 18 && c.temp <= 25), etapas: ['crecimiento', 'maduracion'], gravedad: 'ALTA', preventivo: 'Variedades resistentes (H57-5174). Fungicida preventivo.' },
      { nombre: 'Mosaico', condicion: (c, d) => (c.temp > 22), etapas: ['crecimiento'], gravedad: 'MEDIA', preventivo: 'Usar semilla libre de virus. Controlar mosca blanca vector.' },
    ],
  },
  platano: {
    plagas: [
      { nombre: 'Picudo del plátano', condicion: (c, d) => (c.temp > 22 && d > 120), etapas: ['crecimiento', 'fructificacion'], gravedad: 'ALTA', preventivo: 'Trampas con feromonas. Eliminar tallos infestados.' },
      { nombre: 'Nematodos', condicion: (c, d) => (d > 90), etapas: ['crecimiento'], gravedad: 'MEDIA', preventivo: 'Aplicar Nematicida al suelo. Rotar cultivos. Usar hijuelos sanos.' },
    ],
    enfermedades: [
      { nombre: 'Sigatoka negra', condicion: (c, d) => (c.humedad > 80 && c.temp >= 20), etapas: ['crecimiento', 'floracion'], gravedad: 'ALTA', preventivo: 'Aplicar fungicida cada 14 días. Eliminar hojas infectadas. Mejorar drenaje.' },
      { nombre: 'Pseudomonas', condicion: (c, d) => (c.lluvia > 15 && c.humedad > 90), etapas: ['crecimiento', 'fructificacion'], gravedad: 'ALTA', preventivo: 'No herir plantas. Desinfectar herramientas. Variedades resistentes.' },
    ],
  },
  papaya: {
    plagas: [
      { nombre: 'Mosca de la fruta', condicion: (c, d) => (c.temp > 24 && d > 150), etapas: ['fructificacion', 'cosecha'], gravedad: 'MEDIA', preventivo: 'Trampas con McPhail. Cubrir frutos con bolsa.' },
      { nombre: 'Trips de la flor', condicion: (c, d) => (c.temp > 22 && c.humedad < 65), etapas: ['floracion'], gravedad: 'MEDIA', preventivo: 'Aplicar aceite de neem. Mantener humedad ambiental.' },
    ],
    enfermedades: [
      { nombre: 'Chancro bacterial', condicion: (c, d) => (c.lluvia > 10 && c.humedad > 85), etapas: ['crecimiento'], gravedad: 'ALTA', preventivo: 'Aplicar cobre preventivo. No regar por aspersión. Cortar plantas infectadas.' },
      { nombre: 'Antracnosis', condicion: (c, d) => (c.humedad > 80 && c.temp >= 22), etapas: ['fructificacion', 'cosecha'], gravedad: 'MEDIA', preventivo: 'Aplicar fungicida preventivo. Cubrir frutos. Manejar con cuidado.' },
    ],
  },
};

function getEtapaActual(diasDesdeSiembra) {
  if (diasDesdeSiembra < 15) return 'siembra';
  if (diasDesdeSiembra < 30) return 'germinacion';
  if (diasDesdeSiembra < 60) return 'crecimiento';
  if (diasDesdeSiembra < 90) return 'floracion';
  if (diasDesdeSiembra < 150) return 'tuberizacion';
  return 'cosecha';
}

function evaluarClima(data) {
  if (!data) return null;
  const actual = data.current || {};
  const daily = data.daily || {};

  const temp = actual.temperature_2m || 0;
  const humedad = actual.relative_humidity_2m || 0;
  const lluvia = actual.precipitation || 0;
  const viento = actual.wind_speed_10m || 0;

  let lluvia7d = 0;
  if (daily.precipitation_sum) {
    lluvia7d = daily.precipitation_sum.slice(0, 7).reduce((a, b) => a + (b || 0), 0);
  }

  let tempMax = -999, tempMin = 999;
  if (daily.temperature_2m_max) {
    for (let i = 0; i < 7; i++) {
      tempMax = Math.max(tempMax, daily.temperature_2m_max[i] || 0);
      tempMin = Math.min(tempMin, daily.temperature_2m_min?.[i] || 999);
    }
  }

  return {
    temp,
    humedad,
    lluvia,
    lluvia7d: Math.round(lluvia7d * 10) / 10,
    viento,
    tempMax,
    tempMin,
    condicionHumedad: humedad > 85 ? 'muy_humeda' : humedad > 70 ? 'humeda' : humedad > 50 ? 'normal' : 'seca',
    condicionLluvia: lluvia7d > 30 ? 'mucha' : lluvia7d > 10 ? 'moderada' : 'poca',
    condicionTemp: tempMax > 30 ? 'caluroso' : tempMin < 5 ? 'frio' : 'normal',
  };
}

function evaluarRiesgo(clima, cultivo, etapa, historial) {
  if (!clima) return { nivel: 'desconocido', color: 'gray' };

  let puntos = 0;
  let factores = [];

  if (clima.condicionHumedad === 'muy_humeda') { puntos += 30; factores.push('Humedad muy alta'); }
  else if (clima.condicionHumedad === 'humeda') { puntos += 15; factores.push('Humedad alta'); }

  if (clima.condicionLluvia === 'mucha') { puntos += 25; factores.push('Lluvia acumulada alta'); }
  else if (clima.condicionLluvia === 'moderada') { puntos += 10; factores.push('Lluvia moderada'); }

  if (clima.condicionTemp === 'caluroso') { puntos += 10; factores.push('Temperatura alta'); }
  if (clima.condicionTemp === 'frio') { puntos += 15; factores.push('Temperatura baja'); }

  if (clima.viento > 30) { puntos += 10; factores.push('Viento fuerte'); }

  if (historial?.tendencia === 'empeorando') { puntos += 20; factores.push('Tendencia empeorando'); }
  if (historial?.problemasActivos?.length > 2) { puntos += 15; factores.push('Múltiples problemas activos'); }

  if (puntos >= 70) return { nivel: 'critico', color: 'red', puntos, factores };
  if (puntos >= 50) return { nivel: 'alto', color: 'orange', puntos, factores };
  if (puntos >= 30) return { nivel: 'moderado', color: 'yellow', puntos, factores };
  if (puntos >= 10) return { nivel: 'bajo', color: 'green', puntos, factores };
  return { nivel: 'minimo', color: 'green', puntos, factores };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, 'http://localhost');
  const type = url.searchParams.get('type');

  // ── Admin Auth (fusionado de admin-auth.js) ──
  if (type === 'auth') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { clave } = req.body || {};
    if (!clave) return res.status(400).json({ error: 'Falta la clave' });
    const ADMIN_KEY = process.env.ADMIN_KEY || process.env.VITE_ADMIN_KEY;
    if (!ADMIN_KEY) return res.status(500).json({ error: 'ADMIN_KEY no configurada en el servidor' });
    if (clave === ADMIN_KEY) return res.status(200).json({ ok: true });
    return res.status(401).json({ ok: false, error: 'Clave incorrecta' });
  }

  if (req.method !== 'GET') return res.status(405).end();
  const lat = parseFloat(url.searchParams.get('lat')) || null;
  const lon = parseFloat(url.searchParams.get('lon')) || null;
  const cultivo = url.searchParams.get('cultivo') || 'papa';
  const diasDesdeSiembra = parseInt(url.searchParams.get('diasDesdeSiembra')) || 30;
  const historial = url.searchParams.get('historial') ? JSON.parse(url.searchParams.get('historial')) : null;

  if (!lat || !lon) {
    return res.status(400).json({ error: 'Falta lat/lon' });
  }

  try {
    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=7`);
    const weather = await weatherRes.json();

    const clima = evaluarClima(weather);
    const etapa = getEtapaActual(diasDesdeSiembra);
    const riesgo = evaluarRiesgo(clima, cultivo, etapa, historial);

    const alertasActivas = [];
    const cultivoAlertas = ALERTAS_POR_CULTIVO[cultivo];

    if (cultivoAlertas) {
      const todasLasAlertas = [...(cultivoAlertas.plagas || []), ...(cultivoAlertas.enfermedades || [])];

      for (const alerta of todasLasAlertas) {
        if (alerta.etapas.includes(etapa) && alerta.condicion(clima, diasDesdeSiembra)) {
          alertasActivas.push({
            nombre: alerta.nombre,
            gravedad: alerta.gravedad,
            preventivo: alerta.preventivo,
            etapaActual: etapa,
          });
        }
      }
    }

    const recomendaciones = [];
    if (riesgo.nivel === 'critico' || riesgo.nivel === 'alto') {
      recomendaciones.push('Monitorear la parcela diariamente');
      recomendaciones.push('Revisar partes inferiores de las hojas');
      recomendaciones.push('Verificar drenaje del terreno');
    }
    if (clima?.condicionHumedad === 'muy_humeda') {
      recomendaciones.push('Evitar riego por aspersión');
      recomendaciones.push('Mejorar ventilación entre plantas');
    }
    if (clima?.condicionLluvia === 'mucha') {
      recomendaciones.push('Verificar que el agua no esté estancada');
      recomendaciones.push('Posponer aplicaciones de productos químicos');
    }
    if (riesgo.nivel === 'minimo') {
      recomendaciones.push('Condiciones favorables, mantener manejo actual');
    }

    return res.status(200).json({
      ubicacion: { lat, lon },
      cultivo,
      etapa,
      diasDesdeSiembra,
      clima: {
        temperatura: clima.temp,
        humedad: clima.humedad,
        lluviaHoy: clima.lluvia,
        lluvia7d: clima.lluvia7d,
        viento: clima.viento,
      },
      riesgo,
      alertas: alertasActivas,
      recomendaciones,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Alertas preventivas error:', error);
    return res.status(500).json({ error: error.message });
  }
}
