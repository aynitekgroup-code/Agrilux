import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useAgentes } from '../lib/AgentContext';
import { CULTIVOS } from '../lib/constants';
import { getPronosticoPlagas } from '../lib/externalApis';
import { predecirPlagas, getEtapaCultivo } from '../lib/scoringModel';
import TimelineRiesgo from '../components/TimelineRiesgo';
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  Calendar,
  ChevronDown,
  ChevronUp,
  Sparkles,
  MapPin,
} from 'lucide-react';

export default function PrediccionPlagas() {
  const { user } = useAuth();
  const { coords, cultivoActivo } = useAgentes();

  const [cultivoId, setCultivoId] = useState(cultivoActivo?.id || 'papa');
  const [diasDesdeSiembra, setDiasDesdeSiembra] = useState(30);
  const [prediccion, setPrediccion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    if (cultivoActivo?.id) {
      setCultivoId(cultivoActivo.id);
    }
  }, [cultivoActivo?.id]);

  const cultivo = CULTIVOS.find((c) => c.id === cultivoId);
  const lat = coords?.lat ?? user?.coords?.lat ?? -12.05;
  const lon = coords?.lon ?? user?.coords?.lon ?? -77.04;

  const diasTranscurridos = useCallback(() => {
    const hoy = new Date();
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - diasDesdeSiembra);
    return diasDesdeSiembra;
  }, [diasDesdeSiembra]);

  const ejecutarPrediccion = useCallback(async () => {
    if (!cultivoId) return;
    setLoading(true);
    setError(null);
    try {
      const { pronostico } = await getPronosticoPlagas(lat, lon);
      const resultado = predecirPlagas(cultivoId, diasDesdeSiembra, pronostico);
      setPrediccion(resultado);
    } catch (err) {
      console.error('Error en predicción de plagas:', err);
      setError(err.message || 'No se pudo obtener el pronóstico. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [cultivoId, diasDesdeSiembra, lat, lon]);

  useEffect(() => {
    ejecutarPrediccion();
  }, [ejecutarPrediccion]);

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-screen bg-gradient-to-b from-green-50 to-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-green-100">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-green-600" />
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-tight">
                Predicción de Plagas
              </h1>
              {cultivo && (
                <p className="text-[11px] text-gray-500 flex items-center gap-1">
                  <span>{cultivo.emoji}</span>
                  <span>{cultivo.nombre}</span>
                  <span className="mx-0.5">·</span>
                  <MapPin size={10} />
                  <span>{user?.ubicacion || 'Ubicación'}</span>
                  <span className="mx-0.5">·</span>
                  <Calendar size={10} />
                  <span>{diasDesdeSiembra} días</span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={ejecutarPrediccion}
            disabled={loading}
            className="p-2 rounded-full bg-green-100 hover:bg-green-200 text-green-700 transition-colors disabled:opacity-50"
            aria-label="Refrescar predicción"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Config panel toggle */}
      <div className="px-4 mt-3">
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className="w-full flex items-center justify-between px-3 py-2 bg-white rounded-xl border border-gray-200 shadow-sm text-sm font-medium text-gray-700 hover:border-green-300 transition-colors"
        >
          <span>Configurar análisis</span>
          {panelOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Config panel */}
      <div
        className={`mx-4 overflow-hidden transition-all duration-300 ease-in-out ${
          panelOpen ? 'max-h-60 opacity-100 mt-2' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Cultivo
            </label>
            <select
              value={cultivoId}
              onChange={(e) => setCultivoId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none"
            >
              {CULTIVOS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Días desde siembra
            </label>
            <input
              type="number"
              min={0}
              max={365}
              value={diasDesdeSiembra}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) setDiasDesdeSiembra(Math.min(365, Math.max(0, val)));
              }}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Etapa actual: {getEtapaCultivo(cultivoId, diasDesdeSiembra)}
            </p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="px-4 mt-4">
        {loading && !prediccion && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 size={32} className="animate-spin text-green-600" />
            <p className="text-sm text-gray-500 text-center">
              Analizando pronóstico climático...
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center space-y-3">
            <AlertTriangle size={24} className="mx-auto text-red-500" />
            <p className="text-sm text-red-700 font-medium">{error}</p>
            <button
              onClick={ejecutarPrediccion}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium rounded-lg transition-colors"
            >
              <RefreshCw size={14} />
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && !prediccion && (
          <div className="text-center py-20 space-y-2">
            <Sparkles size={40} className="mx-auto text-green-300" />
            <p className="text-sm text-gray-500">
              Selecciona un cultivo y días de siembra para ver predicciones
            </p>
          </div>
        )}

        {!loading && prediccion && (
          <TimelineRiesgo timeline={prediccion.timeline} resumen={prediccion.resumen} />
        )}
      </div>

      {/* Bottom recommendations */}
      {!loading && prediccion?.resumen?.recomendacionesPrincipales?.length > 0 && (
        <div className="px-4 mt-5">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <AlertTriangle size={14} className="text-orange-500" />
              Recomendaciones principales
            </h3>
            <ul className="space-y-2">
              {prediccion.resumen.recomendacionesPrincipales.map((rec, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs text-gray-600 leading-relaxed"
                >
                  <span className="text-green-500 mt-0.5 shrink-0">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-center text-[10px] text-gray-400 mt-4 px-6">
            Basado en pronóstico Open-Meteo a 16 días. Las predicciones se mejoran
            con el uso.
          </p>
        </div>
      )}
    </div>
  );
}
