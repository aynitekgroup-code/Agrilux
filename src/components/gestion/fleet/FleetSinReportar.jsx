import React, { useEffect, useMemo, useState } from 'react';
import { Clock, Database, FileSpreadsheet, Loader2, RotateCw, Sparkles } from 'lucide-react';
import { obtenerEstadoUnidadesFlota, LIMITE_ESTADO_UNIDADES } from '../../../lib/agrotrackReportesGeocerca';
import { formatearFechaHora } from '../../../lib/agrotrackFlota';
import { armarContextoReporte } from '../../../lib/reportesIa';
import { llamarIaGestion } from '../../../lib/agrotrackIa';
import { CuerpoEstado, haceCuanto, useLimiteFilas, BotonVerMas } from './reportesComunes';

/**
 * Reporte "Unidades sin reportar" (réplica de la captura de Zonar:
 * Unidades - Sin Reportar), FASE 4.
 *
 * Ventana de 8 / 16 / 24 / 48 horas y una fila por unidad con su última
 * comunicación GPRS. Sin reportar = cuya `ultima_fecha` es anterior a
 * (ahora − ventana); se ordena por mayor antigüedad primero, con chip rojo
 * para las que exceden la ventana y verde para las que reportan dentro.
 *
 * Los datos salen de la RPC EXISTENTE agrotrack_estado_unidades_flota con
 * p_desde = null y p_hasta = null: la función acepta rangos nulos
 * (`p_desde is null or p.fecha >= p_desde`) y devuelve la última posición
 * conocida de cada placa en todo el histórico, sin descargar posiciones al
 * navegador (PostgREST corta en 1000 filas).
 */
const VENTANAS = [
  { horas: 8, label: '8 h' },
  { horas: 16, label: '16 h' },
  { horas: 24, label: '24 h' },
  { horas: 48, label: '48 h' },
];

const COLUMNAS = [
  { label: 'Unidad', clase: 'text-left' },
  { label: 'Placa', clase: 'text-left' },
  { label: 'Últ. dirección', clase: 'text-left' },
  { label: 'Últ. evento', clase: 'text-left' },
  { label: 'Últ. fecha GPRS', clase: 'text-left' },
  { label: 'Geocerca asignada', clase: 'text-left' },
  { label: 'Tiempo transcurrido', clase: 'text-right' },
];

/** Geocerca actual (la RPC la calcula con PostGIS) o, si la unidad está
 *  fuera de todas, la última conocida como respaldo. */
function geocercaAsignada(f) {
  if (!f) return '—';
  if (f.geocerca) return f.geocerca;
  if (f.geocerca_ultima) return `${f.geocerca_ultima} (última conocida)`;
  return '—';
}

export default function FleetSinReportar({ empresaId, fuente = 'real' }) {
  const [ventana, setVentana] = useState(24);
  const [estado, setEstado] = useState('inactivo');
  const [intento, setIntento] = useState(0);
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState(null);
  const [ahora, setAhora] = useState(() => new Date());
  const [generadoEn, setGeneradoEn] = useState(null);
  const [descargaError, setDescargaError] = useState(null);
  // Análisis con IA (solo lectura): interpreta la tabla ya calculada, nunca
  // recalcula cifras ni toca la base.
  const [explicando, setExplicando] = useState(false);
  const [explicacion, setExplicacion] = useState(null);
  const [errorExplicacion, setErrorExplicacion] = useState(null);

  // Última posición conocida de cada unidad (rangos nulos = histórico completo).
  useEffect(() => {
    if (!empresaId) {
      // Nunca dejar "Calculando..." colgado (ver FleetEventsSummary).
      setEstado((prev) => (prev === 'cargando' ? 'inactivo' : prev));
      return undefined;
    }
    let cancelado = false;
    setEstado('cargando');
    setError(null);
    const instante = new Date();
    obtenerEstadoUnidadesFlota(empresaId, { desde: null, hasta: null })
      .then((resultado) => {
        if (cancelado) return;
        // El "ahora" de los cálculos es el de la carga: así el tiempo
        // transcurrido de la tabla es consistente mientras esté en pantalla.
        setAhora(instante);
        setFilas(resultado);
        setEstado(resultado.length ? 'ok' : 'vacio');
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
  }, [empresaId, intento]);

  // Filas con la antigüedad calculada contra la ventana elegida, ordenadas
  // por mayor antigüedad primero (las que nunca reportaron quedan arriba).
  const filasVistas = useMemo(() => {
    const umbralMs = ahora.getTime() - ventana * 3600 * 1000;
    return filas
      .map((f) => {
        const t = Date.parse(f.ultima_fecha || '');
        const tieneFecha = Number.isFinite(t);
        const antiguedadMs = tieneFecha ? ahora.getTime() - t : Infinity;
        return {
          ...f,
          antiguedadMs,
          transcurrido: tieneFecha ? haceCuanto(f.ultima_fecha, ahora) : 'sin reporte',
          sinReportar: !tieneFecha || t < umbralMs,
        };
      })
      .sort((a, b) => (a.antiguedadMs === b.antiguedadMs ? 0 : b.antiguedadMs - a.antiguedadMs));
  }, [filas, ahora, ventana]);

  // Tabla limitada a 15 filas; Excel e IA usan la lista completa.
  const { filasVistas: filasTabla, expandido, alternar, total } = useLimiteFilas(filasVistas);

  const conteos = useMemo(() => ({
    sinReportar: filasVistas.filter((f) => f.sinReportar).length,
    reportando: filasVistas.filter((f) => !f.sinReportar).length,
  }), [filasVistas]);

  const pendienteDeFecha = !empresaId;
  const mensajePendiente = 'Selecciona una empresa activa para consultar las unidades sin reportar.';
  const puedeExportar = estado === 'ok' && filasVistas.length > 0;

  // El XLSX se importa bajo demanda: la librería pesa ~430 kB y solo se
  // necesita cuando el usuario pide el archivo.
  const descargarExcel = async () => {
    setDescargaError(null);
    try {
      const { exportarSinReportarExcel } = await import('../../../lib/exportExcelReportes');
      exportarSinReportarExcel(filasVistas, { ventanaHoras: ventana, generado: generadoEn || ahora });
    } catch (e) {
      setDescargaError(e?.message || 'No se pudo generar el archivo de Excel.');
    }
  };

  // Análisis con IA de la tabla ya calculada (ventana + antigüedades): manda
  // solo las filas visibles comprimidas; la IA interpreta, no calcula.
  const analizarIa = async () => {
    if (explicando || !filasVistas.length) return;
    setExplicando(true);
    setErrorExplicacion(null);
    try {
      const contexto = armarContextoReporte({
        reporte: `Unidades sin reportar (Zonar: Unidades - Sin Reportar) — ventana de ${ventana} h`,
        rango: `última posición conocida de cada unidad · generado ${generadoEn
          ? generadoEn.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })
          : '—'} · hora de Perú`,
        columnas: ['Unidad', 'Placa', 'Últ. dirección', 'Últ. evento', 'Últ. fecha GPRS', 'Geocerca asignada', 'Tiempo transcurrido', 'Sin reportar (ventana)'],
        filas: filasVistas.map((f) => ({
          Unidad: f.unidad || f.placa,
          Placa: f.placa,
          'Últ. dirección': f.direccion,
          'Últ. evento': f.ultimo_evento,
          'Últ. fecha GPRS': f.ultima_fecha ? formatearFechaHora(f.ultima_fecha) : 'sin reporte',
          'Geocerca asignada': geocercaAsignada(f),
          'Tiempo transcurrido': f.transcurrido,
          'Sin reportar (ventana)': f.sinReportar ? `SÍ (>${ventana} h)` : 'no',
        })),
        totalFilas: filasVistas.length,
      });
      const data = await llamarIaGestion({ modo: 'reporte', contexto });
      if (!data.texto) throw new Error('La IA no devolvió texto para este reporte.');
      setExplicacion({ texto: data.texto, provider: data.provider });
    } catch (e) {
      setErrorExplicacion(e?.message || 'No se pudo analizar el reporte.');
    } finally {
      setExplicando(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm min-w-0">
      <div className="p-4 sm:p-5 border-b border-slate-50 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <Clock size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">Unidades sin reportar (Zonar: Unidades - Sin Reportar)</h2>
            <p className="text-xs text-slate-500">
              Unidades cuya última comunicación GPRS es anterior a la ventana elegida, de la más antigua a la más reciente.
            </p>
            {generadoEn ? (
              <p className="text-[11px] text-slate-400 mt-0.5">
                Generado: {generadoEn.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
                {' · '}ventana de {ventana} h
              </p>
            ) : null}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {fuente === 'real' ? (
              <span className="hidden lg:inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Database size={12} /> Última posición conocida
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setIntento((n) => n + 1)}
              disabled={estado === 'cargando' || !empresaId}
              title="Volver a leer la última posición conocida de cada unidad"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-forest hover:text-forest disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCw size={13} className={estado === 'cargando' ? 'animate-spin' : ''} />
              {estado === 'cargando' ? 'Actualizando…' : 'Actualizar ahora'}
            </button>
            <button
              type="button"
              onClick={analizarIa}
              disabled={!puedeExportar || explicando}
              title="Interpretar esta tabla con IA (solo lectura)"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {explicando ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {explicando ? 'Analizando…' : 'Analizar con IA'}
            </button>
            <button
              type="button"
              onClick={descargarExcel}
              disabled={!puedeExportar}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-forest hover:text-forest disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <FileSpreadsheet size={13} /> Descargar Excel
            </button>
          </div>
        </div>
        {descargaError ? <p className="text-[10px] text-red-600">{descargaError}</p> : null}
        {errorExplicacion ? <p className="text-[10px] text-red-600">{errorExplicacion}</p> : null}
        {explicacion ? (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 mb-1 flex items-center gap-1">
              <Sparkles size={11} /> Análisis de la IA
            </p>
            <div className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-line">{explicacion.texto}</div>
            <p className="mt-2 text-[10px] text-slate-400">
              Interpretación de las {filasVistas.length} filas visibles ya calculadas; no sustituye la revisión del responsable de flota.
            </p>
          </div>
        ) : null}

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Ventana sin reportar</p>
          <div className="flex flex-wrap gap-1.5">
            {VENTANAS.map((v) => (
              <button
                key={v.horas}
                type="button"
                onClick={() => { setVentana(v.horas); setExplicacion(null); setErrorExplicacion(null); }}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                  ventana === v.horas ? 'bg-forest text-white' : 'bg-slate-50 text-slate-500 hover:text-forest'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <CuerpoEstado
        pendienteDeFecha={pendienteDeFecha}
        mensajePendiente={mensajePendiente}
        estado={estado}
        error={error}
        onReintentar={() => setIntento((n) => n + 1)}
        mensajeVacio="Esta empresa todavía no tiene unidades con posición conocida en agrotrack_posiciones, así que no hay nada que comparar contra la ventana."
      >
        {estado === 'ok' ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-slate-700">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                    {COLUMNAS.map((col) => (
                      <th key={col.label} className={`px-3 py-2.5 font-bold ${col.clase}`}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filasTabla.map((fila, i) => (
                    <tr
                      key={fila.placa || `sin-placa-${i}`}
                      className={`border-b border-slate-50 hover:bg-slate-50/60 ${fila.sinReportar ? 'bg-red-50/40' : ''}`}
                    >
                      <td className="px-3 py-2">
                        <span className="font-bold text-slate-800">{fila.placa || '—'}</span>
                        {fila.unidad && fila.unidad !== fila.placa ? (
                          <span className="block text-[10px] text-slate-400 truncate max-w-[240px]">{fila.unidad}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-semibold text-slate-600">{fila.placa || '—'}</td>
                      <td className="px-3 py-2 text-slate-500 max-w-[260px]">
                        <span className="block truncate" title={fila.direccion || ''}>
                          {fila.direccion || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{fila.ultimo_evento || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                        {fila.ultima_fecha ? formatearFechaHora(fila.ultima_fecha) : 'sin reporte'}
                      </td>
                      <td className="px-3 py-2 text-slate-600 max-w-[180px]">
                        <span className="block truncate" title={geocercaAsignada(fila)}>
                          {geocercaAsignada(fila)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                            fila.sinReportar
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                          title={fila.sinReportar ? `Sin reportar: excede la ventana de ${ventana} h` : `Dentro de la ventana de ${ventana} h`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${fila.sinReportar ? 'bg-red-500' : 'bg-emerald-500'}`}
                            aria-hidden="true"
                          />
                          {fila.transcurrido}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 text-slate-700 font-bold">
                    <td className="px-3 py-2.5" colSpan={5}>
                      {filasVistas.length} unidad{filasVistas.length === 1 ? '' : 'es'} · ventana de {ventana} h
                    </td>
                    <td className="px-3 py-2.5" colSpan={2}>
                      <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-normal text-slate-500">
                        <span>
                          Sin reportar: <b className="font-bold text-red-600">{conteos.sinReportar}</b>
                        </span>
                        <span>
                          Reportando: <b className="font-bold text-emerald-700">{conteos.reportando}</b>
                        </span>
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <BotonVerMas expandido={expandido} onAlternar={alternar} total={total} />

            {filas.length >= LIMITE_ESTADO_UNIDADES ? (
              <p className="px-4 py-2 text-[10px] text-amber-600 border-t border-slate-50">
                Se alcanzó el tope de {LIMITE_ESTADO_UNIDADES} unidades (límite de PostgREST). Si falta alguna, revisa el rango de la base.
              </p>
            ) : null}
          </>
        ) : null}
      </CuerpoEstado>

      <p className="px-4 py-2.5 text-[10px] text-slate-400 border-t border-slate-50 leading-relaxed">
        {fuente === 'real' ? (
          <span className="inline-flex items-center gap-1">
            <Database size={10} /> Última posición conocida de cada placa con agrotrack_estado_unidades_flota (p_desde = null, p_hasta = null).
          </span>
        ) : (
          'Aún no hay datos reales para esta empresa.'
        )}
        <span className="block mt-0.5">
          Sin reportar = última fecha GPRS anterior a (ahora − {ventana} h) · orden por mayor antigüedad primero ·
          el tiempo se calcula contra el momento de la carga · hora de Perú.
        </span>
      </p>
    </div>
  );
}
