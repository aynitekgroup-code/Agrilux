import React, { useEffect, useMemo, useState } from 'react';
import { Database, FileSpreadsheet, MapPinned, Gauge } from 'lucide-react';
import { obtenerEstadoUnidadesFlota, LIMITE_ESTADO_UNIDADES } from '../../../lib/agrotrackReportesGeocerca';
import { formatearFechaHora, clasificarEstado } from '../../../lib/agrotrackFlota';
import { useRango, ControlesRango, CuerpoEstado, numero } from './reportesComunes';
import { StatusPill } from './VehicleList';

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
  { label: 'Unidad', clase: 'text-left' },
  { label: 'Últ. fecha', clase: 'text-left' },
  { label: 'Estado', clase: 'text-left' },
  { label: 'Dirección', clase: 'text-left' },
  { label: 'Últ. evento', clase: 'text-left' },
  { label: 'Vel.', clase: 'text-right' },
  { label: 'Odómetro', clase: 'text-right' },
  { label: 'Geocerca', clase: 'text-left' },
];

export default function FleetUnitStatus({ empresaId, periodo = null, fuente = 'real' }) {
  const { rango, setRango, dia, setDia, mes, setMes, consulta, pendienteDeFecha } = useRango(periodo);
  const [estado, setEstado] = useState('inactivo');
  const [intento, setIntento] = useState(0);
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState(null);
  const [rangoTexto, setRangoTexto] = useState('');
  const [descargaError, setDescargaError] = useState(null);
  const [generadoEn, setGeneradoEn] = useState(null);

  useEffect(() => {
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
  }, [empresaId, consulta, pendienteDeFecha, intento]);

  // Cantidad de unidades en cada estado (el criterio es el de la consola).
  const conteos = useMemo(() => {
    const c = { en_ruta: 0, detenido: 0, offline: 0 };
    filas.forEach((f) => {
      const e = clasificarEstado(f, periodo?.hasta);
      c[e] = (c[e] || 0) + 1;
    });
    return c;
  }, [filas, periodo?.hasta]);

  const puedeExportar = estado === 'ok' && filas.length > 0;
  const mensajePendiente =
    rango === 'todo' && !periodo?.desde
      ? 'Esta empresa todavía no tiene periodo cargado en agrotrack_posiciones, así que no hay estados que mostrar.'
      : 'Esperando el periodo cargado para precargar el selector…';

  // El XLSX se importa bajo demanda: la librería pesa ~430 kB y solo se
  // necesita cuando el usuario pide el archivo.
  const descargarExcel = async () => {
    setDescargaError(null);
    try {
      const { exportarEstadoUnidadesExcel } = await import('../../../lib/exportExcel');
      exportarEstadoUnidadesExcel(filas, { rangoTexto, periodo });
    } catch (e) {
      setDescargaError(e?.message || 'No se pudo generar el archivo de Excel.');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm min-w-0">
      <div className="p-4 sm:p-5 border-b border-slate-50 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <MapPinned size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">Status de maquinaria (estado de unidades + geocerca)</h2>
            <p className="text-xs text-slate-500">
              Reporte 34 de Zonar "Estado de unidades": última posición, evento y dirección de cada placa, con la geocerca donde está ahora.
            </p>
            {generadoEn ? (
              <p className="text-[11px] text-slate-400 mt-0.5">
                Generado: {generadoEn.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            ) : null}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {fuente === 'real' && rangoTexto ? (
              <span className="hidden lg:inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Database size={12} /> Datos reales: {rangoTexto}
              </span>
            ) : null}
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

        <ControlesRango rango={rango} setRango={setRango} dia={dia} setDia={setDia} mes={mes} setMes={setMes} />
      </div>

      <CuerpoEstado
        pendienteDeFecha={pendienteDeFecha}
        mensajePendiente={mensajePendiente}
        estado={estado}
        error={error}
        onReintentar={() => setIntento((n) => n + 1)}
        mensajeVacio={`No hay posiciones en ${rangoTexto || 'el rango elegido'}. Prueba con otro día/mes o con “Todo el periodo”.`}
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
                  {filas.map((fila) => (
                    <tr key={fila.placa} className="border-b border-slate-50 hover:bg-slate-50/60">
                      <td className="px-3 py-2">
                        <span className="font-bold text-slate-800">{fila.placa}</span>
                        {fila.unidad && fila.unidad !== fila.placa ? (
                          <span className="block text-[10px] text-slate-400 truncate max-w-[240px]">{fila.unidad}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                        {formatearFechaHora(fila.ultima_fecha)}
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill estado={clasificarEstado(fila, periodo?.hasta)} />
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
                      <td className="px-3 py-2 text-right text-slate-300" title="El reporte de Zonar importado no trae odómetro">
                        —
                      </td>
                      <td className="px-3 py-2">
                        {fila.geocerca ? (
                          <>
                            <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                              <MapPinned size={11} className="text-emerald-600 opacity-70" />
                              {fila.geocerca}
                            </span>
                            {fila.geocerca_division ? (
                              <span className="block text-[10px] text-slate-400">{fila.geocerca_division}</span>
                            ) : null}
                          </>
                        ) : fila.geocerca_ultima ? (
                          <>
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                              <MapPinned size={11} className="text-amber-600 opacity-70" />
                              Últ.: {fila.geocerca_ultima}
                            </span>
                            <span className="block text-[10px] text-slate-400">
                              fuera ahora · última visita {fila.geocerca_ultima_fecha ? formatearFechaHora(fila.geocerca_ultima_fecha) : ''}
                            </span>
                          </>
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
                      {filas.length} unidad{filas.length === 1 ? '' : 'es'} reportando
                    </td>
                    <td className="px-3 py-2.5" colSpan={2}>
                      <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-normal text-slate-500">
                        <span>En ruta: <b className="font-bold text-slate-700">{conteos.en_ruta}</b></span>
                        <span>Detenidas: <b className="font-bold text-slate-700">{conteos.detenido}</b></span>
                        <span>Sin conexión: <b className="font-bold text-slate-700">{conteos.offline}</b></span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right" colSpan={4}>
                      <span className="inline-flex items-center gap-1 text-[10px] font-normal text-slate-400">
                        <Gauge size={11} /> Odómetro no viene en el archivo de Zonar
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {filas.length >= LIMITE_ESTADO_UNIDADES ? (
              <p className="px-4 py-2 text-[10px] text-amber-600 border-t border-slate-50">
                Se alcanzó el tope de {LIMITE_ESTADO_UNIDADES} unidades (límite de PostgREST). Reduce el rango.
              </p>
            ) : null}
          </>
        ) : null}
      </CuerpoEstado>

      <p className="px-4 py-2.5 text-[10px] text-slate-400 border-t border-slate-50 leading-relaxed">
        {fuente === 'real' ? (
          <span className="inline-flex items-center gap-1">
            <Database size={10} /> Cálculo en SQL con PostGIS sobre public.agrotrack_posiciones + public.agrotrack_geocercas (agrotrack_estado_unidades_flota).
          </span>
        ) : (
          'Aún no hay datos reales para esta empresa.'
        )}
        <span className="block mt-0.5">
          Última posición del rango · geocerca = polígono (ST_Contains) que la contiene; si está fuera, se muestra la última geocerca de campo en la que estuvo (evento pt_referencia) · «Fuera de geocercas» solo si no hay ninguna · estado contra max(fecha) del periodo cargado · hora de Perú.
        </span>
      </p>
    </div>
  );
}
