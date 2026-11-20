import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  MapPinned,
  Pencil,
  RefreshCw,
  Save,
  Truck,
  Upload,
  Users,
  UsersRound,
  X,
} from 'lucide-react';

import PosicionesImport from './PosicionesImport';

import { supabase } from '../../../lib/supabase';
import { normalizarPlaca } from '../../../lib/agrotrackGrupos';
import { cargarGruposUnidades, guardarGrupoUnidad } from '../../../lib/agrotrackGrupos';
import {
  listarGeocercas,
  importarGeocercasZip,
  guardarGeocerca,
  quitarGeocerca,
} from '../../../lib/agrotrackGeocercas';

const TABS = [
  { id: 'maquinas', label: 'Máquinas / Unidades', Icon: Truck },
  { id: 'geocercas', label: 'Geocercas', Icon: MapPinned },
  { id: 'choferes', label: 'Choferes', Icon: Users },
  { id: 'grupos', label: 'Grupos', Icon: UsersRound },
];

const ESTADOS_OPERATIVOS = ['operativo', 'mantenimiento', 'fuera_servicio'];
const ESTADOS_MOVIMIENTO = ['en_ruta', 'detenido', 'sin_conexion'];

const MAQUINA_VACIA = {
  placa: '',
  area: '',
  grupo: '',
  conductor_id: '',
  marca: '',
  modelo: '',
  tipo: '',
  anio: '',
  capacidad_tanque_gal: '',
  consumo_estimado_gal_h: '',
  estado_operativo: 'operativo',
  estado_movimiento: 'sin_conexion',
  activo: true,
};

const CHOFER_VACIO = {
  nombre: '',
  telefono: '',
  licencia_numero: '',
  licencia_categoria: '',
  licencia_vence: '',
  tarjeta_rfid: '',
  activo: true,
};

const detalle = (error) => String(error?.message || error || 'Error desconocido');
const numero = (valor) => (valor === '' || valor == null ? null : Number(valor));
const texto = (valor) => String(valor ?? '').trim() || null;

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] text-slate-800 outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/20 placeholder:text-slate-400';
const labelCls = 'block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1';
const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-lg bg-forest px-3 py-2 text-[11px] font-bold text-white transition hover:bg-forest/90 disabled:opacity-50';
const btnGhost =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50';
const tablaCls = 'w-full border-collapse text-[11px]';
const thCls = 'border-b border-slate-200 px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-500';
const tdCls = 'border-b border-slate-100 px-2 py-2 align-middle text-slate-700';

function Campo({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

function Aviso({ tipo = 'info', children }) {
  const estilo =
    tipo === 'error'
      ? 'border-red-200 bg-red-50 text-red-800'
      : tipo === 'ok'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : 'border-amber-200 bg-amber-50 text-amber-800';
  return (
    <p className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] leading-snug ${estilo}`}>
      <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{children}</span>
    </p>
  );
}

function Estado({ ok, textoOk = 'Listo', textoNo = 'Pendiente' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        ok
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-slate-50 text-slate-500'
      }`}
    >
      {ok ? <Check size={10} className="mr-1" /> : null}
      {ok ? textoOk : textoNo}
    </span>
  );
}

/**
 * Configuración real de AgroTrack.
 * Máquinas y choferes: tablas con RLS. Geocercas: librería existente.
 * Grupos: RPC security definer `agrotrack_guardar_grupo_unidad`.
 */
export default function ConfiguracionPrincipal({ empresaId, userId, puedePosiciones = true }) {
  const [tab, setTab] = useState('maquinas');
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const [maquinas, setMaquinas] = useState([]);
  const [choferes, setChoferes] = useState([]);
  const [geocercas, setGeocercas] = useState([]);
  const [grupos, setGrupos] = useState({});
  const [gruposDisponibles, setGruposDisponibles] = useState(false);

  const [maquina, setMaquina] = useState(MAQUINA_VACIA);
  const [editandoMaquina, setEditandoMaquina] = useState(null);
  const [chofer, setChofer] = useState(CHOFER_VACIO);
  const [editandoChofer, setEditandoChofer] = useState(null);

  const [archivoZip, setArchivoZip] = useState(null);
  const [importando, setImportando] = useState(false);
  const [resumenImport, setResumenImport] = useState(null);
  const [filtroGeo, setFiltroGeo] = useState('');
  const [geoEdit, setGeoEdit] = useState({ id: null, nombre: '' });

  const [nombreGrupo, setNombreGrupo] = useState('');
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [cambiosGrupo, setCambiosGrupo] = useState({});
  const [filtroPlacas, setFiltroPlacas] = useState('');

  const cargarTodo = useCallback(async () => {
    if (!empresaId) return;
    setCargando(true);
    setError('');
    const fallos = [];

    try {
      const { data, error: e } = await supabase
        .from('agrotrack_vehiculos')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('placa', { ascending: true });
      if (e) throw e;
      setMaquinas(data || []);
    } catch (e) {
      fallos.push(`Máquinas: ${detalle(e)}`);
    }

    try {
      const { data, error: e } = await supabase
        .from('agrotrack_conductores')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nombre', { ascending: true });
      if (e) throw e;
      setChoferes(data || []);
    } catch (e) {
      fallos.push(`Choferes: ${detalle(e)}`);
    }

    try {
      setGeocercas(await listarGeocercas(empresaId));
    } catch (e) {
      fallos.push(`Geocercas: ${detalle(e)}`);
    }

    try {
      const resultado = await cargarGruposUnidades(empresaId);
      setGrupos(resultado.grupos || {});
      setGruposDisponibles(Boolean(resultado.disponible));
      if (resultado.aviso && !resultado.disponible) fallos.push(`Grupos: ${resultado.aviso}`);
    } catch (e) {
      fallos.push(`Grupos: ${detalle(e)}`);
    }

    if (fallos.length) setError(fallos.join(' · '));
    setCargando(false);
  }, [empresaId]);

  useEffect(() => {
    cargarTodo();
  }, [cargarTodo]);

  const placas = useMemo(() => {
    const conjunto = new Set(Object.keys(grupos));
    maquinas.forEach((m) => m?.placa && conjunto.add(String(m.placa).trim()));
    return [...conjunto].filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'));
  }, [grupos, maquinas]);

  const geocercasFiltradas = useMemo(() => {
    const q = filtroGeo.trim().toLowerCase();
    if (!q) return geocercas;
    return geocercas.filter((g) =>
      `${g.nombre || ''} ${g.division || ''} ${g.distrito || ''}`.toLowerCase().includes(q),
    );
  }, [geocercas, filtroGeo]);

  const placasFiltradas = useMemo(() => {
    const q = filtroPlacas.trim().toLowerCase();
    return q ? placas.filter((p) => p.toLowerCase().includes(q)) : placas;
  }, [placas, filtroPlacas]);

  const avisar = (mensaje) => {
    setAviso(mensaje);
    setError('');
  };

  /* ------------------------------ Máquinas ------------------------------ */

  const guardarMaquina = async (evento) => {
    evento.preventDefault();
    const placa = normalizarPlaca(maquina.placa);
    if (!placa) {
      setError('La placa es obligatoria.');
      return;
    }
    setGuardando(true);
    setError('');
    setAviso('');
    try {
      const fila = {
        empresa_id: empresaId,
        placa,
        area: texto(maquina.area),
        grupo: texto(maquina.grupo),
        conductor_id: maquina.conductor_id || null,
        marca: texto(maquina.marca),
        modelo: texto(maquina.modelo),
        tipo: texto(maquina.tipo),
        anio: numero(maquina.anio),
        capacidad_tanque_gal: numero(maquina.capacidad_tanque_gal),
        consumo_estimado_gal_h: numero(maquina.consumo_estimado_gal_h),
        estado_operativo: maquina.estado_operativo,
        estado_movimiento: maquina.estado_movimiento,
        activo: maquina.activo,
        updated_at: new Date().toISOString(),
      };
      const { error: e } = await supabase
        .from('agrotrack_vehiculos')
        .upsert(fila, { onConflict: 'empresa_id,placa' });
      if (e) throw e;
      setMaquina(MAQUINA_VACIA);
      setEditandoMaquina(null);
      avisar(`Unidad ${placa} guardada en el padrón.`);
      await cargarTodo();
    } catch (e) {
      setError(detalle(e));
    } finally {
      setGuardando(false);
    }
  };

  const editarMaquina = (fila) => {
    setMaquina({
      placa: fila.placa || '',
      area: fila.area || '',
      grupo: fila.grupo || '',
      conductor_id: fila.conductor_id || '',
      marca: fila.marca || '',
      modelo: fila.modelo || '',
      tipo: fila.tipo || '',
      anio: fila.anio == null ? '' : String(fila.anio),
      capacidad_tanque_gal: fila.capacidad_tanque_gal == null ? '' : String(fila.capacidad_tanque_gal),
      consumo_estimado_gal_h:
        fila.consumo_estimado_gal_h == null ? '' : String(fila.consumo_estimado_gal_h),
      estado_operativo: fila.estado_operativo || 'operativo',
      estado_movimiento: fila.estado_movimiento || 'sin_conexion',
      activo: fila.activo !== false,
    });
    setEditandoMaquina(fila.id || fila.placa);
    setError('');
    setAviso('');
  };

  const alternarMaquina = async (fila) => {
    setGuardando(true);
    try {
      const { error: e } = await supabase
        .from('agrotrack_vehiculos')
        .update({ activo: fila.activo === false, updated_at: new Date().toISOString() })
        .eq('id', fila.id);
      if (e) throw e;
      avisar(`Unidad ${fila.placa} ${fila.activo === false ? 'activada' : 'desactivada'}.`);
      await cargarTodo();
    } catch (e) {
      setError(detalle(e));
    } finally {
      setGuardando(false);
    }
  };

  /* ------------------------------ Choferes ------------------------------ */

  const guardarChofer = async (evento) => {
    evento.preventDefault();
    const nombre = texto(chofer.nombre);
    if (!nombre) {
      setError('El nombre del chofer es obligatorio.');
      return;
    }
    setGuardando(true);
    setError('');
    setAviso('');
    try {
      const fila = {
        empresa_id: empresaId,
        nombre,
        telefono: texto(chofer.telefono),
        licencia_numero: texto(chofer.licencia_numero),
        licencia_categoria: texto(chofer.licencia_categoria),
        licencia_vence: chofer.licencia_vence || null,
        tarjeta_rfid: texto(chofer.tarjeta_rfid),
        activo: chofer.activo,
        updated_at: new Date().toISOString(),
      };
      const consulta = supabase.from('agrotrack_conductores');
      const { error: e } = editandoChofer
        ? await consulta.update(fila).eq('id', editandoChofer)
        : await consulta.insert(fila);
      if (e) throw e;
      setChofer(CHOFER_VACIO);
      setEditandoChofer(null);
      avisar(`Chofer ${nombre} guardado.`);
      await cargarTodo();
    } catch (e) {
      setError(detalle(e));
    } finally {
      setGuardando(false);
    }
  };

  const editarChoferFila = (fila) => {
    setChofer({
      nombre: fila.nombre || '',
      telefono: fila.telefono || '',
      licencia_numero: fila.licencia_numero || '',
      licencia_categoria: fila.licencia_categoria || '',
      licencia_vence: fila.licencia_vence || '',
      tarjeta_rfid: fila.tarjeta_rfid || '',
      activo: fila.activo !== false,
    });
    setEditandoChofer(fila.id);
  };

  const alternarChofer = async (fila) => {
    setGuardando(true);
    try {
      const { error: e } = await supabase
        .from('agrotrack_conductores')
        .update({ activo: fila.activo === false, updated_at: new Date().toISOString() })
        .eq('id', fila.id);
      if (e) throw e;
      avisar(`Chofer ${fila.nombre} ${fila.activo === false ? 'activado' : 'desactivado'}.`);
      await cargarTodo();
    } catch (e) {
      setError(detalle(e));
    } finally {
      setGuardando(false);
    }
  };

  /* ----------------------------- Geocercas ------------------------------ */

  const importarZip = async () => {
    if (!archivoZip) {
      setError('Selecciona un ZIP con las capas linderos, oficinas o distritos.');
      return;
    }
    if (!userId) {
      setError('No hay sesión iniciada; no se puede importar.');
      return;
    }
    setImportando(true);
    setError('');
    setAviso('');
    setResumenImport(null);
    try {
      const resumen = await importarGeocercasZip(archivoZip, empresaId, userId);
      setResumenImport(resumen);
      avisar(`Importación terminada: ${resumen.guardadas || 0} guardadas, ${resumen.omitidas || 0} omitidas.`);
      await cargarTodo();
    } catch (e) {
      setError(detalle(e));
    } finally {
      setImportando(false);
      setArchivoZip(null);
    }
  };

  const guardarNombreGeo = async (geocerca) => {
    const nombre = texto(geoEdit.nombre);
    if (!nombre || nombre === geocerca.nombre) {
      setGeoEdit({ id: null, nombre: '' });
      return;
    }
    setGuardando(true);
    try {
      await guardarGeocerca(empresaId, { id: geocerca.id, nombre });
      setGeoEdit({ id: null, nombre: '' });
      avisar(`Geocerca renombrada a «${nombre}».`);
      await cargarTodo();
    } catch (e) {
      setError(detalle(e));
    } finally {
      setGuardando(false);
    }
  };

  const quitarGeo = async (geocerca) => {
    if (!window.confirm(`¿Quitar la geocerca «${geocerca.nombre}»? Esta acción no se puede deshacer.`)) return;
    setGuardando(true);
    try {
      await quitarGeocerca(empresaId, geocerca.id);
      avisar(`Geocerca «${geocerca.nombre}» quitada.`);
      await cargarTodo();
    } catch (e) {
      setError(detalle(e));
    } finally {
      setGuardando(false);
    }
  };

  /* ------------------------------- Grupos ------------------------------- */

  const valorGrupo = (placa) => cambiosGrupo[placa] ?? grupos[placa] ?? '';

  const guardarGrupoFila = async (placa) => {
    setGuardando(true);
    setError('');
    try {
      await guardarGrupoUnidad(empresaId, placa, valorGrupo(placa));
      avisar(`Grupo de ${placa} actualizado.`);
      await cargarTodo();
    } catch (e) {
      setError(detalle(e));
    } finally {
      setGuardando(false);
    }
  };

  const asignarGrupoMasivo = async () => {
    const grupo = texto(nombreGrupo);
    if (!grupo) {
      setError('Escribe el nombre del grupo para asignar.');
      return;
    }
    if (!seleccionadas.length) {
      setError('Selecciona al menos una unidad.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      for (const placa of seleccionadas) {
        await guardarGrupoUnidad(empresaId, placa, grupo);
      }
      avisar(`Grupo «${grupo}» asignado a ${seleccionadas.length} unidad(es).`);
      setSeleccionadas([]);
      setNombreGrupo('');
      await cargarTodo();
    } catch (e) {
      setError(detalle(e));
    } finally {
      setGuardando(false);
    }
  };

  const alternarSeleccion = (placa) => {
    setSeleccionadas((prev) =>
      prev.includes(placa) ? prev.filter((p) => p !== placa) : [...prev, placa],
    );
  };

  /* -------------------------------- Render ------------------------------ */

  const renderMaquinas = () => (
    <div className="space-y-3">
      <form onSubmit={guardarMaquina} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-slate-800">
            {editandoMaquina ? 'Editar unidad' : 'Cargar unidad al padrón'}
          </h4>
          {editandoMaquina ? (
            <button type="button" className={btnGhost} onClick={() => { setMaquina(MAQUINA_VACIA); setEditandoMaquina(null); }}>
              <X size={12} /> Cancelar
            </button>
          ) : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Campo label="Placa">
            <input
              className={inputCls}
              value={maquina.placa}
              onChange={(e) => setMaquina({ ...maquina, placa: e.target.value })}
              placeholder="Ej. BPH-767"
              readOnly={Boolean(editandoMaquina)}
              required
            />
          </Campo>
          <Campo label="Área / descripción">
            <input className={inputCls} value={maquina.area} onChange={(e) => setMaquina({ ...maquina, area: e.target.value })} />
          </Campo>
          <Campo label="Grupo">
            <input className={inputCls} value={maquina.grupo} onChange={(e) => setMaquina({ ...maquina, grupo: e.target.value })} />
          </Campo>
          <Campo label="Chofer asignado">
            <select
              className={inputCls}
              value={maquina.conductor_id}
              onChange={(e) => setMaquina({ ...maquina, conductor_id: e.target.value })}
            >
              <option value="">Sin asignar</option>
              {choferes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Marca">
            <input className={inputCls} value={maquina.marca} onChange={(e) => setMaquina({ ...maquina, marca: e.target.value })} />
          </Campo>
          <Campo label="Modelo">
            <input className={inputCls} value={maquina.modelo} onChange={(e) => setMaquina({ ...maquina, modelo: e.target.value })} />
          </Campo>
          <Campo label="Tipo">
            <input className={inputCls} value={maquina.tipo} onChange={(e) => setMaquina({ ...maquina, tipo: e.target.value })} />
          </Campo>
          <Campo label="Año">
            <input type="number" min="1950" max="2100" className={inputCls} value={maquina.anio} onChange={(e) => setMaquina({ ...maquina, anio: e.target.value })} />
          </Campo>
          <Campo label="Capacidad tanque (gal)">
            <input type="number" min="0" step="0.01" className={inputCls} value={maquina.capacidad_tanque_gal} onChange={(e) => setMaquina({ ...maquina, capacidad_tanque_gal: e.target.value })} />
          </Campo>
          <Campo label="Consumo estimado (gal/h)">
            <input type="number" min="0" step="0.01" className={inputCls} value={maquina.consumo_estimado_gal_h} onChange={(e) => setMaquina({ ...maquina, consumo_estimado_gal_h: e.target.value })} />
          </Campo>
          <Campo label="Estado operativo">
            <select className={inputCls} value={maquina.estado_operativo} onChange={(e) => setMaquina({ ...maquina, estado_operativo: e.target.value })}>
              {ESTADOS_OPERATIVOS.map((valor) => <option key={valor} value={valor}>{valor.replaceAll('_', ' ')}</option>)}
            </select>
          </Campo>
          <Campo label="Estado movimiento">
            <select className={inputCls} value={maquina.estado_movimiento} onChange={(e) => setMaquina({ ...maquina, estado_movimiento: e.target.value })}>
              {ESTADOS_MOVIMIENTO.map((valor) => <option key={valor} value={valor}>{valor.replaceAll('_', ' ')}</option>)}
            </select>
          </Campo>
        </div>
        <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-600">
          <input
            type="checkbox"
            checked={maquina.activo}
            onChange={(e) => setMaquina({ ...maquina, activo: e.target.checked })}
            className="h-3.5 w-3.5 accent-emerald-700"
          />
          Unidad activa
        </label>
        <div className="mt-3">
          <button type="submit" className={btnPrimary} disabled={guardando}>
            {guardando ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
            {editandoMaquina ? 'Guardar cambios' : 'Guardar unidad'}
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className={tablaCls}>
          <thead>
            <tr>
              <th className={thCls}>Placa</th>
              <th className={thCls}>Área</th>
              <th className={thCls}>Grupo</th>
              <th className={thCls}>Chofer</th>
              <th className={thCls}>Estado</th>
              <th className={thCls}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {maquinas.length === 0 ? (
              <tr><td colSpan={6} className={tdCls}>No hay unidades en el padrón de esta empresa.</td></tr>
            ) : maquinas.map((m) => (
              <tr key={m.id || m.placa}>
                <td className={`${tdCls} font-semibold`}>{m.placa}</td>
                <td className={tdCls}>{m.area || '—'}</td>
                <td className={tdCls}>{m.grupo || '—'}</td>
                <td className={tdCls}>{choferes.find((c) => c.id === m.conductor_id)?.nombre || '—'}</td>
                <td className={tdCls}>
                  <div className="flex flex-wrap items-center gap-1">
                    <span>{m.estado_operativo?.replaceAll('_', ' ')}</span>
                    <Estado ok={m.activo !== false} textoOk="Activa" textoNo="Inactiva" />
                  </div>
                </td>
                <td className={tdCls}>
                  <div className="flex flex-wrap gap-1">
                    <button type="button" className={btnGhost} onClick={() => editarMaquina(m)}>
                      <Pencil size={11} /> Editar
                    </button>
                    <button type="button" className={btnGhost} onClick={() => alternarMaquina(m)} disabled={guardando}>
                      {m.activo === false ? 'Activar' : 'Desactivar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderGeocercas = () => (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <h4 className="mb-2 text-xs font-bold text-slate-800">Cargar geocercas desde Zonar (ZIP / Shapefile)</h4>
        <p className="mb-3 text-[11px] leading-snug text-slate-500">
          Se aceptan las capas <b>linderos</b>, <b>oficinas</b> y <b>distritos</b> (.shp, .shx, .dbf, .prj y .cpg),
          incluidas dentro de ZIP y subcarpetas. La capa <b>divisiones</b> se ignora. Los linderos que ya existen no se sobrescriben.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept=".zip"
            onChange={(e) => setArchivoZip(e.target.files?.[0] || null)}
            className="block w-full max-w-xs text-[11px] text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-200 file:px-3 file:py-2 file:text-[11px] file:font-semibold file:text-slate-700"
          />
          <button type="button" className={btnPrimary} onClick={importarZip} disabled={importando || !archivoZip}>
            {importando ? <RefreshCw size={13} className="animate-spin" /> : <Upload size={13} />}
            {importando ? 'Importando…' : 'Cargar geocercas'}
          </button>
        </div>
        {resumenImport ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {resumenImport.grupos?.map((g) => (
              <div key={g.id} className="rounded-lg border border-slate-200 bg-white p-2 text-[11px]">
                <p className="font-bold text-slate-800">{g.etiqueta}</p>
                <p className="text-slate-500">Capa: {g.capa}</p>
                <p className="text-emerald-700">{g.guardadas} guardadas · {g.omitidas} omitidas</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <h4 className="mb-2 text-xs font-bold text-slate-800">Cargar reporte de unidades (ZIP / Excel)</h4>
        <p className="mb-3 text-[11px] leading-snug text-slate-500">
          ZIP o Excel del “Reporte por placa” de Zonar (un punto GPS cada 2 minutos por unidad).
        </p>
        {puedePosiciones ? (
          <PosicionesImport empresaId={empresaId} userId={userId} />
        ) : (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            Solo administrador o ingeniero puede cargar el reporte de unidades.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-slate-800">Geocercas cargadas ({geocercas.length})</h4>
          <input
            className={`${inputCls} max-w-xs`}
            placeholder="Filtrar por nombre, campo o distrito…"
            value={filtroGeo}
            onChange={(e) => setFiltroGeo(e.target.value)}
          />
        </div>
        <div className="max-h-[420px] overflow-auto">
          <table className={tablaCls}>
            <thead>
              <tr>
                <th className={thCls}>Nombre</th>
                <th className={thCls}>División</th>
                <th className={thCls}>Tipo</th>
                <th className={thCls}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {geocercasFiltradas.length === 0 ? (
                <tr><td colSpan={4} className={tdCls}>No hay geocercas para este filtro.</td></tr>
              ) : geocercasFiltradas.map((g) => (
                <tr key={g.id}>
                  <td className={tdCls}>
                    {geoEdit.id === g.id ? (
                      <input
                        className={inputCls}
                        value={geoEdit.nombre}
                        onChange={(e) => setGeoEdit({ ...geoEdit, nombre: e.target.value })}
                        autoFocus
                      />
                    ) : (
                      <span className="font-semibold">{g.nombre}</span>
                    )}
                  </td>
                  <td className={tdCls}>{g.division || '—'}</td>
                  <td className={tdCls}>{g.tipo || '—'}</td>
                  <td className={tdCls}>
                    <div className="flex flex-wrap gap-1">
                      {geoEdit.id === g.id ? (
                        <>
                          <button type="button" className={btnGhost} onClick={() => guardarNombreGeo(g)} disabled={guardando}>
                            <Save size={11} /> Guardar
                          </button>
                          <button type="button" className={btnGhost} onClick={() => setGeoEdit({ id: null, nombre: '' })}>
                            <X size={11} /> Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" className={btnGhost} onClick={() => setGeoEdit({ id: g.id, nombre: g.nombre || '' })}>
                            <Pencil size={11} /> Renombrar
                          </button>
                          <button type="button" className={btnGhost} onClick={() => quitarGeo(g)} disabled={guardando}>
                            Quitar
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderChoferes = () => (
    <div className="space-y-3">
      <form onSubmit={guardarChofer} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-slate-800">{editandoChofer ? 'Editar chofer' : 'Cargar chofer'}</h4>
          {editandoChofer ? (
            <button type="button" className={btnGhost} onClick={() => { setChofer(CHOFER_VACIO); setEditandoChofer(null); }}>
              <X size={12} /> Cancelar
            </button>
          ) : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Campo label="Nombre">
            <input className={inputCls} value={chofer.nombre} onChange={(e) => setChofer({ ...chofer, nombre: e.target.value })} required />
          </Campo>
          <Campo label="Teléfono">
            <input className={inputCls} value={chofer.telefono} onChange={(e) => setChofer({ ...chofer, telefono: e.target.value })} />
          </Campo>
          <Campo label="N° de licencia">
            <input className={inputCls} value={chofer.licencia_numero} onChange={(e) => setChofer({ ...chofer, licencia_numero: e.target.value })} />
          </Campo>
          <Campo label="Categoría">
            <input className={inputCls} value={chofer.licencia_categoria} onChange={(e) => setChofer({ ...chofer, licencia_categoria: e.target.value })} />
          </Campo>
          <Campo label="Vencimiento licencia">
            <input type="date" className={inputCls} value={chofer.licencia_vence} onChange={(e) => setChofer({ ...chofer, licencia_vence: e.target.value })} />
          </Campo>
          <Campo label="Tarjeta RFID">
            <input className={inputCls} value={chofer.tarjeta_rfid} onChange={(e) => setChofer({ ...chofer, tarjeta_rfid: e.target.value })} />
          </Campo>
        </div>
        <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-600">
          <input
            type="checkbox"
            checked={chofer.activo}
            onChange={(e) => setChofer({ ...chofer, activo: e.target.checked })}
            className="h-3.5 w-3.5 accent-emerald-700"
          />
          Chofer activo
        </label>
        <div className="mt-3">
          <button type="submit" className={btnPrimary} disabled={guardando}>
            {guardando ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
            {editandoChofer ? 'Guardar cambios' : 'Guardar chofer'}
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className={tablaCls}>
          <thead>
            <tr>
              <th className={thCls}>Nombre</th>
              <th className={thCls}>Teléfono</th>
              <th className={thCls}>Licencia</th>
              <th className={thCls}>RFID</th>
              <th className={thCls}>Estado</th>
              <th className={thCls}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {choferes.length === 0 ? (
              <tr><td colSpan={6} className={tdCls}>Todavía no hay choferes registrados en esta empresa.</td></tr>
            ) : choferes.map((c) => (
              <tr key={c.id}>
                <td className={`${tdCls} font-semibold`}>{c.nombre}</td>
                <td className={tdCls}>{c.telefono || '—'}</td>
                <td className={tdCls}>{[c.licencia_numero, c.licencia_categoria].filter(Boolean).join(' · ') || '—'}</td>
                <td className={tdCls}>{c.tarjeta_rfid || '—'}</td>
                <td className={tdCls}><Estado ok={c.activo !== false} textoOk="Activo" textoNo="Inactivo" /></td>
                <td className={tdCls}>
                  <div className="flex flex-wrap gap-1">
                    <button type="button" className={btnGhost} onClick={() => editarChoferFila(c)}>
                      <Pencil size={11} /> Editar
                    </button>
                    <button type="button" className={btnGhost} onClick={() => alternarChofer(c)} disabled={guardando}>
                      {c.activo === false ? 'Activar' : 'Desactivar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderGrupos = () => (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <h4 className="mb-2 text-xs font-bold text-slate-800">Crear grupo y asignar en bloque</h4>
        <p className="mb-3 text-[11px] leading-snug text-slate-500">
          Escribe un nombre de grupo, marca varias unidades y asígnalas. El mismo grupo queda disponible en el mapa y en los reportes.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <Campo label="Nombre del grupo" className="min-w-[180px] flex-1">
            <input
              className={inputCls}
              value={nombreGrupo}
              onChange={(e) => setNombreGrupo(e.target.value)}
              placeholder="Ej. Seguridad, Maquinaria, Motos Supervisor"
            />
          </Campo>
          <button type="button" className={btnPrimary} onClick={asignarGrupoMasivo} disabled={guardando || !seleccionadas.length}>
            {guardando ? <RefreshCw size={13} className="animate-spin" /> : <UsersRound size={13} />}
            Asignar a {seleccionadas.length || 0} unidad(es)
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-slate-800">Grupos por unidad ({placas.length})</h4>
          <input
            className={`${inputCls} max-w-xs`}
            placeholder="Filtrar placa…"
            value={filtroPlacas}
            onChange={(e) => setFiltroPlacas(e.target.value)}
          />
        </div>
        <div className="mb-2 flex gap-2">
          <button type="button" className={btnGhost} onClick={() => setSeleccionadas(placasFiltradas)}>
            Seleccionar todas las visibles
          </button>
          <button type="button" className={btnGhost} onClick={() => setSeleccionadas([])}>
            Limpiar selección
          </button>
        </div>
        <div className="max-h-[420px] overflow-auto">
          <table className={tablaCls}>
            <thead>
              <tr>
                <th className={thCls}></th>
                <th className={thCls}>Placa</th>
                <th className={thCls}>Grupo actual</th>
                <th className={thCls}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {placasFiltradas.length === 0 ? (
                <tr><td colSpan={4} className={tdCls}>No hay unidades para mostrar.</td></tr>
              ) : placasFiltradas.map((placa) => (
                <tr key={placa}>
                  <td className={tdCls}>
                    <input
                      type="checkbox"
                      checked={seleccionadas.includes(placa)}
                      onChange={() => alternarSeleccion(placa)}
                      className="h-3.5 w-3.5 accent-emerald-700"
                      aria-label={`Seleccionar ${placa}`}
                    />
                  </td>
                  <td className={`${tdCls} font-semibold`}>{placa}</td>
                  <td className={tdCls}>
                    <input
                      className={inputCls}
                      value={valorGrupo(placa)}
                      onChange={(e) => setCambiosGrupo({ ...cambiosGrupo, [placa]: e.target.value })}
                      placeholder="Sin grupo"
                    />
                  </td>
                  <td className={tdCls}>
                    <button type="button" className={btnGhost} onClick={() => guardarGrupoFila(placa)} disabled={guardando}>
                      <Save size={11} /> Guardar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <div className="flex flex-wrap gap-1">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => { setTab(id); setError(''); setAviso(''); }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                tab === id ? 'bg-forest text-white' : 'bg-slate-50 text-slate-600 hover:bg-emerald-50 hover:text-forest'
              }`}
            >
              <Icon size={13} aria-hidden="true" />
              {label}
              <Estado
                ok={id === 'geocercas' ? geocercas.length > 0 : id === 'grupos' ? gruposDisponibles : id === 'choferes' ? choferes.length > 0 : maquinas.length > 0}
                textoOk="Listo"
                textoNo="Vacío"
              />
            </button>
          ))}
        </div>
        <button type="button" className={btnGhost} onClick={cargarTodo} disabled={cargando}>
          <RefreshCw size={12} className={cargando ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      {aviso ? <Aviso tipo="ok">{aviso}</Aviso> : null}

      {tab === 'maquinas' ? renderMaquinas() : null}
      {tab === 'geocercas' ? renderGeocercas() : null}
      {tab === 'choferes' ? renderChoferes() : null}
      {tab === 'grupos' ? renderGrupos() : null}
    </div>
  );
}
