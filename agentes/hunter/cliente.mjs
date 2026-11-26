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

async function iniciarSesion(usuario, password, fetchFn) {
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
  return cookies;
}

export async function leerEstadoHunter(usuario, password, fetchFn = fetch) {
  const cookies = await iniciarSesion(usuario, password, fetchFn);
  const lectura = await pedir(fetchFn, `${BASE}/Moviles/getVehiculos`, { headers: { cookie: cookies.join('; '), accept: 'application/json' } });
  if (!lectura.ok) throw new Error('Hunter no autorizó la consulta de unidades.');
  let datos;
  try { datos = await lectura.json(); } catch { throw new Error('Hunter no devolvió JSON de unidades; revisa el acceso o segundo factor.'); }
  if (!datos || typeof datos !== 'object' || Array.isArray(datos) || Object.keys(datos).length === 0) throw new Error('Hunter no devolvió unidades válidas.');
  return datos;
}

// Lectura del recorrido observado en el portal Hunter; no escribe en Agrilux.
export async function leerRecorridoHunter(usuario, password, { equipo, dia }, fetchFn = fetch) {
  const fechaMs = Date.parse(`${dia}T00:00:00Z`);
  if (!/^\d+$/.test(String(equipo || '')) || !/^\d{4}-\d{2}-\d{2}$/.test(dia || '') || !Number.isFinite(fechaMs) || new Date(fechaMs).toISOString().slice(0, 10) !== dia) {
    throw new Error('Equipo o fecha de recorrido inválidos.');
  }
  const cookies = await iniciarSesion(usuario, password, fetchFn);
  const fecha = dia.replaceAll('-', '/');
  const body = new URLSearchParams({ IdVehiculos: String(equipo), FechaIni: fecha, HoraIni: '00:00:00', FechaFin: fecha, HoraFin: '23:59:59', Puntos: 'true', Orientacion: 'false', Paradas: 'true', CellID: 'false', Panicos: 'false', Ignicion: 'true', Lugar: 'false', TiempoMinParada: '600', PuntosDescartados: 'false', AllowCreateStops: 'allow', Optimizar: 'denied', calc_use_engine: '0', average_speed: '0', calc_fuel_cons: '0', nueva_vista_activos: 'true', ShowMarkers: '1', SensorForTravel: 'velocidad', SensorId: '71', 'eventosPermitidos[all]': 'all', 'alertasPermitidos[all]': 'all' });
  const respuesta = await pedir(fetchFn, `${BASE}/Recorridos/trazarRecorridos`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookies.join('; '), accept: 'application/json' }, body });
  if (!respuesta.ok) throw new Error('Hunter rechazó la consulta del recorrido.');
  let datos;
  try { datos = await respuesta.json(); } catch { throw new Error('Hunter no devolvió un recorrido JSON válido.'); }
  const recorrido = datos?.[String(equipo)];
  if (!recorrido || !Array.isArray(recorrido.data)) throw new Error('Hunter no devolvió el recorrido esperado para el equipo.');
  return { fuente: 'hunter360', equipo: String(equipo), desde: `${dia}T00:00:00-05:00`, hasta: `${dia}T23:59:59-05:00`, recorrido };
}
