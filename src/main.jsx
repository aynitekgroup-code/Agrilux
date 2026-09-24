import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// ── Fix para APK nativo: /api/* debe ir al dominio producción ──
const API_BASE = 'https://www.vitalfarmbright.store';
const isNative = window.Capacitor?.isNativePlatform?.() || location.protocol === 'capacitor:' || location.protocol === 'file:';
if (isNative) {
  const origFetch = window.fetch;
  window.fetch = (url, opts) => {
    if (typeof url === 'string' && url.startsWith('/api/')) url = API_BASE + url;
    return origFetch(url, opts);
  };
}

// Capturar el evento de instalación lo antes posible
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__installPrompt = e;
});

ReactDOM.createRoot(document.getElementById('root')).render(<App />)