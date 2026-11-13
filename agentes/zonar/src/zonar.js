/**
 * agentes/zonar/src/zonar.js
 * Cliente HTTP de Zonar (https://app.tsomobile.com) — el mismo flujo que usa
 * la plataforma web, en versión resumida:
 *
 *   1) GET /wcf/AuthenticationController/ValidateUser  -> token (login, AppID 38)
 *   2) GET /wcf/MappingController/GetUnitsLocator      -> TODAS las unidades
 *      (jsonparams {"units":"-99,0|"} = "All Units", como en la UI)
 *   3) GET /wcf/MappingController/GetUnitsHistory      -> historial GPS por
 *      unidad y rango (entityname=historicallocations), el mismo dato que la
 *      UI exporta como Excel "Ubicaciones históricas".
 *
 * Todo sale por la IP de la máquina donde corre este agente (la PC de Carlos).
 */

const TIMEOUT_MS = 60000;
const RE_INTENTOS = 3;

function dormir(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** GET con reintentos; devuelve el cuerpo parseado (JSON o texto). */
async function pedir(url, { reintentos = RE_INTENTOS, aceptarTexto = false } = {}) {
  let ultimo = null;
  for (let intento = 1; intento <= reintentos; intento += 1) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json, text/plain, */*' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: 'follow',
      });
      const texto = await res.text();
      if (!res.ok) {
        ultimo = new Error(`HTTP ${res.status} en ${rutaSegura(url)}${texto ? `: ${texto.slice(0, 200)}` : ''}`);
        await dormir(1000 * intento);
        continue;
      }
      if (!texto) return null;
      try {
        return desdoblar(texto);
      } catch {
        if (aceptarTexto) return texto;
        throw new Error(`Respuesta no-JSON en ${rutaSegura(url)}: ${texto.slice(0, 200)}`);
      }
    } catch (e) {
      ultimo = e;
      await dormir(1000 * intento);
    }
  }
  throw ultimo || new Error(`Sin respuesta de ${rutaSegura(url)}`);
}

/** El WCF a veces devuelve JSON "doblado" (un string que contiene JSON). */
function desdoblar(texto) {
  let valor = typeof texto === 'string' ? JSON.parse(texto) : texto;
  let vueltas = 0;
  while (typeof valor === 'string' && vueltas < 3) {
    try {
      valor = JSON.parse(valor);
    } catch {
      break;
    }
    vueltas += 1;
  }
  return valor;
}

/** URL sin credenciales para los mensajes de error. */
function rutaSegura(url) {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) u.searchParams.set(k, '***');
    return u.toString();
  } catch {
    return url.slice(0, 80);
  }
}

/** Fecha de HOY en hora de Perú (YYYY-MM-DD). */
export function hoyPeru() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** YYYY-MM-DD -> YYYY-MM-DD restando n días (sin depender de la TZ de la PC). */
export function restarDias(fechaIso, n) {
  const [y, m, d] = fechaIso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() - n);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** 1) Login: devuelve el token de sesión de Zonar. */
export async function loginZonar(z) {
  const params = new URLSearchParams({
    login: z.usuario,
    password: z.password,
    AppID: String(z.appid),
    IPAddress: '',
    lang: z.lang,
  });
  const url = `${z.base}/wcf/AuthenticationController/ValidateUser?${params}`;
  const rs = await pedir(url);
  const codigo = rs?.Result?.Code;
  if (Number(codigo) !== 1) {
    const msg = rs?.Result?.Message || 'respuesta sin Result.Code=1';
    if (/password|contrase|invalid|user/i.test(String(msg)) || !rs?.token) {
      throw new Error(`Zonar rechazó el inicio de sesión: ${msg}. Revisa usuario/contraseña en configurar.mjs.`);
    }
    throw new Error(`Zonar devolvió un login inesperado: ${msg}`);
  }
  if (!rs.token) throw new Error('Zonar no devolvió token de sesión.');
  return {
    token: rs.token,
    userId: rs.userId ?? null,
    fullname: rs.FullName ?? '',
    companyid: rs.companyId ?? null,
  };
}

/**
 * 2) Lista TODAS las unidades con su UnitID (lo que la UI llama "All Units":
 *    jsonparams {"units":"-99,0|"}), usando GetUnitsLocator.
 * @returns {Promise<Array<object>>} marcadores crudos (MarkerName, UnitID, …)
 */
export async function crudoUnidades(z, tkn) {
  const jsonparams = JSON.stringify({ units: '-99,0|' });
  const url = `${z.base}/wcf/MappingController/GetUnitsLocator`
    + `?tkn=${encodeURIComponent(tkn)}&jsonparams=${encodeURIComponent(jsonparams)}`
    + `&lan=${encodeURIComponent(z.lang)}&entityname=unitslocator`;
  const marcas = await pedir(url);
  if (!Array.isArray(marcas)) {
    throw new Error(`GetUnitsLocator no devolvió una lista (tipo ${typeof marcas}).`);
  }
  return marcas;
}

/**
 * Misma llamada que crudoUnidades, ya normalizada a {unitId, nombre}.
 * @returns {Promise<Array<{unitId: string|number, nombre: string}>>}
 */
export async function listarUnidades(z, tkn) {
  const marcas = await crudoUnidades(z, tkn);
  const vistas = new Set();
  const unidades = [];
  for (const marca of marcas) {
    const unitId = marca?.UnitID ?? marca?.unitId ?? marca?.MarkerID;
    const nombre = String(marca?.MarkerName ?? marca?.Unit ?? marca?.MarkerID ?? '').trim();
    if (unitId === null || unitId === undefined || unitId === '' || !nombre) continue;
    const clave = String(unitId);
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    unidades.push({ unitId, nombre });
  }
  if (!unidades.length) {
    throw new Error('GetUnitsLocator no devolvió unidades (¿token expirado?).');
  }
  return unidades;
}

/**
 * 3) Historial GPS de UNIDAD para un rango de fechas (días completos,
 *    hora de Perú como en la UI: 00:00:00 a 23:59:59).
 *    Respuesta cruda (el WCF puede devolver JSON doble).
 */
export async function crudoHistorial(z, tkn, { unitId, desde, hasta }) {
  const jsonparams = JSON.stringify({
    unit: unitId,
    datefrom: `${desde} 00:00:00`,
    dateto: `${hasta} 23:59:59`,
  });
  const url = `${z.base}/wcf/MappingController/GetUnitsHistory`
    + `?tkn=${encodeURIComponent(tkn)}&jsonparams=${encodeURIComponent(jsonparams)}`
    + `&lan=${encodeURIComponent(z.lang)}&entityname=historicallocations`;
  const datos = await pedir(url);
  let lista = datos;
  if (typeof lista === 'string') lista = desdoblar(lista);
  if (!Array.isArray(lista)) {
    throw new Error(`GetUnitsHistory no devolvió una lista (tipo ${typeof lista}).`);
  }
  return lista;
}

/** Misma llamada que crudoHistorial, lista para armarFilaZonar. */
export async function historialUnidad(z, tkn, params) {
  return crudoHistorial(z, tkn, params);
}

/**
 * Best-effort (solo modo descubrir): árbol de grupos y unidades desde la API
 * REST (rest.tsomobile.com), el que alimenta el treeview de la UI.
 */
export async function crudoArbolUnidades(z, tkn) {
  const url = `${z.api}/ApplicationController/GetDynamicInfo`
    + `?sp=units.LoadUnits_TEMP&tkn=${encodeURIComponent(tkn)}`
    + `&key=GROUPSANDUNITS&id=-1&lan=${encodeURIComponent(z.lang)}`;
  return pedir(url, { reintentos: 1 });
}

export { dormir };
