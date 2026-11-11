/**
 * src/modules/diagnostico/components/DiagnosticCard.jsx
 *
 * Tarjeta central unificada del módulo Diagnóstico IA.
 * Contiene toda la interacción principal del usuario:
 *   - Carga de fotos (cámara / subir archivo)
 *   - Área de texto con activación de voz integrada
 *   - Botón principal de análisis
 *
 * Diseño con Tailwind: flex-col, items-center, gap-*, max-w-*
 * para mantener proporciones limpias en laptop sin scroll vertical.
 */

import React from 'react';
import {
  Camera,
  Mic,
  MicOff,
  Upload,
  X,
  MapPin,
  ChevronDown,
  Plus,
  ArrowRight,
  Navigation,
  Loader2,
} from 'lucide-react';

const PRIMARY = 'bg-[#1a6b3c] text-white hover:bg-[#14522e]';

const CULTIVOS = [
  { id: 'papa', nombre: 'Papa', emoji: '🥔' },
  { id: 'maiz', nombre: 'Maíz', emoji: '🌽' },
  { id: 'palta', nombre: 'Palta', emoji: '🥑' },
  { id: 'arandano', nombre: 'Arándano', emoji: '🫐' },
  { id: 'cana', nombre: 'Caña de azúcar', emoji: '🍃' },
  { id: 'platano', nombre: 'Plátano', emoji: '🍌' },
];

/**
 * DiagnosticCard — tarjeta central de diagnóstico.
 *
 * @param {Object} props
 * @param {Array} props.fotos - Lista de fotos ya cargadas
 * @param {number} props.currentIndex - Índice de la foto actual
 * @param {Function} props.setFotos - Callback al cambiar fotos
 * @param {Function} props.setCurrentIndex - Callback al cambiar índice actual
 * @param {string} props.pregunta - Texto de consulta del usuario
 * @param {Function} props.setPregunta - Callback al cambiar texto
 * @param {boolean} props.grabando - Estado de grabación de voz
 * @param {Function} props.grabarVozConsulta - Callback para iniciar/detener grabación de voz
 * @param {boolean} props.puedeAnalizar - Puede analizar (fotos o texto presente)
 * @param {boolean} props.analizando - Está analizando
 * @param {Function} props.analizar - Callback de análisis
 * @param {Object} props.cultivo - Cultivo seleccionado { id, nombre, emoji }
 * @param {Function} props.setCultivo - Callback al cambiar cultivo
 * @param {Object} props.fileRef - Ref del input de archivo
 * @param {Object} props.cameraRef - Ref del input de cámara
 * @param {Function} props.handleFoto - Manejador de archivos
 * @param {string} props.ubicacionEfectiva - Ubicación efectiva mostrada
 * @param {Object|null} props.coords - Coordenadas GPS { lat, lon }
 * @param {boolean} props.mostrarSelectorUbicacion - Mostrar selector de ubicación
 * @param {Function} props.setMostrarSelectorUbicacion - Callback para mostrar/ocultar selector
 * @param {Function} props.setUbicacion - Callback al cambiar ubicación
 * @param {Function} props.actualizarUbicacion - Callback para actualizar ubicación en contexto
 */
export default function DiagnosticCard({
  fotos,
  setFotos,
  currentIndex,
  setCurrentIndex,
  pregunta,
  setPregunta,
  grabando,
  grabarVozConsulta,
  puedeAnalizar,
  analizando,
  analizar,
  cultivo,
  setCultivo,
  fileRef,
  cameraRef,
  handleFoto,
  ubicacionEfectiva,
  coords,
  mostrarSelectorUbicacion,
  setMostrarSelectorUbicacion,
  setUbicacion,
  actualizarUbicacion,
}) {
  const ubicacionInputRef = React.useRef(null);

  const ubicacionValida = (ubi) =>
    ubi.trim() !== '' &&
    ubi !== 'Lugar aproximado no identificado' &&
    !/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(ubi.trim());

  const handleCambiarUbicacion = () => {
    setMostrarSelectorUbicacion(true);
  };

  const handleDefinirZona = () => {
    setMostrarSelectorUbicacion(true);
  };

  const handleSeleccionarCultivo = (c) => {
    setCultivo(c);
  };

  return (
    <section className="space-y-4">
      {/* ── ZONA UNIFICADA: foto + texto + voz ── */}
      <div className="bg-gradient-to-b from-primary to-primary-dark text-white rounded-3xl overflow-hidden shadow-lg border border-primary/30">
        {/* Área de foto */}
        <div className="border-b border-white/10 p-5">
          {fotos.length === 0 ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-white font-bold text-sm text-center">Foto del cultivo (opcional)</p>
              <div className="flex gap-3 w-full max-w-[560px] mx-auto">
                <button
                  onClick={() => cameraRef.current && cameraRef.current.click()}
                  className="flex-1 flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 text-white font-bold py-4 rounded-2xl transition-all active:scale-[0.97]"
                >
                  <Camera size={20} />
                  <span className="text-sm">Tomar foto</span>
                </button>
                <button
                  onClick={() => fileRef.current && fileRef.current.click()}
                  className="flex-1 flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 text-white font-bold py-4 rounded-2xl transition-all active:scale-[0.97]"
                >
                  <Upload size={20} />
                  <span className="text-sm">Subir foto</span>
                </button>
              </div>
              <p className="text-white/50 text-xs text-center">Hoja, tallo, raíz o fruto</p>
            </div>
          ) : (
            <div>
              <div className="relative max-w-[560px] mx-auto">
                <img
                  src={fotos[currentIndex]?.preview}
                  alt="foto principal"
                  className="w-full h-52 object-contain rounded-2xl bg-black/20 mx-auto"
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFotos((prev) => prev.filter((_, j) => j !== currentIndex));
                    setCurrentIndex(0);
                  }}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center"
                >
                  <X size={14} />
                </button>
                {fotos.length > 1 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentIndex((i) => (i - 1 + fotos.length) % fotos.length);
                      }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full w-8 h-8 flex items-center justify-center"
                    >
                      ‹
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentIndex((i) => (i + 1) % fotos.length);
                      }}
                      className="absolute right-10 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full w-8 h-8 flex items-center justify-center"
                    >
                      ›
                    </button>
                  </>
                )}
              </div>
              {fotos.length > 1 && (
                <div className="flex gap-2 mt-2 overflow-x-auto justify-center">
                  {fotos.map((f, i) => (
                    <div
                      key={i}
                      className={`relative flex-shrink-0 ${i === currentIndex ? 'ring-2 ring-white rounded-lg' : ''}`}
                    >
                      <img
                        src={f.preview}
                        alt={`thumb-${i}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentIndex(i);
                        }}
                        className="w-14 h-14 object-cover rounded-lg cursor-pointer"
                      />
                    </div>
                  ))}
                  <div
                    className="w-14 h-14 border border-dashed border-white/40 rounded-lg flex items-center justify-center text-white/60 cursor-pointer flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileRef.current && fileRef.current.click();
                    }}
                  >
                    <Camera size={16} />
                  </div>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFoto}
                className="hidden"
              />
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                onChange={handleFoto}
                className="hidden"
              />
            </div>
          )}
        </div>

        {/* Área de texto + voz */}
        <div className="p-4">
          <div className="flex items-end gap-2 max-w-[560px] mx-auto">
            <textarea
              value={pregunta}
              onChange={(e) => setPregunta(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (puedeAnalizar && !analizando) analizar();
                }
              }}
              placeholder={
                fotos.length > 0
                  ? 'Opcional: describe qué ves o haz una pregunta...'
                  : 'Describe el problema de tu cultivo o pregunta algo...'
              }
              rows={2}
              className="flex-1 bg-white/10 text-white placeholder-white/40 border border-white/20 rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-white/50"
            />
            {/* Botón micrófono integrado dentro del contenedor de texto */}
            <button
              onClick={grabarVozConsulta}
              className={`flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
                grabando ? 'bg-red-500 animate-pulse' : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              {grabando ? (
                <MicOff size={18} className="text-white" />
              ) : (
                <Mic size={18} className="text-white" />
              )}
            </button>
          </div>
          {grabando && (
            <p className="text-white/60 text-xs mt-2 text-center flex items-center justify-center gap-1 max-w-[560px] mx-auto">
              <span className="w-2 h-2 bg-red-400 rounded-full animate-ping inline-block" /> Escuchando...
            </p>
          )}
        </div>
      </div>

      {/* ── Ubicación ── */}
      {ubicacionEfectiva ? (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 max-w-[560px] mx-auto">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0 pt-1">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                  <MapPin size={18} className="text-orange-600" />
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">
                  📍 Coordenadas
                </p>
                <p className="text-base font-semibold text-gray-900">
                  {coords?.lat != null && coords?.lon != null
                    ? `${Number(coords.lat).toFixed(4)}, ${Number(coords.lon).toFixed(4)}`
                    : ubicacionEfectiva}
                </p>
                {ubicacionValida(ubicacionEfectiva) && (
                  <p className="text-sm text-gray-500 mt-1 break-words">{ubicacionEfectiva}</p>
                )}
              </div>
            </div>
            <button
              onClick={handleCambiarUbicacion}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all flex-shrink-0 ml-3"
            >
              Cambiar ubicación
              <ChevronDown size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-orange-50 rounded-2xl p-4 border border-orange-200 max-w-[560px] mx-auto">
          <div className="flex items-start gap-3 mb-3">
            <div className="flex-shrink-0 pt-0.5">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                <MapPin size={18} className="text-orange-600" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">
                Zona no definida
              </p>
              <p className="text-base font-semibold text-gray-900 mb-2">Ubicación desactivada</p>
              <p className="text-sm text-gray-600 mb-3">
                Activa el GPS o elige tu zona para calibrar plagas y clima local con precisión.
              </p>
              <p className="text-xs text-gray-500 mb-4 flex items-center gap-1">
                <Navigation size={14} className="text-orange-600" />
                GPS · Voz · Búsqueda
              </p>
            </div>
          </div>
          <button
            onClick={handleDefinirZona}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-teal-900 text-white text-sm font-semibold hover:bg-teal-950 transition-all"
          >
            <Plus size={16} />
            Definir zona
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* ── Selector de cultivo ── */}
      <div className="bg-white rounded-2xl p-4 shadow-sm max-w-[560px] mx-auto">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">¿Qué cultivo es?</p>
        <div className="flex flex-wrap gap-3 justify-center">
          {CULTIVOS.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSeleccionarCultivo(c)}
              className={`flex flex-col items-center gap-1.5 px-5 py-3 rounded-2xl transition-all ${
                cultivo.id === c.id
                  ? 'bg-primary text-white shadow-md scale-105'
                  : 'bg-gray-50 text-gray-600 border border-gray-200'
              }`}
            >
              <span className="text-3xl">{c.emoji}</span>
              <span className="text-xs font-bold">{c.nombre}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Botón analizar ── */}
      <button
        onClick={analizar}
        disabled={!puedeAnalizar || analizando}
        className="w-full bg-gradient-to-r from-primary to-primary-dark text-white font-bold py-6 rounded-2xl disabled:opacity-40 text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all active:scale-95 relative overflow-hidden group max-w-[560px] mx-auto"
      >
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative">
          {analizando ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={24} className="animate-spin" /> Analizando con PlaguIA...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <span>🔬</span>
              {fotos.length > 0 && pregunta.trim()
                ? 'Analizar foto + consulta'
                : fotos.length > 0
                  ? 'Iniciar Diagnóstico'
                  : pregunta.trim()
                    ? 'Consultar al agrónomo IA'
                    : 'Sube una foto o escribe tu consulta'}
            </span>
          )}
        </div>
      </button>
    </section>
  );
}
