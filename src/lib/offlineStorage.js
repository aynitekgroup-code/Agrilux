/**
 * src/lib/offlineStorage.js
 * Almacenamiento offline con IndexedDB para Agrilux
 * 
 * Guarda localmente:
 * - Diagnósticos realizados
 * - Recomendaciones del ciclo
 * - Datos de clima/suelo cacheados
 * - Parcelas y registros
 * - Fotos comprimidas
 * 
 * Sincroniza cuando vuelve la red.
 */

const DB_NAME = 'agrilux-offline';
const DB_VERSION = 1;

const STORES = {
  diagnosticos: 'diagnosticos',     // Diagnósticos IA realizados
  recomendaciones: 'recomendaciones', // Recomendaciones del ciclo
  clima: 'clima',                    // Datos climáticos cacheados
  suelo: 'suelo',                    // Datos de suelo cacheados
  parcelas: 'parcelas',              // Parcelas del usuario
  registros: 'registros',            // Registros de monitoreo
  pendientes: 'pendientes',          // Operaciones pendientes de sync
  fotos: 'fotos',                    // Fotos comprimidas (base64)
};

// ── Abrir DB ────────────────────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      Object.values(STORES).forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('userId', 'userId', { unique: false });
        }
      });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ── Genérico: guardar ───────────────────────────────────────────────────────
async function guardar(storeName, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const item = { ...data, timestamp: Date.now(), sync: false };
    const req = store.add(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Genérico: obtener todos ──────────────────────────────────────────────────
async function obtenerTodos(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// ── Genérico: obtener por userId ─────────────────────────────────────────────
async function obtenerPorUser(storeName, userId) {
  const todos = await obtenerTodos(storeName);
  return todos.filter((item) => item.userId === userId);
}

// ── Genérico: eliminar ───────────────────────────────────────────────────────
async function eliminar(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Genérico: limpiar store ──────────────────────────────────────────────────
async function limpiar(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Obtener pendientes de sync ───────────────────────────────────────────────
async function obtenerPendientes() {
  return obtenerTodos(STORES.pendientes);
}

// ── Marcar como sincronizado ─────────────────────────────────────────────────
async function marcarSync(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.get(id);
    req.onsuccess = () => {
      const item = req.result;
      if (item) {
        item.sync = true;
        store.put(item);
      }
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

// ── Guardar diagnóstico offline ──────────────────────────────────────────────
async function guardarDiagnosticoOffline(diagnostico) {
  const id = await guardar(STORES.diagnosticos, {
    ...diagnostico,
    offline: true,
    sync: false,
  });
  // También guardar como pendiente de sync
  await guardar(STORES.pendientes, {
    tipo: 'diagnostico',
    data: diagnostico,
    originalId: id,
  });
  return id;
}

// ── Guardar foto offline ────────────────────────────────────────────────────
async function guardarFotoOffline(foto) {
  return guardar(STORES.fotos, foto);
}

// ── Obtener fotos offline ───────────────────────────────────────────────────
async function obtenerFotosOffline() {
  return obtenerTodos(STORES.fotos);
}

// ── Guardar clima cacheado ──────────────────────────────────────────────────
async function guardarClima(lat, lon, datos) {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.clima, 'readwrite');
    const store = tx.objectStore(STORES.clima);
    const req = store.put({
      id: key,
      lat,
      lon,
      datos,
      timestamp: Date.now(),
    });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Obtener clima cacheado (válido 6 horas) ────────────────────────────────
async function obtenerClimaCacheado(lat, lon) {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.clima, 'readonly');
    const store = tx.objectStore(STORES.clima);
    const req = store.get(key);
    req.onsuccess = () => {
      const item = req.result;
      if (!item) return resolve(null);
      // Válido por 6 horas
      const seisHoras = 6 * 60 * 60 * 1000;
      if (Date.now() - item.timestamp > seisHoras) {
        return resolve(null); // Expirado
      }
      resolve(item.datos);
    };
    req.onerror = () => reject(req.error);
  });
}

// ── Verificar si hay conexión ────────────────────────────────────────────────
function isOnline() {
  return navigator.onLine;
}

// ── Escuchar cambios de conexión ─────────────────────────────────────────────
function onConnectionChange(callback) {
  window.addEventListener('online', () => callback(true));
  window.addEventListener('offline', () => callback(false));
}

export {
  guardarDiagnosticoOffline,
  guardarFotoOffline,
  obtenerFotosOffline,
  guardarClima,
  obtenerClimaCacheado,
  obtenerTodos,
  obtenerPorUser,
  guardar,
  eliminar,
  limpiar,
  obtenerPendientes,
  marcarSync,
  isOnline,
  onConnectionChange,
  STORES,
};
