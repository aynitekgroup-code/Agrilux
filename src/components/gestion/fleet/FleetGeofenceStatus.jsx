import React, { useEffect, useMemo, useState } from 'react';
import { Layers, FileSpreadsheet, Search, ChevronDown, ChevronRight, Database } from 'lucide-react';
import { obtenerEstadoVivo, obtenerLatidos, suscribirEstadoVivo, describirLatido } from '../../../lib/agrotrackTiempoReal';
import { obtenerEstadoUnidadesFlota } from '../../../lib/agrotrackReportesGeocerca';
import { formatearFechaHora } from '../../../lib/agrotrackFlota';
import { codigoArea } from '../../../lib/agrotrackVisitasDia';
import {
  agruparPorGeocerca,
  totalesPorEstado,
  ETIQUETAS_ESTADO_GEO,
  UMBRAL_SIN_DATO_MINUTOS,
} from '../../../lib/estadoGeocerca';
import {
  CuerpoEstado,
  haceCuanto,
  numero,
  useLimiteFilas,
  BotonVerMas,
  BotonActualizarAhora,
  RelojEnVivo,
} from './reportesComunes';

/**
 * Reporte "Estado por geocerca" (3 estados), pedido por el Ing. Carlos Perez.
 *
 * Una fila por geocerca con la cantidad de unidades en cada estado de la
 * última posición: Apagado · Ralentí (encendido y 0 a 5 km/h) · Conduciendo
 * (más de 5 km/h). Al abrir la geocerca se listan sus placas con el estado,
 * la velocidad y la última posición. Usa la misma data en vivo que el Punto 3
 * (Status de maquinaria): agrotrack_estado_vivo_flota + Realtime + respaldo
 * cada 60 s; si el SQL en vivo no está instalado, cae al histórico.
 */

const RESPALDO_VIVO_MS = 60 * 1000;

const TONOS = {
  conduciendo: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ralenti: 'bg-amber-50 text-amber-700 border-amber-200',
  apagado: 'bg-slate-100 text-slate-600 border-slate-200',
  sin_dato: 'bg-rose-50 text-rose-700 border-rose-200',
};

function ChipEstado({ estado }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${TONOS[estado] || TONOS.sin_dato}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
      {ETIQUETAS_ESTADO_GEO[estado] || 'Sin dato'}
    </span>
  );
}

function areaDe(fila) {
  if (!fila) return '—';
  return codigoArea(fila.unidad, fila.placa)
    || (fila.descripcion && fila.descripcion !== fila.placa ? fila.descripcion : '—');
}

export default function FleetGeofenceStatus({ empresaId, fuente = 'real' }) {
  const [filas, setFilas] = useState([]);
  const [estado, setEstado] = useState('inactivo');
  const [error, setError] = useState(null);
  const [intento, setIntento] = useState(0);
  const [generadoEn, setGeneradoEn] = useState(null);
  const [latido, setLatido] = useState(null);
  const [ahora, setAhora] = useState(() => new Date());
  const [busqueda, setBusqueda] = useState('');
  const [abiertas, setAbiertas] = useState(() => new Set());
  const [descargaError, setDescargaError] = useState(null);

  useEffect(() => {
    if (!empresaId) {
      setEstado((prev) => (prev === 'cargando' ? 'inactivo' : prev));
      return undefined;
    }
    let cancelado = false;

    const cargar = async (silencioso) => {
      if (!silencioso) setEstado('cargando');
      let datos = [];
      let avisoVivo = null;
      try {
        datos = await obtenerEstadoVivo(empresaId);
      } catch (e) {
        avisoVivo = e;
      }
      // Sin tabla en vivo (o aún sin filas): último estado conocido del histórico.
      if (!datos.length) {
        try {
          datos = await obtenerEstadoUnidadesFlota(empresaId, { desde: null, hasta: null });
        } catch (e) {
          if (cancelado) return;
          setError(e?.message || avisoVivo?.message || 'No se pudo leer el estado de las unidades.');
          setEstado('error');
          return;
        }
      }
      if (cancelado) return;
      const latidos = await obtenerLatidos(empresaId).catch(() => null);
      if (cancelado) return;
      setFilas(datos);
      setLatido(latidos?.envivo || latidos?.diario || null);
      setAhora(new Date());
      setGeneradoEn(new Date());
      setEstado(datos.length ? 'ok' : 'vacio');
      setError(null);
    };

    cargar(false);

    let pendiente = null;
    const cancelarSuscripcion = suscribirEstadoVivo(empresaId, () => {
      clearTimeout(pendiente);
      pendiente = setTimeout(() => cargar(true), 1500);
    });
    const reloj = setInterval(() => cargar(true), RESPALDO_VIVO_MS);

    return () => {
      cancelado = true;
      clearTimeout(pendiente);
      clearInterval(reloj);
      cancelarSuscripcion();
    };
  }, [empresaId, intento]);

  // Las unidades sin telemetría (o sin ninguna fecha) nunca tuvieron posición:
  // no pertenecen a una geocerca y no se inventan como "sin dato" de un lote.
  const filasConUbicacion = useMemo(
    () => filas.filter((f) => !f.sin_telemetria && f.ultima_fecha),
    [filas],
  );

  const grupos = useMemo(
    () => agruparPorGeocerca(filasConUbicacion, ahora),
    [filasConUbicacion, ahora],
  );

  const totales = useMemo(() => totalesPorEstado(grupos), [grupos]);

  const gruposFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return grupos;
    return grupos.filter((g) => g.geocerca.toLowerCase().includes(q)
      || g.unidades.some((u) => String(u.placa || '').toLowerCase().includes(q)));
  }, [grupos, busqueda]);

  const { filasVistas, expandido, alternar, total } = useLimiteFilas(gruposFiltrados);

  const totalesVista = useMemo(() => totalesPorEstado(gruposFiltrados), [gruposFiltrados]);

  const alternarGrupo = (clave) => {
    setAbiertas((prev) => {
      const copia = new Set(prev);
      if (copia.has(clave)) copia.delete(clave);
      else copia.add(clave);
      return copia;
    });
  };

  const puedeExportar = estado === 'ok' && gruposFiltrados.length > 0;

  const descargarExcel = async () => {
    setDescargaError(null);
    try {
      const { exportarEstadoPorGeocercaExcel } = await import('../../../lib/exportExcelReportes');
      exportarEstadoPorGeocercaExcel(gruposFiltrados, {
        generado: generadoEn,
        ahora,
        filtro: busqueda.trim(),
        sinTelemetria: filas.length - filasConUbicacion.length,
      });
    } catch (e) {
      setDescargaError(e?.message || 'No se pudo generar el archivo de Excel.');
    }
  };

  const chipInfo = (() => {
    if (!latido?.ultima_lectura) return null;
    return describirLatido(latido, ahora);
  })();

  return (
    <div className="min-w-0">
      <h3 className="text-sm font-bold uppercase tracking-wide text-emerald-800 mb-3">
        Punto 5 · Estado por geocerca (apagado · ralentí · conduciendo)
      </h3>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm min-w-0">
        <div className="p-4 sm:p-5 border-b border-slate-50 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Layers size={17} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900">Estado por geocerca</h2>
              <p className="text-xs text-slate-500">
                Unidades dentro de cada geocerca según su última posición · 3 estados · se actualiza sola desde la nube.
              </p>
              {generadoEn ? (
                <p className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    title="Reloj de Perú. No indica la antigüedad del dato: para eso mira el chip «leído hace…»."
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                    Hora Perú <RelojEnVivo />
                  </span>
                  <span>
                    Generado: {generadoEn.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
                    {' · '}se actualiza al llegar datos de Zonar
                  </span>
                </p>
              ) : null}
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {chipInfo ? (
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap ${
                  chipInfo.viejo
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${chipInfo.viejo ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} aria-hidden="true" />
                  {chipInfo.texto}
                </span>
              ) : null}
              <BotonActualizarAhora
                onClick={() => setIntento((n) => n + 1)}
                disabled={estado === 'cargando'}
                cargando={estado === 'cargando'}
              />
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
            <span className="inline-flex items-center gap-1.5 rounded-full bg-forest px-2.5 py-1 text-[11px] font-semibold text-white whitespace-nowrap">
              Total {numero(totales.total, 0)} unidades
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${TONOS.conduciendo}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
              Conduciendo {numero(totales.conduciendo, 0)}
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${TONOS.ralenti}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
              Ralentí {numero(totales.ralenti, 0)}
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${TONOS.apagado}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
              Apagado {numero(totales.apagado, 0)}
            </span>
            {totales.sinDato > 0 ? (
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${TONOS.sin_dato}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
                Sin dato {numero(totales.sinDato, 0)}
              </span>
            ) : null}
          </div>

          <p className="text-[10px] text-slate-400 leading-relaxed">
            Apagado = motor apagado/estacionado · Ralentí = encendido y 0 a 5 km/h · Conduciendo = más de 5 km/h.
            {' '}Sin dato = última posición mayor a {UMBRAL_SIN_DATO_MINUTOS} min o fecha inválida (no se suma a los 3 estados).
          </p>

          {estado === 'ok' || gruposFiltrados.length > 0 ? (
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-0 flex-1 sm:flex-none">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Buscar geocerca o placa</span>
                <span className="relative block">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Todas las geocercas"
                    className="w-full sm:w-72 rounded-lg border border-slate-200 pl-8 pr-2.5 py-1.5 text-xs text-slate-700 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </span>
              </label>
              <span className="ml-auto text-[11px] text-slate-400">
                {numero(gruposFiltrados.length, 0)} geocerca(s) · {numero(totalesVista.total, 0)} unidad(es)
              </span>
            </div>
          ) : null}
        </div>

        <CuerpoEstado
          pendienteDeFecha={!empresaId}
          mensajePendiente="Selecciona una empresa activa para ver el estado por geocerca."
          estado={estado}
          error={error}
          onReintentar={() => setIntento((n) => n + 1)}
          mensajeVacio="No hay unidades con posición conocida para agrupar por geocerca."
          childrenCuandoVacio={gruposFiltrados.length > 0}
        >
          {estado === 'ok' || gruposFiltrados.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-slate-700">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                      <th className="px-3 py-2.5 font-bold text-left">Geocerca</th>
                      <th className="px-3 py-2.5 font-bold text-right text-emerald-700">Conduciendo</th>
                      <th className="px-3 py-2.5 font-bold text-right text-amber-700">Ralentí</th>
                      <th className="px-3 py-2.5 font-bold text-right text-slate-600">Apagado</th>
                      <th className="px-3 py-2.5 font-bold text-right text-rose-600">Sin dato</th>
                      <th className="px-3 py-2.5 font-bold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasVistas.length === 0 ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-slate-400" colSpan={6}>
                          Ninguna geocerca coincide con «{busqueda}».
                        </td>
                      </tr>
                    ) : null}

                    {filasVistas.map((grupo) => {
                      const abierta = abiertas.has(grupo.clave);
                      return (
                        <React.Fragment key={grupo.clave}>
                          <tr
                            className="border-b border-slate-50 hover:bg-slate-50/60 cursor-pointer"
                            onClick={() => alternarGrupo(grupo.clave)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                alternarGrupo(grupo.clave);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            aria-expanded={abierta}
                          >
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center gap-1.5 text-left font-semibold text-slate-800">
                                {abierta ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                                <span className={grupo.clave === '__sin_geocerca__' ? 'text-slate-400' : ''}>{grupo.geocerca}</span>
                                <span className="text-[10px] font-normal text-slate-400">({grupo.total})</span>
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-emerald-700">{grupo.conduciendo || '—'}</td>
                            <td className="px-3 py-2 text-right font-bold text-amber-700">{grupo.ralenti || '—'}</td>
                            <td className="px-3 py-2 text-right font-semibold text-slate-600">{grupo.apagado || '—'}</td>
                            <td className="px-3 py-2 text-right text-rose-600">{grupo.sinDato || '—'}</td>
                            <td className="px-3 py-2 text-right font-bold text-slate-800">{grupo.total}</td>
                          </tr>

                          {abierta ? (
                            <tr className="bg-slate-50/60 border-b border-slate-100">
                              <td colSpan={6} className="px-3 pb-3 pt-1">
                                <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
                                  <table className="w-full text-[11px] text-slate-700">
                                    <thead>
                                      <tr className="border-b border-slate-100 text-[9px] uppercase tracking-wide text-slate-400">
                                        <th className="px-3 py-2 text-left font-bold">Placa</th>
                                        <th className="px-3 py-2 text-left font-bold">Área</th>
                                        <th className="px-3 py-2 text-left font-bold">Estado</th>
                                        <th className="px-3 py-2 text-right font-bold">Vel.</th>
                                        <th className="px-3 py-2 text-left font-bold">Últ. posición</th>
                                        <th className="px-3 py-2 text-left font-bold">Hace</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {grupo.unidades.map((u, i) => (
                                        <tr key={`${u.placa || 'sin-placa'}-${i}`} className="border-b border-slate-50 last:border-0">
                                          <td className="px-3 py-1.5 font-bold text-slate-800">{u.placa || '—'}</td>
                                          <td className="px-3 py-1.5 text-slate-600">{areaDe(u)}</td>
                                          <td className="px-3 py-1.5"><ChipEstado estado={u.estado} /></td>
                                          <td className="px-3 py-1.5 text-right whitespace-nowrap text-slate-600">
                                            {u.ultima_velocidad == null ? '—' : `${numero(u.ultima_velocidad, 0)} km/h`}
                                          </td>
                                          <td className="px-3 py-1.5 whitespace-nowrap text-slate-600">
                                            {u.ultima_fecha ? formatearFechaHora(u.ultima_fecha) : 'sin reporte'}
                                          </td>
                                          <td className="px-3 py-1.5 whitespace-nowrap text-slate-400">{haceCuanto(u.ultima_fecha, ahora)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-100 bg-slate-50/60 text-[11px]">
                      <td className="px-3 py-2 font-bold uppercase tracking-wide text-slate-500">
                        Total general
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-emerald-700">{totalesVista.conduciendo}</td>
                      <td className="px-3 py-2 text-right font-bold text-amber-700">{totalesVista.ralenti}</td>
                      <td className="px-3 py-2 text-right font-bold text-slate-600">{totalesVista.apagado}</td>
                      <td className="px-3 py-2 text-right text-rose-600">{totalesVista.sinDato}</td>
                      <td className="px-3 py-2 text-right font-bold text-slate-800">{totalesVista.total}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <BotonVerMas expandido={expandido} onAlternar={alternar} total={total} />
            </>
          ) : null}
        </CuerpoEstado>

        <p className="px-4 py-2.5 text-[10px] text-slate-400 border-t border-slate-50 leading-relaxed">
          {fuente === 'real' ? (
            <span className="inline-flex items-center gap-1">
              <Database size={10} /> Última posición de cada unidad (agrotrack_estado_vivo_flota) + geocerca actual por PostGIS.
            </span>
          ) : (
            'Aún no hay datos reales para esta empresa.'
          )}
          <span className="block mt-0.5">
            Agrupado por la geocerca que contiene la última posición; fuera de todas va en «Sin geocerca».
            {' '}Las unidades sin ninguna posición no se incluyen (ver «Unidades sin reportar»).
            {' '}Los conteos no son horas: son unidades en cada estado en este momento · hora de Perú.
          </span>
        </p>
      </div>
    </div>
  );
}
