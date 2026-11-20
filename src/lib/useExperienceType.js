/**
 * src/lib/useExperienceType.js
 *
 * Hook centralizado que determina qué experiencia visual corresponde:
 * - 'mobile' → PWA/Capacitor/navegador móvil
 * - 'web'    → navegador de escritorio
 *
 * Criterios (en orden de prioridad):
 * 1. Capacitor.isNativePlatform()  → APK nativo
 * 2. display-mode: standalone      → PWA instalada
 * 3. Ancho de pantalla < 768px     → navegador móvil
 *
 * No usa el rol del usuario. No depende exclusivamente de userAgent.
 * Incluye debounce para evitar cambios inesperados al redimensionar.
 */

import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 768;

function detectExperience() {
  // Guard para entornos sin window/navigator (SSR, tests)
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'web';
  }

  // 1. APK Android / nativo mediante Capacitor
  try {
    if (
      typeof Capacitor !== 'undefined' &&
      typeof Capacitor.isNativePlatform === 'function' &&
      Capacitor.isNativePlatform()
    ) {
      return 'mobile';
    }
  } catch {
    /* Capacitor no disponible */
  }

  // 2. PWA instalada (display-mode: standalone o fullscreen)
  try {
    if (
      window.matchMedia &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches)
    ) {
      return 'mobile';
    }
  } catch {
    /* matchMedia no soportado */
  }

  // 3. Navegador móvil por ancho de pantalla (reactivo, no userAgent)
  if (window.innerWidth < MOBILE_BREAKPOINT) {
    return 'mobile';
  }

  return 'web';
}

export function useExperienceType() {
  const [experience, setExperience] = useState(() => detectExperience());

  // Cambios de tamaño con debounce para evitar switching inesperado
  useEffect(() => {
    let timeoutId = null;

    const handleResize = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const next = detectExperience();
        setExperience((prev) => (prev === next ? prev : next));
      }, 250);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Cambios de display-mode (instalación/desinstalación de PWA en caliente)
  useEffect(() => {
    if (!window.matchMedia || typeof window.matchMedia('(display-mode: standalone)').addEventListener !== 'function') {
      return;
    }
    const mql = window.matchMedia('(display-mode: standalone)');
    const handler = (e) => {
      setExperience(e.matches ? 'mobile' : detectExperience());
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return experience;
}

export default useExperienceType;
