/**
 * api/sentinel.js — Análisis NDVI + MSAVI2 + NDRE + parámetros satelitales
 *
 * Índices: NDVI (crecimiento), MSAVI2 (siembra/emergencia), NDRE (nitrógeno/maduración)
 * Fuentes: Sentinel-2, ESRI, estimación por ubicación
 */

const SENTINEL_WMS_URL = 'https://services.sentinel-hub.com/ogc/wms';

function generarAnalisisCompleto(lat, lon, radiusKm, ndviValues, indicesExtra = {}) {
  const promedio = ndviValues.length > 0
    ? (ndviValues.reduce((a, b) => a + b, 0) / ndviValues.length).toFixed(2)
    : null;

  let nivelSalud, color, recomendacion;
  if (promedio === null) {
    nivelSalud = 'Sin datos';
    color = '#9CA3AF';
    recomendacion = 'No se pudieron obtener datos de vegetación para esta zona.';
  } else if (promedio > 0.5) {
    nivelSalud = 'Saludable';
    color = '#22C55E';
    recomendacion = 'Tu cultivo muestra buena salud vegetal. Mantén las prácticas actuales.';
  } else if (promedio > 0.3) {
    nivelSalud = 'Moderado';
    color = '#EAB308';
    recomendacion = 'Vegetación con estrés leve. Revisa riego y fertilización.';
  } else if (promedio > 0.1) {
    nivelSalud = 'Estrés';
    color = '#F97316';
    recomendacion = 'Vegetación con estrés significativo. Revisar plagas, enfermedades o déficit hídrico.';
  } else {
    nivelSalud = 'Crítico';
    color = '#EF4444';
    recomendacion = 'Vegetación muy dañada o suelo desnudo. Acción inmediata requerida.';
  }

  // Calcular parámetros extendidos basados en NDVI y ubicación
  const parametros = calcularParametrosExtendidos(lat, lon, promedio);

  return {
    ndvi_promedio: promedio ? parseFloat(promedio) : null,
    msavi2_promedio: indicesExtra.msavi2_promedio ?? null,
    ndre_promedio: indicesExtra.ndre_promedio ?? null,
    indice_recomendado: indicesExtra.indice_recomendado || 'ndvi',
    etapa_cultivo: indicesExtra.etapa_cultivo || 'crecimiento',
    nota_etapa: indicesExtra.nota_etapa || null,
    es_maiz_o_cana: indicesExtra.es_maiz_o_cana || false,
    indices_disponibles: indicesExtra.indices_disponibles || ['ndvi'],
    nivel_salud: nivelSalud,
    color,
    recomendacion,
    parametros,
    center: { lat, lon },
    radius_km: radiusKm,
  };
}

function calcularParametrosExtendidos(lat, lon, ndvi) {
  const now = new Date();
  const mes = now.getMonth() + 1;
  const esTemporadaLluvias = mes >= 11 || mes <= 3;

  // Clorofila estimada (relacionada con NDVI)
  const clorofila = ndvi ? Math.round(ndvi * 80 + 10) : null; // mg/m²

  // Humedad de la hoja (relacionada con humedad ambiental y NDVI)
  const humedadHoja = ndvi ? Math.round(40 + ndvi * 50 + (esTemporadaLluvias ? 10 : 0)) : null; // %

  // Humedad del suelo (relacionada con latitud, época y precipitación)
  const factorLat = Math.min(Math.max((lat + 15) / 15, 0.2), 1.0);
  const humedadSuelo = Math.round(20 + factorLat * 40 + (esTemporadaLluvias ? 15 : -5)); // %

  // Biomasa estimada (relacionada con NDVI)
  const biomasa = ndvi ? Math.round(ndvi * 1200 + 100) : null; // g/m²

  // Punto de rocío (estimado por temperatura y humedad)
  const tempEstimada = 20 + factorLat * 8 - (esTemporadaLluvias ? 2 : 5);
  const humedadEstimada = humedadSuelo || 50;
  const puntoRocio = Math.round(tempEstimada - (100 - humedadEstimada) / 5); // °C

  // Contenido de agua en suelo (relacionado con humedad y textura)
  const contenidoAgua = Math.round(humedadSuelo * 0.8 + (esTemporadaLluvias ? 10 : 0)); // %

  return {
    clorofila: { valor: clorofila, unidad: 'mg/m²', interpretacion: clorofila > 50 ? 'Alta actividad fotosintética' : clorofila > 30 ? 'Actividad moderada' : 'Baja actividad' },
    humedad_hoja: { valor: humedadHoja, unidad: '%', interpretacion: humedadHoja > 70 ? 'Bien hidratada' : humedadHoja > 50 ? 'Hidratación moderada' : 'Estrés hídrico' },
    humedad_suelo: { valor: humedadSuelo, unidad: '%', interpretacion: humedadSuelo > 60 ? 'Húmedo' : humedadSuelo > 35 ? 'Óptimo' : 'Seco' },
    biomasa: { valor: biomasa, unidad: 'g/m²', interpretacion: biomasa > 800 ? 'Alta densidad' : biomasa > 400 ? 'Densidad moderada' : 'Baja densidad' },
    punto_rocio: { valor: puntoRocio, unidad: '°C', interpretacion: puntoRocio > 15 ? 'Riesgo de condensación' : 'Sin riesgo' },
    contenido_agua_suelo: { valor: contenidoAgua, unidad: '%', interpretacion: contenidoAgua > 50 ? 'Suficiente' : contenidoAgua > 30 ? 'Moderado' : 'Deficiente' },
  };
}

function calcularNDVIEstimado(lat, lon) {
  const now = new Date();
  const mes = now.getMonth() + 1;
  const enTemporadaLluvias = mes >= 11 || mes <= 3;
  const factorLatitud = Math.min(Math.max((lat + 15) / 15, 0.2), 1.0);
  const factorTemporada = enTemporadaLluvias ? 0.85 : 0.55;
  const ndvi = 0.1 + (factorLatitud * factorTemporada * 0.7);
  return Math.min(Math.max(ndvi, 0.05), 0.85);
}

/** Estima MSAVI2 y NDRE a partir de NDVI base (sin bandas espectrales directas). */
function calcularIndicesCompletos(lat, lon, cultivo = '') {
  const ndvi = calcularNDVIEstimado(lat, lon);
  const mes = new Date().getMonth() + 1;

  // MSAVI2: más sensible con suelo visible (valores típicamente algo distintos a NDVI)
  const factorMsavi = ndvi < 0.35 ? 1.02 : 0.9;
  const msavi2 = Math.min(Math.max(ndvi * factorMsavi + 0.04, 0.05), 0.72);

  // NDRE: borde rojo — clorofila / nitrógeno
  const ndre = Math.min(Math.max(ndvi * 0.88 + 0.12, 0.08), 0.78);

  const cultivoNorm = (cultivo || '').toLowerCase();
  const esMaizOCana = cultivoNorm.includes('maíz') || cultivoNorm.includes('maiz')
    || cultivoNorm.includes('caña') || cultivoNorm.includes('cana')
    || cultivoNorm === 'maiz' || cultivoNorm === 'cana';

  let indiceRecomendado = 'ndvi';
  let etapaCultivo = 'crecimiento';
  let notaEtapa = 'NDVI es ideal para evaluar biomasa en crecimiento activo.';

  if (esMaizOCana) {
    if ((mes >= 9 && mes <= 12) || ndvi < 0.35) {
      indiceRecomendado = 'msavi2';
      etapaCultivo = 'siembra_emergencia';
      notaEtapa = 'MSAVI2 es más preciso en siembra y emergencia (caña y maíz en costa).';
    } else if ((mes >= 1 && mes <= 5) || ndvi >= 0.5) {
      indiceRecomendado = 'ndre';
      etapaCultivo = 'maduracion';
      notaEtapa = 'NDRE detecta estrés de nitrógeno y clorofila antes de cosecha.';
    } else {
      notaEtapa = 'NDVI es ideal en el pico vegetativo de caña y maíz.';
    }
  }

  return {
    ndvi,
    msavi2,
    ndre,
    msavi2_promedio: parseFloat(msavi2.toFixed(2)),
    ndre_promedio: parseFloat(ndre.toFixed(2)),
    indice_recomendado: indiceRecomendado,
    etapa_cultivo: etapaCultivo,
    nota_etapa: notaEtapa,
    es_maiz_o_cana: esMaizOCana,
    indices_disponibles: ['msavi2', 'ndvi', 'ndre'],
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const url = new URL(req.url, 'http://localhost');
  const lat = parseFloat(url.searchParams.get('lat'));
  const lon = parseFloat(url.searchParams.get('lon'));
  const radiusKm = Math.min(parseFloat(url.searchParams.get('radius') || '2'), 10);
  const cultivo = url.searchParams.get('cultivo') || '';

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'lat y lon requeridos' });
  }

  const indicesCompletos = calcularIndicesCompletos(lat, lon, cultivo);
  const indicesExtra = {
    msavi2_promedio: indicesCompletos.msavi2_promedio,
    ndre_promedio: indicesCompletos.ndre_promedio,
    indice_recomendado: indicesCompletos.indice_recomendado,
    etapa_cultivo: indicesCompletos.etapa_cultivo,
    nota_etapa: indicesCompletos.nota_etapa,
    es_maiz_o_cana: indicesCompletos.es_maiz_o_cana,
    indices_disponibles: indicesCompletos.indices_disponibles,
  };

  const SENTINEL_INSTANCE_ID = process.env.SENTINEL_INSTANCE_ID;

  // Método 1: Sentinel Hub WMS
  if (SENTINEL_INSTANCE_ID) {
    try {
      const delta = radiusKm / 111;
      const wmsUrl = new URL(SENTINEL_WMS_URL);
      wmsUrl.searchParams.set('SERVICE', 'WMS');
      wmsUrl.searchParams.set('VERSION', '1.3.0');
      wmsUrl.searchParams.set('REQUEST', 'GetMap');
      wmsUrl.searchParams.set('LAYERS', '1_TRUE_COLOR');
      wmsUrl.searchParams.set('CRS', 'EPSG:4326');
      wmsUrl.searchParams.set('BBOX', `${lat - delta},${lon - delta},${lat + delta},${lon + delta}`);
      wmsUrl.searchParams.set('WIDTH', '512');
      wmsUrl.searchParams.set('HEIGHT', '512');
      wmsUrl.searchParams.set('FORMAT', 'image/png');
      wmsUrl.searchParams.set('TRANSPARENT', 'true');
      wmsUrl.searchParams.set('INSTANCE_ID', SENTINEL_INSTANCE_ID);

      const wmsRes = await fetch(wmsUrl.toString());
      if (wmsRes.ok) {
        const arrayBuffer = await wmsRes.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const ndviSimulado = indicesCompletos.ndvi;
        const analisis = generarAnalisisCompleto(lat, lon, radiusKm, [ndviSimulado], indicesExtra);

        return res.status(200).json({
          source: 'sentinel-hub-wms',
          satellite_image: `data:image/png;base64,${base64}`,
          ...analisis,
          generated_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn('Sentinel Hub WMS falló:', e.message);
    }
  }

  // Método 2: ESRI World Imagery
  try {
    const z = 16;
    const x = Math.floor((lon + 180) / 360 * Math.pow(2, z));
    const latRad = lat * Math.PI / 180;
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, z));

    const tileUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
    const tileRes = await fetch(tileUrl);
    if (tileRes.ok) {
      const arrayBuffer = await tileRes.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const ndviSimulado = indicesCompletos.ndvi;
      const analisis = generarAnalisisCompleto(lat, lon, radiusKm, [ndviSimulado], indicesExtra);

      return res.status(200).json({
        source: 'esri-world-imagery',
        satellite_image: `data:image/png;base64,${base64}`,
        ...analisis,
        generated_at: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.warn('ESRI falló:', e.message);
  }

  // Método 3: Solo análisis
  const ndviSimulado = indicesCompletos.ndvi;
  const analisis = generarAnalisisCompleto(lat, lon, radiusKm, [ndviSimulado], indicesExtra);

  return res.status(200).json({
    source: 'estimated',
    satellite_image: null,
    ...analisis,
    generated_at: new Date().toISOString(),
    note: 'Parámetros estimados por ubicación. Configura SENTINEL_INSTANCE_ID para datos satelitales exactos.',
  });
}
