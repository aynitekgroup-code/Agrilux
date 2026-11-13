/**
 * agentes/zonar/src/config.js
 * Configuración y rutas del agente.
 *
 * Las credenciales NUNCA viven en el repo: se guardan en
 * %APPDATA%\agrilux-zonar\config.json (fuera del repositorio) y esa carpeta
 * está ignorada por .gitignore.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const HOME = process.env.AGROTRACK_ZONAR_HOME
  || path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'agrilux-zonar');

export const RUTAS = {
  home: HOME,
  config: path.join(HOME, 'config.json'),
  logs: path.join(HOME, 'logs'),
  descargas: path.join(HOME, 'descargas'),
  descubrimiento: path.join(HOME, 'descubrimiento'),
  estado: path.join(HOME, 'estado.json'),
};

export function asegurarCarpetas() {
  for (const dir of [HOME, RUTAS.logs, RUTAS.descargas, RUTAS.descubrimiento]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Valida la forma mínima del config.json y lanza errores claros en español. */
function validar(cfg) {
  const faltan = [];
  if (!cfg?.zonar?.base) faltan.push('zonar.base');
  if (!cfg?.zonar?.usuario) faltan.push('zonar.usuario');
  if (!cfg?.zonar?.password) faltan.push('zonar.password');
  if (!cfg?.agrilux?.url) faltan.push('agrilux.url');
  if (!cfg?.agrilux?.anon_key) faltan.push('agrilux.anon_key');
  if (!cfg?.agrilux?.email) faltan.push('agrilux.email');
  if (!cfg?.agrilux?.password) faltan.push('agrilux.password');
  if (faltan.length) {
    throw new Error(`La configuración está incompleta (falta ${faltan.join(', ')}). Ejecuta "node configurar.mjs".`);
  }
  return {
    zonar: {
      base: String(cfg.zonar.base).replace(/\/+$/, ''),
      api: String(cfg.zonar.api || cfg.zonar.base).replace(/\/+$/, ''),
      usuario: cfg.zonar.usuario,
      password: cfg.zonar.password,
      appid: cfg.zonar.appid || 38,
      lang: cfg.zonar.lang || 'es',
    },
    agrilux: {
      url: String(cfg.agrilux.url).replace(/\/+$/, ''),
      anon_key: cfg.agrilux.anon_key,
      email: cfg.agrilux.email,
      password: cfg.agrilux.password,
      empresa_id: cfg.agrilux.empresa_id || null,
    },
    corrida: {
      hora: cfg.corrida?.hora || '05:30',
      fecha_modo: cfg.corrida?.fecha_modo || 'auto',
      delay_ms: Number(cfg.corrida?.delay_ms ?? 400),
      guardar_json: cfg.corrida?.guardar_json !== false,
      reten_dias: Number(cfg.corrida?.reten_dias ?? 30),
      max_unidades: Number(cfg.corrida?.max_unidades ?? 0),
    },
  };
}

export function cargarConfig() {
  if (!fs.existsSync(RUTAS.config)) {
    throw new Error(
      `Falta la configuración. Ejecuta primero: node configurar.mjs`
      + ` (se guarda en ${RUTAS.config}).`,
    );
  }
  let crudo;
  try {
    crudo = JSON.parse(fs.readFileSync(RUTAS.config, 'utf8'));
  } catch (e) {
    throw new Error(`No se pudo leer ${RUTAS.config}: ${e.message}`);
  }
  return validar(crudo);
}

/** Guarda el config (modo escritura; se usa desde configurar.mjs). */
export function guardarConfig(cfg) {
  asegurarCarpetas();
  fs.writeFileSync(RUTAS.config, `${JSON.stringify(cfg, null, 2)}\n`, { mode: 0o600 });
  return RUTAS.config;
}
