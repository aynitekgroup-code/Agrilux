/**
 * src/components/layout/MobileLayout.jsx
 *
 * Experiencia móvil (PWA/Capacitor) de Agrilux.
 * Envuelve el Layout existente que ya implementa la UX móvil:
 * header compacto, navegación inferior, max-w-[430px], safe areas.
 *
 * Se mantiene como wrapper para:
 * - Preservar toda la funcionalidad actual sin duplicarla.
 * - Exponer una interfaz estable para App.jsx (WebLayout | MobileLayout).
 * - Facilitar evoluciones futuras sin tocar Layout.jsx.
 */

import React from 'react';
import Layout from '../Layout';

export default function MobileLayout({ children }) {
  return <Layout>{children}</Layout>;
}
