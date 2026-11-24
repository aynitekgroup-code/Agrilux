import React, { useEffect, useMemo, useState } from 'react';
import { Database, FileSpreadsheet, Timer, CircleStop, Radio } from 'lucide-react';
import { obtenerActividadFlota, rangoHoyLima } from '../../../lib/agrotrackFlota';
import {
  segundosDelRango,
  calcularEventosResumidos,
  totalesEventosResumidos,
  formatearHMS,
} from '../../../lib/agrotrackEventosResumidos';
import { useRango, ControlesRango, CuerpoEstado, useLimiteFilas, BotonVerMas, BotonActualizarAhora, useFiltroUnidadGrupo, ControlesFiltroUnidadGrupo, filtrarFilasPorPlaca, RelojEnVivo } from './reportesComunes';
import { completarUnidadesReporte } from '../../../lib/agrotrackReporteFilas.js';
import { codigoArea } from '../../../lib/agrotrackVisitasDia';

/**
 * Reporte 15 de Zonar "Eventos resumidos" (FASE 3.6, pedido por el Ing.
 * Carlos Perez): por unidad, cuánto tiempo estuvo en Stop (detenida con el
 * motor apagado), Idle (encendida sin moverse) y Drive (en viaje), con sus
 * porcentajes sobre el rango.
 *
 * Los segundos salen de la RPC agrotrack_actividad_flota (agrupar 'unidad'):
 * Drive = viaje_segundos, Idle = ralenti_segundos y Stop = total del rango −
 * encendido, así los tres porcentajes suman 100%. Solo se descargan filas ya
 * agregadas por SQL (una por unidad), nunca las +100 mil posiciones.
 */
const COLUMNAS = [
  { id: 'stop', label: 'Stop' },
  { id: 'idle', label: 'Idle' },
  { id: 'drive', label: 'Drive' },
  { id: 'total', label: 'Total' },
];

function CeldaTiempo({ segundos, pct, clase }) {
  if (segundos == null) return <td className="px-3 py-1 text-right text-slate-300">—</td>;
  return (
    <td className="px-3 py-1 text-right whitespace-nowrap tabular-nums">
      <span className={`font-semibold ${clase}`}>{formatearHMS(segundos)}</span>
      {pct != null ? <span className="ml-1.5 text-[10px] font-medium text-slate-500">{pct}%</span> : null}
    </td>
  );
}

export default function FleetEventsSummary({ empresaId, periodo = null, fuente = 'real', vehicles = [] }) {
  const {
    rango, setRango, dia, setDia, mes, setMes, desdeHora, setDesdeHora, hastaHora, setHastaHora,
    consulta: consultaRango, pendienteDeFecha: pendienteRango,
  } = useRango(periodo);
  const {
    mostrar,
    setMostrar,
    opcionFiltro,
    setOpcionFiltro,
    gruposInfo,
    opcionesGrupos,
    unidades,
    placasFiltro,
  } = useFiltroUnidadGrupo({ vehicles, empresaId });
  const placa = mostrar === 'unidades' ? opcionFiltro : '';
  const [estado, setEstado] = useState('inactivo');
  const [intento, setIntento] = useState(0);
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState(null);
  const [rangoTexto, setRangoTexto] = useState('');
  const [descargaError, setDescargaError] = useState(null);
  const [generadoEn, setGeneradoEn] = useState(null);
  const [modoReporte, setModoReporte] = useState('historico');
  const [ahora, setAhora] = useState(() => new Date());

  // Tiempo real: el rango no se elige, es el día en curso. `ahora` avanza
  // cada minuto, así que la consulta y el refresco de la tabla se rearman
  // solos con la ventana 00:00 → hora actual.
  useEffect(() => {
    if (modoReporte !== 'tiempo-real') return undefined;
    setAhora(new Date());
    const reloj = setInterval(() => setAhora(new Date()), 60 * 1000);
    return () => clearInterval(reloj);
  }, [modoReporte]);

  const consulta = useMemo(
    () => (modoReporte === 'tiempo-real' ? rangoHoyLima(ahora) : consultaRango),
    [modoReporte, ahora, consultaRango],
  );

  const pendienteDeFecha = modoReporte === 'tiempo-real' ? !consulta.desde : pendienteRango;

  // "23/11/2026" para el contador del día que se está leyendo.
  const fechaLecturaTexto = useMemo(() => {
    const [anio, mes, dia] = String(consulta?.fecha || '').split('-');
    return dia && mes && anio ? `${dia}/${mes}/${anio}` : 'Hoy';
  }, [consulta?.fecha]);

  const textoActualizacion = modoReporte === 'tiempo-real'
    ? 'se actualiza solo cada minuto'
    : 'se actualiza al cambiar el rango o con Actualizar';

  useEffect(() => {
    if (!empresaId || pendienteDeFecha) {
      // Nunca dejar "Calculando..." colgado: si el rango aún no está listo
      // (o cambió a uno pendiente), volvemos a inactivo para que la tarjeta
      // muestre el mensaje de espera en lugar de girar para siempre.
      setEstado((prev) => (prev === 'cargando' ? 'inactivo' : prev));
      return undefined;
    }
    let cancelado = false;
    setEstado('cargando');
    setError(null);
    obtenerActividadFlota(empresaId, {
      desde: consulta.desde,
      hasta: consulta.hasta,
      placa: placa || null,
      agrupar: 'unidad',
    })
      .then((resultado) => {
        if (cancelado) return;
        setFilas(resultado);
        setEstado(resultado.length ? 'ok' : 'vacio');
        setRangoTexto(consulta.texto);
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
  }, [empresaId, consulta, placa, pendienteDeFecha, intento]);

  const filasFiltradas = useMemo(
    () => filtrarFilasPorPlaca(filas, placasFiltro, (fila) => fila?.placa),
    [filas, placasFiltro],
  );

  // Duración real del rango (limitada al periodo cargado): es el denominador
  // de los porcentajes y el Total de cada fila.
  const totalSegundos = useMemo(
    () => segundosDelRango(consulta, modoReporte === 'tiempo-real' ? null : periodo),
    [consulta, periodo, modoReporte],
  );

  const filasCalculadas = useMemo(
    () => calcularEventosResumidos(completarUnidadesReporte(
      filasFiltradas, filtrarFilasPorPlaca(unidades, placasFiltro),
    ), totalSegundos),
    [filasFiltradas, totalSegundos, unidades, placasFiltro]
  );

  // Tabla limitada a 15 filas; totales, filtros y Excel usan todo.
  const { filasVistas, expandido, alternar, total } = useLimiteFilas(filasCalculadas);

  const totales = useMemo(() => totalesEventosResumidos(filasCalculadas), [filasCalculadas]);

  const puedeExportar = (estado === 'ok' || estado === 'vacio') && filasCalculadas.length > 0 && totalSegundos > 0;
  const mensajePendiente =
    rango === 'todo' && !periodo?.desde
      ? 'Esta empresa todavía no tiene periodo cargado en agrotrack_posiciones, así que no hay cifras que mostrar.'
      : 'Esperando el periodo cargado para precargar el selector…';

  // El XLSX se importa bajo demanda: la librería pesa ~430 kB y solo se
  // necesita cuando el usuario pide el archivo.
  const descargarExcel = async () => {
    setDescargaError(null);
    try {
      const { exportarEventosResumidosExcel } = await import('../../../lib/exportExcel');
      exportarEventosResumidosExcel(filasCalculadas, { totalSegundos, rangoTexto, placa, calculadas: true });
    } catch (e) {
      setDescargaError(e?.message || 'No se pudo generar el archivo de Excel.');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm min-w-0">
      <div className="p-4 sm:p-5 border-b border-slate-50 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Timer size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">Eventos resumidos (Stop / Idle / Drive)</h2>
            <p className="text-xs text-slate-500">
              {modoReporte === 'tiempo-real'
                ? 'Reporte 15 de Zonar: porcentaje de tiempo de cada unidad detenida, en ralentí y en viaje del día en curso.'
                : 'Reporte 15 de Zonar: porcentaje de tiempo de cada unidad detenida, en ralentí y en viaje dentro del rango.'}
            </p>
            {generadoEn ? (
              <p className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  title="Reloj de Perú. No indica la antigüedad del dato: para eso mira «leído hace instantes»"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                  Hora Perú <RelojEnVivo />
                </span>
                <span>
                  Generado: {generadoEn.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
                  {modoReporte === 'tiempo-real' ? ` · Día en lectura: ${fechaLecturaTexto}` : ''}
                  {' · '}{textoActualizacion}
                </span>
              </p>
            ) : null}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {fuente === 'real' && rangoTexto ? (
              <span className="hidden lg:inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Database size={12} /> Datos reales: {rangoTexto}
              </span>
            ) : null}
            <BotonActualizarAhora onClick={() => setIntento((n) => n + 1)} disabled={estado === 'cargando' || pendienteDeFecha} cargando={estado === 'cargando'} />
            <button
              type="button"
              onClick={descargarExcel}
              disabled={!puedeExportar}
              className="inline-flex items-center gap-1.5 rounded-lg border border-forest bg-forest px-2.5 py-1.5 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <FileSpreadsheet size={13} /> Descargar Excel
            </button>
          </div>
        </div>
        {descargaError ? <p className="text-[10px] text-red-600">{descargaError}</p> : null}

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-slate-50 p-0.5" role="group" aria-label="Modo del reporte">
            <button
              type="button"
              onClick={() => setModoReporte('tiempo-real')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                modoReporte === 'tiempo-real' ? 'bg-forest text-white' : 'text-slate-500 hover:text-forest'
              }`}
              title="Tiempo de Stop / Idle / Drive del día en curso, con los datos que envía Zonar"
            >
              <Radio size={13} className={modoReporte === 'tiempo-real' ? 'animate-pulse' : ''} /> Tiempo real (Zonar)
            </button>
            <button
              type="button"
              onClick={() => setModoReporte('historico')}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                modoReporte === 'historico' ? 'bg-forest text-white' : 'text-slate-500 hover:text-forest'
              }`}
            >
              Histórico por rango
            </button>
          </div>
          {modoReporte === 'tiempo-real' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
              {generadoEn ? 'Consulta actualizada · ver hora de generación' : 'Esperando primera lectura'}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {modoReporte !== 'tiempo-real' ? (
            <ControlesRango rango={rango} setRango={setRango} dia={dia} setDia={setDia} mes={mes} setMes={setMes} desdeHora={desdeHora} setDesdeHora={setDesdeHora} hastaHora={hastaHora} setHastaHora={setHastaHora} />
          ) : null}
          <ControlesFiltroUnidadGrupo
            mostrar={mostrar}
            setMostrar={setMostrar}
            opcionFiltro={opcionFiltro}
            setOpcionFiltro={setOpcionFiltro}
            unidades={unidades}
            opcionesGrupos={opcionesGrupos}
            gruposInfo={gruposInfo}
          />
        </div>
      </div>

      <CuerpoEstado
        pendienteDeFecha={pendienteDeFecha}
        mensajePendiente={mensajePendiente}
        estado={estado}
        error={error}
        onReintentar={() => setIntento((n) => n + 1)}
        mensajeVacio={`No hay posiciones en ${rangoTexto || 'el rango elegido'}${placa ? ` para la unidad ${placa}` : ''}. Prueba con otro día/mes o con “Todas las unidades”.`}
        childrenCuandoVacio={filasCalculadas.length > 0}
      >
        {estado === 'ok' || filasCalculadas.length ? (
          <>
            <div className="max-h-[65vh] overflow-auto">
              <table className="w-full text-xs text-slate-700">
                <thead className="sticky top-0 z-10 bg-white shadow-sm">
                  <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2.5 font-bold text-left">Placa</th>
                    <th className="px-3 py-2.5 font-bold text-left">Área</th>
                    {COLUMNAS.map((col) => (
                      <th key={col.id} className="px-3 py-2.5 font-bold text-right">
                        {col.id === 'stop' ? (
                          <span className="inline-flex items-center gap-1">
                            <CircleStop size={10} className="opacity-60" /> {col.label}
                          </span>
                        ) : (
                          col.label
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filasVistas.map((fila) => (
                    <tr key={fila.placa} className="border-b border-slate-50 hover:bg-slate-50/60">
                      <td className="px-3 py-1 whitespace-nowrap">
                        <span className="font-bold text-slate-800">{fila.placa}</span>
                        {fila.sin_datos_rango ? <span className="ml-2 text-[10px] text-amber-700">Sin datos</span> : null}
                      </td>
                      <td className="px-3 py-1 text-slate-600">{codigoArea(fila.unidad, fila.placa) || '—'}</td>
                      <CeldaTiempo segundos={fila.stop} pct={fila.pct_stop} clase="text-slate-700" />
                      <CeldaTiempo segundos={fila.idle} pct={fila.pct_idle} clase="text-amber-600" />
                      <CeldaTiempo segundos={fila.drive} pct={fila.pct_drive} clase="text-emerald-700" />
                      <CeldaTiempo segundos={fila.total} pct={null} clase="text-slate-800" />
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 text-slate-700 font-bold">
                    <td className="px-3 py-2.5" colSpan={2}>
                      Totales de {filasCalculadas.length} unidad{filasCalculadas.length === 1 ? '' : 'es'}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {totales.total > 0 ? formatearHMS(totales.stop) : '—'}
                      <span className="ml-1.5 text-[10px] font-normal text-slate-500">
                        {totales.pct_stop != null ? `${totales.pct_stop}%` : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-amber-600">
                      {totales.total > 0 ? formatearHMS(totales.idle) : '—'}
                      <span className="ml-1.5 text-[10px] font-normal text-slate-500">
                        {totales.pct_idle != null ? `${totales.pct_idle}%` : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-emerald-700">
                      {totales.total > 0 ? formatearHMS(totales.drive) : '—'}
                      <span className="ml-1.5 text-[10px] font-normal text-slate-500">
                        {totales.pct_drive != null ? `${totales.pct_drive}%` : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">{totales.total > 0 ? formatearHMS(totales.total) : '—'}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <BotonVerMas expandido={expandido} onAlternar={alternar} total={total} />

            <p className="px-4 py-2 text-[10px] text-slate-400 border-t border-slate-50">
              Total del rango: {formatearHMS(totalSegundos)} · Stop + Idle + Drive = 100% en cada fila.
            </p>
          </>
        ) : null}
      </CuerpoEstado>

      <p className="px-4 py-2.5 text-[10px] text-slate-400 border-t border-slate-50 leading-relaxed">
        {fuente === 'real' ? (
          <span className="inline-flex items-center gap-1">
            <Database size={10} /> Cifras de SQL sobre public.agrotrack_posiciones (agrotrack_actividad_flota); Stop/Idle/Drive derivados de esas filas agregadas.
          </span>
        ) : (
          'Aún no hay datos reales para esta empresa.'
        )}
        <span className="block mt-0.5">
          Drive: encendido y &gt; 5 km/h · Idle: encendido y ≤ 5 km/h · Stop: tiempo del rango sin motor encendido · hora de Perú.
        </span>
      </p>
    </div>
  );
}
