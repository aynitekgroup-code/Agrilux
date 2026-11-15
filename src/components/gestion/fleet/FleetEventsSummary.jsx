import React, { useEffect, useMemo, useState } from 'react';
import { Database, FileSpreadsheet, Timer, CircleStop } from 'lucide-react';
import { obtenerActividadFlota } from '../../../lib/agrotrackFlota';
import {
  segundosDelRango,
  calcularEventosResumidos,
  totalesEventosResumidos,
  formatearHMS,
} from '../../../lib/agrotrackEventosResumidos';
import { useRango, ControlesRango, CuerpoEstado, useLimiteFilas, BotonVerMas } from './reportesComunes';

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
  if (segundos == null) return <td className="px-3 py-2 text-right text-slate-300">—</td>;
  return (
    <td className="px-3 py-2 text-right">
      <span className={`font-semibold ${clase}`}>{formatearHMS(segundos)}</span>
      {pct != null ? <span className="block text-[10px] text-slate-400">{pct}%</span> : null}
    </td>
  );
}

export default function FleetEventsSummary({ empresaId, periodo = null, fuente = 'real', vehicles = [] }) {
  const { rango, setRango, dia, setDia, mes, setMes, desdeHora, setDesdeHora, hastaHora, setHastaHora, consulta, pendienteDeFecha } = useRango(periodo);
  const [placa, setPlaca] = useState('');
  const [estado, setEstado] = useState('inactivo');
  const [intento, setIntento] = useState(0);
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState(null);
  const [rangoTexto, setRangoTexto] = useState('');
  const [descargaError, setDescargaError] = useState(null);

  const unidades = useMemo(
    () => vehicles.map((v) => ({ placa: v.placa, descripcion: v.descripcion || '' })),
    [vehicles]
  );

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

  // Duración real del rango (limitada al periodo cargado): es el denominador
  // de los porcentajes y el Total de cada fila.
  const totalSegundos = useMemo(() => segundosDelRango(consulta, periodo), [consulta, periodo]);

  const filasCalculadas = useMemo(
    () => calcularEventosResumidos(filas, totalSegundos),
    [filas, totalSegundos]
  );

  // Tabla limitada a 15 filas; totales, filtros y Excel usan todo.
  const { filasVistas, expandido, alternar, total } = useLimiteFilas(filasCalculadas);

  const totales = useMemo(() => totalesEventosResumidos(filasCalculadas), [filasCalculadas]);

  const puedeExportar = estado === 'ok' && filasCalculadas.length > 0 && totalSegundos > 0;
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
      exportarEventosResumidosExcel(filas, { totalSegundos, rangoTexto, placa });
    } catch (e) {
      setDescargaError(e?.message || 'No se pudo generar el archivo de Excel.');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm min-w-0">
      <div className="p-4 sm:p-5 border-b border-slate-50 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Timer size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">Eventos resumidos (Stop / Idle / Drive)</h2>
            <p className="text-xs text-slate-500">
              Reporte 15 de Zonar: porcentaje de tiempo de cada unidad detenida, en ralentí y en viaje dentro del rango.
            </p>
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

        <div className="flex flex-wrap items-end gap-3">
          <ControlesRango rango={rango} setRango={setRango} dia={dia} setDia={setDia} mes={mes} setMes={setMes} desdeHora={desdeHora} setDesdeHora={setDesdeHora} hastaHora={hastaHora} setHastaHora={setHastaHora} />
          <label className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Unidad</span>
            <select
              value={placa}
              onChange={(e) => setPlaca(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">Todas las unidades</option>
              {unidades.map((u) => (
                <option key={u.placa} value={u.placa}>
                  {u.descripcion ? `${u.placa} · ${u.descripcion}` : u.placa}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <CuerpoEstado
        pendienteDeFecha={pendienteDeFecha}
        mensajePendiente={mensajePendiente}
        estado={estado}
        error={error}
        onReintentar={() => setIntento((n) => n + 1)}
        mensajeVacio={`No hay posiciones en ${rangoTexto || 'el rango elegido'}${placa ? ` para la unidad ${placa}` : ''}. Prueba con otro día/mes o con “Todas las unidades”.`}
      >
        {estado === 'ok' ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-slate-700">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2.5 font-bold text-left">Unidad</th>
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
                      <td className="px-3 py-2">
                        <span className="font-bold text-slate-800">{fila.placa}</span>
                        {fila.unidad && fila.unidad !== fila.placa ? (
                          <span className="block text-[10px] text-slate-400 truncate max-w-[240px]">{fila.unidad}</span>
                        ) : null}
                      </td>
                      <CeldaTiempo segundos={fila.stop} pct={fila.pct_stop} clase="text-slate-700" />
                      <CeldaTiempo segundos={fila.idle} pct={fila.pct_idle} clase="text-amber-600" />
                      <CeldaTiempo segundos={fila.drive} pct={fila.pct_drive} clase="text-emerald-700" />
                      <CeldaTiempo segundos={fila.total} pct={null} clase="text-slate-800" />
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 text-slate-700 font-bold">
                    <td className="px-3 py-2.5">
                      Totales de {filasCalculadas.length} unidad{filasCalculadas.length === 1 ? '' : 'es'}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {formatearHMS(totales.stop)}
                      <span className="block text-[10px] font-normal text-slate-400">
                        {totales.pct_stop != null ? `${totales.pct_stop}%` : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-amber-600">
                      {formatearHMS(totales.idle)}
                      <span className="block text-[10px] font-normal text-slate-400">
                        {totales.pct_idle != null ? `${totales.pct_idle}%` : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-emerald-700">
                      {formatearHMS(totales.drive)}
                      <span className="block text-[10px] font-normal text-slate-400">
                        {totales.pct_drive != null ? `${totales.pct_drive}%` : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">{formatearHMS(totales.total)}</td>
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
