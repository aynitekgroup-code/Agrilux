/**
 * src/components/AgentStatus.jsx
 * 
 * Muestra el estado sincronizado de TODOS los agentes:
 * - Diagnóstico: qué problema detectó
 * - Ciclo: qué etapa está y qué recomienda
 * - Búsqueda: qué tiendas encontró
 * - Alertas: qué riesgos predijo
 * 
 * El agricultor ve UNA sola vista con toda la info sincronizada.
 */

import React from 'react';
import { useAgentes } from '../lib/AgentContext';
import { AlertTriangle, CheckCircle, Store, Calendar, Bell, MapPin } from 'lucide-react';

export default function AgentStatus() {
  const {
    ubicacion,
    coords,
    cultivoActivo,
    productoRecomendado,
    problemaDetectado,
    tiendasCercanas,
    ofertasRegistradas,
    alertasActivas,
    historial,
  } = useAgentes();

  // No mostrar si no hay nada relevante
  const tieneActividad = problemaDetectado || productoRecomendado || tiendasCercanas.length > 0 || ofertasRegistradas.length > 0 || alertasActivas.length > 0;
  if (!tieneActividad) return null;

  return (
    <div className="bg-gradient-to-r from-primary/5 to-emerald-50 rounded-2xl p-4 border border-primary/10">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
          <span className="text-white text-sm">🤖</span>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-800">Agentes Sincronizados</p>
          <p className="text-[10px] text-gray-500">
            {cultivoActivo?.emoji} {cultivoActivo?.nombre || 'Sin cultivo'} · {coords?.lat ? `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}` : ubicacion || 'Sin ubicación'}
          </p>
        </div>
      </div>

      {/* Estado de cada agente */}
      <div className="space-y-2">
        {/* Diagnóstico */}
        {problemaDetectado && (
          <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-gray-100">
            <AlertTriangle size={14} className="text-orange-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-700 truncate">
                Detectado: {problemaDetectado.nombre}
              </p>
              <p className="text-[10px] text-gray-400">Agente de Diagnóstico</p>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              problemaDetectado.gravedad === 'critica' ? 'bg-red-100 text-red-700' :
              problemaDetectado.gravedad === 'grave' ? 'bg-orange-100 text-orange-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>
              {problemaDetectado.gravedad}
            </span>
          </div>
        )}

        {/* Producto recomendado */}
        {productoRecomendado && (
          <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-gray-100">
            <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-700 truncate">
                Recomendado: {productoRecomendado.nombre}
              </p>
              <p className="text-[10px] text-gray-400">
                {productoRecomendado.dosis ? `Dosis: ${productoRecomendado.dosis}` : 'Agente de Ciclo'}
              </p>
            </div>
            <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
              Producto
            </span>
          </div>
        )}

        {/* Ofertas registradas */}
        {ofertasRegistradas.length > 0 && (
          <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-gray-100">
            <Store size={14} className="text-emerald-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-700">
                {ofertasRegistradas.length} ofertas de tiendas registradas
              </p>
              <p className="text-[10px] text-gray-400">Mercado Agrilux</p>
            </div>
            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
              Ofertas
            </span>
          </div>
        )}

        {/* Tiendas encontradas */}
        {tiendasCercanas.length > 0 && (
          <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-gray-100">
            <Store size={14} className="text-blue-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-700">
                {tiendasCercanas.length} tiendas en tu zona
              </p>
              <p className="text-[10px] text-gray-400">Agente de Búsqueda Local</p>
            </div>
            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
              {tiendasCercanas[0]?.distanciaKm || '?'} km
            </span>
          </div>
        )}

        {/* Alertas preventivas */}
        {alertasActivas.length > 0 && (
          <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-gray-100">
            <Bell size={14} className="text-red-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-700">
                {alertasActivas.length} alertas preventivas activas
              </p>
              <p className="text-[10px] text-gray-400">Agente Predictivo</p>
            </div>
            <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">
              Riesgo
            </span>
          </div>
        )}

        {/* Último evento del historial */}
        {historial.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            <p className="text-[10px] text-gray-400">
              Último evento: {historial[historial.length - 1].tipo} · {new Date(historial[historial.length - 1].fecha).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
