import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, AlertTriangle, RotateCw, CalendarClock, Database, ChevronDown, ChevronUp } from 'lucide-react';
import { rangoDiaLima, rangoMesLima, rangoLibreLima, formatearRango, ultimoDiaLima } from '../../../lib/agrotrackFlota';

import { cargarVehiculosMaestro } from '../../../lib/agrotrackVehiculos';
import {
  cargarGruposUnidades,
  unidadesConPosicionYGrupos,
  grupoPorPlaca,
  resolverPlacasFiltro,
  normalizarPlaca,
} from '../../../lib/agrotrackGrupos';

/**
 * src/components/gestion/fleet/reportesComunes.jsx
 * Piezas compartidas por las tarjetas de reportes de flota (actividad,
 * eventos resumidos, estado de unidades y geocercas): el selector de rango
 * (todo / día / mes) y los cuatro estados de cada tarjeta (pendiente de
 * fecha, cargando, error, vacío). Un solo lugar para que todas las tarjetas
 * se comporten igual.
 */

/** Filas visibles inicialmente en una tabla antes de pedir "Ver más". */
export const FILAS_INICIALES_TABLA = 15;

/**
 * Reloj de Perú que se actualiza cada segundo. Vive aparte para que no
 * re-renderice la tabla completa. Es solo la hora del navegador: la frescura
 * del dato la indica el chip «leído hace…».
 */
export function RelojEnVivo() {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const reloj = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(reloj);
  }, []);
  return (
    <>
      {ahora.toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'America/Lima',
      })}
    </>
  );
}

/**
 * Limita a 15 filas la parte visible de una tabla: el usuario puede abrir
 * todo con el botón "Ver más" (tipo flecha). `filasVistas` es la sección a
 * renderizar; el resto de la pantalla y los exports deben seguir usando la
 * lista completa. Al cambiar la lista de filas (otro rango/reporte) vuelve
 * a contraerse.
 */
export function useLimiteFilas(filas = [], limite = FILAS_INICIALES_TABLA) {
  const [expandido, setExpandido] = useState(false);
  useEffect(() => {
    setExpandido(false);
  }, [filas]);
  const filasVistas = useMemo(() => (expandido ? filas : filas.slice(0, limite)), [filas, expandido, limite]);
  return {
    filasVistas,
    expandido,
    alternar: () => setExpandido((v) => !v),
    total: filas.length,
  };
}

export function filtrarFilasPorPlaca(filas = [], placasFiltro, selector = (fila) => fila?.placa ?? fila?.unidad) {
  if (placasFiltro == null) return filas;
  const placas = new Set(placasFiltro.map(normalizarPlaca).filter(Boolean));
  return filas.filter((fila) => placas.has(normalizarPlaca(selector(fila))));
}

export function useFiltroUnidadGrupo({ vehicles = [], empresaId = null }) {
  const [mostrar, setMostrar] = useState('unidades');
  const [opcionFiltro, setOpcionFiltro] = useState('');
  const [gruposInfo, setGruposInfo] = useState({ grupos: {}, disponible: true, aviso: null });
  const [maestroInfo, setMaestroInfo] = useState({ unidades: [], disponible: false, aviso: null });

  useEffect(() => {
    if (!empresaId) return undefined;
    let cancelado = false;
    const cargarMaestro = () => cargarVehiculosMaestro(empresaId).then((info) => {
      if (!cancelado) setMaestroInfo(info);
    });
    cargarMaestro();
    cargarGruposUnidades(empresaId).then((info) => {
      if (!cancelado) setGruposInfo(info);
    });
    return () => {
      cancelado = true;
    };
  }, [empresaId]);

  const unidades = useMemo(
    () => unidadesConPosicionYGrupos(vehicles, gruposInfo, maestroInfo),
    [vehicles, gruposInfo, maestroInfo],
  );

  const grupoDePlaca = useMemo(() => {
    const mapa = {};
    unidades.forEach((vehicle) => {
      const placa = normalizarPlaca(vehicle?.placa);
      if (!placa) return;
      mapa[placa] = String(vehicle?.grupo || '').trim()
        || grupoPorPlaca(
          placa,
          gruposInfo,
          vehicle?.descripcion || vehicle?.modelo || '',
        );
    });
    return mapa;
  }, [unidades, gruposInfo]);

  const opcionesGrupos = useMemo(
    () => [...new Set(Object.values(grupoDePlaca))].sort((a, b) => a.localeCompare(b, 'es')),
    [grupoDePlaca],
  );

  const placasFiltro = useMemo(
    () => resolverPlacasFiltro(unidades, gruposInfo, mostrar, opcionFiltro),
    [unidades, gruposInfo, mostrar, opcionFiltro],
  );

  const unidadesSinPosicion = useMemo(
    () => unidades.filter((vehicle) => vehicle?.sin_telemetria),
    [unidades],
  );

  const cambiarMostrar = (value) => {
    setMostrar(value);
    setOpcionFiltro('');
  };

  return {
    mostrar,
    setMostrar: cambiarMostrar,
    opcionFiltro,
    setOpcionFiltro,
    gruposInfo,
    grupoDePlaca,
    opcionesGrupos,
    unidades,
    unidadesSinPosicion,
    placasFiltro,
  };
}

export function ControlesFiltroUnidadGrupo({
  mostrar,
  setMostrar,
  opcionFiltro,
  setOpcionFiltro,
  unidades = [],
  opcionesUnidades,
  opcionesGrupos = [],
  gruposInfo = { disponible: true, aviso: null },
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Mostrar</p>
        <div className="flex gap-1.5" role="radiogroup" aria-label="Mostrar por grupos o por unidades">
          {[['grupos', 'Grupos'], ['unidades', 'Unidades']].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={mostrar === id}
              onClick={() => setMostrar(id)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                mostrar === id ? 'bg-forest text-white' : 'bg-slate-50 text-slate-500 hover:text-forest'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <label className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
          {mostrar === 'grupos' ? 'Grupo' : 'Unidad'}
        </span>
        <select
          value={opcionFiltro}
          onChange={(e) => setOpcionFiltro(e.target.value)}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 bg-white min-w-[240px] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        >
          <option value="">{mostrar === 'grupos' ? 'Todos los grupos' : 'Todas las unidades'}</option>
          {mostrar === 'grupos'
            ? opcionesGrupos.map((grupo) => <option key={grupo} value={grupo}>{grupo}</option>)
            : (opcionesUnidades ?? unidades.map((unidad) => ({
              valor: unidad.placa,
              etiqueta: `${unidad.placa}${unidad.descripcion ? ` - ${unidad.descripcion}` : unidad.sin_telemetria ? ' · sin telemetría' : ''}`,
            }))).map(({ valor, etiqueta }) => <option key={valor} value={valor}>{etiqueta}</option>)}
        </select>
        {mostrar === 'grupos' && !gruposInfo.disponible && gruposInfo.aviso ? (
          <span className="block mt-1 text-[10px] text-amber-600 max-w-[280px] leading-snug">
            Grupos no disponibles en la base: se agrupa por la descripción de la unidad. {gruposInfo.aviso}
          </span>
        ) : null}
      </label>
    </div>
  );
}

export function BotonActualizarAhora({ onClick, disabled = false, cargando = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-forest hover:text-forest disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      <RotateCw size={13} className={cargando ? 'animate-spin' : ''} />
      {cargando ? 'Actualizando…' : 'Actualizar'}
    </button>
  );
}

/** Botón "Ver más (N restantes) ▾ / Ver menos ▴" para las tablas largas. */
export function BotonVerMas({ expandido, onAlternar, total, limite = FILAS_INICIALES_TABLA }) {
  if (total <= limite) return null;
  return (
    <div className="flex items-center justify-center border-t border-slate-50 py-1.5">
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={expandido}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-forest hover:text-forest transition-colors"
      >
        {expandido ? (
          <>Ver menos <ChevronUp size={14} /></>
        ) : (
          <>Ver más ({total - limite} restante{total - limite === 1 ? '' : 's'}) <ChevronDown size={14} /></>
        )}
      </button>
    </div>
  );
}

/** Número localizado con el mínimo de decimales pedido. */
export function numero(valor, decimales = 1) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('es-PE', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

/**
 * Cuánto tiempo hace desde una fecha ISO, en lenguaje llano:
 * "hace 12 h 30 min" · "hace 45 min" · "hace 3 d 4 h" · "hace instantes".
 * Lo usa el reporte "Unidades sin reportar" (Zonar) y su exportación a
 * Excel, para que el texto en pantalla y en el archivo sean idénticos.
 * @param {string} iso      fecha de la última comunicación (GPRS)
 * @param {Date}   ahora    instante contra el que se compara (por defecto, hoy)
 */
export function haceCuanto(iso, ahora = new Date()) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return 'sin reporte';
  const seg = Math.max(0, Math.floor((ahora.getTime() - t) / 1000));
  const dias = Math.floor(seg / 86400);
  const horas = Math.floor((seg % 86400) / 3600);
  const minutos = Math.floor((seg % 3600) / 60);
  if (dias > 0) return `hace ${dias} d ${horas} h`;
  if (horas > 0) return `hace ${horas} h ${minutos} min`;
  if (minutos > 0) return `hace ${minutos} min`;
  return 'hace instantes';
}

/**
 * Selector de rango (todo / día / mes) de una tarjeta. Precarga el día y el
 * mes con el último dato real y expone `consulta` ({ desde, hasta, texto })
 * listo para la RPC.
 */
export function useRango(periodo, rangoInicial = 'libre') {
  const [rango, setRango] = useState(rangoInicial);
  const [dia, setDia] = useState('');
  const [mes, setMes] = useState('');
  // Rango libre con hora (pedido por el Ing. Carlos Perez): dos buscadores de
  // fecha+hora en formato datetime-local, interpretados en hora de Perú.
  const [desdeHora, setDesdeHora] = useState('');
  const [hastaHora, setHastaHora] = useState('');

  // Precarga con el último día (o mes) que trae datos reales.
  useEffect(() => {
    if (!periodo?.hasta) return;
    const ultimo = ultimoDiaLima(periodo.hasta);
    if (!ultimo) return;
    setDia((prev) => prev || ultimo);
    setMes((prev) => prev || ultimo.slice(0, 7));
    // El rango libre arranca como ese último día completo (00:00 a 23:59).
    setDesdeHora((prev) => prev || `${ultimo}T00:00`);
    setHastaHora((prev) => prev || `${ultimo}T23:59`);
  }, [periodo?.hasta]);

  const consulta = useMemo(() => {
    if (rango === 'dia') return { ...rangoDiaLima(dia), texto: dia };
    if (rango === 'mes') return { ...rangoMesLima(mes), texto: mes };
    if (rango === 'libre') return rangoLibreLima(desdeHora, hastaHora);
    return {
      desde: periodo?.desde || null,
      hasta: periodo?.hasta || null,
      texto: periodo?.desde ? formatearRango(periodo.desde, periodo.hasta) : '',
    };
  }, [rango, dia, mes, desdeHora, hastaHora, periodo]);

  const pendienteDeFecha =
    (rango === 'dia' && !dia) || (rango === 'mes' && !mes)
    || (rango === 'libre' && (!desdeHora || !hastaHora))
    || (rango === 'todo' && !periodo?.desde);

  return {
    rango, setRango, dia, setDia, mes, setMes,
    desdeHora, setDesdeHora, hastaHora, setHastaHora,
    consulta, pendienteDeFecha,
  };
}

/** Hoy en hora de Perú (YYYY-MM-DD). */
export function hoyLima(ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(ahora);
}

function sumarDias(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/**
 * Atajos de Zonar (Hoy · Ayer · Esta semana · Semana anterior) como rangos
 * "Desde / hasta" con hora: { desde: 'YYYY-MM-DDT00:00', hasta: '...T23:59' }.
 * La semana va de lunes a domingo, como en Zonar.
 */
export function rangoRapido(id, ahora = new Date()) {
  const hoy = hoyLima(ahora);
  const [y, m, d] = hoy.split('-').map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // 0 = lunes
  const lunes = sumarDias(hoy, -dow);
  const rangos = {
    hoy: [hoy, hoy],
    ayer: [sumarDias(hoy, -1), sumarDias(hoy, -1)],
    semana: [lunes, hoy],
    'semana-anterior': [sumarDias(lunes, -7), sumarDias(lunes, -1)],
  };
  const r = rangos[id];
  if (!r) return null;
  return { desde: `${r[0]}T00:00`, hasta: `${r[1]}T23:59` };
}

const ATAJOS = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'ayer', label: 'Ayer' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'semana-anterior', label: 'Semana anterior' },
];

/** Atajos + From/To con hora, compartidos por las tarjetas. */
export function ControlesRango({
  rango, setRango, dia, setDia, mes, setMes,
  desdeHora = '', setDesdeHora = () => {}, hastaHora = '', setHastaHora = () => {},
}) {
  const aplicarAtajo = (id) => {
    const r = rangoRapido(id);
    if (!r) return;
    setDesdeHora(r.desde);
    setHastaHora(r.hasta);
    setRango('libre');
  };
  const cambiarDesde = (valor) => {
    if (valor) {
      setDesdeHora(valor);
      setRango('libre');
    }
  };
  const cambiarHasta = (valor) => {
    if (valor) {
      setHastaHora(valor);
      setRango('libre');
    }
  };
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Atajos</p>
        <div className="flex flex-wrap gap-1.5">
          {ATAJOS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => aplicarAtajo(a.id)}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-slate-200 bg-white text-slate-600 hover:border-forest hover:text-forest transition-colors"
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <label className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Desde</span>
        <input
          type="datetime-local"
          step="60"
          value={desdeHora}
          onChange={(e) => cambiarDesde(e.target.value)}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </label>

      <label className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Hasta</span>
        <input
          type="datetime-local"
          step="60"
          value={hastaHora}
          onChange={(e) => cambiarHasta(e.target.value)}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </label>

    </div>
  );
}

/** Estados compartidos (pendiente / cargando / error / vacío) de una tarjeta. */
export function AvisoUnidadesSinTelemetria({ unidades = [] }) {
  if (!unidades.length) return null;
  return (
    <div className="mx-4 my-4 rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">
        Unidades sin telemetría
      </p>
      <p className="mt-1 text-[11px] text-amber-900 leading-snug">
        Estas unidades no tienen posiciones cargadas; no representan datos GPS.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {unidades.map((unidad) => {
          const area = unidad?.area || unidad?.descripcion || '';
          return (
            <span
              key={unidad.placa}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-white px-2 py-1 text-[10px] font-semibold text-amber-900"
            >
              {unidad.placa}{area ? ` · ${area}` : ''} · —
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function CuerpoEstado({ pendienteDeFecha, mensajePendiente, estado, error, onReintentar, mensajeVacio, childrenCuandoVacio = false, children }) {
  if (pendienteDeFecha) {
    return (
      <div className="p-8 flex flex-col items-center gap-2 text-slate-400">
        <CalendarClock size={18} />
        <p className="text-xs text-center leading-relaxed max-w-md">{mensajePendiente}</p>
      </div>
    );
  }
  if (estado === 'cargando') {
    return (
      <div className="p-8 flex flex-col items-center gap-2 text-slate-500">
        <Loader2 size={18} className="animate-spin" />
        <p className="text-xs">Calculando el reporte en la base de datos…</p>
      </div>
    );
  }
  if (estado === 'error') {
    return (
      <div className="p-8 text-center">
        <div className="mx-auto w-9 h-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
          <AlertTriangle size={17} />
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-700">No se pudo cargar el reporte</p>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{error}</p>
        <button
          type="button"
          onClick={onReintentar}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-forest hover:text-forest transition-colors"
        >
          <RotateCw size={12} /> Reintentar
        </button>
      </div>
    );
  }
  if (estado === 'vacio') {
    if (childrenCuandoVacio) return children;
    return (
      <div className="p-8 text-center">
        <p className="text-sm font-semibold text-slate-600">Sin datos para ese rango</p>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{mensajeVacio}</p>
      </div>
    );
  }
  return children;
}

/**
 * Estado honesto de un reporte que todavía no tiene fuente real de datos:
 * en lugar de cifras inventadas se explica qué falta. Compartido por la
 * consola de flota y por ReportesPage (catálogo de módulos).
 */
export function PanelSinDatos({ titulo, descripcion, puntos = [], nota = null }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
          <Database size={18} />
        </span>
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
            Sin datos
          </span>
          <h3 className="mt-2 text-base font-bold text-slate-800">{titulo}</h3>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed max-w-3xl">{descripcion}</p>
          {puntos.length ? (
            <ul className="mt-3 space-y-1.5">
              {puntos.map((punto) => (
                <li key={punto} className="text-xs text-slate-500 flex items-start gap-2">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                  {punto}
                </li>
              ))}
            </ul>
          ) : null}
          {nota ? (
            <p className="mt-3 text-[11px] text-slate-400 border-t border-slate-100 pt-3 leading-relaxed">{nota}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
