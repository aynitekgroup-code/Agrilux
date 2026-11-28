import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Table2, Loader2, AlertTriangle, RotateCw, FileSpreadsheet, Database, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { ultimoDiaLima } from '../../../lib/agrotrackFlota';
import { cargarGruposUnidades } from '../../../lib/agrotrackGrupos';
import {
  asegurarVisitasCalculadas, pendientesVisitasDia, leerVisitasDia, leerTablaGeocercasDia,
  leerDivisionesGeocercas, armarMatriz, METRICAS, partesLima, duracionTexto, horasDecimal, codigoArea,
} from '../../../lib/agrotrackVisitasDia';
import { hoyLima, rangoRapido, useLimiteFilas, BotonVerMas } from './reportesComunes';

/**
 * TABLA DIARIA DE GEOCERCAS · TODAS LAS UNIDADES (14/11/2026)
 *
 * "Los reportes de geocercas todavía no pueden dar el reporte de todas las
 *  unidades juntas; es importante para el reporte diario" + la tabla
 * dinámica que se presenta todos los días a las 6:30 a. m. (dónde estuvieron
 * las unidades el día anterior).
 *
 * Lee las visitas GUARDADAS por día (scripts/agrotrack-visitas-diarias.sql):
 * no recalcula todo en vivo (eso superaba los 8 s de Supabase y las 1000
 * filas). Si falta algún (día, placa), lo calcula de a una placa mostrando el
 * avance, y queda guardado como respaldo de horas por máquina.
 */

const MAX_DIAS = 31;
const FILAS_DETALLE = 100;

function sumarDias(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function diasEntre(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

function h2(segundos) {
  return horasDecimal(segundos).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fechaCorta(fecha) {
  if (!fecha) return '—';
  const [y, m, d] = fecha.split('-');
  return `${d}/${m}/${y}`;
}

function fechaHoraCorta(iso) {
  if (!iso) return '—';
  const [fecha, hora = '00:00'] = iso.split('T');
  return `${fechaCorta(fecha)} ${hora}`;
}

function aIsoLima(iso, final = false) {
  const [fecha, hora = '00:00'] = String(iso || '').split('T');
  return `${fecha || ''}T${hora || '00:00'}:${final ? '59' : '00'}-05:00`;
}

function rangoDiaCompleto(desde, hasta) {
  return String(desde || '').endsWith('T00:00') && String(hasta || '').endsWith('T23:59');
}

function visitasComoTabla(visitas = []) {
  const porPar = new Map();
  (visitas || []).forEach((v) => {
    const placa = String(v?.placa || '').trim();
    const geocerca = String(v?.geocerca || '').trim();
    if (!placa || !geocerca) return;
    const clave = `${placa}|${geocerca}`;
    const fila = porPar.get(clave) || {
      placa,
      geocerca,
      visitas: 0,
      duracion_segundos: 0,
      apagado_segundos: 0,
      ralenti_segundos: 0,
      viaje_segundos: 0,
      primera_entrada: v?.entrada || null,
      ultima_salida: v?.salida || v?.entrada || null,
    };
    fila.visitas += v?.continua_dia_anterior ? 0 : 1;
    fila.duracion_segundos += Number(v?.duracion_segundos || 0);
    fila.apagado_segundos += Number(v?.apagado_segundos || 0);
    fila.ralenti_segundos += Number(v?.ralenti_segundos || 0);
    fila.viaje_segundos += Number(v?.viaje_segundos || 0);
    if (v?.entrada && (!fila.primera_entrada || v.entrada < fila.primera_entrada)) fila.primera_entrada = v.entrada;
    const salida = v?.salida || v?.entrada || null;
    if (salida && (!fila.ultima_salida || salida > fila.ultima_salida)) fila.ultima_salida = salida;
    porPar.set(clave, fila);
  });
  return [...porPar.values()];
}

export default function FleetTablaDiariaGeocercas({ empresaId, periodo = null, fuente = 'real', vehicles = [] }) {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [geocerca, setGeocerca] = useState('');
  const [grupo, setGrupo] = useState('');
  // Columnas de la tabla dinámica: por división (lo que reporta Zonar) o por
  // geocerca de campo (más detalle). Nunca las dos juntas: una división
  // agrupa varios campos y se duplicaría la información.
  const [columnas, setColumnas] = useState('division');
  const [divisionPorGeocerca, setDivisionPorGeocerca] = useState({});
  const [metrica, setMetrica] = useState('duracion_segundos');
  const [estado, setEstado] = useState('inactivo'); // inactivo | calculando | cargando | ok | vacio | error
  const [progreso, setProgreso] = useState(null);
  const [error, setError] = useState('');
  const [avisos, setAvisos] = useState([]);
  const [respaldoCompleto, setRespaldoCompleto] = useState(false);
  const [visitas, setVisitas] = useState([]);
  const [tabla, setTabla] = useState([]);
  const [grupos, setGrupos] = useState({});
  const [intento, setIntento] = useState(0);
  const [verDetalle, setVerDetalle] = useState(false);
  const [paginaDetalle, setPaginaDetalle] = useState(1);
  const [buscar, setBuscar] = useState('');
  const [exportError, setExportError] = useState('');
  // El panel de flota llega después del primer render: mientras tanto, el
  // default de "ayer" no debe quedarse fijo si los datos terminan antes.
  const [fechaElegida, setFechaElegida] = useState(false);

  const desdeDia = String(desde || '').split('T')[0];
  const hastaDia = String(hasta || '').split('T')[0];

  // Por defecto: AYER (la tabla de las 6:30 es del día anterior). Si los
  // datos cargados terminan antes, el último día con datos.
  useEffect(() => {
    if (fechaElegida) return;
    const ayer = sumarDias(hoyLima(), -1);
    const ultimo = periodo?.hasta ? ultimoDiaLima(periodo.hasta) : '';
    const dia = ultimo && ultimo < ayer ? ultimo : ayer;
    setDesde(`${dia}T00:00`);
    setHasta(`${dia}T23:59`);
  }, [periodo?.hasta, fechaElegida]);

  useEffect(() => {
    if (!empresaId) return;
    cargarGruposUnidades(empresaId).then((r) => setGrupos(r.grupos || {})).catch(() => setGrupos({}));
  }, [empresaId]);

  // División de cada geocerca (catálogo). Sin catálogo, la columna usa el
  // nombre de la geocerca y la tabla sigue funcionando.
  useEffect(() => {
    if (!empresaId) return undefined;
    let cancelado = false;
    leerDivisionesGeocercas(empresaId).then((mapa) => {
      if (!cancelado) setDivisionPorGeocerca(mapa || {});
    });
    return () => { cancelado = true; };
  }, [empresaId]);

  const rangoValido = desdeDia && hastaDia && hastaDia >= desdeDia && diasEntre(desdeDia, hastaDia) < MAX_DIAS;

  const cargar = useCallback(async (cancelado) => {
    setError('');
    setAvisos([]);
    setRespaldoCompleto(false);
    setEstado('calculando');
    setProgreso(null);
    try {
      const { errores } = await asegurarVisitasCalculadas(empresaId, desdeDia, hastaDia, (hechas, total, actual) => {
        if (!cancelado()) setProgreso({ hechas, total, actual });
      });
      if (cancelado()) return;
      if (errores.length) setAvisos(errores.slice(0, 5));
      setEstado('cargando');
      const rangoCompleto = rangoDiaCompleto(desde, hasta);
      const visitasEnRango = await leerVisitasDia(empresaId, {
        desdeDia, hastaDia, desde: aIsoLima(desde), hasta: aIsoLima(hasta, true), cancelado,
      });
      const t = rangoCompleto
        ? await leerTablaGeocercasDia(empresaId, { desdeDia, hastaDia })
        : visitasComoTabla(visitasEnRango);
      const pendientes = await pendientesVisitasDia(empresaId, desdeDia, hastaDia);
      if (cancelado()) return;
      setVisitas(visitasEnRango);
      setTabla(t);
      setRespaldoCompleto(errores.length === 0 && pendientes.length === 0);
      if (pendientes.length) setAvisos((prev) => [...prev, `${pendientes.length} unidades/días pendientes; pulsa Actualizar.`]);
      setPaginaDetalle(1);
      setEstado(visitasEnRango.length || t.length ? 'ok' : 'vacio');
    } catch (e) {
      if (cancelado()) return;
      setError(e?.message || 'No se pudo cargar la tabla de geocercas.');
      setEstado('error');
    }
  }, [empresaId, desde, hasta]);

  useEffect(() => {
    if (!empresaId || !rangoValido) return undefined;
    let cancel = false;
    cargar(() => cancel);
    return () => { cancel = true; };
  }, [empresaId, rangoValido, cargar, intento]);

  // Área (código de Zonar) y grupo de cada placa.
  const infoPlaca = useMemo(() => {
    const info = {};
    vehicles.forEach((v) => {
      const placa = v.placa || v.id;
      if (!placa) return;
      info[placa] = { area: codigoArea(v.unidad || v.descripcion, placa) || v.descripcion || '', grupo: grupos[placa] || '' };
    });
    visitas.forEach((v) => {
      if (!info[v.placa]) info[v.placa] = { area: codigoArea(v.unidad, v.placa), grupo: grupos[v.placa] || '' };
      else if (!info[v.placa].area) info[v.placa].area = codigoArea(v.unidad, v.placa);
    });
    Object.keys(grupos).forEach((placa) => {
      if (info[placa]) info[placa].grupo = grupos[placa];
    });
    return info;
  }, [vehicles, visitas, grupos]);

  const geocercasDisponibles = useMemo(
    () => [...new Set(tabla.map((f) => f.geocerca))].sort((a, b) => a.localeCompare(b, 'es')),
    [tabla],
  );
  const gruposDisponibles = useMemo(
    () => [...new Set(Object.values(infoPlaca).map((i) => i.grupo || i.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [infoPlaca],
  );

  const pasaFiltros = useCallback((placa, geo) => {
    if (geocerca && geo !== geocerca) return false;
    if (grupo) {
      const i = infoPlaca[placa] || {};
      if ((i.grupo || i.area) !== grupo) return false;
    }
    return true;
  }, [geocerca, grupo, infoPlaca]);

  const tablaFiltrada = useMemo(() => tabla.filter((f) => pasaFiltros(f.placa, f.geocerca)), [tabla, pasaFiltros]);
  const visitasFiltradas = useMemo(() => visitas.filter((v) => pasaFiltros(v.placa, v.geocerca)), [visitas, pasaFiltros]);
  const matriz = useMemo(
    () => armarMatriz(tablaFiltrada, infoPlaca, metrica, { columnasMode: columnas, divisionPorGeocerca }),
    [tablaFiltrada, infoPlaca, metrica, columnas, divisionPorGeocerca],
  );
  const { filasVistas: filasMatriz, expandido: expandidoMatriz, alternar: alternarMatriz, total: totalMatrizFilas } = useLimiteFilas(matriz.filas);

  const kpis = useMemo(() => {
    const s = (c) => tablaFiltrada.reduce((acc, f) => acc + Number(f[c] || 0), 0);
    return {
      unidades: new Set(tablaFiltrada.map((f) => f.placa)).size,
      geocercas: new Set(tablaFiltrada.map((f) => f.geocerca)).size,
      visitas: tablaFiltrada.reduce((acc, f) => acc + Number(f.visitas || 0), 0),
      total: s('duracion_segundos'),
      apagado: s('apagado_segundos'),
      ralenti: s('ralenti_segundos'),
      viaje: s('viaje_segundos'),
    };
  }, [tablaFiltrada]);

  const detalle = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    if (!q) return visitasFiltradas;
    return visitasFiltradas.filter((v) => `${v.placa} ${v.geocerca} ${v.unidad || ''}`.toLowerCase().includes(q));
  }, [visitasFiltradas, buscar]);
  const totalPaginas = Math.max(1, Math.ceil(detalle.length / FILAS_DETALLE));
  const paginaActual = Math.min(paginaDetalle, totalPaginas);
  const filasPagina = detalle.slice((paginaActual - 1) * FILAS_DETALLE, paginaActual * FILAS_DETALLE);

  const atajo = (id) => {
    const r = rangoRapido(id);
    if (!r) return;
    setFechaElegida(true);
    setDesde(r.desde);
    setHasta(r.hasta);
  };

  const descargarExcel = async () => {
    if (!respaldoCompleto || estado !== 'ok') return;
    setExportError('');
    try {
      const { exportarTablaDinamicaGeocercasExcel } = await import('../../../lib/exportExcelReportes');
      exportarTablaDinamicaGeocercasExcel(visitasFiltradas, {
        matriz, infoPlaca, desdeDia, hastaDia,
        columnasMode: columnas,
        metricaLabel: METRICAS.find((m) => m.id === metrica)?.label,
      });
    } catch (e) {
      setExportError(e?.message || 'No se pudo generar el Excel.');
    }
  };

  const ocupado = estado === 'calculando' || estado === 'cargando';
  const etiquetaMetrica = METRICAS.find((m) => m.id === metrica)?.label || '';

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm min-w-0">
      <div className="p-4 sm:p-5 border-b border-slate-50 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Table2 size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">Tabla diaria de geocercas · todas las unidades</h2>
            <p className="text-xs text-slate-500">
              Dónde estuvo cada unidad y cuántas horas (apagado, ralentí y viajando). Columnas por división, como Zonar, o por geocerca de campo. Es la tabla dinámica de las 6:30 a. m., lista para Excel.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIntento((n) => n + 1)}
              disabled={ocupado || !rangoValido}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-forest hover:text-forest disabled:opacity-40 transition-colors"
            >
              <RotateCw size={13} /> Actualizar
            </button>
            <button
              type="button"
              onClick={descargarExcel}
              disabled={estado !== 'ok' || !respaldoCompleto}
              className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-2.5 py-1.5 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-40 transition-colors"
            >
              <FileSpreadsheet size={13} /> Descargar Excel (Data + Resumen)
            </button>
          </div>
        </div>
        {exportError ? <p className="text-[10px] text-red-600">{exportError}</p> : null}

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Atajos</p>
            <div className="flex gap-1.5">
              {[['hoy', 'Hoy'], ['ayer', 'Ayer'], ['semana', 'Esta semana'], ['semana-anterior', 'Semana anterior']].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => atajo(id)}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-slate-200 bg-white text-slate-600 hover:border-forest hover:text-forest transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Desde</span>
            <input type="datetime-local" step="60" value={desde} onChange={(e) => { setFechaElegida(true); setDesde(e.target.value); }}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700" />
          </label>
          <label className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Hasta</span>
            <input type="datetime-local" step="60" value={hasta} onChange={(e) => { setFechaElegida(true); setHasta(e.target.value); }}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700" />
          </label>
          <label className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Geocerca</span>
            <select value={geocerca} onChange={(e) => setGeocerca(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 bg-white max-w-[220px]">
              <option value="">Todas las geocercas</option>
              {geocercasDisponibles.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
          <label className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Grupo / área</span>
            <select value={grupo} onChange={(e) => setGrupo(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 bg-white max-w-[200px]">
              <option value="">Todas las unidades</option>
              {gruposDisponibles.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
          <label className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Valores (horas)</span>
            <select value={metrica} onChange={(e) => setMetrica(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 bg-white">
              {METRICAS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
          <label className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Columnas</span>
            <select value={columnas} onChange={(e) => setColumnas(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 bg-white"
              title="Zonar solo reporta divisiones; Agrilux tiene además las geocercas de los campos.">
              <option value="division">Por división (como Zonar)</option>
              <option value="geocerca">Por geocerca de campo</option>
            </select>
          </label>
        </div>
        {desdeDia && hastaDia && !rangoValido ? (
          <p className="text-[11px] text-amber-700">Elige un rango de máximo {MAX_DIAS} días con “Hasta” igual o posterior a “Desde”.</p>
        ) : null}
      </div>

      {estado === 'calculando' ? (
        <div className="p-8 flex flex-col items-center gap-2 text-slate-500">
          <Loader2 size={18} className="animate-spin" />
          <p className="text-xs text-center">
            {progreso?.total
              ? `Calculando y guardando visitas pendientes: ${progreso.hechas} de ${progreso.total}${progreso.actual ? ` (${progreso.actual.placa} · ${fechaCorta(progreso.actual.dia)})` : ''}…`
              : 'Revisando qué días ya están calculados…'}
          </p>
          {progreso?.total ? (
            <div className="w-64 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: `${Math.round((progreso.hechas / progreso.total) * 100)}%` }} />
            </div>
          ) : null}
        </div>
      ) : null}

      {estado === 'cargando' ? (
        <div className="p-8 flex flex-col items-center gap-2 text-slate-500">
          <Loader2 size={18} className="animate-spin" />
          <p className="text-xs">Leyendo las visitas guardadas de todas las unidades…</p>
        </div>
      ) : null}

      {estado === 'error' ? (
        <div className="p-8 text-center">
          <div className="mx-auto w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <AlertTriangle size={17} />
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-700">No se pudo cargar la tabla</p>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-lg mx-auto">{error}</p>
          <button type="button" onClick={() => setIntento((n) => n + 1)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-forest hover:text-forest">
            <RotateCw size={12} /> Reintentar
          </button>
        </div>
      ) : null}

      {estado === 'vacio' ? (
        <div className="p-8 text-center">
          <p className="text-sm font-semibold text-slate-600">Sin visitas a geocercas</p>
          <p className="text-xs text-slate-400 mt-1">Ninguna unidad entró a una geocerca entre {fechaHoraCorta(desde)} y {fechaHoraCorta(hasta)}.</p>
        </div>
      ) : null}

      {estado === 'ok' ? (
        <>
          {estado === 'ok' ? <p className={`text-xs font-semibold ${respaldoCompleto ? 'text-emerald-700' : 'text-amber-700'}`} role="status">
            {respaldoCompleto ? 'Respaldo calculado para los datos cargados · listo para Excel' : 'Respaldo incompleto · exportación bloqueada hasta completar el cálculo'}
          </p> : null}
          {avisos.length ? (
            <div className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800">
              Algunas unidades no se pudieron calcular (se reintentará solo): {avisos.join(' · ')}
            </div>
          ) : null}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2 p-4">
            {[
              ['Unidades', kpis.unidades],
              [columnas === 'division' ? 'Divisiones' : 'Geocercas', matriz.geocercas.length],
              ['Visitas', kpis.visitas],
              ['Horas en geocercas', h2(kpis.total)],
              ['Apagado (h)', h2(kpis.apagado)],
              ['Ralentí (h)', h2(kpis.ralenti)],
              ['Viajando (h)', h2(kpis.viaje)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{k}</p>
                <p className="mt-0.5 text-base font-bold text-slate-800">{v}</p>
              </div>
            ))}
          </div>

          <div className="px-4 pb-1 text-[11px] text-slate-500">
            Suma de <b>{etiquetaMetrica}</b> (horas) · {fechaHoraCorta(desde)}{desde !== hasta ? ` a ${fechaHoraCorta(hasta)}` : ''}
            {' · '}columnas por <b>{columnas === 'division' ? 'división' : 'geocerca de campo'}</b>
          </div>
          <p className="px-4 pb-2 text-[10px] text-slate-400 leading-relaxed">
            {columnas === 'division'
              ? 'Cada división agrupa sus geocercas de campo, como en Zonar. El detalle de visitas de abajo conserva la geocerca de campo.'
              : 'Una columna por geocerca de campo (más detalle que Zonar, que solo reporta divisiones).'}
          </p>
          <div className="overflow-x-auto mx-4 mb-4 rounded-xl border border-slate-100">
            <table className="text-[11px] text-slate-700 border-collapse">
              <thead>
                <tr className="bg-green-700 text-white">
                  <th className="sticky left-0 z-10 bg-green-700 px-2 py-2 text-left font-bold min-w-[110px]">Área / grupo</th>
                  <th className="sticky left-[110px] z-10 bg-green-700 px-2 py-2 text-left font-bold min-w-[80px]">Placa</th>
                  {matriz.geocercas.map((g) => (
                    <th key={g} className="px-2 py-2 text-right font-bold align-bottom min-w-[70px] max-w-[90px] leading-tight">{g}</th>
                  ))}
                  <th className="px-2 py-2 text-right font-bold min-w-[70px]">Total general</th>
                </tr>
              </thead>
              <tbody>
                {filasMatriz.map((f) => (
                  <tr key={f.placa} className="border-b border-slate-50 hover:bg-green-50/60">
                    <td className="sticky left-0 bg-white px-2 py-1.5 text-slate-500 truncate max-w-[110px]">{f.grupo || f.area || '—'}</td>
                    <td className="sticky left-[110px] bg-white px-2 py-1.5 font-bold text-slate-800 whitespace-nowrap">{f.placa}</td>
                    {matriz.geocercas.map((g) => (
                      <td key={g} className={`px-2 py-1.5 text-right tabular-nums ${f.valores[g] ? 'text-slate-800' : 'text-slate-300'}`}>
                        {h2(f.valores[g] || 0)}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-right font-bold tabular-nums">{h2(f.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-green-100 font-bold">
                  <td className="sticky left-0 bg-green-100 px-2 py-2" colSpan={1}>Total general</td>
                  <td className="sticky left-[110px] bg-green-100 px-2 py-2">{matriz.filas.length}</td>
                  {matriz.geocercas.map((g) => (
                    <td key={g} className="px-2 py-2 text-right tabular-nums">{h2(matriz.totales[g])}</td>
                  ))}
                  <td className="px-2 py-2 text-right tabular-nums">{h2(matriz.totalGeneral)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <BotonVerMas expandido={expandidoMatriz} onAlternar={alternarMatriz} total={totalMatrizFilas} />

          <div className="px-4 pb-4">
            <button type="button" onClick={() => setVerDetalle((v) => !v)}
              className="text-[11px] font-semibold text-forest hover:underline">
              {verDetalle ? 'Ocultar' : 'Ver'} detalle de visitas ({visitasFiltradas.length})
            </button>
            {verDetalle ? (
              <div className="mt-2 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input type="search" value={buscar} onChange={(e) => { setBuscar(e.target.value); setPaginaDetalle(1); }}
                    placeholder="Buscar placa o geocerca" className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs" />
                  <div className="ml-auto flex items-center gap-1 text-[11px] text-slate-500">
                    <button type="button" aria-label="Página anterior" disabled={paginaActual <= 1}
                      onClick={() => setPaginaDetalle(paginaActual - 1)} className="p-1 rounded border border-slate-200 disabled:opacity-40">
                      <ChevronLeft size={13} />
                    </button>
                    Página {paginaActual} de {totalPaginas}
                    <button type="button" aria-label="Página siguiente" disabled={paginaActual >= totalPaginas}
                      onClick={() => setPaginaDetalle(paginaActual + 1)} className="p-1 rounded border border-slate-200 disabled:opacity-40">
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-[11px] text-slate-700">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                        {['Placa', 'Área / grupo', 'Geocerca', 'Fecha entrada', 'Hora entrada', 'Fecha salida', 'Hora salida', 'Duración', 'Apagado', 'Ralentí', 'Viajando'].map((c) => (
                          <th key={c} className="px-2 py-2 text-left font-bold whitespace-nowrap">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filasPagina.map((v, i) => {
                        const e = partesLima(v.entrada);
                        const s = partesLima(v.salida);
                        const info = infoPlaca[v.placa] || {};
                        return (
                          <tr key={`${v.placa}-${v.geocerca}-${v.entrada}-${i}`} className="border-t border-slate-50">
                            <td className="px-2 py-1.5 font-bold whitespace-nowrap">{v.placa}</td>
                            <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">{info.grupo || info.area || '—'}</td>
                            <td className="px-2 py-1.5 whitespace-nowrap">{v.geocerca}</td>
                            <td className="px-2 py-1.5 whitespace-nowrap">{fechaCorta(e.fecha)}</td>
                            <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">{e.hora}{v.continua_dia_anterior ? ' ↩' : ''}</td>
                            <td className="px-2 py-1.5 whitespace-nowrap">{fechaCorta(s.fecha)}</td>
                            <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">{s.hora}{v.abierta ? ' ↪' : ''}</td>
                            <td className="px-2 py-1.5 whitespace-nowrap tabular-nums font-semibold">{duracionTexto(v.duracion_segundos)}</td>
                            <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">{duracionTexto(v.apagado_segundos)}</td>
                            <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">{duracionTexto(v.ralenti_segundos)}</td>
                            <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">{duracionTexto(v.viaje_segundos)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-slate-400">↩ venía del día anterior (entra a las 00:00:00) · ↪ seguía dentro al cierre del día (sale a las 23:59:59).</p>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      <p className="px-4 py-2.5 text-[10px] text-slate-400 border-t border-slate-50 leading-relaxed">
        {fuente === 'real' ? (
          <span className="inline-flex items-center gap-1">
            <Database size={10} /> Visitas guardadas por día en public.agrotrack_visitas_dia (respaldo de horas por máquina). Se calculan solas cada 10 min (pg_cron) y al terminar la descarga de Zonar.
          </span>
        ) : 'Aún no hay datos reales para esta empresa.'}
        <span className="block mt-0.5">Cada día va de 00:00:00 a 23:59:59 hora de Perú; el tramo entre dos reportes toma el estado del punto donde empieza.</span>
      </p>
    </div>
  );
}
