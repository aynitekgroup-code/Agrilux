import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Database, FileSpreadsheet, MapPinned, Gauge, RotateCw, Radio } from 'lucide-react';
import { obtenerEstadoVivo, obtenerLatidos, suscribirEstadoVivo, describirLatido } from '../../../lib/agrotrackTiempoReal';
import { obtenerEstadoUnidadesFlota, LIMITE_ESTADO_UNIDADES } from '../../../lib/agrotrackReportesGeocerca';
import { formatearFechaHora, clasificarEstado } from '../../../lib/agrotrackFlota';
import { codigoArea } from '../../../lib/agrotrackVisitasDia';
import { useRango, ControlesRango, CuerpoEstado, numero, useLimiteFilas, BotonVerMas, useFiltroUnidadGrupo, ControlesFiltroUnidadGrupo, filtrarFilasPorPlaca, RelojEnVivo } from './reportesComunes';
import { normalizarPlaca } from '../../../lib/agrotrackGrupos';

/**
 * Reporte 34 de Zonar "Estado de unidades" (FASE 3.6, pedido por el Ing.
 * Carlos Perez) con la columna extra que pidió: la geocerca actual.
 *
 * Una fila por placa con su posición más reciente del rango (fecha, evento,
 * dirección, velocidad) + el estado contra max(fecha) del periodo cargado
 * (mismo criterio único que la consola, nunca contra la fecha de hoy) + el
 * nombre del polígono PostGIS que contiene esa posición.
 *
 * La columna "Current Odometer" de Zonar queda en «—»: el archivo "Reporte
 * por placa" que importamos no trae odómetro (ver agrotrackPosiciones.js).
 */
const COLUMNAS = [
  { label: 'Placa', clase: 'text-left', nuevo: true },
  { label: 'Área', clase: 'text-left', nuevo: true },
  { label: 'Últ. fecha', clase: 'text-left' },
  { label: 'Estado', clase: 'text-left' },
  { label: 'Dirección', clase: 'text-left' },
  { label: 'Últ. evento', clase: 'text-left' },
  { label: 'Vel.', clase: 'text-right' },
  { label: 'Odómetro', clase: 'text-right' },
  { label: 'Geocerca', clase: 'text-left' },
];

/** Auto-refresco del modo HISTÓRICO: cada 5 minutos se vuelve a llamar la RPC. */
const AUTO_REFRESCO_MS = 5 * 60 * 1000;

/** Respaldo del modo TIEMPO REAL por si Realtime no avisa (cada 60 s). */
const RESPALDO_VIVO_MS = 60 * 1000;

/** Estado de la máquina con las etiquetas del ejemplo: En movimiento / Ralentí / Apagado. */
function EstadoMaquinaria({ fila, ahoraRef, periodo, tiempoReal }) {
  const clasificado = fila.sin_telemetria ? 'fuera_servicio' : clasificarEstado(fila, tiempoReal ? ahoraRef : periodo?.hasta);
  const evento = String(fila.ultimo_evento || '').toLowerCase();
  const velocidad = Number(fila.ultima_velocidad || 0);
  let etiqueta;
  let tono;
  if (clasificado === 'en_ruta' || velocidad > 5) {
    etiqueta = 'En movimiento';
    tono = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (clasificado === 'detenido' || /ralent/i.test(evento) || (velocidad > 0 && velocidad <= 5)) {
    etiqueta = 'Ralentí';
    tono = 'bg-amber-50 text-amber-700 border-amber-200';
  } else {
    etiqueta = 'Apagado';
    tono = 'bg-slate-100 text-slate-500 border-slate-200';
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold whitespace-nowrap border ${tono}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
      {etiqueta}
    </span>
  );
}

export default function FleetUnitStatus({ empresaId, periodo = null, fuente = 'real' }) {
  const { rango, setRango, dia, setDia, mes, setMes, desdeHora, setDesdeHora, hastaHora, setHastaHora, consulta, pendienteDeFecha } = useRango(periodo);
  const [estado, setEstado] = useState('inactivo');
  const [intento, setIntento] = useState(0);
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState(null);
  const [rangoTexto, setRangoTexto] = useState('');
  const [descargaError, setDescargaError] = useState(null);
  const [generadoEn, setGeneradoEn] = useState(null);

  const [filtroGeocerca, setFiltroGeocerca] = useState('');
  // Modo TIEMPO REAL con los datos que el agente trae de Zonar
  // (agrotrack_estado_vivo). Activo por defecto; "Histórico" vuelve al
  // reporte por rango de siempre.
  const [tiempoReal, setTiempoReal] = useState(true);
  const [latido, setLatido] = useState(null);
  const [ahoraRef, setAhoraRef] = useState(() => new Date().toISOString());

  // Geocerca "mostrada" de una fila: la actual (dentro del polígono) o, si
  // está fuera, la última en la que estuvo (fallback de la RPC).
  const geocercaMostrada = (f) => f.geocerca || f.geocerca_ultima || '';
  const FUERA = '__fuera__';

  const vehiclesFromFilas = useMemo(
    () => filas.map((fila) => ({ placa: fila.placa, descripcion: fila.unidad || '' })),
    [filas],
  );
  const {
    mostrar,
    setMostrar,
    opcionFiltro,
    setOpcionFiltro,
    gruposInfo,
    opcionesGrupos,
    unidades,
    unidadesSinPosicion,
    placasFiltro,
  } = useFiltroUnidadGrupo({ vehicles: vehiclesFromFilas, empresaId });

  // ---- Tiempo real: lectura + Realtime + respaldo cada 60 s ----
  useEffect(() => {
    if (!empresaId || !tiempoReal) return undefined;
    let cancelado = false;
    const cargarVivo = (silencioso) => {
      if (!silencioso) setEstado('cargando');
      Promise.all([obtenerEstadoVivo(empresaId), obtenerLatidos(empresaId)])
        .then(([resultado, latidos]) => {
          if (cancelado) return;
          setFilas(resultado);
          setLatido(latidos?.envivo || latidos?.diario || null);
          setAhoraRef(new Date().toISOString());
          setEstado(resultado.length ? 'ok' : 'vacio');
          setRangoTexto('tiempo real');
          setGeneradoEn(new Date());
          setError(null);
        })
        .catch((e) => {
          if (cancelado) return;
          setError(e?.message || 'No se pudo leer el estado en vivo.');
          setEstado('error');
        });
    };
    cargarVivo(false);
    let pendiente = null;
    const cancelarSuscripcion = suscribirEstadoVivo(empresaId, () => {
      // Varias placas cambian juntas: se agrupan en una sola lectura.
      clearTimeout(pendiente);
      pendiente = setTimeout(() => cargarVivo(true), 1500);
    });
    const reloj = setInterval(() => cargarVivo(true), RESPALDO_VIVO_MS);
    return () => {
      cancelado = true;
      clearTimeout(pendiente);
      clearInterval(reloj);
      cancelarSuscripcion();
    };
  }, [empresaId, tiempoReal, intento]);

  useEffect(() => {
    if (tiempoReal) return undefined;
    if (!empresaId || pendienteDeFecha) {
      // Nunca dejar "Calculando..." colgado (ver FleetEventsSummary).
      setEstado((prev) => (prev === 'cargando' ? 'inactivo' : prev));
      return undefined;
    }
    let cancelado = false;
    setEstado('cargando');
    setError(null);
    obtenerEstadoUnidadesFlota(empresaId, { desde: consulta.desde, hasta: consulta.hasta })
      .then((resultado) => {
        if (cancelado) return;
        setFilas(resultado);
        setEstado(resultado.length ? 'ok' : 'vacio');
        setRangoTexto(consulta.texto);
        // Hora de generación del reporte (pedido por el Ing. Carlos Perez).
        setGeneradoEn(new Date());
      })
      .catch((e) => {
        if (cancelado) return;
        setFilas([]);
        setError(e?.message || 'No se pudo cargar el reporte.');
        setEstado('error');
      });
    return () => {
      cancelado = true;
    };
  }, [empresaId, consulta, pendienteDeFecha, intento, tiempoReal]);

  // Auto-refresco cada 5 minutos SOLO en modo histórico. En tiempo real ya
  // hay Realtime + respaldo de 60 s; si este intervalo siguiera activo,
  // subiría `intento` y destruiría/recrearía la suscripción Realtime y
  // mostraría "cargando" cada 5 min (parpadeo de la tabla).
  // Los refs dan acceso al estado actual SIN rearmar el intervalo en cada
  // render. Si hay un error en curso (o ya hay una carga andando) NO se
  // dispara: no se pisa el aviso de "Reintentar".
  const estadoRef = useRef(estado);
  const pendienteRef = useRef(pendienteDeFecha);
  useEffect(() => { estadoRef.current = estado; }, [estado]);
  useEffect(() => { pendienteRef.current = pendienteDeFecha; }, [pendienteDeFecha]);
  useEffect(() => {
    if (!empresaId || tiempoReal) return undefined;
    const reloj = setInterval(() => {
      if (pendienteRef.current) return;
      if (estadoRef.current === 'error' || estadoRef.current === 'cargando') return;
      setIntento((n) => n + 1);
    }, AUTO_REFRESCO_MS);
    return () => clearInterval(reloj);
  }, [empresaId, tiempoReal]);

  const unidadesSinTelemetria = useMemo(() => {
    if (placasFiltro == null) return unidadesSinPosicion;
    const placas = new Set(placasFiltro.map(normalizarPlaca));
    return unidadesSinPosicion.filter((unit) => placas.has(unit.placa));
  }, [placasFiltro, unidadesSinPosicion]);

  const filasConSinTelemetria = useMemo(() => {
    const presentes = new Set(filas.map((fila) => normalizarPlaca(fila.placa)).filter(Boolean));
    return [
      ...filas,
      ...unidadesSinTelemetria
        .filter((unidad) => !presentes.has(unidad.placa))
        .map((unidad) => ({
          placa: unidad.placa,
          unidad: unidad.area || unidad.descripcion || unidad.placa,
          ultima_fecha: null,
          estado_movimiento: unidad.estado_movimiento || 'detenido',
          ultima_velocidad: null,
          geocerca: '',
          geocerca_ultima: '',
          sin_telemetria: true,
        })),
    ];
  }, [filas, unidadesSinTelemetria]);

  const opcionesGeocercas = useMemo(() => {
    const set = new Set(filasConSinTelemetria.map(geocercaMostrada));
    return [...set].sort((a, b) => String(a || 'zzz').localeCompare(String(b || 'zzz'), 'es'));
  }, [filasConSinTelemetria]);

  // Filas visibles con los filtros aplicados (la tabla, el pie y el Excel
  // usan estas; sin filtros es exactamente lo que devolvió la RPC).
  const filasVistas = useMemo(() => filtrarFilasPorPlaca(filasConSinTelemetria, placasFiltro, (fila) => fila.placa)
    .filter((f) => {
      if (filtroGeocerca) {
        const g = geocercaMostrada(f);
        if (filtroGeocerca === FUERA ? g !== '' : g !== filtroGeocerca) return false;
      }
      return true;
    }), [filasConSinTelemetria, placasFiltro, filtroGeocerca]);

  // Tabla limitada a 15 filas; Excel y contadores usan la lista completa.
  const { filasVistas: filasTabla, expandido, alternar, total } = useLimiteFilas(filasVistas);

  const filtroTexto = [
    mostrar === 'unidades' && opcionFiltro ? `máquina ${opcionFiltro}` : '',
    mostrar === 'grupos' && opcionFiltro ? `grupo ${opcionFiltro}` : '',
    filtroGeocerca ? `geocerca ${filtroGeocerca === FUERA ? 'sin geocerca' : filtroGeocerca}` : '',
  ].filter(Boolean).join(' · ');

  // Cantidad de unidades en cada estado (el criterio es el de la consola).
  const conteos = useMemo(() => {
    const c = { en_ruta: 0, detenido: 0, offline: 0, fuera_servicio: 0 };
    filasVistas.forEach((f) => {
      const e = f.sin_telemetria ? 'fuera_servicio' : clasificarEstado(f, tiempoReal ? ahoraRef : periodo?.hasta);
      c[e] = (c[e] || 0) + 1;
    });
    return c;
  }, [filasVistas, periodo?.hasta, tiempoReal, ahoraRef]);

  const puedeExportar = estado === 'ok' && filasVistas.length > 0;
  const mensajePendiente =
    rango === 'todo' && !periodo?.desde
      ? 'Esta empresa todavía no tiene periodo cargado en agrotrack_posiciones, así que no hay estados que mostrar.'
      : 'Esperando el periodo cargado para precargar el selector…';

  // El XLSX se importa bajo demanda: la librería pesa ~430 kB y solo se
  // necesita cuando el usuario pide el archivo.
  // Exporta lo que el usuario VE (filtros de unidad/grupo/geocerca aplicados),
  // sin las filas "sin telemetría" que no tienen datos de posición.
  const descargarExcel = async () => {
    setDescargaError(null);
    try {
      const { exportarEstadoUnidadesExcel } = await import('../../../lib/exportExcel');
      exportarEstadoUnidadesExcel(filasVistas, { rangoTexto, periodo, filtro: filtroTexto });
    } catch (e) {
      setDescargaError(e?.message || 'No se pudo generar el archivo de Excel.');
    }
  };

  const textoActualizacion = tiempoReal
    ? 'se actualiza al llegar datos de Zonar'
    : 'se actualiza cada 5 min';

  return (
    <div className="min-w-0">
      <h3 className="text-sm font-bold uppercase tracking-wide text-emerald-800 mb-3">
        Punto 3 · Status de maquinaria (estado de unidades – geocerca)
      </h3>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm min-w-0">
      <div className="p-4 sm:p-5 border-b border-slate-50 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <MapPinned size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">Status de maquinaria</h2>
            <p className="text-xs text-slate-500">
              Última posición de cada unidad · una fila por placa · se actualiza sola cada 5 minutos desde la nube.
            </p>
            {generadoEn ? (
              <p className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  title="Reloj de Perú. No indica la antigüedad del dato: para eso mira «leído hace…»"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                  Hora Perú <RelojEnVivo />
                </span>
                <span>
                  Generado: {generadoEn.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
                  {' · '}{textoActualizacion}
                </span>
              </p>
            ) : null}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
              En línea · {describirLatido(latido).texto}
            </span>
            <button
              type="button"
              onClick={() => setIntento((n) => n + 1)}
              disabled={estado === 'cargando' || (!tiempoReal && pendienteDeFecha)}
              title={tiempoReal
                ? 'Volver a leer el estado en vivo ahora (también se actualiza solo)'
                : 'Recargar el reporte ahora (también se recarga solo cada 5 minutos)'}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-forest hover:text-forest disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCw size={13} className={estado === 'cargando' ? 'animate-spin' : ''} />
              {estado === 'cargando' ? 'Actualizando…' : 'Actualizar'}
            </button>
            <button
              type="button"
              onClick={descargarExcel}
              disabled={!puedeExportar}
              className="inline-flex items-center gap-1.5 rounded-lg border border-forest bg-forest px-2.5 py-1.5 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <FileSpreadsheet size={13} /> Excel
            </button>
          </div>
        </div>
        {descargaError ? <p className="text-[10px] text-red-600">{descargaError}</p> : null}

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => setTiempoReal(true)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                tiempoReal ? 'bg-forest text-white' : 'text-slate-500 hover:text-forest'
              }`}
              title="Última posición de cada unidad, tal como la envía Zonar al agente"
            >
              <Radio size={13} className={tiempoReal ? 'animate-pulse' : ''} /> Tiempo real (Zonar)
            </button>
            <button
              type="button"
              onClick={() => setTiempoReal(false)}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                !tiempoReal ? 'bg-forest text-white' : 'text-slate-500 hover:text-forest'
              }`}
            >
              Histórico por rango
            </button>
          </div>
          {tiempoReal ? (() => {
            const l = describirLatido(latido);
            return (
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                l.viejo ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${l.viejo ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} aria-hidden="true" />
                {l.texto}
              </span>
            );
          })() : null}
        </div>

        {!tiempoReal ? (
          <ControlesRango rango={rango} setRango={setRango} dia={dia} setDia={setDia} mes={mes} setMes={setMes} desdeHora={desdeHora} setDesdeHora={setDesdeHora} hastaHora={hastaHora} setHastaHora={setHastaHora} />
        ) : null}

        {estado === 'ok' || filasVistas.length > 0 ? (
          <div className="flex flex-wrap items-end gap-3">
            <ControlesFiltroUnidadGrupo
              mostrar={mostrar}
              setMostrar={setMostrar}
              opcionFiltro={opcionFiltro}
              setOpcionFiltro={setOpcionFiltro}
              unidades={unidades}
              opcionesGrupos={opcionesGrupos}
              gruposInfo={gruposInfo}
            />
            <label className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Geocerca</span>
              <select
                value={filtroGeocerca}
                onChange={(e) => setFiltroGeocerca(e.target.value)}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Todas las geocercas</option>
                {opcionesGeocercas.map((g) => (
                  <option key={g || FUERA} value={g || FUERA}>{g || 'Fuera de geocercas'}</option>
                ))}
              </select>
            </label>
            {opcionFiltro || filtroGeocerca ? (
              <button
                type="button"
                onClick={() => { setOpcionFiltro(''); setFiltroGeocerca(''); }}
                className="px-2 py-1.5 rounded-lg text-[10px] font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                title="Quitar filtros de máquina y geocerca"
              >
                Quitar filtros
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <CuerpoEstado
        pendienteDeFecha={!tiempoReal && pendienteDeFecha}
        mensajePendiente={mensajePendiente}
        estado={estado}
        error={error}
        onReintentar={() => setIntento((n) => n + 1)}
        mensajeVacio={`No hay posiciones en ${rangoTexto || 'el rango elegido'}. Prueba con otro día/mes o con “Todo el periodo”.`}
        childrenCuandoVacio={filasVistas.length > 0}
      >
        {estado === 'ok' || filasVistas.length ? (
          <>
            <div className="max-h-[65vh] overflow-auto">
              <table className="w-full text-xs text-slate-700">
                <thead className="sticky top-0 z-10 bg-white shadow-sm">
                  <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                    {COLUMNAS.map((col) => (
                      <th key={col.label} className={`px-3 py-2.5 font-bold ${col.clase}`}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filasVistas.length === 0 ? (
                    <tr>
                      <td className="px-3 py-6 text-center text-slate-400" colSpan={COLUMNAS.length}>
                        Ninguna unidad coincide con los filtros{filtroTexto ? ` (${filtroTexto})` : ''}. Quita el filtro para ver las {filas.length} unidades.
                      </td>
                    </tr>
                  ) : null}
                  {filasTabla.map((fila) => (
                    <tr key={fila.placa} className="border-b border-slate-50 hover:bg-slate-50/60">
                      <td className="px-3 py-2">
                        <span className="font-bold text-slate-800">{fila.placa}</span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                        {codigoArea(fila.unidad, fila.placa) || (fila.descripcion && fila.descripcion !== fila.placa ? fila.descripcion : '—')}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                        {formatearFechaHora(fila.ultima_fecha)}
                      </td>
                      <td className="px-3 py-2">
                        <EstadoMaquinaria fila={fila} ahoraRef={ahoraRef} periodo={periodo} tiempoReal={tiempoReal} />
                      </td>
                      <td className="px-3 py-2 text-slate-500 max-w-[260px]">
                        <span className="block truncate" title={fila.direccion || ''}>
                          {fila.direccion || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{fila.ultimo_evento || '—'}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {fila.ultima_velocidad == null ? '—' : `${numero(fila.ultima_velocidad, 0)} km/h`}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap text-slate-600">
                        {fila.odometro == null ? '—' : `${numero(fila.odometro, 0)} km`}
                      </td>
                      <td className="px-3 py-2">
                        {fila.geocerca ? (
                          <span className="font-semibold text-slate-800">{fila.geocerca}</span>
                        ) : fila.geocerca_ultima ? (
                          <span className="font-semibold text-amber-700">Últ.: {fila.geocerca_ultima}</span>
                        ) : (
                          <span className="text-slate-400">Fuera de geocercas</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 text-slate-700 font-bold">
                    <td className="px-3 py-2.5" colSpan={2}>
                      {Math.max(0, filasVistas.length - conteos.fuera_servicio)} unidad{filasVistas.length - conteos.fuera_servicio === 1 ? '' : 'es'} reportando
                      {conteos.fuera_servicio ? ` · ${conteos.fuera_servicio} sin telemetría` : ''}
                      {filasVistas.length !== filas.length ? ` de ${filas.length}` : ''}
                    </td>
                    <td className="px-3 py-2.5" colSpan={2}>
                      <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-normal text-slate-500">
                        <span>En ruta: <b className="font-bold text-slate-700">{conteos.en_ruta}</b></span>
                        <span>Detenidas: <b className="font-bold text-slate-700">{conteos.detenido}</b></span>
                        <span>Sin conexión: <b className="font-bold text-slate-700">{conteos.offline}</b></span>
                        <span>Fuera de servicio: <b className="font-bold text-slate-700">{conteos.fuera_servicio}</b></span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right" colSpan={5}>
                      <span className="inline-flex items-center gap-1 text-[10px] font-normal text-slate-400">
                        <Gauge size={11} /> Odómetro no viene en el archivo de Zonar
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <BotonVerMas expandido={expandido} onAlternar={alternar} total={total} />

            {!tiempoReal && filas.length >= LIMITE_ESTADO_UNIDADES ? (
              <p className="px-4 py-2 text-[10px] text-amber-600 border-t border-slate-50">
                Se alcanzó el tope de {LIMITE_ESTADO_UNIDADES} unidades (límite de PostgREST). Reduce el rango.
              </p>
            ) : null}
          </>
        ) : null}
      </CuerpoEstado>

      </div>
    </div>
  );
}
