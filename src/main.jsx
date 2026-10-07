import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// ── Fix para APK nativo: /api/* debe ir al backend producción ──
// En web (mismo origen) se usa '/api/...' directo. En APK Capacitor el
// contenido es local (capacitor:// o https://localhost), así que no hay
// servidor /api: hay que apuntar al dominio de Vercel con CORS habilitado.
//
// NOTA: el shim se instala SIEMPRE (no solo si esNativo() al arrancar),
// porque el bridge de Capacitor puede inyectarse después del import.
// La decisión nativo/no-nativo se evalúa en cada petición.
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'https://www.vitalfarmbright.store';

function esNativo() {
  try {
    if (window.Capacitor?.isNativePlatform?.()) return true;
  } catch {}
  try {
    const p = window.location?.protocol;
    if (p === 'capacitor:' || p === 'file:') return true;
    // Con androidScheme=https el protocolo es https pero el host es local
    const h = window.location?.hostname || '';
    if ((h === 'localhost' || h === '127.0.0.1') && (window.Capacitor || window.__AGRILUX_NATIVE__)) return true;
  } catch {}
  return false;
}

// Reescribe cualquier forma de URL /api/* a absoluta contra API_BASE
function reescribirApi(u) {
  if (typeof u !== 'string' || !u) return u;
  // Relativa: /api/...
  if (u.startsWith('/api/')) return API_BASE + u;
  // Absoluta local generada con new URL('/api/...', location.origin):
  // capacitor://localhost/api/..., https://localhost/api/..., http://localhost:*/api/...
  try {
    if (/^(capacitor|file|http|https):\/\//i.test(u)) {
      const idx = u.indexOf('/api/');
      if (idx > 0) {
        const host = u.slice(0, idx);
        if (/capacitor:\/\/localhost/i.test(host) || /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) {
          return API_BASE + u.slice(idx);
        }
      }
    }
  } catch {}
  return u;
}

(function instalarShimNativo() {
  try {
    const origFetch = window.fetch.bind(window);
    window.fetch = (input, opts) => {
      if (!esNativo()) return origFetch(input, opts);
      if (typeof input === 'string') return origFetch(reescribirApi(input), opts);
      // Soporta Request (lo usa supabase-js y otros clientes)
      try {
        const url = input?.url;
        if (typeof url === 'string') {
          const nueva = reescribirApi(url);
          if (nueva !== url) input = new Request(nueva, input);
        }
      } catch {}
      return origFetch(input, opts);
    };
    // Parche XHR por si alguna lib lo usa (diagnóstico, mapas, etc.)
    try {
      const origOpen = window.XMLHttpRequest?.prototype?.open;
      if (origOpen) {
        window.XMLHttpRequest.prototype.open = function (method, url, ...rest) {
          try {
            if (esNativo() && typeof url === 'string') url = reescribirApi(url);
          } catch {}
          return origOpen.call(this, method, url, ...rest);
        };
      }
    } catch {}
    if (esNativo()) console.log('[Agrilux] Modo nativo: API_BASE =', API_BASE);
  } catch (e) {
    console.warn('[Agrilux] No se pudo instalar shim nativo:', e);
  }
})();

// Capturar el evento de instalación lo antes posible
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__installPrompt = e;
});

ReactDOM.createRoot(document.getElementById('root')).render(<App />)