import React, { useMemo, useState } from 'react';
import { CircleMarker, Marker, Polygon, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  AlertCircle,
  Droplet,
  LoaderCircle,
  Minus,
  Move,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { listarVertices } from '../../../lib/geocercasGeometria';
import { armarContextoGeocerca, bboxDeCentros, validarPropuestaGeocerca } from '../../../lib/geocercaIa';
import { llamarIaGestion } from '../../../lib/agrotrackIa';

/**
 * Editor de geocercas (FASE 3.7), pedido por el Ing. Carlos Perez:
 * renombrar, mover/insertar/quitar vértices, rellenar huecos, dibujar polígonos
 * nuevos y eliminar (solo administradores).
 *
 * Dos piezas:
 *   - GeocercaEditorPanel : los controles (se pinta FUERA del mapa);
 *   - GeocercaVertexLayer : los puntos arrastrables y los clics del mapa
 *                           (se pinte DENTRO de <MapContainer>).
 */

const COLORES_VERTICE = { mover: '#B45309', insertar: '#15803D', quitar: '#DC2626' };

function vertexIcon(modo) {
  const color = COLORES_VERTICE[modo] || COLORES_VERTICE.mover;
  return L.divIcon({
    className: 'fleet-geofence-vertex',
    html:
      `<div style="width:12px;height:12px;border-radius:50%;background:#fff;` +
      `border:2px solid ${color};box-shadow:0 1px 2px rgba(15,23,42,.4);` +
      `cursor:${modo === 'quitar' ? 'pointer' : 'grab'}"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

function ToolButton({ activo, onClick, disabled, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={activo}
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
        activo
          ? 'border-amber-600 bg-amber-50 text-amber-700'
          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

function Mensaje({ mensaje }) {
  if (!mensaje) return null;
  const error = mensaje.tipo === 'error';
  const info = mensaje.tipo === 'info';
  const tono = error
    ? 'border-red-200 bg-red-50 text-red-800'
    : info
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800';
  return (
    <p
      role={error ? 'alert' : 'status'}
      className={`mt-2 flex items-start gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] leading-snug ${tono}`}
    >
      {error || info ? <AlertCircle size={13} className="mt-0.5 shrink-0" /> : null}
      <span>{mensaje.texto}</span>
    </p>
  );
}

const PISTA = {
  mover: 'Arrastra los puntos del polígono para moverlos.',
  insertar: 'Haz clic cerca de un borde para agregar un punto.',
  quitar: 'Haz clic sobre un punto para quitarlo (mínimo 3 por polígono).',
  dibujo: 'Haz clic en el mapa para marcar los puntos (mínimo 3).',
};

/* -------------------------------------------------------------------------
 * Controles del editor (va fuera del mapa, en la tarjeta de FleetMap).
 * ------------------------------------------------------------------------- */
export function GeocercaEditorPanel({
  puedeEditar,
  editando,
  onSalir,
  modo,
  onModo,
  seleccion,
  nombre,
  onNombre,
  sucio,
  guardando,
  mensaje,
  onEntrar,
  onGuardar,
  onDescartar,
  onRellenar,
  cantidadVertices,
  dibujo,
  onCrear,
  onCancelarDibujo,
  puedeEliminar,
  confirmarEliminar,
  eliminando,
  onEliminar,
  onDibujar,
  // IA en Gestión: propuesta de geocerca por instrucción (nunca guarda sola).
  geocercasIA = [],
  onPropuestaIA = null,
}) {
  const [instruccion, setInstruccion] = useState('');
  const [proponiendoIa, setProponiendoIa] = useState(false);
  const [errorIa, setErrorIa] = useState('');

  /**
   * Pide a la IA un polígono a partir de la instrucción. La propuesta se
   * valida (coordenadas, zona y área) y entra como BORRADOR en el mapa:
   * aquí NO se guarda nada; eso lo hace el usuario con "Crear geocerca".
   */
  const proponerConIa = async () => {
    const texto = instruccion.trim();
    if (texto.length < 4 || proponiendoIa || !onPropuestaIA) return;
    setProponiendoIa(true);
    setErrorIa('');
    try {
      const data = await llamarIaGestion({
        modo: 'geocerca',
        contexto: armarContextoGeocerca({ instruccion: texto, geocercas: geocercasIA }),
      });
      const propuesta = validarPropuestaGeocerca(data.datos, {
        bbox: bboxDeCentros((geocercasIA || []).map((g) => g?.centro).filter(Boolean)),
      });
      if (!propuesta.valido) {
        throw new Error(propuesta.errores.join(' ') || 'La IA no devolvió un polígono válido.');
      }
      onPropuestaIA({
        nombre: propuesta.nombre,
        puntos: propuesta.puntos,
        advertencia: propuesta.advertencia,
      });
      setInstruccion('');
    } catch (e) {
      setErrorIa(e?.message || 'No se pudo proponer la geocerca.');
    } finally {
      setProponiendoIa(false);
    }
  };

  if (!puedeEditar) return null;

  if (!editando) {
    return (
      <div className="px-4 sm:px-5 pb-3">
        <button
          type="button"
          onClick={() => onModo('editar')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
        >
          <Pencil size={14} />
          Editar geocercas
        </button>
      </div>
    );
  }

  const dibujando = modo === 'dibujo';
  const puedeCrear = dibujo.length >= 3 && nombre.trim().length > 0;

  return (
    <div className="px-4 sm:px-5 pb-3">
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900">
            <Pencil size={14} />
            Editando geocercas
          </span>
          <span className="text-[11px] text-amber-800/80">
            {dibujando
              ? `Nueva geocerca · ${dibujo.length} punto${dibujo.length === 1 ? '' : 's'}`
              : seleccion
                ? `· ${seleccion.nombre} · ${cantidadVertices} vértices`
                : '· elige un polígono en el mapa'}
          </span>
          <button
            type="button"
            onClick={onSalir}
            className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            <X size={13} /> Salir
          </button>
        </div>

        {dibujando ? (
          <>
            <label className="mt-2.5 block text-[11px] font-semibold text-amber-900">
              Nombre de la geocerca nueva
              <input
                type="text"
                value={nombre}
                onChange={(event) => onNombre(event.target.value)}
                placeholder="p. ej. Medano mejorada"
                className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-normal text-slate-700 outline-none focus:border-amber-600"
                aria-label="Nombre de la geocerca nueva"
              />
            </label>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onCrear}
                disabled={!puedeCrear || guardando}
                className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-forest-dark disabled:opacity-50"
              >
                {guardando ? <LoaderCircle size={13} className="animate-spin" /> : <Save size={13} />}
                Crear geocerca{dibujo.length >= 3 ? ` (${dibujo.length} puntos)` : ''}
              </button>
              <button
                type="button"
                onClick={onCancelarDibujo}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
              >
                <X size={13} /> Cancelar dibujo
              </button>
              <span className="text-[11px] text-amber-800/80">{PISTA.dibujo}</span>
            </div>
          </>
        ) : (
          <>
            <div className="mt-2.5 flex flex-wrap items-end gap-2">
              <label className="min-w-[180px] flex-1 text-[11px] font-semibold text-amber-900">
                Nombre
                <input
                  type="text"
                  value={nombre}
                  onChange={(event) => onNombre(event.target.value)}
                  disabled={!seleccion}
                  className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-normal text-slate-700 outline-none focus:border-amber-600 disabled:bg-slate-50 disabled:text-slate-400"
                  aria-label="Nombre de la geocerca"
                />
              </label>
              <button
                type="button"
                onClick={onGuardar}
                disabled={!seleccion || !sucio || guardando}
                className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-forest-dark disabled:opacity-50"
              >
                {guardando ? <LoaderCircle size={13} className="animate-spin" /> : <Save size={13} />}
                Guardar
              </button>
              <button
                type="button"
                onClick={onDescartar}
                disabled={!sucio || guardando}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <Undo2 size={13} /> Descartar
              </button>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <ToolButton
                activo={modo === 'mover'}
                onClick={() => onModo('mover')}
                disabled={!seleccion}
                title="Mover vértices"
              >
                <Move size={13} /> Mover
              </ToolButton>
              <ToolButton
                activo={modo === 'insertar'}
                onClick={() => onModo('insertar')}
                disabled={!seleccion}
                title="Agregar un vértice"
              >
                <Plus size={13} /> Insertar punto
              </ToolButton>
              <ToolButton
                activo={modo === 'quitar'}
                onClick={() => onModo('quitar')}
                disabled={!seleccion}
                title="Quitar un vértice"
              >
                <Minus size={13} /> Quitar punto
              </ToolButton>
              <ToolButton
                onClick={onRellenar}
                disabled={!seleccion || guardando}
                title="Rellena los huecos del polígono (anillos interiores) y limpia puntos muy cercanos"
              >
                <Droplet size={13} /> Rellenar hueco
              </ToolButton>
              <ToolButton onClick={onDibujar} title="Dibujar una geocerca nueva en el mapa">
                <Pencil size={13} /> Dibujar nueva
              </ToolButton>
              {puedeEliminar ? (
                <ToolButton
                  onClick={onEliminar}
                  disabled={!seleccion || eliminando}
                  activo={confirmarEliminar}
                  title="Eliminar la geocerca seleccionada (solo administradores)"
                >
                  {eliminando ? <LoaderCircle size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  {confirmarEliminar ? '¿Seguro? Pulsa otra vez' : 'Eliminar'}
                </ToolButton>
              ) : null}
            </div>

            {/* Crear por instrucción con IA: propone el polígono, lo guardas tú. */}
            {onPropuestaIA ? (
              <div className="mt-2.5 rounded-xl border border-dashed border-amber-300 bg-white/70 p-2.5">
                <label className="block text-[11px] font-semibold text-amber-900">
                  ✨ Crear por instrucción (IA)
                  <input
                    type="text"
                    value={instruccion}
                    onChange={(event) => {
                      setInstruccion(event.target.value);
                      setErrorIa('');
                    }}
                    placeholder='p. ej. "un rectángulo de 200 m alrededor de la bodega de Chongoyape"'
                    className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-normal text-slate-700 outline-none focus:border-amber-600"
                    aria-label="Instrucción para la IA"
                  />
                </label>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={proponerConIa}
                    disabled={proponiendoIa || instruccion.trim().length < 4}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-forest-dark disabled:opacity-50"
                  >
                    {proponiendoIa ? <LoaderCircle size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    {proponiendoIa ? 'Proponiendo…' : 'Proponer geocerca'}
                  </button>
                  <span className="text-[11px] text-amber-800/80">
                    La IA solo propone: el polígono entra como borrador y lo guardas tú con "Crear geocerca".
                  </span>
                </div>
                {errorIa ? (
                  <p role="alert" className="mt-1.5 text-[11px] text-red-600">
                    {errorIa}
                  </p>
                ) : null}
              </div>
            ) : null}

            <p className="mt-2 text-[11px] text-amber-800/80">
              {modo === 'mover' || modo === 'insertar' || modo === 'quitar'
                ? PISTA[modo]
                : 'Elige una herramienta para editar el polígono seleccionado.'}
              {modo === 'mover' ? ' Los cambios se aplican al pulsar Guardar.' : ''}
            </p>
          </>
        )}

        <Mensaje mensaje={mensaje} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Puntos arrastrables + clics del mapa. Va DENTRO de <MapContainer>.
 * ------------------------------------------------------------------------- */
export function GeocercaVertexLayer({
  modo,
  geometria,
  dibujo,
  onMover,
  onInsertar,
  onQuitar,
  onPuntoDibujo,
}) {
  // El clic del mapa solo se usa para insertar puntos y para dibujar.
  useMapEvents({
    click: (event) => {
      if (modo === 'insertar') {
        onInsertar?.([event.latlng.lng, event.latlng.lat]);
      } else if (modo === 'dibujo') {
        onPuntoDibujo?.([event.latlng.lat, event.latlng.lng]);
      }
    },
  });

  const vertices = useMemo(
    () => (modo === 'dibujo' ? [] : listarVertices(geometria)),
    [geometria, modo],
  );

  const dibujando = modo === 'dibujo';

  return (
    <>
      {dibujando && dibujo.length ? (
        <>
          {dibujo.length >= 3 ? (
            <Polygon
              positions={dibujo}
              pathOptions={{
                color: '#B45309',
                weight: 2,
                dashArray: '6 4',
                fillColor: '#F59E0B',
                fillOpacity: 0.12,
              }}
            />
          ) : (
            <Polyline positions={dibujo} pathOptions={{ color: '#B45309', weight: 2, dashArray: '6 4' }} />
          )}
          {dibujo.map((punto, index) => (
            <CircleMarker
              key={`dibujo-${index}`}
              center={punto}
              radius={index === 0 ? 5 : 4}
              pathOptions={{ color: '#FFFFFF', weight: 1.5, fillColor: '#B45309', fillOpacity: 1 }}
            />
          ))}
        </>
      ) : null}

      {!dibujando
        ? vertices.map((vertice) => (
            <Marker
              key={`${vertice.parte}-${vertice.anillo}-${vertice.indice}`}
              position={[vertice.punto[1], vertice.punto[0]]}
              draggable={modo === 'mover'}
              // En modo "insertar" el punto no intercepta el clic: ese clic
              // debe llegar al mapa para insertar sobre el borde.
              interactive={modo !== 'insertar'}
              icon={vertexIcon(modo)}
              eventHandlers={{
                dragend: (event) => {
                  const latlng = event.target.getLatLng();
                  onMover?.(vertice.parte, vertice.anillo, vertice.indice, [latlng.lng, latlng.lat]);
                },
                click: () => {
                  if (modo === 'quitar') onQuitar?.(vertice.parte, vertice.anillo, vertice.indice);
                },
              }}
            />
          ))
        : null}
    </>
  );
}

export default GeocercaEditorPanel;
