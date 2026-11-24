// Cliente de lectura Hunter. La autenticación web no es una API oficial y
// debe validarse en la instalación antes de programar ejecuciones.
const BASE = 'https://mapas.hunter360.net';

function cookiesRespuesta(respuesta) {
  if (typeof respuesta.headers.getSetCookie !== 'function') throw new Error('El entorno no permite leer cookies de sesión.');
  return respuesta.headers.getSetCookie().map((c) => c.split(';', 1)[0]).filter(Boolean);
}
function combinarCookies(anteriores, nuevas) {
  const mapa = new Map();
  for (const cookie of [...anteriores, ...nuevas]) {
    const i = cookie.indexOf('=');
    if (i > 0) mapa.set(cookie.slice(0, i), cookie);
  }
  return [...mapa.values()];
}
async function pedir(fetchFn, url, opciones = {}) {
  const respuesta = await fetchFn(url, { ...opciones, redirect: 'manual', signal: AbortSignal.timeout(20000) });
  if (respuesta.status >= 500) throw new Error('Hunter no está disponible.');
  return respuesta;
}

export async function leerEstadoHunter(usuario, password, fetchFn = fetch) {
  if (!usuario || !password) throw new Error('Faltan credenciales Hunter.');
  let cookies = [];
  const inicial = await pedir(fetchFn, `${BASE}/login`);
  if (!inicial.ok) throw new Error('Hunter rechazó la página de inicio de sesión.');
  cookies = combinarCookies(cookies, cookiesRespuesta(inicial));
  const login = await pedir(fetchFn, `${BASE}/login`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookies.join('; ') },
    body: new URLSearchParams({ nick: usuario, passwd: password }),
  });
  if (login.status >= 400) throw new Error('Hunter rechazó el inicio de sesión.');
  cookies = combinarCookies(cookies, cookiesRespuesta(login));
  const lectura = await pedir(fetchFn, `${BASE}/Moviles/getVehiculos`, { headers: { cookie: cookies.join('; '), accept: 'application/json' } });
  if (!lectura.ok) throw new Error('Hunter no autorizó la consulta de unidades.');
  let datos;
  try { datos = await lectura.json(); } catch { throw new Error('Hunter no devolvió JSON de unidades; revisa el acceso o segundo factor.'); }
  if (!datos || typeof datos !== 'object' || Array.isArray(datos) || Object.keys(datos).length === 0) throw new Error('Hunter no devolvió unidades válidas.');
  return datos;
}
