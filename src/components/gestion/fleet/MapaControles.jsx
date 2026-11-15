import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileSpreadsheet,
  Layers,
  LoaderCircle,
  Search,
  Satellite,
  X,
} from 'lucide-react';
import { COLORES_GRUPO, ETIQUETAS_GRUPO } from '../../../lib/asistenteMapa';
import { areaHectareas, contarVertices } from '../../../lib/geocercasGeometria';
import { agruparUnidades, grupoSugerido } from '../../../lib/agrotrackGrupos';
import { formatearFechaLarga } from '../../../lib/agrotrackFlota';
import { useLimiteFilas, BotonVerMas } from './reportesComunes';

/**
 * Controles flotantes del mapa de flota (FASE 3.8):
 *   * LeyendaGrupos    → leyenda con colores y conteos por grupo (abajo-izquierda).
 *   * FichaGeocerca    → ficha de la geocerca seleccionada con vértices y área (arriba-derecha).
 *   * ControlVistaSatelite → alterna vista satélite / calle (arriba-derecha).
 * Van DENTRO del contenedor del mapa (position absolute).
 *
 * Observaciones VI / VII / VIII (van FUERA del mapa, en la tarjeta FleetMap):
 *   * PanelGruposUnidades   → localizador con grupos colapsables y asignación.
 *   * TablaCoordenadas      → una fila por marcador visible, exportable.
 *   * TablaRecorrido        → página del recorrido histórico + paginación.
 *   * PanelUnidadesGeocerca → unidades dentro de la geocerca seleccionada.
 */

/* ------------------------------------------------------------------ */
/* Leyenda                                                             */
/* ------------------------------------------------------------------ */

const ORDEN_GRUPOS = ['autorizada', 'oficina', 'distrito', 'poligono'];

export function LeyendaGrupos({ geofences = [] }) {
  const conteos = useMemo(() => {
    const cuenta = {};
    for (const g of geofences) {
      const clave = g.tipo && COLORES_GRUPO[g.tipo] ? g.tipo : 'poligono';
      cuenta[clave] = (cuenta[clave] || 0) + 1;
    }
    return cuenta;
  }, [geofences]);

  const visibles = ORDEN_GRUPOS.filter((grupo) => conteos[grupo]);
  if (!visibles.length) return null;

  return (
    <div className="absolute bottom-3 left-3 z-[1100] rounded-xl border border-white/80 bg-white/95 px-3 py-2.5 shadow-[0_4px_18px_rgba(15,23,42,0.22)] backdrop-blur">
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        <Layers size={12} />
        Geocercas
      </p>
      <ul className="space-y-1">
        {visibles.map((grupo) => (
          <li key={grupo} className="flex items-center gap-2 text-[12px] text-slate-700">
            <span
              className="h-3 w-3 shrink-0 rounded-sm ring-1 ring-black/15"
              style={{ background: COLORES_GRUPO[grupo].relleno }}
              aria-hidden="true"
            />
            <span className="font-medium">{ETIQUETAS_GRUPO[grupo]}</span>
            <span className="ml-auto rounded-full bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-bold text-slate-600">
              {conteos[grupo]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ficha de la geocerca seleccionada                                   */
/* ------------------------------------------------------------------ */

export function FichaGeocerca({ geocerca, onCerrar }) {
  if (!geocerca) return null;

  const tipo = geocerca.tipo && COLORES_GRUPO[geocerca.tipo] ? geocerca.tipo : 'poligono';
  const etiqueta = ETIQUETAS_GRUPO[tipo];
  const vertices = geocerca.geometria ? contarVertices(geocerca.geometria) : 0;
  const area = geocerca.geometria ? areaHectareas(geocerca.geometria) : 0;
  const colores = COLORES_GRUPO[tipo];

  return (
    <div
      className="absolute top-3 right-3 z-[1100] w-[min(260px,calc(100%-24px))] overflow-hidden rounded-xl border border-white/80 bg-white/97 shadow-[0_6px_24px_rgba(15,23,42,0.25)] backdrop-blur"
      role="region"
      aria-label="Ficha de la geocerca seleccionada"
    >
      <div
        className="flex items-center gap-2 px-3 py-2 text-white"
        style={{ background: `linear-gradient(135deg, ${colores.borde}, ${colores.relleno})` }}
      >
        <span className="h-3 w-3 shrink-0 rounded-sm bg-white/85 ring-1 ring-black/15" aria-hidden="true" />
        <p className="min-w-0 flex-1 truncate text-[13px] font-bold" title={geocerca.nombre}>
          {geocerca.nombre || '(sin nombre)'}
        </p>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-lg p-1 transition-colors hover:bg-white/20"
          aria-label="Cerrar ficha de la geocerca"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 px-3 pt-2">
        <span
          className="rounded-full px-2 py-0.5 text-[10.5px] font-bold text-white ring-1 ring-black/10"
          style={{ background: colores.borde }}
        >
          {etiqueta}
        </span>
        {geocerca.division ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-600">
            {geocerca.division}
          </span>
        ) : null}
        {geocerca.incluir_reportes === false ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700">
            Fuera de reportes
          </span>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-px bg-slate-100 mt-2 border-t border-slate-100">
        <div className="bg-white px-3 py-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Vértices</dt>
          <dd className="text-[15px] font-bold text-slate-800">{vertices}</dd>
        </div>
        <div className="bg-white px-3 py-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Área</dt>
          <dd className="text-[15px] font-bold text-slate-800">
            {area >= 100
              ? `${Math.round(area).toLocaleString('es-PE')} ha`
              : `${area.toFixed(2)} ha`}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Control vista satélite                                              */
/* ------------------------------------------------------------------ */

export function ControlVistaSatelite({ satelite, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={satelite}
      className={`absolute top-3 left-16 z-[1100] flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-bold shadow-[0_4px_16px_rgba(15,23,42,0.25)] ring-1 ring-black/5 transition-all hover:scale-[1.03] ${
        satelite
          ? 'bg-slate-900 text-white'
          : 'bg-white/95 text-slate-700 backdrop-blur'
      }`}
      title={satelite ? 'Ver vista de calle' : 'Ver vista satélite'}
    >
      <Satellite size={15} />
      {satelite ? 'Calle' : 'Satélite'}
    </button>
  );
}

/* ================================================================== */
/* VI · Localizador de unidades con grupos (va fuera del mapa)        */
/* ================================================================== */

function normalizarTexto(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Fila de una unidad: clic = seleccionarla en el mapa; a la derecha, el input de grupo. */
function FilaUnidad({
  unidad,
  grupoActual,
  editable,
  gruposConocidos = [],
  guardando = false,
  seleccionada = false,
  onSeleccionar,
  onGuardar,
}) {
  const placa = String(unidad?.placa || unidad?.id || '');
  const [borrador, setBorrador] = useState(null);
  const valor = borrador !== null ? borrador : String(grupoActual || '');
  const sugerido = grupoSugerido(unidad?.descripcion);
  const sinCambios = valor.trim() === String(grupoActual || '').trim();

  const enviar = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setBorrador(null);
    if (!sinCambios) onGuardar(placa, valor);
  };

  return (
    <li
      className={`flex flex-wrap items-center gap-2 px-4 py-2 ${
        seleccionada ? 'bg-emerald-50' : 'hover:bg-slate-50'
      }`}
    >
      <button
        type="button"
        onClick={() => onSeleccionar(placa)}
        className="min-w-0 flex-1 text-left"
        title={`Ver ${placa} en el mapa`}
      >
        <span className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${seleccionada ? 'bg-emerald-600' : 'bg-slate-300'}`}
            aria-hidden="true"
          />
          <span className="text-xs font-bold text-slate-800">{placa}</span>
          <span className="truncate text-[11px] text-slate-500">{unidad?.descripcion || '—'}</span>
        </span>
      </button>

      {editable ? (
        <form onSubmit={enviar} className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
          <input
            list="grupos-unidades-datalist"
            value={valor}
            onChange={(event) => setBorrador(event.target.value)}
            placeholder={sugerido || 'Sin grupo'}
            disabled={guardando}
            autoComplete="off"
            aria-label={`Grupo de ${placa}`}
            className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none focus:border-emerald-500 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={guardando || sinCambios}
            title={sinCambios ? 'Sin cambios' : `Guardar ${placa} en el grupo`}
            aria-label={`Guardar grupo de ${placa}`}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-emerald-500 hover:text-emerald-700 disabled:opacity-40"
          >
            {guardando ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />}
          </button>
        </form>
      ) : (
        <span className="max-w-[45%] truncate rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
          {String(grupoActual || '').trim() || 'Sin grupo'}
        </span>
      )}
    </li>
  );
}

/**
 * Localizador de unidades (VI): grupos colapsables con contador, buscador de
 * unidad/placa y asignación de grupo con guardado optimista (el guardado y el
 * rollback los hace FleetMap; aquí solo se pinta el estado).
 */
export function PanelGruposUnidades({
  unidades = [],
  gruposPorPlaca = {},
  gruposConocidos = [],
  editable = false,
  cargando = false,
  aviso = '',
  error = '',
  guardandoPlaca = null,
  seleccionadoId = '',
  modoDescripcion = false,
  onSeleccionar = () => {},
  onGuardar = () => {},
}) {
  const [busqueda, setBusqueda] = useState('');
  const [colapsados, setColapsados] = useState({});

  const grupos = useMemo(
    () => agruparUnidades(unidades, gruposPorPlaca, modoDescripcion),
    [unidades, gruposPorPlaca, modoDescripcion],
  );

  const visibles = useMemo(() => {
    const consulta = normalizarTexto(busqueda);
    if (!consulta) return grupos;
    return grupos
      .map((grupo) => ({
        ...grupo,
        unidades: grupo.unidades.filter((unidad) =>
          normalizarTexto(`${unidad?.placa || unidad?.id || ''} ${unidad?.descripcion || ''}`).includes(consulta)),
      }))
      .filter((grupo) => grupo.unidades.length);
  }, [grupos, busqueda]);

  const totalVisibles = visibles.reduce((suma, grupo) => suma + grupo.unidades.length, 0);

  // Unidades sin grupo asignado: se listan por su descripción hasta que se
  // les asigne uno (el dato se guarda placa por placa en Supabase).
  const sinAsignar = useMemo(
    () => (editable
      ? unidades.filter((unidad) => {
        const placa = String(unidad?.placa || unidad?.id || '');
        return placa && !String(gruposPorPlaca[placa] ?? '').trim();
      }).length
      : 0),
    [unidades, gruposPorPlaca, editable],
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm min-w-0">
      <div className="p-4 sm:p-5 border-b border-slate-50 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900">Localizador de unidades</h3>
            <p className="text-xs text-slate-500">
              {cargando
                ? 'Cargando grupos…'
                : `${unidades.length} unidades en el mapa · ${grupos.length} grupo(s)${modoDescripcion ? ' (por descripción)' : ''}${sinAsignar ? ` · ${sinAsignar} sin grupo asignado (por descripción)` : ''}`}
            </p>
          </div>
          <label className="ml-auto flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 focus-within:border-emerald-500">
            <Search size={14} className="shrink-0 text-slate-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar unidad o placa…"
              className="w-36 sm:w-56 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
              aria-label="Buscar unidad o placa"
              autoComplete="off"
            />
          </label>
        </div>

        {aviso ? (
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800" role="status">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            <span>{aviso}</span>
          </p>
        ) : null}
        {error ? (
          <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800" role="alert">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}
      </div>

      <datalist id="grupos-unidades-datalist">
        {gruposConocidos.map((grupo) => (
          <option key={grupo} value={grupo} />
        ))}
      </datalist>

      <div className="max-h-[420px] overflow-y-auto">
        {cargando ? (
          <p className="flex items-center justify-center gap-2 p-6 text-xs text-slate-500">
            <LoaderCircle size={15} className="animate-spin" /> Cargando grupos de unidades…
          </p>
        ) : !unidades.length ? (
          <p className="p-6 text-center text-xs text-slate-500">
            Todavía no hay unidades con posición en el mapa.
          </p>
        ) : !visibles.length ? (
          <p className="p-6 text-center text-xs text-slate-500">
            Ninguna unidad coincide con “{busqueda}”.
          </p>
        ) : (
          visibles.map((grupo) => {
            const colapsado = Boolean(colapsados[grupo.clave]);
            return (
              <div key={grupo.clave || 'sin-grupo'} className="border-b border-slate-100 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setColapsados((prev) => ({ ...prev, [grupo.clave]: !colapsado }))}
                  aria-expanded={!colapsado}
                  className="flex w-full items-center gap-2 bg-slate-50/70 px-4 py-2.5 text-left hover:bg-slate-50"
                >
                  {colapsado ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronUp size={14} className="text-slate-400" />}
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Grupo</span>
                  <span className="truncate text-xs font-bold text-slate-700">{grupo.etiqueta}</span>
                  <span className="ml-auto rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                    {grupo.unidades.length}
                  </span>
                </button>
                {!colapsado ? (
                  <ul className="divide-y divide-slate-50">
                    {grupo.unidades.map((unidad) => {
                      const placa = String(unidad?.placa || unidad?.id || '');
                      return (
                        <FilaUnidad
                          key={placa}
                          unidad={unidad}
                          grupoActual={gruposPorPlaca[placa] || ''}
                          editable={editable}
                          gruposConocidos={gruposConocidos}
                          guardando={guardandoPlaca === placa}
                          seleccionada={seleccionadoId === placa}
                          onSeleccionar={onSeleccionar}
                          onGuardar={onGuardar}
                        />
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <p className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-[10px] text-slate-500">
        {busqueda
          ? `Mostrando ${totalVisibles} de ${unidades.length} unidades`
          : 'Clic en la unidad para llevar el mapa hasta su posición.'}
        {editable ? ' Escribe un grupo y pulsa ✓ para guardarlo (vacío = quitar).' : ''}
      </p>
    </div>
  );
}

/* ================================================================== */
/* VI · Tabla de coordenadas (una fila por marcador visible)          */
/* ================================================================== */

export function TablaCoordenadas({
  filas = [],
  rangoTexto = '',
  exportando = false,
  errorExportar = '',
  onExportar = () => {},
}) {
  const muchas = filas.length > 100;
  // Tabla limitada a 15 filas; el pie y el Excel usan el total completo.
  const { filasVistas, expandido, alternar, total } = useLimiteFilas(filas);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm min-w-0">
      <div className="p-4 sm:p-5 border-b border-slate-50 flex flex-wrap items-center gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-slate-900">Coordenadas de las unidades</h3>
          <p className="text-xs text-slate-500">
            {filas.length} posición(es) visible(s) en el mapa{rangoTexto ? ` · ${rangoTexto}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onExportar}
          disabled={!filas.length || exportando}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-forest hover:text-forest disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {exportando ? <LoaderCircle size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
          Descargar Excel
        </button>
      </div>
      {errorExportar ? (
        <p className="px-4 pt-2 text-[10px] text-red-600" role="alert">{errorExportar}</p>
      ) : null}

      {filas.length ? (
        <>
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-xs text-slate-700">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2.5 font-bold text-left">Unidad</th>
                  <th className="px-3 py-2.5 font-bold text-left">Evento</th>
                  <th className="px-3 py-2.5 font-bold text-left">Fecha</th>
                  <th className="px-3 py-2.5 font-bold text-left">Dirección</th>
                  <th className="px-3 py-2.5 font-bold text-right">Vel.</th>
                  <th className="px-3 py-2.5 font-bold text-left">Últ. contacto</th>
                  <th className="px-3 py-2.5 font-bold text-right">Latitud</th>
                  <th className="px-3 py-2.5 font-bold text-right">Longitud</th>
                </tr>
              </thead>
              <tbody>
                {filasVistas.map((fila) => (
                  <tr key={fila.clave || fila.placa} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="px-3 py-2">
                      <span className="block font-semibold text-slate-800">{fila.placa}</span>
                      {fila.descripcion ? (
                        <span className="block text-[10px] text-slate-400">{fila.descripcion}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{fila.evento || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-600">{fila.fechaTexto || '—'}</td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-slate-600" title={fila.direccion || ''}>
                      {fila.direccion || '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fila.velocidadTexto}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-500">{fila.contactoTexto || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{fila.latTexto}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{fila.lngTexto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <BotonVerMas expandido={expandido} onAlternar={alternar} total={total} />
          <p className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-[10px] text-slate-500">
            {filas.length} fila(s) · una por marcador visible
            {muchas ? ' · la tabla tiene scroll, desplázate para verlas todas' : ''}
          </p>
        </>
      ) : (
        <p className="p-6 text-center text-xs text-slate-500">
          No hay posiciones que mostrar: espera a que carguen las unidades o revisa el mapa.
        </p>
      )}
    </div>
  );
}

/* ================================================================== */
/* VII · Tabla del recorrido paginado                                  */
/* ================================================================== */

export function TablaRecorrido({
  puntos = [],
  placa = '',
  pagina = 1,
  totalPaginas = 1,
  ventanaTexto = '',
  muestreada = false,
  cargando = false,
  exportando = false,
  errorExportar = '',
  onPagina = () => {},
  onExportar = () => {},
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm min-w-0">
      <div className="p-4 sm:p-5 border-b border-slate-50 flex flex-wrap items-center gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-slate-900">Coordenadas del recorrido</h3>
          <p className="text-xs text-slate-500">
            {placa ? `${placa} · ` : ''}
            {puntos.length} punto(s) en la página {pagina} de {totalPaginas}
            {ventanaTexto ? ` · ${ventanaTexto}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onExportar}
          disabled={!puntos.length || exportando}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-forest hover:text-forest disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {exportando ? <LoaderCircle size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
          Descargar Excel
        </button>
      </div>
      {errorExportar ? (
        <p className="px-4 pt-2 text-[10px] text-red-600" role="alert">{errorExportar}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
        <button
          type="button"
          onClick={() => onPagina(pagina - 1)}
          disabled={cargando || pagina <= 1}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-forest hover:text-forest disabled:opacity-40"
        >
          <ChevronLeft size={13} /> Anterior
        </button>
        <span className="text-[11px] font-bold text-slate-600">
          Página {pagina} de {totalPaginas}
        </span>
        <button
          type="button"
          onClick={() => onPagina(pagina + 1)}
          disabled={cargando || pagina >= totalPaginas}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-forest hover:text-forest disabled:opacity-40"
        >
          Siguiente <ChevronRight size={13} />
        </button>
        {cargando ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            <LoaderCircle size={13} className="animate-spin" /> Cargando página…
          </span>
        ) : null}
        <span className="ml-auto text-[10px] text-slate-400">
          Cada página es una ventana temporal (máx. 900 puntos por llamada)
        </span>
      </div>

      {puntos.length ? (
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-xs text-slate-700">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2.5 font-bold text-left">Fecha</th>
                <th className="px-3 py-2.5 font-bold text-left">Evento</th>
                <th className="px-3 py-2.5 font-bold text-left">Dirección</th>
                <th className="px-3 py-2.5 font-bold text-right">Vel.</th>
                <th className="px-3 py-2.5 font-bold text-right">Latitud</th>
                <th className="px-3 py-2.5 font-bold text-right">Longitud</th>
                <th className="px-3 py-2.5 font-bold text-center">Alerta</th>
              </tr>
            </thead>
            <tbody>
              {puntos.map((punto) => (
                <tr key={punto.id ?? `${punto.fecha}-${punto.latitud}`} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600">{formatearFechaLarga(punto.fecha)}</td>
                  <td className="px-3 py-2 text-slate-700">{punto.evento || '—'}</td>
                  <td className="max-w-[220px] truncate px-3 py-2 text-slate-600" title={punto.direccion || ''}>
                    {punto.direccion || '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {punto.velocidad == null ? '—' : `${Number(punto.velocidad)} km/h`}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">{Number(punto.latitud).toFixed(5)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">{Number(punto.longitud).toFixed(5)}</td>
                  <td className="px-3 py-2 text-center">
                    {punto.es_alerta ? (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">Sí</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="p-6 text-center text-xs text-slate-500">
          {cargando ? 'Cargando los puntos de esta página…' : 'No hay puntos GPS en esta página del recorrido.'}
        </p>
      )}

      <p className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-[10px] text-slate-500">
        {muestreada
          ? 'Esta ventana superó el tope de 900 puntos y la RPC la muestreó (conserva inicio, fin y alertas). Reduce el rango para ver todos los puntos.'
          : 'El navegador solo conserva la página actual; usa ◀ ▶ para moverte por el rango.'}
      </p>
    </div>
  );
}

/* ================================================================== */
/* VIII · Unidades dentro de la geocerca seleccionada                  */
/* ================================================================== */

export function PanelUnidadesGeocerca({
  geocerca,
  estado = 'vacio', // cargando | ok | vacio | error
  unidades = [],
  error = '',
  aviso = '',
}) {
  // Tabla limitada a 15 filas (ganchos antes del return anticipado).
  const { filasVistas, expandido, alternar, total } = useLimiteFilas(unidades);
  if (!geocerca) return null;

  const cabecera = (
    <div className="p-4 sm:p-5 border-b border-slate-50">
      <h3 className="text-base font-bold text-slate-900">
        {geocerca.nombre || '(sin nombre)'} – Unidades: {estado === 'cargando' ? '…' : unidades.length}
      </h3>
      <p className="text-xs text-slate-500">
        Unidades cuya última posición cae dentro del polígono seleccionado.
      </p>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm min-w-0">
      {cabecera}
      {aviso ? (
        <p className="mx-4 sm:mx-5 mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800" role="status">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <span>{aviso}</span>
        </p>
      ) : null}

      {estado === 'cargando' ? (
        <p className="flex items-center justify-center gap-2 p-6 text-xs text-slate-500">
          <LoaderCircle size={15} className="animate-spin" /> Calculando qué unidades están dentro…
        </p>
      ) : estado === 'error' ? (
        <p className="flex items-start gap-2 p-6 text-xs text-red-700" role="alert">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error || 'No se pudieron calcular las unidades dentro de la geocerca.'}</span>
        </p>
      ) : !unidades.length ? (
        <p className="p-6 text-center text-xs font-semibold text-slate-500">Ninguna unidad dentro</p>
      ) : (
        <>
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-xs text-slate-700">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2.5 font-bold text-left">Unidad</th>
                <th className="px-3 py-2.5 font-bold text-left">Dirección</th>
                <th className="px-3 py-2.5 font-bold text-left">Últ. fecha</th>
                <th className="px-3 py-2.5 font-bold text-right">Vel.</th>
              </tr>
            </thead>
            <tbody>
              {filasVistas.map((unidad) => (
                <tr key={unidad.placa} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-3 py-2">
                    <span className="block font-semibold text-slate-800">{unidad.placa}</span>
                    {unidad.descripcion ? (
                      <span className="block text-[10px] text-slate-400">{unidad.descripcion}</span>
                    ) : null}
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2 text-slate-600" title={unidad.direccion || ''}>
                    {unidad.direccion || '—'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600">{unidad.fechaTexto || '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{unidad.velocidadTexto}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <BotonVerMas expandido={expandido} onAlternar={alternar} total={total} />
        </>
      )}
    </div>
  );
}
