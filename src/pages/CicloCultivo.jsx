import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Calendar, Leaf, Loader2, Camera, ChevronLeft,
  Cloud, Droplets, Thermometer, Wind, AlertTriangle,
  Volume2, VolumeX, Info,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useAgentes } from '../lib/AgentContext';
import { CULTIVOS } from '../lib/constants';
import { supabase } from '../lib/supabase';
import { getWeather, getSoilData, getCicloRecomendaciones, getPronosticoSENAMHI } from '../lib/externalApis';
import { invokeGemini } from '../lib/gemini';
import TimelineEtapa from '../components/TimelineEtapa';
import BuscadorInsumos from '../components/BuscadorInsumos';
import { getResumenProblemas } from '../lib/learningSystem';

function diasDesdeSiembra(fecha) {
  if (!fecha) return 0;
  return Math.floor((new Date() - new Date(fecha)) / (1000 * 60 * 60 * 24));
}

export default function CicloCultivo() {
  const { user } = useAuth();
  const { reportarRecomendacionCiclo, seleccionarCultivo } = useAgentes();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const parcelaId = searchParams.get('parcelaId');

  const [parcelas, setParcelas] = useState([]);
  const [parcelaActiva, setParcelaActiva] = useState(null);
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);

  // IA
  const [recomendaciones, setRecomendaciones] = useState('');
  const [cargandoRec, setCargandoRec] = useState(false);
  const [recomendacionModelo, setRecomendacionModelo] = useState('');

  // Datos ambientales
  const [clima, setClima] = useState(null);
  const [suelo, setSuelo] = useState(null);
  const [cargandoClima, setCargandoClima] = useState(false);
  const [senamhi, setSenamhi] = useState(null);

  // Monitoreo
  const [analizando, setAnalizando] = useState(false);
  const [resultadoFoto, setResultadoFoto] = useState('');
  const fileRef = useRef(null);

  // Voz
  const [leyendo, setLeyendo] = useState(false);

  // Sistema de aprendizaje
  const [historialClinico, setHistorialClinico] = useState(null);

  // Alertas preventivas por etapa
  const [alertasRiesgo, setAlertasRiesgo] = useState(null);

  // Cargar parcelas del usuario
  useEffect(() => {
    const cargar = async () => {
      if (!user) { setLoading(false); return; }
      try {
        const uid = user?.id || user?.uid;
        const { data: rows, error } = await supabase.from('parcelas').select('*').eq('userId', uid);
        if (error) throw error;
        const data = rows || [];
        setParcelas(data);

        // Si hay parcelaId en URL, seleccionarla
        if (parcelaId) {
          const found = data.find(p => p.id === parcelaId);
          if (found) { setParcelaActiva(found); cargarRegistros(found.id); }
        } else if (data.length > 0) {
          setParcelaActiva(data[0]);
          cargarRegistros(data[0].id);
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    cargar();
  }, [user, parcelaId]);

  // Cargar registros de monitoreo
  const cargarRegistros = async (pId) => {
    try {
      const { data, error } = await supabase.from('registros_parcela').select('*').eq('parcelaId', pId).order('fecha', { ascending: false });
      if (error) throw error;
      setRegistros((data || []).map(d => ({ ...d })));
    } catch { setRegistros([]); }
  };

  // Cargar clima, suelo e historial cuando se selecciona parcela
  useEffect(() => {
    if (!parcelaActiva?.gps) return;
    const [lat, lon] = (parcelaActiva?.gps || '').split(',').map(Number);
    if (!lat || !lon) return;

    setCargandoClima(true);
    Promise.allSettled([
      getWeather(lat, lon),
      getSoilData(lat, lon),
      getPronosticoSENAMHI(lat, lon),
    ]).then(([climaRes, sueloRes, senamhiRes]) => {
      if (climaRes.status === 'fulfilled') setClima(climaRes.value);
      if (sueloRes.status === 'fulfilled') setSuelo(sueloRes.value);
      if (senamhiRes.status === 'fulfilled') setSenamhi(senamhiRes.value);
      setCargandoClima(false);
    }).catch(() => setCargandoClima(false));

    // Cargar historial clínico de la parcela
    if (user?.id || user?.uid) {
      getResumenProblemas(parcelaActiva.id)
        .then(setHistorialClinico)
        .catch(() => setHistorialClinico(null));
    }

    // Cargar alertas preventivas
    const diasCalc = diasDesdeSiembra(parcelaActiva.fechaSiembra);
    fetch(`/api/alertas-preventivas?lat=${lat}&lon=${lon}&cultivo=${parcelaActiva.cultivo}&diasDesdeSiembra=${diasCalc}`)
      .then(r => r.json())
      .then(setAlertasRiesgo)
      .catch(() => setAlertasRiesgo(null));
  }, [parcelaActiva, user?.id, user?.uid]);

  // Calcular etapa actual
  const cultivoObj = CULTIVOS.find(c => c.id === parcelaActiva?.cultivo);
  const dias = parcelaActiva?.fechaSiembra ? diasDesdeSiembra(parcelaActiva.fechaSiembra) : 0;
  const etapaActual = cultivoObj?.ciclo?.find(e => dias >= e.diasInicio && dias < e.diasFin)
    || cultivoObj?.ciclo?.[cultivoObj.ciclo.length - 1];

  // Sincronizar cultivo con AgentContext
  useEffect(() => {
    if (cultivoObj) seleccionarCultivo(cultivoObj);
  }, [cultivoObj?.id]);

  // Generar recomendaciones IA
  const generarRecomendaciones = async () => {
    if (!cultivoObj || !etapaActual) return;
    setCargandoRec(true);
    try {
      const [lat, lon] = (parcelaActiva?.gps || '').split(',').map(Number);
      const result = await getCicloRecomendaciones({
        cultivo: cultivoObj.nombre,
        etapa: etapaActual.nombre,
        diasDesdeSiembra: dias,
        variedad: parcelaActiva?.variedad,
        lat: lat || null,
        lon: lon || null,
        clima: clima ? {
          temperature: clima.current?.temperature_2m,
          humidity: clima.current?.relative_humidity_2m,
          precipitation: clima.current?.precipitation,
          windSpeed: clima.current?.wind_speed_10m,
          forecast: clima.daily?.time?.slice(0, 3)?.map((d, i) =>
            `${d}: ${clima.daily.temperature_2m_max?.[i]}°C max, ${clima.daily.precipitation_sum?.[i]}mm`
          ).join('; '),
        } : null,
        suelo: suelo ? {
          ph: suelo.ph,
          organic_matter: suelo.organic_matter,
          texture: suelo.texture,
          phosphorus: suelo.phosphorus,
        } : null,
        registros: registros.slice(0, 1),
        historial: historialClinico || null,
      });
      setRecomendaciones(result.recomendaciones);
      setRecomendacionModelo(result.modelo_usado);

      // Sincronizar con AgentContext — todos los agentes saben de la recomendación del ciclo
      reportarRecomendacionCiclo({
        etapa: etapaActual.nombre,
        cultivo: cultivoObj.nombre,
        recomendaciones: result.recomendaciones,
      });
    } catch (e) {
      setRecomendaciones('No se pudieron generar recomendaciones en este momento. Intenta de nuevo.');
    }
    setCargandoRec(false);
  };

  // Auto-generar recomendaciones cuando hay etapa y datos
  useEffect(() => {
    if (etapaActual && !recomendaciones && !cargandoRec) {
      generarRecomendaciones();
    }
  }, [etapaActual, clima, suelo]);

  // Monitoreo con foto
  const analizarFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !parcelaActiva) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      const compressed = await new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX = 600;
          let w = img.width, h = img.height;
          if (w > MAX) { h = h * MAX / w; w = MAX; }
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = dataUrl;
      });

      setAnalizando(true);
      try {
        const resp = await invokeGemini({
          prompt: `Eres un agrónomo experto de la sierra del Perú. Analiza esta imagen de ${cultivoObj?.nombre}.

CONTEXTO:
- Parcela: ${parcelaActiva.nombre}
- Cultivo: ${cultivoObj?.nombre} (${parcelaActiva.variedad || 'variedad no especificada'})
- Etapa actual: ${etapaActual?.nombre || 'desconocida'}
- Días desde siembra: ${dias}

INSTRUCCIONES:
1. Identifica el estado de salud de la planta
2. Detecta plagas, enfermedades o deficiencias visibles
3. Compara con lo esperado para esta etapa del ciclo
4. Da recomendaciones concretas para mejorar producción
5. Si todo está bien, confirma que el cultivo avanza correctamente

Responde en español, máximo 200 palabras, con viñetas.`,
          file_urls: [compressed],
        });
        setResultadoFoto(resp);
      } catch {
        setResultadoFoto('Error al analizar la imagen. Intenta de nuevo.');
      }
      setAnalizando(false);
    };
    reader.readAsDataURL(file);
  };

  // Leer recomendaciones en voz alta
  const leerRecomendaciones = () => {
    if (!recomendaciones) return;
    if (leyendo) {
      window.speechSynthesis?.cancel();
      setLeyendo(false);
      return;
    }
    const utter = new SpeechSynthesisUtterance(recomendaciones);
    utter.lang = 'es-PE';
    utter.rate = 0.9;
    utter.onend = () => setLeyendo(false);
    window.speechSynthesis?.speak(utter);
    setLeyendo(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen pb-24 flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-4">📅</div>
        <h2 className="font-display font-bold text-xl text-gray-800 mb-2">Ciclo del Cultivo</h2>
        <p className="text-gray-500 text-sm mb-6">
          Inicia sesión para ver el calendario de tu cultivo y obtener recomendaciones personalizadas.
        </p>
        <button onClick={() => navigate('/registro')}
          className="bg-primary text-white font-bold px-6 py-3 rounded-xl">
          Iniciar sesión
        </button>
      </div>
    );
  }

  if (parcelas.length === 0) {
    return (
      <div className="min-h-screen pb-24 flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-4">🌱</div>
        <h2 className="font-display font-bold text-xl text-gray-800 mb-2">Sin parcelas</h2>
        <p className="text-gray-500 text-sm mb-6">
          Primero crea una parcela en "Mi Parcela" para ver su ciclo de cultivo.
        </p>
        <button onClick={() => navigate('/parcela')}
          className="bg-primary text-white font-bold px-6 py-3 rounded-xl">
          Ir a Mi Parcela
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="bg-primary text-white px-6 pt-12 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => navigate(-1)} className="text-white/70 hover:text-white">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-display font-bold">Ciclo del Cultivo</h1>
            <p className="text-white/70 text-sm">{parcelaActiva?.cultivoEmoji} {parcelaActiva?.cultivoNombre}</p>
          </div>
        </div>

        {/* Selector de parcela */}
        {parcelas.length > 1 && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-2 -mx-6 px-6">
            {parcelas.map(p => (
              <button key={p.id} onClick={() => {
                setParcelaActiva(p);
                cargarRegistros(p.id);
                setRecomendaciones('');
                setClima(null);
                setSuelo(null);
              }}
                className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap flex-shrink-0 transition-all ${
                  p.id === parcelaActiva?.id
                    ? 'bg-white text-primary font-bold'
                    : 'bg-white/20 text-white/80'
                }`}>
                {p.cultivoEmoji} {p.nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 -mt-2 space-y-4">
        {/* Resumen del ciclo */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-display font-bold text-gray-800">
                {parcelaActiva?.cultivoEmoji} {parcelaActiva?.cultivoNombre}
              </h2>
              <p className="text-xs text-gray-500">{parcelaActiva?.variedad || 'Variedad no especificada'}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">
                {dias < 0 ? `${Math.abs(dias)}` : dias}
              </p>
              <p className="text-xs text-gray-500">
                {dias < 0 ? 'días para siembra' : 'días desde siembra'}
              </p>
            </div>
          </div>

          {/* Etapa actual destacada */}
          {etapaActual && (
            <div className="bg-primary/5 rounded-xl p-3 border border-primary/10">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{etapaActual.emoji}</span>
                <div>
                  <p className="font-bold text-primary text-sm">Etapa actual: {etapaActual.nombre}</p>
                  <p className="text-xs text-gray-500">
                    Día {dias - etapaActual.diasInicio} de {etapaActual.diasFin - etapaActual.diasInicio}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 🔮 Alertas Preventivas por Etapa */}
          {alertasRiesgo && (alertasRiesgo.alertas?.length > 0 || alertasRiesgo.riesgo?.nivel === 'critico' || alertasRiesgo.riesgo?.nivel === 'alto') && (
            <div className={`rounded-2xl p-4 border-2 ${
              alertasRiesgo.riesgo?.nivel === 'critico' ? 'bg-red-50 border-red-400' :
              alertasRiesgo.riesgo?.nivel === 'alto' ? 'bg-orange-50 border-orange-400' :
              'bg-yellow-50 border-yellow-300'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🔮</span>
                <div className="flex-1">
                  <p className={`text-sm font-bold ${
                    alertasRiesgo.riesgo?.nivel === 'critico' ? 'text-red-700' :
                    alertasRiesgo.riesgo?.nivel === 'alto' ? 'text-orange-700' : 'text-yellow-700'
                  }`}>
                    Riesgo {alertasRiesgo.riesgo?.nivel === 'critico' ? 'Crítico' :
                      alertasRiesgo.riesgo?.nivel === 'alto' ? 'Alto' : 'Moderado'} en Etapa: {etapaActual?.nombre}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {alertasRiesgo.clima?.temperatura}°C · {alertasRiesgo.clima?.humedad}% humedad · {alertasRiesgo.clima?.lluvia7d}mm 7d
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                  alertasRiesgo.riesgo?.nivel === 'critico' ? 'bg-red-500' :
                  alertasRiesgo.riesgo?.nivel === 'alto' ? 'bg-orange-500' : 'bg-yellow-500'
                }`}>
                  {alertasRiesgo.riesgo?.puntos || 0}
                </div>
              </div>

              {alertasRiesgo.alertas?.length > 0 && (
                <div className="space-y-2 mb-3">
                  {alertasRiesgo.alertas.map((a, i) => (
                    <div key={i} className="bg-white rounded-xl p-3 border border-gray-100">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-bold text-gray-800">{a.nombre}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          a.gravedad === 'ALTA' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {a.gravedad}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">Prevenir: {a.preventivo}</p>
                    </div>
                  ))}
                </div>
              )}

              {alertasRiesgo.recomendaciones?.length > 0 && (
                <div className="bg-white/60 rounded-xl p-3">
                  <p className="text-xs font-bold text-gray-600 mb-1">📋 Acciones preventivas</p>
                  <ul className="space-y-1">
                    {alertasRiesgo.recomendaciones.map((r, i) => (
                      <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">•</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Datos ambientales */}
        <div className="grid grid-cols-2 gap-3">
          {/* Clima */}
          <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Cloud size={16} className="text-blue-500" />
              <span className="text-xs font-bold text-gray-600">CLIMA</span>
            </div>
            {cargandoClima ? (
              <Loader2 size={16} className="animate-spin text-primary" />
            ) : clima ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Thermometer size={14} className="text-red-400" />
                  <span className="text-sm font-bold">{clima.current?.temperature_2m}°C</span>
                </div>
                <div className="flex items-center gap-1">
                  <Droplets size={14} className="text-blue-400" />
                  <span className="text-xs text-gray-600">{clima.current?.relative_humidity_2m}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <Wind size={14} className="text-gray-400" />
                  <span className="text-xs text-gray-600">{clima.current?.wind_speed_10m} km/h</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Sin datos</p>
            )}
          </div>

          {/* Suelo */}
          <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Leaf size={16} className="text-green-500" />
              <span className="text-xs font-bold text-gray-600">SUELO</span>
            </div>
            {cargandoClima ? (
              <Loader2 size={16} className="animate-spin text-primary" />
            ) : suelo ? (
              <div className="space-y-1">
                <p className="text-sm font-bold">pH {suelo.ph || 'N/A'}</p>
                <p className="text-xs text-gray-600">Materia orgánica: {suelo.organic_matter || 'N/A'}%</p>
                <p className="text-xs text-gray-600">Textura: {suelo.texture || 'N/A'}</p>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Sin datos</p>
            )}
          </div>
        </div>

        {/* Pronóstico SENAMHI */}
        {senamhi && senamhi.pronosticos?.length > 0 && (
          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide flex items-center gap-1">
                <Cloud size={14} /> Pronóstico SENAMHI Oficial
              </p>
              <span className="text-[10px] bg-blue-100 text-blue-600 rounded-full px-2 py-0.5 font-semibold">
                {senamhi.estacion?.nombre}
              </span>
            </div>
            <div className="space-y-2">
              {senamhi.pronosticos.slice(0, 3).map((p, i) => (
                <div key={i} className="bg-white rounded-xl p-3 border border-blue-100">
                  <p className="text-xs font-semibold text-gray-700 capitalize">{p.fecha}</p>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-sm font-bold text-red-500">⬆ {p.tempMax}°C</span>
                    <span className="text-sm font-bold text-blue-500">⬇ {p.tempMin}°C</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{p.descripcion}</p>
                </div>
              ))}
            </div>
            <a
              href="https://www.senamhi.gob.pe/?p=pronostico-meteorologico"
              target="_blank"
              rel="noreferrer"
              className="mt-3 block text-center text-xs text-blue-600 underline font-semibold"
            >
              Ver pronóstico completo en SENAMHI →
            </a>
          </div>
        )}

        {/* Timeline del ciclo */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h3 className="font-display font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Calendar size={18} className="text-primary" />
            Calendario del ciclo
          </h3>
          {cultivoObj?.ciclo ? (
            <TimelineEtapa
              etapas={cultivoObj.ciclo}
              diasDesdeSiembra={dias}
              onSelect={(etapa) => {
                // Mostrar acciones de la etapa seleccionada
              }}
            />
          ) : (
            <p className="text-sm text-gray-400">Sin datos de ciclo para este cultivo</p>
          )}
        </div>

        {/* Recomendaciones IA */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-gray-800 flex items-center gap-2">
              <span className="text-lg">🎯</span>
              Recomendaciones para esta etapa
            </h3>
            <div className="flex items-center gap-2">
              {recomendaciones && (
                <button onClick={leerRecomendaciones}
                  className="text-gray-400 hover:text-primary p-1">
                  {leyendo ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
              )}
              <button onClick={generarRecomendaciones} disabled={cargandoRec}
                className="text-primary text-xs font-bold disabled:opacity-50">
                {cargandoRec ? '' : 'Actualizar'}
              </button>
            </div>
          </div>

          {cargandoRec ? (
            <div className="flex flex-col items-center py-6">
              <Loader2 size={24} className="animate-spin text-primary mb-2" />
              <p className="text-sm text-gray-500">Generando recomendaciones personalizadas...</p>
            </div>
          ) : recomendaciones ? (
            <div>
              <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                {recomendaciones}
              </div>
              {recomendacionModelo && (
                <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
                  <Info size={12} />
                  Generado por {recomendacionModelo}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              Toca "Actualizar" para obtener recomendaciones
            </p>
          )}
        </div>

        {/* 🔍 Buscador de insumos — sincronizado con diagnóstico */}
        {etapaActual && (
          <BuscadorInsumos
            producto={etapaActual.alertas?.[0]?.includes('fungicida') ? 'Fungicida preventivo' :
              etapaActual.alertas?.[0]?.includes('insecticida') ? 'Insecticida' :
              'Fertilizante ' + (etapaActual.nombre || '')}
            cultivo={parcelaActiva?.cultivoNombre}
            ubicacion={user?.ubicacion}
            lat={parseFloat(parcelaActiva?.gps?.split(',')[0]) || -12.05}
            lon={parseFloat(parcelaActiva?.gps?.split(',')[1]) || -77.04}
          />
        )}

        {/* Alertas de la etapa */}
        {etapaActual?.alertas?.length > 0 && (
          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
            <h3 className="font-display font-bold text-amber-800 mb-2 flex items-center gap-2">
              <AlertTriangle size={18} />
              Alertas para esta etapa
            </h3>
            <ul className="space-y-1.5">
              {etapaActual.alertas.map((alerta, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                  <span className="text-amber-400 mt-0.5">⚠</span>
                  <span>{alerta}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Monitoreo con foto */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h3 className="font-display font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Camera size={18} className="text-primary" />
            Monitoreo de la etapa
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            Toma una foto y la IA analizará el estado de tu cultivo en esta etapa del ciclo.
          </p>
          <input ref={fileRef} type="file" accept="image/*" capture="environment"
            className="hidden" onChange={analizarFoto} />
          <button onClick={() => fileRef.current?.click()} disabled={analizando}
            className="w-full bg-primary/10 text-primary font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
            {analizando ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Analizando imagen...
              </>
            ) : (
              <>
                <Camera size={18} />
                Tomar foto del cultivo
              </>
            )}
          </button>

          {resultadoFoto && (
            <div className="mt-3 bg-gray-50 rounded-xl p-3 text-sm text-gray-700 whitespace-pre-line">
              {resultadoFoto}
            </div>
          )}
        </div>

        {/* Últimos registros de monitoreo */}
        {registros.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <h3 className="font-display font-bold text-gray-800 mb-3">
              📋 Historial de monitoreo
            </h3>
            <div className="space-y-3">
              {registros.slice(0, 5).map(reg => (
                <div key={reg.id} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">
                      {new Date(reg.fecha).toLocaleDateString('es-PE')}
                    </span>
                    <span className="text-xs text-primary font-bold">
                      Día {reg.diasDesdeSiembra}
                    </span>
                  </div>
                  {reg.recomendacion && (
                    <p className="text-sm text-gray-600 line-clamp-3">{reg.recomendacion}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Espacio inferior */}
        <div className="h-4" />
      </div>
    </div>
  );
}
