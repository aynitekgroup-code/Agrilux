import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// ── Fix para APK nativo: /api/* debe ir al backend producción ──
// En web (mismo origen) se usa '/api/...' directo. En APK Capacitor el
// contenido es local (capacitor:// o https://localhost), así que no hay
// servidor /api: hay que apuntar al dominio de Vercel con CORS habilitado.
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'https://www.vitalfarmbright.store';

function esNativo() {
  try {
    if (window.Capacitor?.isNativePlatform?.()) return true;
  } catch {}
  const p = location.protocol;
  if (p === 'capacitor:' || p === 'file:') return true;
  // Con androidScheme=https el protocolo es https pero el host es local
  const h = location.hostname || '';
  if (h === 'localhost' && window.Capacitor) return true;
  return false;
}

if (esNativo()) {
  const origFetch = window.fetch.bind(window);
  const reescribir = (u) =>
    typeof u === 'string' && u.startsWith('/api/') ? API_BASE + u : u;
  window.fetch = (input, opts) => {
    if (typeof input === 'string') return origFetch(reescribir(input), opts);
    // Soporta Request (lo usa supabase-js y otros clientes)
    if (input instanceof Request && input.url.startsWith('/api/')) {
      input = new Request(API_BASE + input.url, input);
    } else if (input?.url && typeof input.url === 'string' && input.url.startsWith('/api/')) {
      try { input = new Request(API_BASE + input.url, input); } catch {}
    }
    return origFetch(input, opts);
  };
  console.log('[Agrilux] Modo nativo: API_BASE =', API_BASE);
}

// Capturar el evento de instalación lo antes posible
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__installPrompt = e;
});

ReactDOM.createRoot(document.getElementById('root')).render(<App />)