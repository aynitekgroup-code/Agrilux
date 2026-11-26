/**
 * src/lib/alcanceNavegacion.js
 *
 * Alcance de la navegación según la empresa activa del usuario.
 *
 * Pomalca usa únicamente el módulo Gestión (AgroTrack): Diagnóstico, Ciclo y
 * Parcela quedan fuera del menú y sus rutas redirigen al mapa de la flota.
 * Las demás empresas conservan la navegación completa.
 */

// Correo del administrador del sistema: conserva toda la navegación para poder
// revisar cualquier módulo aunque tenga Pomalca como empresa activa.
const ADMIN_EMAIL = 'aynitek.group@gmail.com';

// Empresas cuyos usuarios solo ven el módulo Gestión.
const EMPRESAS_SOLO_GESTION = ['pomalca'];

const normalizar = (valor) => String(valor || '').trim().toLowerCase();

/**
 * Indica si el usuario en sesión debe ver únicamente el módulo Gestión.
 *
 * @param {object} [params]
 * @param {string|null} [params.empresa_activa_id] id de la empresa activa
 * @param {Array<{id: string, nombre: string}>} [params.empresas_disponibles]
 * @param {string|null} [params.email] correo del usuario en sesión
 * @returns {boolean}
 */
export function soloModuloGestion({ empresa_activa_id, empresas_disponibles, email } = {}) {
  if (normalizar(email) === ADMIN_EMAIL) return false;
  const lista = Array.isArray(empresas_disponibles) ? empresas_disponibles : [];
  const activa = lista.find((empresa) => empresa?.id === empresa_activa_id);
  return EMPRESAS_SOLO_GESTION.includes(normalizar(activa?.nombre));
}
