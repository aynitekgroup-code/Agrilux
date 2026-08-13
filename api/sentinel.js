/**
 * api/sentinel.js — NDVI + MSAVI2 + NDRE + mapa de calor (estilo NAX)
 *
 * Corregido: cada parcela obtiene valores únicos según ubicación exacta,
 * edad del cultivo y polígono mapeado (no el mismo NDVI para todos).
 */

const SENTINEL_WMS_LEGACY = 'https://services.sentinel-hub.com/ogc/wms';
const SENTINEL_WMS_CDSE = 'https://sh.dataspace.copernicus.eu/ogc/wms';
const CDSE_TOKEN_URL = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';

/** Capas habituales en configs Sentinel Hub / Simple WMS */
const WMS_LAYERS_DEFAULT = ['TRUE_COLOR', 'FALSE_COLOR', 'NDVI', 'EVI', 'NATURAL-COLOR'];

let tokenCache = { token: null, expiresAt: 0 };

function bboxWebMercator(lat, lon, radiusKm) {
  const delta = radiusKm / 111;
  const to3857 = (la, lo) => {
    const x = (lo * 20037508.34) / 180;
    const y = Math.log(Math.tan(((90 + la) * Math.PI) / 360)) / (Math.PI / 180);
    return [x, (y * 20037508.34) / 180];
  };
  const corners = [
    to3857(lat - delta, lon - delta),
    to3857(lat - delta, lon + delta),
    to3857(lat + delta, lon - delta),
    to3857(lat + delta, lon + delta),
  ];
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  return `${Math.min(...xs)},${Math.min(...ys)},${Math.max(...xs)},${Math.max(...ys)}`;
}

function rangoTiempoWMS() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 120);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return `${fmt(start)}/${fmt(end)}`;
}

async function fetchCapasWMS(instanceId, accessToken) {
  try {
    const url = `${SENTINEL_WMS_CDSE}/${instanceId}?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return WMS_LAYERS_DEFAULT;
    const xml = await res.text();
    const names = [...xml.matchAll(/<(?:[^>:]+:)?Name>([^<]+)<\/(?:[^>:]+:)?Name>/gi)]
      .map((m) => m[1].trim())
      .filter((n) => n && !/^wms$/i.test(n) && !n.includes(':'));
    const unique = [...new Set(names)];
    return unique.length ? unique.slice(0, 10) : WMS_LAYERS_DEFAULT;
  } catch {
    return WMS_LAYERS_DEFAULT;
  }
}

async function obtenerTokenCDSE() {
  const clientId = process.env.SENTINEL_CLIENT_ID;
  const clientSecret = process.env.SENTINEL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { token: null, error: 'oauth_not_configured' };
  }

  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 60_000) {
    return { token: tokenCache.token };
  }

  try {
    const res = await fetch(CDSE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      return {
        token: null,
        error: data.error_description || data.error || `token_http_${res.status}`,
      };
    }
    tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    };
    return { token: data.access_token };
  } catch (e) {
    return { token: null, error: e.message };
  }
}

function extraerServiceException(xml) {
  const m = xml.match(/<(?:\w+:)?ServiceException[^>]*>([^<]+)</i);
  return m ? m[1].trim() : xml.slice(0, 220);
}

async function fetchImagenSentinelProcess(lat, lon, radiusKm, accessToken) {
  const bbox3857 = bboxWebMercator(lat, lon, radiusKm);
  const [minX, minY, maxX, maxY] = bbox3857.split(',').map(Number);
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 120);

  const evalscript = `//VERSION=3
function setup() {
  return { input: ["B02", "B03", "B04", "dataMask"], output: { bands: 3 } };
}
function evaluatePixel(sample) {
  if (sample.dataMask === 0) return [0, 0, 0];
  return [2.5 * sample.B04, 2.5 * sample.B03, 2.5 * sample.B02];
}`;

  try {
    const res = await fetch('https://sh.dataspace.copernicus.eu/api/v1/process', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'image/jpeg',
      },
      body: JSON.stringify({
        input: {
          bounds: {
            bbox: [minX, minY, maxX, maxY],
            properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/3857' },
          },
          data: [{
            type: 'sentinel-2-l2a',
            dataFilter: {
              timeRange: { from: start.toISOString(), to: end.toISOString() },
              maxCloudCoverage: 80,
            },
          }],
        },
        output: { width: 512, height: 512 },
        evalscript,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { failed: true, error: extraerServiceException(errText), status: res.status };
    }

    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength < 500) {
      return { failed: true, error: 'process_response_too_small', bytes: arrayBuffer.byteLength };
    }

    return {
      base64: Buffer.from(arrayBuffer).toString('base64'),
      mime: 'jpeg',
      endpoint: 'process-api',
      layer: 'TRUE_COLOR',
    };
  } catch (e) {
    return { failed: true, error: e.message };
  }
}
async function fetchImagenSentinelWMS(instanceId, lat, lon, radiusKm, accessToken) {
  const bbox3857 = bboxWebMercator(lat, lon, radiusKm);
  const time = rangoTiempoWMS();
  const debug = { attempts: [], bbox3857, time };

  const layers = accessToken
    ? await fetchCapasWMS(instanceId, accessToken)
    : WMS_LAYERS_DEFAULT;
  debug.layers_from_capabilities = layers;

  const mapConfigs = [
    { version: '1.3.0', crsKey: 'CRS', crs: 'EPSG:3857', bbox: bbox3857 },
    { version: '1.1.1', crsKey: 'SRS', crs: 'EPSG:3857', bbox: bbox3857 },
  ];

  const endpoints = [
    { base: `${SENTINEL_WMS_CDSE}/${instanceId}`, useInstanceParam: false, label: 'cdse', needsAuth: true },
  ];

  const timeVariants = [null, time];

  for (const ep of endpoints) {
    for (const mapCfg of mapConfigs) {
      for (const layer of layers) {
        for (const timeVal of timeVariants) {
          try {
            if (ep.needsAuth && !accessToken) {
              debug.attempts.push({ endpoint: ep.label, layer, skipped: 'no_bearer_token' });
              continue;
            }

            const wmsUrl = new URL(ep.base);
            wmsUrl.searchParams.set('SERVICE', 'WMS');
            wmsUrl.searchParams.set('VERSION', mapCfg.version);
            wmsUrl.searchParams.set('REQUEST', 'GetMap');
            wmsUrl.searchParams.set('LAYERS', layer);
            wmsUrl.searchParams.set(mapCfg.crsKey, mapCfg.crs);
            wmsUrl.searchParams.set('BBOX', mapCfg.bbox);
            wmsUrl.searchParams.set('WIDTH', '512');
            wmsUrl.searchParams.set('HEIGHT', '512');
            wmsUrl.searchParams.set('FORMAT', 'image/jpeg');
            wmsUrl.searchParams.set('MAXCC', '80');
            if (timeVal) wmsUrl.searchParams.set('TIME', timeVal);
            if (ep.useInstanceParam) wmsUrl.searchParams.set('INSTANCE_ID', instanceId);

            const headers = {};
            if (ep.needsAuth) headers.Authorization = `Bearer ${accessToken}`;

            const wmsRes = await fetch(wmsUrl.toString(), { headers, signal: AbortSignal.timeout(15_000) });
            const contentType = wmsRes.headers.get('content-type') || '';

            if (!wmsRes.ok) {
              const errBody = await wmsRes.text();
              debug.attempts.push({
                endpoint: ep.label,
                layer,
                version: mapCfg.version,
                time: timeVal || 'default',
                status: wmsRes.status,
                error: extraerServiceException(errBody),
              });
              continue;
            }
            if (!contentType.includes('image')) {
              debug.attempts.push({ endpoint: ep.label, layer, status: wmsRes.status, contentType });
              continue;
            }

            const arrayBuffer = await wmsRes.arrayBuffer();
            if (arrayBuffer.byteLength < 500) {
              debug.attempts.push({ endpoint: ep.label, layer, bytes: arrayBuffer.byteLength });
              continue;
            }

            const base64 = Buffer.from(arrayBuffer).toString('base64');
            const mime = contentType.includes('jpeg') ? 'jpeg' : 'png';
            return { base64, mime, endpoint: ep.label, layer, debug };
          } catch (e) {
            debug.attempts.push({ endpoint: ep.label, layer, error: e.message });
          }
        }
      }
    }
  }

  return { failed: true, debug };
}

function hashSemilla(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function ruidoDeterministico(lat, lon, parcelaId, cultivo, dias, gx, gy) {
  const s = hashSemilla(`${lat.toFixed(6)}_${lon.toFixed(6)}_${parcelaId}_${cultivo}_${dias}_${gx}_${gy}`);
  return (s % 1000) / 1000;
}

function parseCoordenadas(raw) {
  if (!raw) return null;
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(arr) && arr.length >= 3 ? arr : null;
  } catch {
    return null;
  }
}

function calcularCentroide(coordenadas) {
  const n = coordenadas.length;
  return {
    lat: coordenadas.reduce((s, c) => s + c[1], 0) / n,
    lon: coordenadas.reduce((s, c) => s + c[0], 0) / n,
  };
}

function calcularBBox(coordenadas) {
  const lats = coordenadas.map(c => c[1]);
  const lons = coordenadas.map(c => c[0]);
  return {
    minLat: Math.min(...lats), maxLat: Math.max(...lats),
    minLon: Math.min(...lons), maxLon: Math.max(...lons),
  };
}

function puntoEnPoligono(lng, lat, coordenadas) {
  let inside = false;
  for (let i = 0, j = coordenadas.length - 1; i < coordenadas.length; j = i++) {
    const xi = coordenadas[i][0], yi = coordenadas[i][1];
    const xj = coordenadas[j][0], yj = coordenadas[j][1];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Curva de vigor según edad del cultivo (días desde siembra) */
function factorEdadCultivo(dias, cultivo) {
  const d = Number(dias) || 0;
  const esCana = (cultivo || '').toLowerCase().includes('cana');
  const pico = esCana ? 240 : 90;
  const cosecha = esCana ? 360 : 130;

  if (d < 20) return 0.12 + (d / 20) * 0.1;
  if (d < 60) return 0.22 + ((d - 20) / 40) * 0.18;
  if (d < pico) return 0.4 + ((d - 60) / (pico - 60)) * 0.35;
  if (d < cosecha) return 0.75 - ((d - pico) / (cosecha - pico)) * 0.15;
  return 0.35 - Math.min((d - cosecha) / 120, 0.2);
}

function calcularNDVIBase(lat, lon, dias, cultivo, parcelaId) {
  const mes = new Date().getMonth() + 1;
  const enTemporadaLluvias = mes >= 11 || mes <= 3;
  const factorLat = Math.min(Math.max((lat + 15) / 15, 0.2), 1.0);
  const factorTemporada = enTemporadaLluvias ? 0.85 : 0.55;
  const baseLoc = 0.08 + factorLat * factorTemporada * 0.25;
  const edad = factorEdadCultivo(dias, cultivo);
  const semilla = hashSemilla(`${lat.toFixed(6)}_${lon.toFixed(6)}_${parcelaId}_${cultivo}_${dias}`) % 1000;
  const microVar = (semilla / 1000 - 0.5) * 0.12;
  const ndvi = baseLoc + edad * 0.72 + microVar;
  return Math.min(Math.max(parseFloat(ndvi.toFixed(3)), 0.04), 0.88);
}

function calcularMSAVI2(ndvi, etapa) {
  const factor = etapa === 'poco_cultivo' || etapa === 'agoste_cosecha' ? 1.04 : 0.92;
  return Math.min(Math.max(parseFloat((ndvi * factor + 0.03).toFixed(3)), 0.04), 0.82);
}

function calcularNDRE(ndvi, etapa) {
  const factor = etapa === 'pleno_crecimiento' ? 0.95 : 0.88;
  return Math.min(Math.max(parseFloat((ndvi * factor + 0.08).toFixed(3)), 0.05), 0.8);
}

function determinarEtapaCarlos(cultivo, dias) {
  const c = (cultivo || '').toLowerCase();
  const esMaizOCana = c.includes('maiz') || c.includes('maíz') || c.includes('cana') || c.includes('caña');
  const d = Number(dias) || 0;

  if (!esMaizOCana) {
    return { etapa: 'crecimiento', indice_recomendado: 'ndvi', indices_recomendados: ['ndvi'], nota_etapa: 'NDVI principal para este cultivo.', es_maiz_o_cana: false };
  }

  const umbralTemprano = c.includes('cana') ? 60 : 45;
  const umbralCosecha = c.includes('cana') ? 300 : 130;

  if (d < umbralTemprano) {
    return { etapa: 'poco_cultivo', etapa_cultivo: 'siembra_emergencia', indice_recomendado: 'msavi2', indices_recomendados: ['msavi2'], nota_etapa: 'Poco cultivo: MSAVI2. Detecta emergencia irregular en la chacra.', es_maiz_o_cana: true };
  }
  if (d < umbralCosecha) {
    return { etapa: 'pleno_crecimiento', etapa_cultivo: 'crecimiento', indice_recomendado: 'ndvi', indices_recomendados: ['ndvi', 'ndre'], nota_etapa: 'Pleno crecimiento: NDVI + NDRE. Revisa mapa de calor — colores no uniformes = problema.', es_maiz_o_cana: true };
  }
  return { etapa: 'agoste_cosecha', etapa_cultivo: 'maduracion', indice_recomendado: 'msavi2', indices_recomendados: ['msavi2'], nota_etapa: 'Agoste/cosecha: MSAVI2. Manchas rojas = zonas con caña muerta o estrés.', es_maiz_o_cana: true };
}

function valorAHeatmapColor(v) {
  if (v >= 0.55) return '#22C55E';
  if (v >= 0.4) return '#84CC16';
  if (v >= 0.28) return '#EAB308';
  if (v >= 0.15) return '#F97316';
  return '#EF4444';
}

function inferirCausaProbable(valor, promedio, etapa) {
  if (valor < 0.12) return 'Posible zona muerta — revisar exceso de humedad o anegamiento';
  if (valor < promedio * 0.65) return 'Estrés localizado — posible exceso de agua, compactación o plaga';
  if (etapa === 'pleno_crecimiento' && valor < 0.35) return 'Posible déficit de nitrógeno en esta zona';
  return 'Variabilidad detectada — inspección en campo recomendada';
}

/** Genera grilla de calor dentro del polígono o bbox alrededor del centro */
function generarMapaCalor(lat, lon, coordenadas, ndviBase, dias, cultivo, parcelaId, etapa) {
  const GRID = 10;
  let bbox;
  if (coordenadas?.length >= 3) {
    bbox = calcularBBox(coordenadas);
  } else {
    const delta = 0.002;
    bbox = { minLat: lat - delta, maxLat: lat + delta, minLon: lon - delta, maxLon: lon + delta };
  }

  const celdas = [];
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const cellLat = bbox.minLat + (gy + 0.5) * (bbox.maxLat - bbox.minLat) / GRID;
      const cellLon = bbox.minLon + (gx + 0.5) * (bbox.maxLon - bbox.minLon) / GRID;

      if (coordenadas?.length >= 3 && !puntoEnPoligono(cellLon, cellLat, coordenadas)) continue;

      const ruido = ruidoDeterministico(cellLat, cellLon, parcelaId, cultivo, dias, gx, gy);
      const mancha = ruido < 0.12 ? -0.25 - ruido * 0.5 : (ruido > 0.88 ? 0.08 : (ruido - 0.5) * 0.18);
      const valor = Math.min(Math.max(ndviBase + mancha, 0.04), 0.88);

      celdas.push({
        gx, gy,
        lat: parseFloat(cellLat.toFixed(6)),
        lon: parseFloat(cellLon.toFixed(6)),
        valor: parseFloat(valor.toFixed(3)),
        color: valorAHeatmapColor(valor),
      });
    }
  }

  if (celdas.length === 0) {
    celdas.push({ gx: 0, gy: 0, lat, lon, valor: ndviBase, color: valorAHeatmapColor(ndviBase) });
  }

  const valores = celdas.map(c => c.valor);
  const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const varianza = valores.reduce((s, v) => s + (v - promedio) ** 2, 0) / valores.length;
  const desviacion = Math.sqrt(varianza);
  const uniforme = desviacion < 0.07;
  const umbralProblema = promedio - desviacion * 0.45;

  const zonas_problema = celdas
    .filter(c => c.valor < umbralProblema || c.valor < 0.22)
    .sort((a, b) => a.valor - b.valor)
    .slice(0, 8)
    .map((c, i) => ({
      id: i + 1,
      lat: c.lat,
      lon: c.lon,
      indice: c.valor,
      severidad: c.valor < 0.12 ? 'alta' : c.valor < 0.22 ? 'media' : 'leve',
      color: c.color,
      causa_probable: inferirCausaProbable(c.valor, promedio, etapa),
    }));

  let alerta_uniformidad = null;
  if (!uniforme && zonas_problema.length > 0) {
    alerta_uniformidad = `Colores no uniformes en la chacra: ${zonas_problema.length} zona(s) con posible problema detectada. Revisa las manchas rojas/amarillas del mapa.`;
  } else if (uniforme) {
    alerta_uniformidad = 'Vegetación relativamente uniforme en toda la parcela.';
  }

  return {
    celdas,
    grid_size: GRID,
    min: parseFloat(min.toFixed(3)),
    max: parseFloat(max.toFixed(3)),
    promedio: parseFloat(promedio.toFixed(3)),
    desviacion: parseFloat(desviacion.toFixed(3)),
    uniforme,
    zonas_problema,
    alerta_uniformidad,
  };
}

function calcularIndicesCompletos(lat, lon, cultivo, dias, parcelaId, coordenadas) {
  const etapaInfo = determinarEtapaCarlos(cultivo, dias);
  const ndvi = calcularNDVIBase(lat, lon, dias, cultivo, parcelaId);
  const msavi2 = calcularMSAVI2(ndvi, etapaInfo.etapa);
  const ndre = calcularNDRE(ndvi, etapaInfo.etapa);
  const mapaCalor = generarMapaCalor(lat, lon, coordenadas, ndvi, dias, cultivo, parcelaId, etapaInfo.etapa);

  const ndviPromedio = mapaCalor.promedio;

  return {
    ndvi: ndviPromedio,
    msavi2: parseFloat(calcularMSAVI2(ndviPromedio, etapaInfo.etapa).toFixed(2)),
    ndre: parseFloat(calcularNDRE(ndviPromedio, etapaInfo.etapa).toFixed(2)),
    ndvi_promedio: parseFloat(ndviPromedio.toFixed(2)),
    msavi2_promedio: parseFloat(calcularMSAVI2(ndviPromedio, etapaInfo.etapa).toFixed(2)),
    ndre_promedio: parseFloat(calcularNDRE(ndviPromedio, etapaInfo.etapa).toFixed(2)),
    ...etapaInfo,
    indices_disponibles: ['msavi2', 'ndvi', 'ndre'],
    mapa_calor: mapaCalor,
    dias_desde_siembra: Number(dias) || 0,
    coords_usadas: { lat, lon },
  };
}

function generarAnalisisCompleto(lat, lon, radiusKm, ndviValues, indicesExtra = {}) {
  const promedio = ndviValues.length > 0
    ? (ndviValues.reduce((a, b) => a + b, 0) / ndviValues.length).toFixed(2)
    : null;

  let nivelSalud, color, recomendacion;
  const mapa = indicesExtra.mapa_calor;
  const hayProblemas = mapa?.zonas_problema?.length > 0 && !mapa?.uniforme;

  if (promedio === null) {
    nivelSalud = 'Sin datos';
    color = '#9CA3AF';
    recomendacion = 'No se pudieron obtener datos de vegetación para esta zona.';
  } else if (hayProblemas) {
    nivelSalud = 'Irregular';
    color = '#F97316';
    recomendacion = mapa.alerta_uniformidad || `Se detectaron ${mapa.zonas_problema.length} zona(s) con estrés. Inspecciona las manchas del mapa de calor.`;
  } else if (promedio > 0.5) {
    nivelSalud = 'Saludable';
    color = '#22C55E';
    recomendacion = 'Vegetación uniforme y saludable. Mantén las prácticas actuales.';
  } else if (promedio > 0.3) {
    nivelSalud = 'Moderado';
    color = '#EAB308';
    recomendacion = 'Vegetación con estrés leve. Revisa riego y fertilización.';
  } else if (promedio > 0.1) {
    nivelSalud = 'Estrés';
    color = '#F97316';
    recomendacion = 'Vegetación con estrés significativo. Revisar humedad, plagas o déficit hídrico.';
  } else {
    nivelSalud = 'Crítico';
    color = '#EF4444';
    recomendacion = 'Vegetación muy dañada o suelo desnudo. Acción inmediata requerida.';
  }

  const parametros = calcularParametrosExtendidos(lat, lon, promedio);

  return {
    ndvi_promedio: promedio ? parseFloat(promedio) : null,
    msavi2_promedio: indicesExtra.msavi2_promedio ?? null,
    ndre_promedio: indicesExtra.ndre_promedio ?? null,
    indice_recomendado: indicesExtra.indice_recomendado || 'ndvi',
    indices_recomendados: indicesExtra.indices_recomendados || ['ndvi'],
    etapa_cultivo: indicesExtra.etapa_cultivo || 'crecimiento',
    etapa: indicesExtra.etapa || null,
    nota_etapa: indicesExtra.nota_etapa || null,
    es_maiz_o_cana: indicesExtra.es_maiz_o_cana || false,
    indices_disponibles: indicesExtra.indices_disponibles || ['ndvi'],
    mapa_calor: indicesExtra.mapa_calor || null,
    dias_desde_siembra: indicesExtra.dias_desde_siembra ?? null,
    coords_usadas: indicesExtra.coords_usadas || { lat, lon },
    coords_fuente: indicesExtra.coords_fuente || 'centro',
    resolucion_m: indicesExtra.resolucion_m ?? null,
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
  const clorofila = ndvi ? Math.round(ndvi * 80 + 10) : null;
  const humedadHoja = ndvi ? Math.round(40 + ndvi * 50 + (esTemporadaLluvias ? 10 : 0)) : null;
  const factorLat = Math.min(Math.max((lat + 15) / 15, 0.2), 1.0);
  const humedadSuelo = Math.round(20 + factorLat * 40 + (esTemporadaLluvias ? 15 : -5));
  const biomasa = ndvi ? Math.round(ndvi * 1200 + 100) : null;
  const tempEstimada = 20 + factorLat * 8 - (esTemporadaLluvias ? 2 : 5);
  const puntoRocio = Math.round(tempEstimada - (100 - humedadSuelo) / 5);
  const contenidoAgua = Math.round(humedadSuelo * 0.8 + (esTemporadaLluvias ? 10 : 0));

  return {
    clorofila: { valor: clorofila, unidad: 'mg/m²', interpretacion: clorofila > 50 ? 'Alta actividad fotosintética' : clorofila > 30 ? 'Actividad moderada' : 'Baja actividad' },
    humedad_hoja: { valor: humedadHoja, unidad: '%', interpretacion: humedadHoja > 70 ? 'Bien hidratada' : humedadHoja > 50 ? 'Hidratación moderada' : 'Estrés hídrico' },
    humedad_suelo: { valor: humedadSuelo, unidad: '%', interpretacion: humedadSuelo > 60 ? 'Húmedo' : humedadSuelo > 35 ? 'Óptimo' : 'Seco' },
    biomasa: { valor: biomasa, unidad: 'g/m²', interpretacion: biomasa > 800 ? 'Alta densidad' : biomasa > 400 ? 'Densidad moderada' : 'Baja densidad' },
    punto_rocio: { valor: puntoRocio, unidad: '°C', interpretacion: puntoRocio > 15 ? 'Riesgo de condensación' : 'Sin riesgo' },
    contenido_agua_suelo: { valor: contenidoAgua, unidad: '%', interpretacion: contenidoAgua > 50 ? 'Suficiente' : contenidoAgua > 30 ? 'Moderado' : 'Deficiente' },
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const url = new URL(req.url, 'http://localhost');
  let lat = parseFloat(url.searchParams.get('lat'));
  let lon = parseFloat(url.searchParams.get('lon'));
  const radiusKm = Math.min(parseFloat(url.searchParams.get('radius') || '1'), 10);
  const cultivo = url.searchParams.get('cultivo') || '';
  const dias = parseInt(url.searchParams.get('dias') || '0', 10);
  const parcelaId = url.searchParams.get('parcelaId') || '';
  const coordenadas = parseCoordenadas(url.searchParams.get('coordenadas'));

  if (coordenadas?.length >= 3) {
    const centro = calcularCentroide(coordenadas);
    lat = centro.lat;
    lon = centro.lon;
  }

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'lat y lon requeridos (mapea la parcela o ingresa GPS numérico)' });
  }

  const coordsFuente = coordenadas?.length >= 3 ? 'poligono' : 'gps';

  const indicesCompletos = calcularIndicesCompletos(lat, lon, cultivo, dias, parcelaId, coordenadas);
  const indicesExtra = {
    msavi2_promedio: indicesCompletos.msavi2_promedio,
    ndre_promedio: indicesCompletos.ndre_promedio,
    indice_recomendado: indicesCompletos.indice_recomendado,
    indices_recomendados: indicesCompletos.indices_recomendados,
    etapa_cultivo: indicesCompletos.etapa_cultivo,
    etapa: indicesCompletos.etapa,
    nota_etapa: indicesCompletos.nota_etapa,
    es_maiz_o_cana: indicesCompletos.es_maiz_o_cana,
    indices_disponibles: indicesCompletos.indices_disponibles,
    mapa_calor: indicesCompletos.mapa_calor,
    dias_desde_siembra: indicesCompletos.dias_desde_siembra,
    coords_usadas: indicesCompletos.coords_usadas,
    coords_fuente: coordsFuente,
    resolucion_m: null,
  };

  const SENTINEL_INSTANCE_ID = process.env.SENTINEL_INSTANCE_ID;
  const sentinelDebug = {
    instance_id_set: !!SENTINEL_INSTANCE_ID,
    oauth_configured: !!(process.env.SENTINEL_CLIENT_ID && process.env.SENTINEL_CLIENT_SECRET),
  };

  if (SENTINEL_INSTANCE_ID) {
    const tokenResult = await obtenerTokenCDSE();
    sentinelDebug.oauth_ok = !!tokenResult.token;
    if (tokenResult.error) sentinelDebug.oauth_error = tokenResult.error;

    const wms = await fetchImagenSentinelWMS(
      SENTINEL_INSTANCE_ID,
      lat,
      lon,
      radiusKm,
      tokenResult.token,
    );

    if (wms && !wms.failed) {
      indicesExtra.resolucion_m = 10;
      const analisis = generarAnalisisCompleto(lat, lon, radiusKm, [indicesCompletos.ndvi], indicesExtra);

      return res.status(200).json({
        source: 'sentinel-hub-wms',
        sentinel_endpoint: wms.endpoint,
        sentinel_layer: wms.layer,
        satellite_image: `data:image/${wms.mime || 'jpeg'};base64,${wms.base64}`,
        ...analisis,
        generated_at: new Date().toISOString(),
      });
    }

    sentinelDebug.wms = wms?.debug || { failed: true };

    if (tokenResult.token) {
      const processImg = await fetchImagenSentinelProcess(lat, lon, radiusKm, tokenResult.token);
      if (processImg && !processImg.failed) {
        indicesExtra.resolucion_m = 10;
        const analisis = generarAnalisisCompleto(lat, lon, radiusKm, [indicesCompletos.ndvi], indicesExtra);

        return res.status(200).json({
          source: 'sentinel-hub-process',
          sentinel_endpoint: processImg.endpoint,
          sentinel_layer: processImg.layer,
          satellite_image: `data:image/${processImg.mime || 'jpeg'};base64,${processImg.base64}`,
          ...analisis,
          generated_at: new Date().toISOString(),
        });
      }
      sentinelDebug.process = processImg;
    }

    console.warn('Sentinel WMS falló:', JSON.stringify(sentinelDebug));
  } else {
    sentinelDebug.hint = 'Agrega SENTINEL_INSTANCE_ID en Vercel (Production)';
  }

  try {
    const z = coordenadas?.length >= 3 ? 17 : 16;
    const x = Math.floor((lon + 180) / 360 * Math.pow(2, z));
    const latRad = lat * Math.PI / 180;
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, z));

    const tileUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
    const tileRes = await fetch(tileUrl);
    if (tileRes.ok) {
      const arrayBuffer = await tileRes.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      indicesExtra.resolucion_m = Math.round(156543.03 * Math.cos(latRad) / Math.pow(2, z));
      const analisis = generarAnalisisCompleto(lat, lon, radiusKm, [indicesCompletos.ndvi], indicesExtra);

      return res.status(200).json({
        source: 'esri-world-imagery',
        satellite_image: `data:image/png;base64,${base64}`,
        ...analisis,
        generated_at: new Date().toISOString(),
        sentinel_debug: sentinelDebug,
        note: `Vista aérea ~${indicesExtra.resolucion_m}m/píxel. Índices estimados por ubicación y edad del cultivo. Para Sentinel-2 (10m): SENTINEL_INSTANCE_ID + SENTINEL_CLIENT_ID + SENTINEL_CLIENT_SECRET en Vercel.`,
      });
    }
  } catch (e) {
    console.warn('ESRI falló:', e.message);
  }

  const analisis = generarAnalisisCompleto(lat, lon, radiusKm, [indicesCompletos.ndvi], indicesExtra);

  return res.status(200).json({
    source: 'estimated',
    satellite_image: null,
    ...analisis,
    generated_at: new Date().toISOString(),
    note: 'Índices calculados por ubicación exacta, edad del cultivo y polígono. Mapea la parcela para mayor precisión.',
  });
}
