/**
 * src/lib/AgentContext.jsx
 * 
 * Contexto compartido entre TODOS los agentes:
 * - Diagnóstico (detecta problema → recomienda producto)
 * - Asistente de voz (responde preguntas → busca tiendas)
 * - Ciclo del cultivo (recomienda productos → busca tiendas)
 * - Búsqueda local (encuentra tiendas → muestra ofertas)
 * 
 * Flujo sincronizado:
 * 1. Diagnóstico detecta: "Tizón tardío en papa"
 * 2. Recomienda: "Mancozeb 2kg/ha"
 * 3. AgentContext comparte: {producto: "Mancozeb", cultivo: "papa", ubicacion: "..."}
 * 4. Búsqueda local busca tiendas con Mancozeb
 * 5. Asistente de voz sabe qué producto y dónde comprarlo
 * 6. Ciclo muestra link para comprar en cada etapa
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const AgentContext = createContext();

export function AgentProvider({ children }) {
  const { user } = useAuth();

  // ── Estado compartido entre agentes ──
  const [ubicacion, setUbicacion] = useState('');
  const [coords, setCoords] = useState({ lat: null, lon: null });
  const [cultivoActivo, setCultivoActivo] = useState(null);
  const [productoRecomendado, setProductoRecomendado] = useState(null);
  const [problemaDetectado, setProblemaDetectado] = useState(null);
  const [tiendasCercanas, setTiendasCercanas] = useState([]);
  const [alertasActivas, setAlertasActivas] = useState([]);
  const [historial, setHistorial] = useState([]);

  // ── Cargar ubicación del usuario al iniciar ──
  useEffect(() => {
    if (user?.ubicacion) {
      setUbicacion(user.ubicacion);
    }
    // Prioridad: 1) coords del perfil, 2) coords de localStorage, 3) GPS en tiempo real
    if (user?.coords?.lat && user?.coords?.lon) {
      setCoords({ lat: user.coords.lat, lon: user.coords.lon });
    } else {
      const savedCoords = localStorage.getItem('agrilux_coords');
      if (savedCoords) {
        try {
          const parsed = JSON.parse(savedCoords);
          if (parsed.lat && parsed.lon) setCoords(parsed);
        } catch {}
      }
      // GPS en tiempo real como último fallback
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setCoords({
              lat: pos.coords.latitude,
              lon: pos.coords.longitude,
            });
          },
          () => {},
          { enableHighAccuracy: true, timeout: 5000 }
        );
      }
    }
  }, [user?.ubicacion, user?.coords]);

  // ── Funciones para sincronizar entre agentes ──

  // Diagnóstico detecta un problema → notifica a todos los agentes
  const reportarDiagnostico = useCallback((diagnostico) => {
    setProblemaDetectado({
      nombre: diagnostico.nombre_problema,
      gravedad: diagnostico.gravedad,
      cultivo: cultivoActivo?.id,
      fecha: new Date().toISOString(),
    });

    // Si hay productos recomendados, activar búsqueda de tiendas
    if (diagnostico.productos?.length > 0) {
      const producto = diagnostico.productos[0];
      setProductoRecomendado({
        nombre: producto.nombre,
        ingrediente: producto.ingrediente_activo,
        dosis: producto.dosis,
        frecuencia: producto.frecuencia,
        cultivo: cultivoActivo?.id,
      });
    }

    // Agregar al historial
    setHistorial(prev => [...prev, {
      tipo: 'diagnostico',
      datos: diagnostico,
      fecha: new Date().toISOString(),
    }]);
  }, [cultivoActivo]);

  // Ciclo recomienda un producto → notifica a búsqueda local
  const reportarRecomendacionCiclo = useCallback((recomendacion) => {
    if (recomendacion.producto) {
      setProductoRecomendado({
        nombre: recomendacion.producto,
        etapa: recomendacion.etapa,
        cultivo: cultivoActivo?.id,
      });
    }

    setHistorial(prev => [...prev, {
      tipo: 'ciclo',
      datos: recomendacion,
      fecha: new Date().toISOString(),
    }]);
  }, [cultivoActivo]);

  // Asistente de voz busca un producto → actualizar búsqueda local
  const buscarProducto = useCallback((producto, cultivo) => {
    setProductoRecomendado({
      nombre: producto,
      cultivo: cultivo || cultivoActivo?.id,
    });
  }, [cultivoActivo]);

  // Búsqueda local encuentra tiendas → compartir con otros agentes
  const tiendasEncontradas = useCallback((tiendas) => {
    setTiendasCercanas(tiendas);
  }, []);

  // Actualizar ubicación desde cualquier agente
  const actualizarUbicacion = useCallback((nuevaUbicacion, nuevasCoords) => {
    setUbicacion(nuevaUbicacion);
    if (nuevasCoords) {
      setCoords(nuevasCoords);
    }
  }, []);

  // Actualizar cultivo activo
  const seleccionarCultivo = useCallback((cultivo) => {
    setCultivoActivo(cultivo);
  }, []);

  // Agregar alerta preventiva
  const agregarAlerta = useCallback((alerta) => {
    setAlertasActivas(prev => {
      const existe = prev.find(a => a.nombre === alerta.nombre);
      if (existe) return prev;
      return [...prev, alerta];
    });
  }, []);

  // Obtener contexto completo para el asistente de voz
  const getContextoCompleto = useCallback(() => {
    return {
      ubicacion,
      coords,
      cultivoActivo: cultivoActivo?.nombre,
      productoRecomendado: productoRecomendado?.nombre,
      problemaDetectado: problemaDetectado?.nombre,
      tiendasCercanas: tiendasCercanas.length,
      alertasActivas: alertasActivas.length,
      historial: historial.slice(-5), // Últimos 5 eventos
    };
  }, [ubicacion, coords, cultivoActivo, productoRecomendado, problemaDetectado, tiendasCercanas, alertasActivas, historial]);

  const value = {
    // Estado
    ubicacion,
    coords,
    cultivoActivo,
    productoRecomendado,
    problemaDetectado,
    tiendasCercanas,
    alertasActivas,
    historial,
    
    // Acciones
    reportarDiagnostico,
    reportarRecomendacionCiclo,
    buscarProducto,
    tiendasEncontradas,
    actualizarUbicacion,
    seleccionarCultivo,
    agregarAlerta,
    getContextoCompleto,
  };

  return (
    <AgentContext.Provider value={value}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgentes() {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error('useAgentes debe usarse dentro de AgentProvider');
  }
  return context;
}
