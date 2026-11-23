import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarDays,
  Database,
  FileSpreadsheet,
  Filter,
  Loader2,
  LogIn,
  LogOut,
  MapPinned,
  Save,
  Sparkles,
  X,
} from 'lucide-react';
import {
  obtenerEventosGeocerca,
  obtenerLotesFlota,
  obtenerPermanenciasLoteExcel,
  guardarRespaldoVisitas,
  LIMITE_EVENTOS_GEOCERCA,
  LIMITE_LOTES,
} from '../../../lib/agrotrackReportesGeocerca';
import {
  asegurarVisitasCalculadas,
  leerVisitasDia,
  filtrarVisitasPorRango,
  partesLima,
  codigoArea,
} from '../../../lib/agrotrackVisitasDia';
import {
  formatearDuracion,
  formatearFechaHora,
  etiquetaPeriodoReporte,
  ultimoDiaLima,
} from '../../../lib/agrotrackFlota';
import { useRango, ControlesRango, CuerpoEstado, numero, useLimiteFilas, BotonVerMas, BotonActualizarAhora, useFiltroUnidadGrupo, ControlesFiltroUnidadGrupo, filtrarFilasPorPlaca, AvisoUnidadesSinTelemetria } from './reportesComunes';
import { normalizarPlaca } from '../../../lib/agrotrackGrupos';
import { agruparPorDivision, aplanarGrupos, nombreDivision, normalizarDivision } from '../../../lib/agrotrackDivisiones';
import { armarContextoReporte } from '../../../lib/reportesIa';
import { llamarIaGestion } from '../../../lib/agrotrackIa';

/**
 * Reportes de geocercas (FASE 3.5): los dos reportes pedidos por el Ing.
 * Carlos Perez, calculados en SQL (RPC) sobre public.agrotrack_posiciones y
 * public.agrotrack_geocercas:
 *   1) Entradas y salidas: los eventos de Zonar ("Entrada a Geocerca" /
 *      "Salida de Geocerca") agrupados por geocerca, por día o por mes.
 *   2) Tiempo en cada lote: punto dentro del polígono con PostGIS.
 * Nada se descarga al navegador: PostgREST corta en 1000 filas y el cruce son
 * +100 mil posiciones x 129 polígonos.
 */

const AGRUPACIONES = [
  { id: 'geocerca', label: 'Por geocerca' },
  { id: 'dia', label: 'Por día' },
  { id: 'mes', label: 'Por mes' },
];

/** Tarjeta 1: entradas y salidas de geocerca (eventos de Zonar). */
function CardEventos({ empresaId, periodo, fuente, vehicles = [] }) {
  const { rango, setRango, dia, setDia, mes, setMes, desdeHora, setDesdeHora, hastaHora, setHastaHora, consulta, pendienteDeFecha } = useRango(periodo);
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
  } = useFiltroUnidadGrupo({ vehicles, empresaId });
  const [agrupar, setAgrupar] = useState('geocerca');
  const [estado, setEstado] = useState('inactivo');
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState(null);
  const [rangoTexto, setRangoTexto] = useState('');
  const [intento, setIntento] = useState(0);
  const [descargaError, setDescargaError] = useState(null);

  useEffect(() => {
    if (!empresaId || pendienteDeFecha) {
      // Nunca dejar "Calculando..." colgado (ver FleetEventsSummary).
      setEstado((prev) => (prev === 'cargando' ? 'inactivo' : prev));
      return undefined;
    }
    let cancelado = false;
    setEstado('cargando');
    setError(null);
    obtenerEventosGeocerca(empresaId, {
      desde: consulta.desde,
      hasta: consulta.hasta,
      agrupar,
      placas: placasFiltro,
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
  }, [empresaId, consulta, agrupar, pendienteDeFecha, intento, placasFiltro]);

  const unidadesSinTelemetria = useMemo(() => {
    if (placasFiltro == null) return unidadesSinPosicion;
    const placas = new Set(placasFiltro.map(normalizarPlaca));
    return unidadesSinPosicion.filter((unidad) => placas.has(unidad.placa));
  }, [placasFiltro, unidadesSinPosicion]);

  const totales = useMemo(() => {
    const sum = (campo) => filas.reduce((s, f) => s + Number(f[campo] || 0), 0);
    return { entradas: sum('entradas'), salidas: sum('salidas') };
  }, [filas]);

  // Tabla limitada a 15 filas; el pie y el Excel usan el total completo.
  const { filasVistas, expandido, alternar, total } = useLimiteFilas(filas);

  const puedeExportar = estado === 'ok' && filas.length > 0;
  const mensajePendiente =
    rango === 'todo' && !periodo?.desde
      ? 'Esta empresa todavía no tiene periodo cargado en agrotrack_posiciones, así que no hay cifras que mostrar.'
      : 'Esperando el periodo cargado para precargar el selector…';

  // El XLSX se importa bajo demanda: la librería pesa ~430 kB y solo se
  // necesita cuando el usuario pide el archivo.


  const descargarExcel = async () => {
    setDescargaError(null);
    try {
      const { exportarEventosGeocercaExcel } = await import('../../../lib/exportExcel');
      exportarEventosGeocercaExcel(filas, { agrupar, rangoTexto });
    } catch (e) {
      setDescargaError(e?.message || 'No se pudo generar el archivo de Excel.');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm min-w-0">
      <div className="p-4 sm:p-5 border-b border-slate-50 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <LogIn size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">Entradas y salidas de geocerca</h2>
            <p className="text-xs text-slate-500">
              Eventos de Zonar por geocerca, por día o por mes: entradas, salidas y unidades que entraron.
            </p>
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

        <div className="flex flex-wrap items-end gap-3">
          <ControlesRango rango={rango} setRango={setRango} dia={dia} setDia={setDia} mes={mes} setMes={setMes} desdeHora={desdeHora} setDesdeHora={setDesdeHora} hastaHora={hastaHora} setHastaHora={setHastaHora} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Agrupación</p>
            <div className="flex gap-1.5">
              {AGRUPACIONES.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAgrupar(a.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                    agrupar === a.id ? 'bg-forest text-white' : 'bg-slate-50 text-slate-500 hover:text-forest'
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
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
        mensajeVacio={`No hay eventos de geocerca en ${rangoTexto || 'el rango elegido'}. Prueba con otro día/mes o con “Todo el periodo”.`}
        childrenCuandoVacio={unidadesSinTelemetria.length > 0}
      >
        <AvisoUnidadesSinTelemetria unidades={unidadesSinTelemetria} />
        {estado === 'ok' ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-slate-700">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2.5 font-bold text-left">
                      {agrupar === 'geocerca' ? 'Geocerca' : 'Período'}
                    </th>
                    <th className="px-3 py-2.5 font-bold text-right">Entradas</th>
                    <th className="px-3 py-2.5 font-bold text-right">Salidas</th>
                    <th className="px-3 py-2.5 font-bold text-right">Unidades</th>
                    <th className="px-3 py-2.5 font-bold text-right">Última entrada</th>
                  </tr>
                </thead>
                <tbody>
                  {filasVistas.map((fila, i) => (
                    <tr key={`${fila.grupo}-${i}`} className="border-b border-slate-50 hover:bg-slate-50/60">
                      <td className="px-3 py-2 font-semibold text-slate-800">
                        {etiquetaPeriodoReporte({ periodo: fila.grupo }, agrupar)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <LogIn size={11} className="opacity-60" />
                          {numero(fila.entradas, 0)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-600">
                          <LogOut size={11} className="opacity-60" />
                          {numero(fila.salidas, 0)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">{numero(fila.unidades, 0)}</td>
                      <td className="px-3 py-2 text-right text-slate-500">
                        {fila.ultima_entrada ? formatearFechaHora(fila.ultima_entrada) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 text-slate-700 font-bold">
                    <td className="px-3 py-2.5">Totales de {filas.length} fila{filas.length === 1 ? '' : 's'}</td>
                    <td className="px-3 py-2.5 text-right text-emerald-700">{numero(totales.entradas, 0)}</td>
                    <td className="px-3 py-2.5 text-right">{numero(totales.salidas, 0)}</td>
                    <td className="px-3 py-2.5 text-right" colSpan={2}>
                      Unidades no sumables (una placa puede estar en varios grupos)
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <BotonVerMas expandido={expandido} onAlternar={alternar} total={total} />

            {filas.length >= LIMITE_EVENTOS_GEOCERCA ? (
              <p className="px-4 py-2 text-[10px] text-amber-600 border-t border-slate-50">
                Se alcanzó el tope de {LIMITE_EVENTOS_GEOCERCA} filas (límite de PostgREST). Agrupa por día o por mes.
              </p>
            ) : null}
          </>
        ) : null}
      </CuerpoEstado>

      <p className="px-4 py-2.5 text-[10px] text-slate-400 border-t border-slate-50 leading-relaxed">
        {fuente === 'real' ? (
          <span className="inline-flex items-center gap-1">
            <Database size={10} /> Cálculo en SQL sobre public.agrotrack_posiciones (agrotrack_eventos_geocerca_flota).
          </span>
        ) : (
          'Aún no hay datos reales para esta empresa.'
        )}
        <span className="block mt-0.5">
          Eventos de Zonar con pt_referencia (nombre de la geocerca) · salidas pueden no cuadrar con entradas · hora de Perú.
        </span>
      </p>
    </div>
  );
}

const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const VALORES_PIVOT = [
  { id: 'duracion_segundos', label: 'Duración' },
  { id: 'apagado_segundos', label: 'Apagado' },
  { id: 'ralenti_segundos', label: 'Ralentí' },
  { id: 'viaje_segundos', label: 'Viajando' },
];

/**
 * Arma la estructura de la tabla dinámica "Suma de Duración (h)" con la
 * jerarquía del Excel de referencia: Meses → Fecha de entrada → Area Cod →
 * Placa. Las columnas son las geocercas (o divisiones) y se agrega la
 * columna final "Total general".
 */
function construirTablaDinamica(permanencias, columnasMode, valor) {
  const columnaDe = (f) =>
    columnasMode === 'division'
      ? normalizarDivision(f?.division, f?.geocerca) || 'Sin división'
      : String(f?.geocerca || f?.nombre || '').trim() || 'Sin geocerca';
  const areaDe = (f) => codigoArea(f?.unidad, f?.placa) || '';
  const placaDe = (f) => String(f?.placa || '').trim() || 'Sin placa';
  const valorDe = (f) => Number(f?.[valor] || 0) / 3600;
  const fechaDe = (f) => String(f?.dia || '').trim().slice(0, 10);

  const columnasSet = new Set();
  const porDia = new Map(); // fecha -> área -> placa -> columna -> horas

  for (const f of permanencias || []) {
    const fecha = fechaDe(f);
    const col = columnaDe(f);
    const area = areaDe(f);
    const placa = placaDe(f);
    if (!fecha || !col) continue;
    columnasSet.add(col);
    if (!porDia.has(fecha)) porDia.set(fecha, new Map());
    const areas = porDia.get(fecha);
    if (!areas.has(area)) areas.set(area, new Map());
    const placas = areas.get(area);
    if (!placas.has(placa)) placas.set(placa, new Map());
    const celdas = placas.get(placa);
    celdas.set(col, (celdas.get(col) || 0) + valorDe(f));
  }

  const columnas = [...columnasSet].sort((a, b) => a.localeCompare(b, 'es'));
  const grupos = [];
  const totalesGenerales = new Map();
  let total = 0;

  for (const fecha of [...porDia.keys()].sort()) {
    const [anio, mes, dia] = fecha.split('-');
    const indiceMes = Number(mes) - 1;
    const etiquetaMes = `${MESES_CORTO[indiceMes] || mes} ${anio}`;
    const etiquetaDia = `${Number(dia)}-${MESES_CORTO[indiceMes] || mes}`;
    let grupo = grupos.find((g) => g.etiqueta === etiquetaMes);
    if (!grupo) {
      grupo = { etiqueta: etiquetaMes, dias: [], totalesCol: new Map(), totalMes: 0 };
      grupos.push(grupo);
    }

    const areas = [];
    const totalesCol = new Map();
    let totalDia = 0;
    const areasDia = porDia.get(fecha);
    for (const area of [...areasDia.keys()].sort((a, b) => a.localeCompare(b, 'es'))) {
      const placasDia = areasDia.get(area);
      const filas = [];
      const totalesArea = new Map();
      let totalArea = 0;
      for (const placa of [...placasDia.keys()].sort((a, b) => a.localeCompare(b, 'es'))) {
        const celdas = placasDia.get(placa);
        let totalFila = 0;
        for (const [col, v] of celdas) {
          totalesCol.set(col, (totalesCol.get(col) || 0) + v);
          totalesArea.set(col, (totalesArea.get(col) || 0) + v);
          totalFila += v;
        }
        totalDia += totalFila;
        totalArea += totalFila;
        filas.push({ placa, celdas, totalFila });
      }
      areas.push({ area: area || '—', filas, totalesCol: totalesArea, totalArea });
    }

    for (const [col, v] of totalesCol) {
      grupo.totalesCol.set(col, (grupo.totalesCol.get(col) || 0) + v);
      totalesGenerales.set(col, (totalesGenerales.get(col) || 0) + v);
    }
    grupo.totalMes += totalDia;
    total += totalDia;

    grupo.dias.push({ fecha, etiqueta: etiquetaDia, areas, totalesCol, totalDia });
  }

  return { columnas, grupos, totalesGenerales, total };
}

const LABEL_COLS = [
  { label: 'Meses', width: 76, campo: 'mes' },
  { label: 'Fecha de entrada', width: 108, campo: 'fecha' },
  { label: 'Area Cod', width: 106, campo: 'area' },
  { label: 'Placa', width: 98, campo: 'placa' },
];
const LABEL_OFFSETS = LABEL_COLS.reduce((acc, col, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + LABEL_COLS[i - 1].width);
  return acc;
}, []);

/** "2026-11" -> "Nov 2026" (encabezado de mes). */
function etiquetaMesClave(clave) {
  const [anio, mes] = String(clave || '').split('-');
  const indice = Number(mes) - 1;
  return `${MESES_CORTO[indice] || mes || ''} ${anio || ''}`.trim();
}

/** "2026-11-22" -> "22-Nov" (encabezado de día). */
function etiquetaFechaClave(clave) {
  const [, mes, dia] = String(clave || '').split('-');
  const indice = Number(mes) - 1;
  return `${Number(dia)}-${MESES_CORTO[indice] || mes || ''}`;
}

/**
 * Filtro desplegable tipo Excel para un encabezado de la tabla dinámica.
 * El panel va por portal para que el `overflow-x-auto` de la tabla no lo
 * recorte, y se cierra al hacer clic fuera o con Escape.
 */
function PopoverFiltro({ titulo, opciones, seleccion, onAplicar }) {
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState(seleccion || []);
  const [busqueda, setBusqueda] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const botonRef = useRef(null);
  const panelRef = useRef(null);
  // null = sin filtro; un arreglo (aunque esté vacío) = filtro aplicado.
  const activo = Array.isArray(seleccion);

  const abrir = () => {
    const rect = botonRef.current?.getBoundingClientRect();
    if (rect) {
      const ancho = 248;
      const alto = 320;
      const izquierda = Math.min(Math.max(8, rect.right - ancho), Math.max(8, window.innerWidth - ancho - 8));
      const abajo = rect.bottom + 4;
      const top = abajo + alto > window.innerHeight - 8 ? Math.max(8, rect.top - alto - 4) : abajo;
      setPos({ top, left: izquierda });
    }
    setBorrador(Array.isArray(seleccion) ? [...seleccion] : (opciones || []).map((o) => o.valor));
    setBusqueda('');
    setAbierto(true);
  };

  useEffect(() => {
    if (!abierto) return undefined;
    const alClicFuera = (e) => {
      if (panelRef.current?.contains(e.target)) return;
      if (botonRef.current?.contains(e.target)) return;
      setAbierto(false);
    };
    const alTecla = (e) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    const alScroll = (e) => {
      if (panelRef.current?.contains(e.target)) return;
      setAbierto(false);
    };
    const alRedimensionar = () => setAbierto(false);
    document.addEventListener('mousedown', alClicFuera);
    document.addEventListener('keydown', alTecla);
    window.addEventListener('scroll', alScroll, true);
    window.addEventListener('resize', alRedimensionar);
    return () => {
      document.removeEventListener('mousedown', alClicFuera);
      document.removeEventListener('keydown', alTecla);
      window.removeEventListener('scroll', alScroll, true);
      window.removeEventListener('resize', alRedimensionar);
    };
  }, [abierto]);

  const total = (opciones || []).length;
  const todos = total === 0 || borrador.length === total;
  const texto = busqueda.trim().toLowerCase();
  const visibles = (opciones || []).filter((o) => !texto || String(o.etiqueta).toLowerCase().includes(texto));

  const alternar = (valor) => {
    setBorrador((prev) => (prev.includes(valor) ? prev.filter((v) => v !== valor) : [...prev, valor]));
  };
  const alternarTodos = () => {
    setBorrador(todos ? [] : (opciones || []).map((o) => o.valor));
  };
  const aplicar = () => {
    const lista = [...new Set(borrador)];
    // Si están todos marcados equivale a no filtrar; si no hay ninguno, la
    // tabla queda vacía como en Excel.
    onAplicar(lista.length === total ? null : lista);
    setAbierto(false);
  };
  const limpiar = () => {
    onAplicar(null);
    setAbierto(false);
  };

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        title={`Filtrar ${titulo}`}
        aria-label={`Filtrar ${titulo}`}
        aria-pressed={activo}
        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors ${
          activo
            ? 'bg-white text-emerald-700 shadow-sm'
            : 'text-emerald-800 hover:bg-emerald-400/50 hover:text-emerald-950'
        }`}
      >
        <Filter size={10} strokeWidth={3} />
      </button>
      {abierto
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label={`Filtro de ${titulo}`}
              className="fixed z-[80] w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
              style={{ top: pos.top, left: pos.left }}
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                <span className="text-[11px] font-bold text-slate-700">Filtrar: {titulo}</span>
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Cerrar filtro"
                >
                  <X size={13} />
                </button>
              </div>
              <div className="p-2">
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar…"
                  className="w-full rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-700 outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={todos}
                  onChange={alternarTodos}
                  className="h-3 w-3 accent-emerald-600"
                />
                (Todos)
              </label>
              <div className="max-h-56 overflow-y-auto py-1">
                {visibles.length === 0 ? (
                  <p className="px-3 py-2 text-[11px] text-slate-400">Sin coincidencias.</p>
                ) : (
                  visibles.map((o) => (
                    <label
                      key={o.valor}
                      className="flex cursor-pointer items-center gap-2 px-3 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={borrador.includes(o.valor)}
                        onChange={() => alternar(o.valor)}
                        className="h-3 w-3 accent-emerald-600"
                      />
                      <span className="truncate">{o.etiqueta}</span>
                    </label>
                  ))
                )}
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-2 py-2">
                <button
                  type="button"
                  onClick={limpiar}
                  className="rounded-md px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100"
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  onClick={aplicar}
                  className="rounded-md bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                >
                  Aplicar
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** Tabla dinámica estilo Excel: Meses → Fecha → Area Cod → Placa, con Total general. */
// null = sin filtro; un arreglo = filtro aplicado (vacío = ninguno marcado).
const FILTROS_VACIOS = { mes: null, fecha: null, area: null, placa: null, columna: null };

function TablaDinamicaLotes({ permanencias, columnasMode, valor }) {
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);

  // La columna del filtro depende del modo (división o geocerca): al cambiarlo
  // se descarta la selección de columnas para no dejar el reporte vacío.
  useEffect(() => {
    setFiltros((prev) => (Array.isArray(prev.columna) ? { ...prev, columna: null } : prev));
  }, [columnasMode]);

  const columnaDe = (f) =>
    columnasMode === 'division'
      ? normalizarDivision(f?.division, f?.geocerca) || 'Sin división'
      : String(f?.geocerca || f?.nombre || '').trim() || 'Sin geocerca';

  // Opciones de los filtros: se calculan sobre TODAS las permanencias para que
  // nunca desaparezcan valores por haber aplicado otro filtro antes.
  const opciones = useMemo(() => {
    const mes = new Set();
    const fecha = new Set();
    const area = new Set();
    const placa = new Set();
    const columna = new Set();
    for (const f of permanencias || []) {
      const dia = String(f?.dia || '').trim().slice(0, 10);
      if (dia) {
        mes.add(dia.slice(0, 7));
        fecha.add(dia);
      }
      const a = codigoArea(f?.unidad, f?.placa);
      if (a) area.add(a);
      const p = String(f?.placa || '').trim();
      if (p) placa.add(p);
      const c = columnaDe(f);
      if (c) columna.add(c);
    }
    const ordenar = (conjunto) => [...conjunto].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
    return {
      mes: ordenar(mes),
      fecha: ordenar(fecha),
      area: ordenar(area),
      placa: ordenar(placa),
      columna: ordenar(columna),
    };
  }, [permanencias, columnasMode]);

  // Se filtra antes de construir la tabla para que los totales, los totales
  // por día/mes y el Total general cuadren con lo que se ve.
  const permanenciasFiltradas = useMemo(() => {
    const pasa = (lista, valor) => lista == null || lista.includes(valor);
    return (permanencias || []).filter((f) => {
      const dia = String(f?.dia || '').trim().slice(0, 10);
      return (
        pasa(filtros.mes, dia.slice(0, 7)) &&
        pasa(filtros.fecha, dia) &&
        pasa(filtros.area, codigoArea(f?.unidad, f?.placa) || '') &&
        pasa(filtros.placa, String(f?.placa || '').trim()) &&
        pasa(filtros.columna, columnaDe(f))
      );
    });
  }, [permanencias, filtros, columnasMode]);

  const { columnas, grupos, totalesGenerales, total } = useMemo(
    () => construirTablaDinamica(permanenciasFiltradas, columnasMode, valor),
    [permanenciasFiltradas, columnasMode, valor],
  );

  const opcionesPopover = useMemo(
    () => ({
      mes: opciones.mes.map((v) => ({ valor: v, etiqueta: etiquetaMesClave(v) })),
      fecha: opciones.fecha.map((v) => ({ valor: v, etiqueta: etiquetaFechaClave(v) })),
      area: opciones.area.map((v) => ({ valor: v, etiqueta: v })),
      placa: opciones.placa.map((v) => ({ valor: v, etiqueta: v })),
      columna: opciones.columna.map((v) => ({ valor: v, etiqueta: v })),
    }),
    [opciones],
  );

  const aplicarFiltro = (campo) => (lista) => setFiltros((prev) => ({ ...prev, [campo]: lista }));
  const limpiarTodo = () => setFiltros(FILTROS_VACIOS);
  const hayFiltros = Object.values(filtros).some((lista) => lista != null);

  const etiquetaValor = VALORES_PIVOT.find((v) => v.id === valor)?.label || 'Duración';
  const celda = (valorCelda) => (valorCelda ? <span className="tabular-nums">{numero(valorCelda, 2)}</span> : null);
  const sticky = (i, z = 10) => ({
    position: 'sticky',
    left: `${LABEL_OFFSETS[i]}px`,
    zIndex: z,
    width: `${LABEL_COLS[i].width}px`,
    minWidth: `${LABEL_COLS[i].width}px`,
    maxWidth: `${LABEL_COLS[i].width}px`,
  });
  const totalColumnas = LABEL_COLS.length + columnas.length + 1;
  const tituloColumnas = columnasMode === 'division' ? 'División' : 'Geocerca';

  if (!columnas.length) {
    return (
      <div className="space-y-3 p-8 text-center">
        <p className="text-xs text-slate-400">
          {hayFiltros
            ? 'Sin resultados con los filtros aplicados.'
            : 'Sin permanencias para mostrar en la tabla dinámica.'}
        </p>
        {hayFiltros ? (
          <button
            type="button"
            onClick={limpiarTodo}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            <X size={12} /> Limpiar filtros
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-slate-700 border-collapse">
        <thead>
          <tr className="bg-emerald-300 text-emerald-950">
            <th colSpan={LABEL_COLS.length} className="border-b border-emerald-400/50 px-2 py-2 text-left font-bold">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">Suma de {etiquetaValor} (h)</span>
                {hayFiltros ? (
                  <button
                    type="button"
                    onClick={limpiarTodo}
                    title="Quitar todos los filtros"
                    className="inline-flex shrink-0 items-center gap-1 rounded bg-emerald-900/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900 hover:bg-emerald-900/20"
                  >
                    <X size={10} /> Limpiar filtros
                  </button>
                ) : null}
              </div>
            </th>
            <th colSpan={columnas.length + 1} className="border-b border-l border-emerald-400/50 px-2 py-2 text-left font-bold">
              <div className="flex items-center gap-1.5">
                <span className="truncate">{tituloColumnas}</span>
                <PopoverFiltro
                  titulo={tituloColumnas}
                  opciones={opcionesPopover.columna}
                  seleccion={filtros.columna}
                  onAplicar={aplicarFiltro('columna')}
                />
              </div>
            </th>
          </tr>
          <tr className="bg-emerald-200 text-emerald-950">
            {LABEL_COLS.map((col, i) => (
              <th
                key={col.label}
                style={sticky(i, 30)}
                className="overflow-hidden border-r border-emerald-300 bg-emerald-200 px-1.5 py-2.5 text-left font-bold whitespace-nowrap"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate">{col.label}</span>
                  <PopoverFiltro
                    titulo={col.label}
                    opciones={opcionesPopover[col.campo]}
                    seleccion={filtros[col.campo]}
                    onAplicar={aplicarFiltro(col.campo)}
                  />
                </div>
              </th>
            ))}
            {columnas.map((col) => (
              <th
                key={col}
                className="min-w-[84px] max-w-[112px] border-r border-emerald-300/70 px-2 py-2 text-center align-bottom text-[11px] font-bold leading-tight whitespace-normal"
              >
                {col}
              </th>
            ))}
            <th className="min-w-[84px] px-2 py-2 text-center align-bottom text-[11px] font-bold leading-tight whitespace-normal">
              Total general
            </th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((grupo) => (
            <React.Fragment key={grupo.etiqueta}>
              <tr className="border-b border-slate-100 bg-white font-bold text-slate-900">
                <td style={sticky(0)} className="bg-white px-2 py-1.5">{grupo.etiqueta}</td>
                <td colSpan={totalColumnas - 1} className="px-2 py-1.5" />
              </tr>
              {grupo.dias.map((dia) => (
                <React.Fragment key={dia.fecha}>
                  <tr className="border-b border-slate-100 bg-white font-semibold text-slate-600">
                    <td style={sticky(0)} className="bg-white px-2 py-1.5" />
                    <td style={sticky(1)} className="bg-white px-2 py-1.5">{dia.etiqueta}</td>
                    <td colSpan={totalColumnas - 2} className="px-2 py-1.5" />
                  </tr>
                  {dia.areas.map((area) => (
                    <React.Fragment key={`${dia.fecha}-${area.area}`}>
                      <tr className="border-b border-slate-100 bg-slate-50/70 font-semibold text-slate-800">
                        <td style={sticky(0)} className="bg-slate-50 px-2 py-1.5" />
                        <td style={sticky(1)} className="bg-slate-50 px-2 py-1.5" />
                        <td style={sticky(2)} className="bg-slate-50 px-2 py-1.5 truncate">{area.area}</td>
                        <td style={sticky(3)} className="bg-slate-50 px-2 py-1.5" />
                        {columnas.map((col) => (
                          <td key={col} className="border-r border-slate-100 px-2 py-1.5 text-center tabular-nums">
                            {celda(area.totalesCol.get(col))}
                          </td>
                        ))}
                        <td className="px-2 py-1.5 text-right tabular-nums">{celda(area.totalArea)}</td>
                      </tr>
                      {area.filas.map((fila) => (
                        <tr key={`${dia.fecha}-${area.area}-${fila.placa}`} className="border-b border-slate-50 hover:bg-emerald-50/40">
                          <td style={sticky(0)} className="bg-white px-2 py-1.5" />
                          <td style={sticky(1)} className="bg-white px-2 py-1.5" />
                          <td style={sticky(2)} className="bg-white px-2 py-1.5" />
                          <td style={sticky(3)} className="bg-white px-2 py-1.5 whitespace-nowrap font-medium text-slate-700">{fila.placa}</td>
                          {columnas.map((col) => (
                            <td key={col} className="border-r border-slate-100 px-2 py-1.5 text-center">
                              {celda(fila.celdas.get(col))}
                            </td>
                          ))}
                          <td className="px-2 py-1.5 text-right font-semibold">{celda(fila.totalFila)}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                  <tr className="bg-emerald-50 text-emerald-900 font-semibold border-y border-emerald-200">
                    <td style={sticky(0)} className="bg-emerald-50 px-2 py-1.5" />
                    <td style={sticky(1)} className="bg-emerald-50 px-2 py-1.5" />
                    <td style={sticky(2)} className="bg-emerald-50 px-2 py-1.5" />
                    <td style={sticky(3)} className="bg-emerald-50 px-2 py-1.5 whitespace-nowrap">Total {dia.etiqueta}</td>
                    {columnas.map((col) => (
                      <td key={col} className="border-r border-emerald-100 px-2 py-1.5 text-center tabular-nums">
                        {dia.totalesCol.get(col) ? numero(dia.totalesCol.get(col), 2) : null}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-right tabular-nums">{celda(dia.totalDia)}</td>
                  </tr>
                </React.Fragment>
              ))}
              <tr className="bg-emerald-100 text-emerald-900 font-bold">
                <td colSpan={LABEL_COLS.length} className="px-2 py-2">Total {grupo.etiqueta}</td>
                {columnas.map((col) => (
                  <td key={col} className="border-r border-emerald-200/70 px-2 py-2 text-center tabular-nums">
                    {grupo.totalesCol.get(col) ? numero(grupo.totalesCol.get(col), 2) : null}
                  </td>
                ))}
                <td className="px-2 py-2 text-right tabular-nums">{celda(grupo.totalMes)}</td>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-emerald-100 text-emerald-900 font-bold">
            <td colSpan={LABEL_COLS.length} className="px-2 py-2.5">Total general</td>
            {columnas.map((col) => (
              <td key={col} className="border-r border-emerald-200/70 px-2 py-2.5 text-center tabular-nums">
                {totalesGenerales.get(col) ? numero(totalesGenerales.get(col), 2) : null}
              </td>
            ))}
            <td className="px-2 py-2.5 text-right tabular-nums">{celda(total)}</td>
          </tr>
        </tfoot>
      </table>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-50 px-4 py-2.5 text-[10px] text-slate-400">
        <span>
          {hayFiltros ? `${permanenciasFiltradas.length} de ${permanencias.length}` : permanencias.length} permanencias ·{' '}
          {columnas.length} columnas · columnas por{' '}
          {columnasMode === 'division'
            ? 'División (campos agrupados; distritos u oficinas con su nombre)'
            : 'geocerca'}.
        </span>
        <span className="font-semibold text-emerald-700">Total general: {numero(total, 2)} h · {etiquetaValor}</span>
      </div>
    </div>
  );
}

/** Tarjeta 2: tiempo dentro de cada lote (punto dentro del polígono, PostGIS). */
function CardLotes({ empresaId, periodo, fuente, vehicles = [] }) {
  const { rango, setRango, dia, setDia, mes, setMes, desdeHora, setDesdeHora, hastaHora, setHastaHora, consulta, pendienteDeFecha } = useRango(periodo);
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
  } = useFiltroUnidadGrupo({ vehicles, empresaId });
  const [descargaError, setDescargaError] = useState(null);
  const [descargando, setDescargando] = useState(false);
  const [estado, setEstado] = useState('inactivo');
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState(null);
  const [rangoTexto, setRangoTexto] = useState('');
  const [avisoLotes, setAvisoLotes] = useState('');
  const [intento, setIntento] = useState(0);
  // Por defecto gerencia ve el resumen por División. Al elegir una unidad se
  // cambia al detalle plano; al elegir grupo o "Todas las unidades" vuelve a
  // División. El botón sigue permitiendo cambiar la vista manualmente.
  const [vista, setVista] = useState('division');
  const [columnas, setColumnas] = useState('division');
  const [valor, setValor] = useState('duracion_segundos');
  const [permanencias, setPermanencias] = useState([]);
  const [estadoPivot, setEstadoPivot] = useState('inactivo');
  const [errorPivot, setErrorPivot] = useState(null);

  useEffect(() => {
    setVista((prev) => (prev === 'dinamica' ? 'dinamica' : mostrar === 'unidades' && opcionFiltro ? 'todos' : 'division'));
  }, [mostrar, opcionFiltro]);

  useEffect(() => {
    if (vista !== 'dinamica' || !empresaId || pendienteDeFecha) {
      setEstadoPivot((prev) => (prev === 'cargando' ? 'inactivo' : prev));
      return undefined;
    }
    let cancelado = false;
    setEstadoPivot('cargando');
    setErrorPivot(null);
    const desdeDia = partesLima(consulta.desde).fecha;
    const hastaDia = partesLima(consulta.hasta).fecha;
    leerVisitasDia(empresaId, {
      desdeDia,
      hastaDia,
      ...(placasFiltro?.length === 1 ? { placa: placasFiltro[0] } : {}),
    })
      .then((filas) => {
        if (cancelado) return;
        const enRango = filtrarVisitasPorRango(filas, consulta.desde, consulta.hasta);
        const filasFiltradas = Array.isArray(placasFiltro) && placasFiltro.length > 1
          ? filtrarFilasPorPlaca(enRango, placasFiltro)
          : enRango;
        setPermanencias(filasFiltradas);
        setEstadoPivot(filasFiltradas.length ? 'ok' : 'vacio');
      })
      .catch((e) => {
        if (cancelado) return;
        setPermanencias([]);
        setErrorPivot(e?.message || 'No se pudo cargar la tabla dinámica.');
        setEstadoPivot('error');
      });
    return () => {
      cancelado = true;
    };
  }, [vista, empresaId, consulta, placasFiltro, pendienteDeFecha, intento]);

  useEffect(() => {
    if (!empresaId || pendienteDeFecha) {
      // Nunca dejar "Calculando..." colgado (ver FleetEventsSummary).
      setEstado((prev) => (prev === 'cargando' ? 'inactivo' : prev));
      return undefined;
    }
    let cancelado = false;
    setEstado('cargando');
    setError(null);
    obtenerLotesFlota(empresaId, {
      desde: consulta.desde,
      hasta: consulta.hasta,
      placas: placasFiltro,
    })
      .then((resultado) => {
        if (cancelado) return;
        setFilas(resultado);
        setAvisoLotes(resultado?.aviso || '');
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
  }, [empresaId, consulta, placasFiltro, pendienteDeFecha, intento]);

  const unidadesSinTelemetria = useMemo(() => {
    if (placasFiltro == null) return unidadesSinPosicion;
    const placas = new Set(placasFiltro.map(normalizarPlaca));
    return unidadesSinPosicion.filter((unidad) => placas.has(unidad.placa));
  }, [placasFiltro, unidadesSinPosicion]);

  const totales = useMemo(() => {
    const sum = (campo) => filas.reduce((s, f) => s + Number(f[campo] || 0), 0);
    return {
      visitas: sum('visitas'),
      permanencia: sum('permanencia_segundos'),
      apagado: sum('apagado_segundos'),
      ralenti: sum('ralenti_segundos'),
      viaje: sum('viaje_segundos'),
      km: sum('km_recorridos'),
      puntos: sum('puntos'),
    };
  }, [filas]);

  // Los grupos salen de la columna `division` (ya incluida en la RPC).
  // Supabase ya aplicó la regla division = COALESCE(NULLIF(TRIM(...)), nombre)
  // y las equivalencias; aquí solo se agrupa, sin grupo "Sin división".
  const gruposDivision = useMemo(() => agruparPorDivision(filas), [filas]);
  const filasAgrupadas = useMemo(() => aplanarGrupos(gruposDivision), [gruposDivision]);

  // Tabla limitada a 15 filas; totales y el Excel usan la lista completa.
  // Las dos vistas comparten el MISMO render de fila: en "todos" envolvemos
  // cada fila cruda con { tipo: 'lote', fila } para que el map de abajo no
  // intente leer item.fila.geocerca_id de una fila plana (pantalla en blanco).
  const filasTabla = useMemo(
    () => (vista === 'division'
      ? filasAgrupadas
      : filas.map((fila) => ({ tipo: 'lote', fila }))),
    [vista, filasAgrupadas, filas],
  );
  const { filasVistas, expandido, alternar, total } = useLimiteFilas(filasTabla);

  const puedeExportar = estado === 'ok' && filas.length > 0;
  // Si la RPC en Supabase todavía no tiene las columnas del desglose (script
  // sin actualizar), se muestran «—» con un aviso en vez de un 0 engañoso.
  const conDesglose = filas.some((f) => f.apagado_segundos != null || f.ralenti_segundos != null || f.viaje_segundos != null);
  const mensajePendiente =
    rango === 'todo' && !periodo?.desde
      ? 'Esta empresa todavía no tiene periodo cargado en agrotrack_posiciones, así que no hay cifras que mostrar.'
      : 'Esperando el periodo cargado para precargar el selector…';

  // Una sola definición de fila de lote para las dos vistas (todos / división).
  const renderFilaLote = (fila, key) => (
    <tr key={key} className="border-b border-slate-50 hover:bg-slate-50/60">
      <td className="px-3 py-2">
        <span className="font-bold text-slate-800">{fila.lote}</span>
        {fila.anexo ? (
          <span className="block text-[10px] text-slate-400">Anexo {fila.anexo}</span>
        ) : null}
      </td>
      <td className="px-3 py-2 text-slate-500">{nombreDivision(fila) || '—'}</td>
      <td className="px-3 py-2 text-right">{numero(fila.unidades, 0)}</td>
      <td className="px-3 py-2 text-right font-semibold">{numero(fila.visitas, 0)}</td>
      <td className="px-3 py-2 text-right text-slate-500">
        {conDesglose ? formatearDuracion(fila.apagado_segundos) : '—'}
      </td>
      <td className="px-3 py-2 text-right text-amber-700">
        {conDesglose ? formatearDuracion(fila.ralenti_segundos) : '—'}
      </td>
      <td className="px-3 py-2 text-right text-emerald-700">
        {conDesglose ? formatearDuracion(fila.viaje_segundos) : '—'}
      </td>
      <td className="px-3 py-2 text-right font-bold text-slate-800">
        {formatearDuracion(fila.permanencia_segundos)}
      </td>
      <td className="px-3 py-2 text-right">{numero(fila.km_recorridos, 1)}</td>
      <td className="px-3 py-2 text-right text-slate-500">{numero(fila.puntos, 0)}</td>
      <td className="px-3 py-2 text-right">
        {fila.vel_max_kmh == null ? '—' : `${numero(fila.vel_max_kmh, 0)} km/h`}
      </td>
    </tr>
  );
  const descargarExcel = async () => {
    setDescargaError(null);
    setDescargando(true);
    try {
      // El Excel no se arma desde las filas agregadas de la pantalla: la RPC
      // devuelve cada permanencia individual, ya recortada al rango y en hora
      // de Perú, para que la tabla dinámica sume las horas correctamente.
      const permanencias = await obtenerPermanenciasLoteExcel(empresaId, {
        desde: consulta.desde,
        hasta: consulta.hasta,
        placas: placasFiltro,
      });
      if (!permanencias.length) {
        throw new Error('No hay permanencias en el rango elegido para exportar.');
      }
      const { exportarPermanenciasLotesExcel } = await import('../../../lib/exportExcel');
      exportarPermanenciasLotesExcel(permanencias, { rangoTexto });
    } catch (e) {
      setDescargaError(e?.message || 'No se pudo generar el archivo de Excel.');
    } finally {
      setDescargando(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm min-w-0">
      <div className="p-4 sm:p-5 border-b border-slate-50 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <LogOut size={17} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Tiempo en cada lote · Tabla dinámica</h2>
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700">
                Nuevo
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Horas dentro de cada geocerca por fecha, área y placa. Una máquina: todos sus campos; grupo: todas por División.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {fuente === 'real' && rangoTexto ? (
              <span className="hidden lg:inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Database size={12} /> Datos reales: {rangoTexto}
              </span>
            ) : null}
            <BotonActualizarAhora onClick={() => setIntento((n) => n + 1)} disabled={estado === 'cargando' || estadoPivot === 'cargando' || pendienteDeFecha} cargando={estado === 'cargando' || estadoPivot === 'cargando'} />
            <button
              type="button"
              onClick={descargarExcel}
              disabled={!puedeExportar || descargando}
              className="inline-flex items-center gap-1.5 rounded-lg border border-forest bg-forest px-2.5 py-1.5 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {descargando ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
              {descargando ? 'Generando…' : 'Descargar Excel'}
            </button>
          </div>
        </div>
        {descargaError ? <p className="text-[10px] text-red-600">{descargaError}</p> : null}

        <div className="flex flex-wrap items-end gap-3">
          <ControlesRango rango={rango} setRango={setRango} dia={dia} setDia={setDia} mes={mes} setMes={setMes} desdeHora={desdeHora} setDesdeHora={setDesdeHora} hastaHora={hastaHora} setHastaHora={setHastaHora} />
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

      {avisoLotes && estado === 'ok' ? (
        <p className="mx-4 sm:mx-5 mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800" role="status">
          {avisoLotes}
        </p>
      ) : null}
      <CuerpoEstado
        pendienteDeFecha={pendienteDeFecha}
        mensajePendiente={mensajePendiente}
        estado={estado}
        error={error}
        onReintentar={() => setIntento((n) => n + 1)}
        mensajeVacio={`Ningún lote tuvo posiciones dentro de su polígono en ${rangoTexto || 'el rango elegido'}${opcionFiltro ? ` para ${mostrar === 'grupos' ? 'el grupo' : 'la unidad'} ${opcionFiltro}` : ''}. Prueba con otro día/mes, con “Todo el periodo” o quitando los filtros.`}
        childrenCuandoVacio={unidadesSinTelemetria.length > 0}
      >
        <AvisoUnidadesSinTelemetria unidades={unidadesSinTelemetria} />
        <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 py-2.5 text-[11px] border-b border-slate-50">
          <span className="font-semibold text-slate-500">Vista del reporte:</span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5" role="group" aria-label="Vista del reporte de geocercas">
            {[
              { id: 'dinamica', label: 'Tabla dinámica', badge: true },
              { id: 'todos', label: 'Lotes: todos los campos' },
              { id: 'division', label: 'Lotes: por división' },
            ].map((opcion) => (
              <button
                key={opcion.id}
                type="button"
                onClick={() => setVista(opcion.id)}
                aria-pressed={vista === opcion.id}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-semibold transition-colors ${
                  vista === opcion.id
                    ? 'bg-forest text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white hover:text-forest'
                }`}
              >
                {opcion.badge ? (
                  <span className={`rounded px-1 py-0.5 text-[9px] font-black uppercase ${
                    vista === opcion.id ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'
                  }`}>Nuevo</span>
                ) : null}
                {opcion.label}
              </button>
            ))}
          </div>
          {vista === 'dinamica' ? (
            <>
              <span className="ml-2 font-semibold text-slate-500">Columnas:</span>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5" role="group" aria-label="Columnas de la tabla dinámica">
                {[
                  { id: 'division', label: 'Por división' },
                  { id: 'geocerca', label: 'Cada geocerca' },
                ].map((opcion) => (
                  <button
                    key={opcion.id}
                    type="button"
                    onClick={() => setColumnas(opcion.id)}
                    aria-pressed={columnas === opcion.id}
                    className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                      columnas === opcion.id
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-white hover:text-emerald-700'
                    }`}
                  >
                    {opcion.label}
                  </button>
                ))}
              </div>
              <span className="ml-2 font-semibold text-slate-500">Valores:</span>
              <select
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                aria-label="Valor de la tabla dinámica"
                className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800 outline-none focus:ring-2 focus:ring-emerald-200"
              >
                {VALORES_PIVOT.map((opcion) => (
                  <option key={opcion.id} value={opcion.id}>{opcion.label} (h)</option>
                ))}
              </select>
              <span className="ml-auto font-semibold text-emerald-700">
                Una columna por {columnas === 'division' ? 'división' : 'geocerca'}.
              </span>
            </>
          ) : (
            <>
              {vista === 'division' ? (
                <span className="text-slate-400">Geocercas agrupadas por División.</span>
              ) : null}
              <span className="ml-auto text-[11px] font-semibold text-amber-700">
                Las visitas no son sumables entre grupos, las horas sí.
              </span>
            </>
          )}
        </div>
        {vista === 'dinamica' ? (
          estadoPivot === 'ok' ? (
            <TablaDinamicaLotes permanencias={permanencias} columnasMode={columnas} valor={valor} />
          ) : (
            <CuerpoEstado
              pendienteDeFecha={pendienteDeFecha}
              mensajePendiente={mensajePendiente}
              estado={estadoPivot}
              error={errorPivot}
              onReintentar={() => setIntento((n) => n + 1)}
              mensajeVacio={`Sin permanencias en ${rangoTexto || 'el rango elegido'}${opcionFiltro ? ` para ${mostrar === 'grupos' ? 'el grupo' : 'la unidad'} ${opcionFiltro}` : ''}. Prueba con otro día o quitando filtros.`}
            />
          )
        ) : estado === 'ok' ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-slate-700">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2.5 font-bold text-left">Lote</th>
                    <th className="px-3 py-2.5 font-bold text-left">División</th>
                    <th className="px-3 py-2.5 font-bold text-right">Unidades</th>
                    <th className="px-3 py-2.5 font-bold text-right">Visitas</th>
                    <th className="px-3 py-2.5 font-bold text-right">Apagado</th>
                    <th className="px-3 py-2.5 font-bold text-right">Ralentí</th>
                    <th className="px-3 py-2.5 font-bold text-right">Viajando</th>
                    <th className="px-3 py-2.5 font-bold text-right">Total en geocerca</th>
                    <th className="px-3 py-2.5 font-bold text-right">Recorrido (km)</th>
                    <th className="px-3 py-2.5 font-bold text-right">Puntos</th>
                    <th className="px-3 py-2.5 font-bold text-right">Vel. máx.</th>
                  </tr>
                </thead>
                <tbody>
                  {filasVistas.map((item, i) =>
                    item.tipo === 'division' ? (
                      <tr key={`division-${item.division}`} className="border-b border-emerald-100 bg-emerald-50/70">
                        <td className="px-3 py-2 font-bold text-emerald-800" colSpan={3}>
                          {item.division}
                          <span className="ml-2 text-[10px] font-semibold text-emerald-600">
                            {item.cantidad} lote{item.cantidad === 1 ? '' : 's'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-800">{numero(item.totales.visitas, 0)}</td>
                        <td className="px-3 py-2 text-right text-slate-500">
                          {conDesglose ? formatearDuracion(item.totales.apagado_segundos) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-amber-700">
                          {conDesglose ? formatearDuracion(item.totales.ralenti_segundos) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-emerald-700">
                          {conDesglose ? formatearDuracion(item.totales.viaje_segundos) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-800">
                          {formatearDuracion(item.totales.permanencia_segundos)}
                        </td>
                        <td className="px-3 py-2 text-right">{numero(item.totales.km_recorridos, 1)}</td>
                        <td className="px-3 py-2 text-right text-slate-500">{numero(item.totales.puntos, 0)}</td>
                        <td className="px-3 py-2 text-right">—</td>
                      </tr>
                    ) : (
                      renderFilaLote(item.fila, item.fila?.geocerca_id ?? `lote-${i}`)
                    )
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 text-slate-700 font-bold">
                    <td className="px-3 py-2.5" colSpan={3}>
                      Totales de {filas.length} lote{filas.length === 1 ? '' : 's'} con actividad
                    </td>
                    <td className="px-3 py-2.5 text-right">{numero(totales.visitas, 0)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-500">
                      {conDesglose ? formatearDuracion(totales.apagado) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-amber-700">
                      {conDesglose ? formatearDuracion(totales.ralenti) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-emerald-700">
                      {conDesglose ? formatearDuracion(totales.viaje) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right">{formatearDuracion(totales.permanencia)}</td>
                    <td className="px-3 py-2.5 text-right">{numero(totales.km, 1)}</td>
                    <td className="px-3 py-2.5 text-right">{numero(totales.puntos, 0)}</td>
                    <td className="px-3 py-2.5 text-right">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <BotonVerMas expandido={expandido} onAlternar={alternar} total={total} />

            {filas.length >= LIMITE_LOTES ? (
              <p className="px-4 py-2 text-[10px] text-amber-600 border-t border-slate-50">
                Se alcanzó el tope de {LIMITE_LOTES} lotes (límite de PostgREST). Reduce el rango.
              </p>
            ) : null}
            {!conDesglose ? (
              <p className="px-4 py-2 text-[10px] text-amber-600 border-t border-slate-50">
                El desglose apagado / ralentí / viajando no está disponible todavía: ejecuta la versión
                actualizada de scripts/agrotrack-geocercas-reportes.sql en el SQL Editor de Supabase.
              </p>
            ) : null}
          </>
        ) : null}
      </CuerpoEstado>

      <p className="px-4 py-2.5 text-[10px] text-slate-400 border-t border-slate-50 leading-relaxed">
        {fuente === 'real' ? (
          <span className="inline-flex items-center gap-1">
            <Database size={10} /> Visitas guardadas por día (agrotrack_visitas_día) + Nombre/División (agrotrack_geocercas_reportes) · hora de Perú.
          </span>
        ) : (
          'Aún no hay datos reales para esta empresa.'
        )}
        <span className="block mt-0.5">
          Una fila por máquina, una columna por geocerca/división · valores: duración total, apagado, ralentí o viajando en horas decimales · hora de Perú.
        </span>
      </p>
    </div>
  );
}

/** ¿La visita sigue abierta (la unidad aún está dentro de la geocerca)? */
function visitaAbierta(f) {
  if (f.abierta === true || f.abierta === 'true') return true;
  // Compatibilidad: si la RPC vieja no trae la columna `abierta`, se deduce
  // de que no tiene salida.
  if (f.abierta == null) return !f.salida;
  return false;
}

/**
 * Tarjeta 3 (FASE 4): "Visitas (detalle)" — una fila por visita dentro de
 * cada geocerca, al estilo del reporte de visitas de Zonar: entrada, salida
 * (o "En curso"), duración y el desglose apagado / ralentí / viajando, con
 * totales al pie. Incluye el respaldo del rango en la base y la "tabla del
 * día" (resumen por geocerca + detalle) para Excel.
 */
function CardVisitas({ empresaId, periodo, fuente, vehicles = [] }) {
  const { rango, setRango, dia, setDia, mes, setMes, desdeHora, setDesdeHora, hastaHora, setHastaHora, consulta, pendienteDeFecha } = useRango(periodo);
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
  } = useFiltroUnidadGrupo({ vehicles, empresaId });
  const [geocerca, setGeocerca] = useState('');
  const [estado, setEstado] = useState('inactivo');
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState(null);
  const [rangoTexto, setRangoTexto] = useState('');
  const [intento, setIntento] = useState(0);
  const [descargaError, setDescargaError] = useState(null);
  // Geocercas vistas en cualquier carga: el selector NO pierde las opciones
  // al filtrar (no hay RPC de listado; se arma con los datos reales).
  const [geocercasVistas, setGeocercasVistas] = useState([]);
  // Avance del cálculo de las visitas que falten guardar (placa por placa).
  const [progreso, setProgreso] = useState(null);
  const [avisos, setAvisos] = useState([]);
  // Respaldo de las visitas del rango (agrotrack_guardar_respaldo_visitas).
  const [guardando, setGuardando] = useState(false);
  const [respaldo, setRespaldo] = useState(null); // { ok, n } | { ok: false, mensaje }
  // Análisis con IA de las visitas ya calculadas en SQL (solo lectura).
  const [explicando, setExplicando] = useState(false);
  const [explicacion, setExplicacion] = useState(null);
  const [errorExplicacion, setErrorExplicacion] = useState(null);

  useEffect(() => {
    if (!empresaId || pendienteDeFecha) {
      // Nunca dejar "Calculando..." colgado (ver FleetEventsSummary).
      setEstado((prev) => (prev === 'cargando' || prev === 'calculando' ? 'inactivo' : prev));
      return undefined;
    }
    // 18/11/2026: las visitas se leen GUARDADAS por día
    // (public.agrotrack_visitas_dia, scripts/agrotrack-visitas-diarias.sql).
    // Recalcular el rango entero con PostGIS (agrotrack_visitas_geocerca_calc)
    // tardaba >8 s incluso con 1 hora y hacía fallar los tres reportes de
    // geocercas por el statement_timeout de Supabase.
    const desdeDia = partesLima(consulta.desde).fecha;
    const hastaDia = partesLima(consulta.hasta).fecha;
    if (!desdeDia || !hastaDia) {
      setEstado('inactivo');
      return undefined;
    }
    let cancelado = false;
    setError(null);
    setRespaldo(null);
    setAvisos([]);
    setProgreso(null);
    setEstado('calculando');
    (async () => {
      try {
        // Lo que falte se calcula de a UNA placa (cada llamada < 1 s) y queda
        // guardado; el avance se muestra en pantalla.
        const { errores } = await asegurarVisitasCalculadas(
          empresaId,
          desdeDia,
          hastaDia,
          (hechas, total, actual) => {
            if (!cancelado) setProgreso({ hechas, total, actual });
          },
        );
        if (cancelado) return;
        if (errores.length) setAvisos(errores.slice(0, 5));
        setEstado('cargando');
        const guardadas = await leerVisitasDia(empresaId, { desdeDia, hastaDia, geocerca });
        if (cancelado) return;
        // La tabla guarda visitas completas por día: si el rango "Desde /
        // hasta" trae hora, se descartan las que quedan fuera.
        const resultado = filtrarVisitasPorRango(guardadas, consulta.desde, consulta.hasta);
        setFilas(resultado);
        setEstado(resultado.length ? 'ok' : 'vacio');
        setRangoTexto(consulta.texto);
        // Acumula las geocercas vistas para que el selector no se vacíe al
        // filtrar (la lectura con p_geocerca solo devuelve esa geocerca).
        setGeocercasVistas((prev) => {
          const conjunto = new Set(prev);
          resultado.forEach((f) => { if (f?.geocerca) conjunto.add(f.geocerca); });
          return [...conjunto].sort((a, b) => String(a).localeCompare(String(b), 'es'));
        });
      } catch (e) {
        if (cancelado) return;
        setFilas([]);
        setError(e?.message || 'No se pudo cargar el reporte.');
        setEstado('error');
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [empresaId, consulta, geocerca, pendienteDeFecha, intento]);

  const totales = useMemo(() => {
    const filtradas = filtrarFilasPorPlaca(filas, placasFiltro, (fila) => fila?.placa);
    const sum = (campo) => filtradas.reduce((s, f) => s + Number(f[campo] || 0), 0);
    return {
      duracion: sum('duracion_segundos'),
      apagado: sum('apagado_segundos'),
      ralenti: sum('ralenti_segundos'),
      viaje: sum('viaje_segundos'),
    };
  }, [filas, placasFiltro]);

  const abiertas = useMemo(
    () => filtrarFilasPorPlaca(filas, placasFiltro, (fila) => fila?.placa).filter(visitaAbierta).length,
    [filas, placasFiltro],
  );

  // Tabla limitada a 15 filas; Excel, IA y respaldo usan la lista completa.
  const filasFiltradas = useMemo(
    () => filtrarFilasPorPlaca(filas, placasFiltro, (fila) => fila?.placa),
    [filas, placasFiltro],
  );

  const unidadesSinTelemetria = useMemo(() => {
    if (placasFiltro == null) return unidadesSinPosicion;
    const placas = new Set(placasFiltro.map(normalizarPlaca));
    return unidadesSinPosicion.filter((unidad) => placas.has(unidad.placa));
  }, [placasFiltro, unidadesSinPosicion]);

  // Tabla limitada a 15 filas; Excel, IA y respaldo usan la lista completa.
  const { filasVistas, expandido, alternar, total } = useLimiteFilas(filasFiltradas);

  // Si la RPC todavía no trae el desglose, se muestran «—» con un aviso en
  // vez de un 0 engañoso (mismo criterio que la tarjeta de lotes).
  const conDesglose = filas.some(
    (f) => f.apagado_segundos != null || f.ralenti_segundos != null || f.viaje_segundos != null
  );

  // Último día calendario completo (hora de Perú) presente en las visitas
  // cargadas: es el que exporta "Tabla del día" (más robusto que depender de
  // que el rango elegido coincida exactamente con "ayer").
  const diaExportado = useMemo(() => {
    const hoy = ultimoDiaLima(new Date().toISOString());
    const dias = new Set();
    filas.forEach((f) => {
      const d = ultimoDiaLima(f.entrada);
      if (d && hoy && d < hoy) dias.add(d);
    });
    if (!dias.size) return null;
    return [...dias].sort().pop();
  }, [filas]);

  const ayerLima = useMemo(() => {
    const hoy = ultimoDiaLima(new Date().toISOString());
    if (!hoy) return '';
    const d = new Date(`${hoy}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const diaEsAyer = Boolean(diaExportado && diaExportado === ayerLima);

  const puedeExportar = estado === 'ok' && filas.length > 0;
  const mensajePendiente =
    rango === 'todo' && !periodo?.desde
      ? 'Esta empresa todavía no tiene periodo cargado en agrotrack_posiciones, así que no hay visitas que mostrar.'
      : 'Esperando el periodo cargado para precargar el selector…';

  // El XLSX se importa bajo demanda: la librería pesa ~430 kB y solo se
  // necesita cuando el usuario pide el archivo.
  const descargarExcel = async () => {
    setDescargaError(null);
    try {
      const { exportarVisitasGeocercaExcel } = await import('../../../lib/exportExcelReportes');
      exportarVisitasGeocercaExcel(filas, { rangoTexto, geocerca, placa: '' });
    } catch (e) {
      setDescargaError(e?.message || 'No se pudo generar el archivo de Excel.');
    }
  };

  const descargarTablaDia = async () => {
    setDescargaError(null);
    if (!diaExportado) return;
    try {
      const { exportarTablaDiaExcel } = await import('../../../lib/exportExcelReportes');
      const visitasDelDia = filas.filter((f) => ultimoDiaLima(f.entrada) === diaExportado);
      exportarTablaDiaExcel(visitasDelDia, { dia: diaExportado, rangoTexto, geocerca, placa: '' });
    } catch (e) {
      setDescargaError(e?.message || 'No se pudo generar el archivo de Excel.');
    }
  };

  // Guarda en la base las visitas visibles del rango cargado (las que la RPC
  // devolvió con estos filtros). Si la RPC todavía no existe, el error amable
  // de "ejecuta scripts/agrotrack-geocercas-reportes.sql" se muestra aquí.
  const guardarRespaldo = async () => {
    if (guardando || !filas.length) return;
    setGuardando(true);
    setRespaldo(null);
    setDescargaError(null);
    try {
      const n = await guardarRespaldoVisitas(empresaId, {
        desde: consulta.desde,
        hasta: consulta.hasta,
        filas,
      });
      setRespaldo({ ok: true, n: Number(n) || 0 });
    } catch (e) {
      setRespaldo({ ok: false, mensaje: e?.message || 'No se pudo guardar el respaldo.' });
    } finally {
      setGuardando(false);
    }
  };

  // Análisis con IA de las visitas ya calculadas en SQL: manda solo las filas
  // visibles comprimidas; la IA interpreta (permanencias, anomalías), no
  // recalcula ni vuelve a tocar la base.
  const explicarVisitasIa = async () => {
    if (explicando || !filas.length) return;
    setExplicando(true);
    setErrorExplicacion(null);
    try {
      const enCurso = filas.filter((f) => f.abierta || !f.salida).length;
      const contexto = armarContextoReporte({
        reporte: 'Visitas a geocercas (detalle por visita: entrada, salida, duración y desglose apagado/ralentí/viajando)',
        rango: `${rangoTexto || 'todo el periodo cargado'}${geocerca ? ` · geocerca: ${geocerca}` : ''}${opcionFiltro ? ` · ${mostrar === 'grupos' ? 'grupo' : 'máquina'}: ${opcionFiltro}` : ''}${
          enCurso ? ` · ${enCurso} visita(s) en curso` : ''
        }`,
        columnas: ['Placa', 'Geocerca', 'Entrada', 'Salida', 'Duración', 'Apagado', 'Ralentí', 'Viajando'],
        filas: filas.map((f) => ({
          Placa: f.placa,
          Geocerca: f.geocerca,
          Entrada: f.entrada ? formatearFechaHora(f.entrada) : '—',
          Salida: f.salida ? formatearFechaHora(f.salida) : 'en curso',
          Duración: f.duracion_segundos != null ? formatearDuracion(f.duracion_segundos) : '—',
          Apagado: f.apagado_segundos != null ? formatearDuracion(f.apagado_segundos) : '—',
          Ralentí: f.ralenti_segundos != null ? formatearDuracion(f.ralenti_segundos) : '—',
          Viajando: f.viaje_segundos != null ? formatearDuracion(f.viaje_segundos) : '—',
        })),
        totalFilas: filas.length,
      });
      const data = await llamarIaGestion({ modo: 'reporte', contexto });
      if (!data.texto) throw new Error('La IA no devolvió texto para este reporte.');
      setExplicacion({ texto: data.texto, provider: data.provider });
    } catch (e) {
      setErrorExplicacion(e?.message || 'No se pudo explicar las visitas.');
    } finally {
      setExplicando(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm min-w-0">
      <div className="p-4 sm:p-5 border-b border-slate-50 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <MapPinned size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">Visitas (detalle)</h2>
            <p className="text-xs text-slate-500">
              Una fila por visita dentro de cada geocerca: entrada, salida, duración y el desglose apagado / ralentí / viajando.
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {fuente === 'real' && rangoTexto ? (
              <span className="hidden lg:inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Database size={12} /> Datos reales: {rangoTexto}
              </span>
            ) : null}
            <BotonActualizarAhora onClick={() => setIntento((n) => n + 1)} disabled={estado === 'cargando' || estado === 'calculando' || pendienteDeFecha} cargando={estado === 'cargando' || estado === 'calculando'} />
            <button
              type="button"
              onClick={guardarRespaldo}
              disabled={!puedeExportar || guardando}
              title="Guarda estas visitas del rango en una tabla de respaldo (auditoría) usando agrotrack_guardar_respaldo_visitas"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-forest hover:text-forest disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {guardando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {guardando ? 'Guardando…' : 'Guardar respaldo del rango'}
            </button>
            <button
              type="button"
              onClick={descargarTablaDia}
              disabled={!diaExportado}
              title={
                diaExportado
                  ? `Exporta a Excel las visitas del ${diaExportado} (resumen por geocerca + detalle)`
                  : 'No hay un día calendario completo con visitas en el rango cargado: amplíalo para poder exportar la tabla de un día'
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-forest hover:text-forest disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <CalendarDays size={13} /> {diaEsAyer ? 'Tabla del día anterior' : 'Tabla del día'}
            </button>
            <button
              type="button"
              onClick={explicarVisitasIa}
              disabled={!puedeExportar || explicando}
              title="Interpretar estas visitas con IA (solo lectura)"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {explicando ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {explicando ? 'Explicando…' : 'Explicar con IA'}
            </button>
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
        {respaldo ? (
          <p className={`text-[11px] font-semibold ${respaldo.ok ? 'text-emerald-700' : 'text-red-600'}`}>
            {respaldo.ok
              ? `Respaldo guardado: ${respaldo.n} visita${respaldo.n === 1 ? '' : 's'}`
              : respaldo.mensaje}
          </p>
        ) : null}
        {descargaError ? <p className="text-[10px] text-red-600">{descargaError}</p> : null}
        {errorExplicacion ? <p className="text-[10px] text-red-600">{errorExplicacion}</p> : null}
        {explicacion ? (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 mb-1 flex items-center gap-1">
              <Sparkles size={11} /> Análisis de la IA
            </p>
            <div className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-line">{explicacion.texto}</div>
            <p className="mt-2 text-[10px] text-slate-400">
              Interpretación de las {filas.length} visitas visibles ya calculadas en SQL; no sustituye la revisión del responsable de flota.
            </p>
          </div>
        ) : null}
        {estado === 'ok' && !diaExportado ? (
          <p className="text-[10px] text-slate-400 leading-relaxed">
            No hay un día calendario completo con visitas en el rango cargado: amplíalo (por ejemplo a “Todo el periodo”)
            para poder exportar la “Tabla del día anterior”.
          </p>
        ) : null}

        <div className="flex flex-wrap items-end gap-3">
          <ControlesRango rango={rango} setRango={setRango} dia={dia} setDia={setDia} mes={mes} setMes={setMes} desdeHora={desdeHora} setDesdeHora={setDesdeHora} hastaHora={hastaHora} setHastaHora={setHastaHora} />
          <ControlesFiltroUnidadGrupo
            mostrar={mostrar}
            setMostrar={setMostrar}
            opcionFiltro={opcionFiltro}
            setOpcionFiltro={setOpcionFiltro}
            unidades={unidades}
            opcionesGrupos={opcionesGrupos}
            gruposInfo={gruposInfo}
          />
          {geocercasVistas.length ? (
            <label className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Geocerca</span>
              <select
                value={geocerca}
                onChange={(e) => setGeocerca(e.target.value)}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Todas</option>
                {geocercasVistas.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </label>
          ) : null}
          {geocerca ? (
            <button
              type="button"
              onClick={() => setGeocerca('')}
              className="px-2 py-1.5 rounded-lg text-[10px] font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              title="Quitar el filtro de geocerca"
            >
              Quitar
            </button>
          ) : null}
        </div>
      </div>

      {estado === 'calculando' ? (
        <div className="p-8 flex flex-col items-center gap-2 text-slate-500">
          <Loader2 size={18} className="animate-spin" />
          <p className="text-xs text-center">
            {progreso?.total
              ? `Calculando y guardando las visitas que faltan: ${progreso.hechas} de ${progreso.total}${progreso.actual ? ` (${progreso.actual.placa} · ${progreso.actual.dia})` : ''}…`
              : 'Revisando qué días ya están calculados…'}
          </p>
          {progreso?.total ? (
            <div className="w-64 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: `${Math.round((progreso.hechas / progreso.total) * 100)}%` }} />
            </div>
          ) : null}
        </div>
      ) : null}

      <CuerpoEstado
        pendienteDeFecha={pendienteDeFecha}
        mensajePendiente={mensajePendiente}
        estado={estado}
        error={error}
        onReintentar={() => setIntento((n) => n + 1)}
        mensajeVacio={`No hay visitas en ${rangoTexto || 'el rango elegido'}${geocerca ? ` para la geocerca ${geocerca}` : ''}${opcionFiltro ? ` para ${mostrar === 'grupos' ? 'el grupo' : 'la unidad'} ${opcionFiltro}` : ''}. Prueba con otro día/mes, con “Todo el periodo” o quitando los filtros.`}
        childrenCuandoVacio={unidadesSinTelemetria.length > 0}
      >
        {avisos.length ? (
          <p className="px-4 py-2 text-[11px] text-amber-700">
            Algunas unidades no se pudieron calcular (se reintentará solo): {avisos.join(' · ')}
          </p>
        ) : null}
        <AvisoUnidadesSinTelemetria unidades={unidadesSinTelemetria} />
        {estado === 'ok' || filasVistas.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-slate-700">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2.5 font-bold text-left">Placa</th>
                    <th className="px-3 py-2.5 font-bold text-left">Geocerca</th>
                    <th className="px-3 py-2.5 font-bold text-left">Entrada</th>
                    <th className="px-3 py-2.5 font-bold text-left">Salida</th>
                    <th className="px-3 py-2.5 font-bold text-right">Duración</th>
                    <th className="px-3 py-2.5 font-bold text-right">Apagado</th>
                    <th className="px-3 py-2.5 font-bold text-right">Ralentí</th>
                    <th className="px-3 py-2.5 font-bold text-right">Viajando</th>
                  </tr>
                </thead>
                <tbody>
                  {filasVistas.map((f, i) => (
                    <tr key={`${f.placa}-${f.geocerca}-${f.entrada}-${i}`} className="border-b border-slate-50 hover:bg-slate-50/60">
                      <td className="px-3 py-2 whitespace-nowrap font-bold text-slate-800">{f.placa || '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{f.geocerca || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                        {f.entrada ? formatearFechaHora(f.entrada) : '—'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {visitaAbierta(f) ? (
                          <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
                            En curso
                          </span>
                        ) : f.salida ? (
                          <span className="text-slate-600">{formatearFechaHora(f.salida)}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                        {f.duracion_segundos == null ? '—' : formatearDuracion(f.duracion_segundos)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-500 whitespace-nowrap">
                        {conDesglose && f.apagado_segundos != null ? formatearDuracion(f.apagado_segundos) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-amber-700 whitespace-nowrap">
                        {conDesglose && f.ralenti_segundos != null ? formatearDuracion(f.ralenti_segundos) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-700 whitespace-nowrap">
                        {conDesglose && f.viaje_segundos != null ? formatearDuracion(f.viaje_segundos) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 text-slate-700 font-bold">
                    <td className="px-3 py-2.5" colSpan={4}>
                      Totales de {filasFiltradas.length} visita{filasFiltradas.length === 1 ? '' : 's'}
                      {geocerca ? ` · geocerca ${geocerca}` : ''}{opcionFiltro ? ` · ${opcionFiltro}` : ''}
                      {abiertas ? ` · ${abiertas} en curso` : ''}
                    </td>
                    <td className="px-3 py-2.5 text-right">{formatearDuracion(totales.duracion)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-500">
                      {conDesglose ? formatearDuracion(totales.apagado) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-amber-700">
                      {conDesglose ? formatearDuracion(totales.ralenti) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-emerald-700">
                      {conDesglose ? formatearDuracion(totales.viaje) : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <BotonVerMas expandido={expandido} onAlternar={alternar} total={total} />

            {!conDesglose ? (
              <p className="px-4 py-2 text-[10px] text-amber-600 border-t border-slate-50">
                El desglose apagado / ralentí / viajando no está disponible todavía: ejecuta la versión
                actualizada de scripts/agrotrack-geocercas-reportes.sql en el SQL Editor de Supabase.
              </p>
            ) : null}
          </>
        ) : null}
      </CuerpoEstado>

      <p className="px-4 py-2.5 text-[10px] text-slate-400 border-t border-slate-50 leading-relaxed">
        {fuente === 'real' ? (
          <span className="inline-flex items-center gap-1">
            <Database size={10} /> Visitas guardadas por día en public.agrotrack_visitas_dia (tabla precalculada): la pantalla no recalcula con PostGIS, así carga en segundos.
          </span>
        ) : (
          'Aún no hay datos reales para esta empresa.'
        )}
        <span className="block mt-0.5">
          Una fila por visita · apagado + ralentí + viajando = duración · las visitas aún abiertas se marcan “En curso” ·
          con un rango “Desde / hasta” con hora se muestran las visitas que tocan ese tramo (la duración es la de la visita completa) ·
          “Guardar respaldo del rango” usa agrotrack_guardar_respaldo_visitas · hora de Perú.
        </span>
      </p>
    </div>
  );
}

export default function FleetGeofenceReports({ empresaId, periodo = null, fuente = 'real', vehicles = [] }) {
  return (
    <div className="space-y-4">
      <CardEventos empresaId={empresaId} periodo={periodo} fuente={fuente} vehicles={vehicles} />
      <CardLotes empresaId={empresaId} periodo={periodo} fuente={fuente} vehicles={vehicles} />
      <CardVisitas empresaId={empresaId} periodo={periodo} fuente={fuente} vehicles={vehicles} />
    </div>
  );
}
