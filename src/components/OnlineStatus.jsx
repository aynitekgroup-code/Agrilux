import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Cloud, CloudOff } from 'lucide-react';
import { isOnline, onConnectionChange, obtenerPendientes } from '../lib/offlineStorage';

/**
 * OnlineStatus — Indicador de estado offline/online
 * Muestra un banner cuando no hay conexión y cuántos diagnósticos están pendientes de sync.
 */
export default function OnlineStatus() {
  const [online, setOnline] = useState(isOnline());
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => {
    const checkPendientes = async () => {
      try {
        const p = await obtenerPendientes();
        setPendientes(p.length);
      } catch { /* ignore */ }
    };

    checkPendientes();
    const interval = setInterval(checkPendientes, 30000);

    const unsub = onConnectionChange((isNowOnline) => {
      setOnline(isNowOnline);
      if (isNowOnline) checkPendientes();
    });

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', unsub);
      window.removeEventListener('offline', unsub);
    };
  }, []);

  // No mostrar nada si está online y sin pendientes
  if (online && pendientes === 0) return null;

  return (
    <div className={`
      px-4 py-2 text-xs font-medium flex items-center justify-center gap-2
      ${online
        ? 'bg-amber-50 text-amber-700 border-b border-amber-200'
        : 'bg-red-50 text-red-700 border-b border-red-200'
      }
    `}>
      {online ? (
        <>
          <Cloud size={14} className="text-amber-500" />
          <span>Sincronizando {pendientes} {pendientes === 1 ? 'diagnóstico' : 'diagnósticos'} pendientes...</span>
        </>
      ) : (
        <>
          <WifiOff size={14} className="text-red-500" />
          <span>Sin conexión — tus datos se guardan localmente</span>
        </>
      )}
    </div>
  );
}
