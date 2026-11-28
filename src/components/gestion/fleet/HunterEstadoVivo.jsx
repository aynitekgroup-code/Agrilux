import React, { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, MapPinned, RefreshCw, Search, Share2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { compararUnidades } from '../../../lib/agrotrackReporteFilas';
import { exportarStatusHunterExcel, geocercaHunter } from '../../../lib/hunterStatusExport';
import { agruparUnidadesHunter, filtrarUnidadesHunter, opcionesFiltrosHunter } from '../../../lib/hunterStatusFiltros';
import { estadoHunter as estado } from '../../../lib/hunterEstado';
import { imagenStatusHunter, prepararStatusCompartido } from '../../../lib/hunterCompartir';
import { ControlesFiltroUnidadGrupo } from './reportesComunes';

const COLUMNAS = ['Unidad', 'Área', 'Última posición', 'Estado', 'Velocidad', 'Geocerca', 'Dirección', 'Sincronización'];
const fecha = (valor) => valor ? new Date(valor).toLocaleString('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' }) : '—';
const normalizarBusqueda = (valor) => String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
export default function HunterEstadoVivo({ empresaId }) {
  const [filas, setFilas] = useState([]);
  const [estadoCarga, setEstadoCarga] = useState('cargando');
  const [error, setError] = useState('');
  const [ahora, setAhora] = useState(Date.now());
  const [intento, setIntento] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [mostrar, setMostrar] = useState('grupos');
  const [opcionFiltro, setOpcionFiltro] = useState('');
  const [filtroGeocerca, setFiltroGeocerca] = useState('');
  const [filtroArea, setFiltroArea] = useState('');
  const [agrupar, setAgrupar] = useState('grupo');
  const [gruposDisponibles, setGruposDisponibles] = useState(true);
  const [areasDisponibles, setAreasDisponibles] = useState(true);
  const [geocercasDisponibles, setGeocercasDisponibles] = useState(true);
  const [departamentosDisponibles, setDepartamentosDisponibles] = useState(true);
  const [errorDescarga, setErrorDescarga] = useState('');
  const [compartiendo, setCompartiendo] = useState(false);
  const [avisoCompartir, setAvisoCompartir] = useState('');
  useEffect(() => {
    if (!empresaId) return undefined;
    let activo = true;
    async function cargar(silencioso) {
      if (!silencioso) setEstadoCarga('cargando');
      try {
        const todas = [];
        const asignaciones = [];
        let disponible = true;
        for (let inicio = 0; ; inicio += 200) {
          const { data, error: e } = await supabase.from('agrotrack_hunter_grupos').select('equipo_id,grupo').eq('empresa_id', empresaId).order('equipo_id').order('grupo').range(inicio, inicio + 199);
          if (e?.code === '42P01' || e?.code === 'PGRST205') { disponible = false; break; }
          if (e) throw e;
          asignaciones.push(...(data || []));
          if ((data || []).length < 200) break;
        }
        if (activo) setGruposDisponibles(disponible);
        const gruposPorEquipo = new Map();
        for (const a of asignaciones) {
          if (!gruposPorEquipo.has(a.equipo_id)) gruposPorEquipo.set(a.equipo_id, []);
          gruposPorEquipo.get(a.equipo_id).push(a.grupo);
        }
        const areasPorEquipo = new Map();
        let areasOk = true;
        for (let inicio = 0; ; inicio += 200) {
          const { data, error: e } = await supabase.from('agrotrack_hunter_areas').select('equipo_id,area').eq('empresa_id', empresaId).order('equipo_id').range(inicio, inicio + 199);
          if (e?.code === '42P01' || e?.code === 'PGRST205') { areasOk = false; break; }
          if (e) throw e;
          for (const a of data || []) areasPorEquipo.set(a.equipo_id, a.area);
          if ((data || []).length < 200) break;
        }
        if (activo) setAreasDisponibles(areasOk);
        for (let inicio = 0; ; inicio += 200) {
          let { data, error: e } = await supabase.rpc('agrotrack_hunter_estado_geocercas', { p_empresa_id: empresaId, p_offset: inicio, p_limite: 200 });
          if (e?.code === 'PGRST202') {
            if (activo) setGeocercasDisponibles(false);
            ({ data, error: e } = await supabase.from('agrotrack_hunter_estado_vivo').select('equipo_id,unidad,fecha,velocidad_kmh,ignicion,direccion,actualizado_en').eq('empresa_id', empresaId).order('equipo_id').range(inicio, inicio + 199));
          } else if (!e && activo) setGeocercasDisponibles(true);
          if (e) throw e;
          const { data: departamentos, error: errorDepartamento } = await supabase.rpc('agrotrack_hunter_departamentos', { p_empresa_id: empresaId, p_offset: inicio, p_limite: 200 });
          if (errorDepartamento && errorDepartamento.code !== 'PGRST202') throw errorDepartamento;
          if (activo) setDepartamentosDisponibles(!errorDepartamento);
          const porEquipo = new Map((departamentos || []).map((d) => [d.equipo_id, d.departamento]));
          todas.push(...(data || []).map((f) => ({ ...f, departamento: porEquipo.get(f.equipo_id) || null, area_operativa: areasPorEquipo.get(f.equipo_id) || null, grupos_operativos: gruposPorEquipo.get(f.equipo_id) || [] })));
          if ((data || []).length < 200) break;
        }
        if (activo) { setFilas(todas); setAhora(Date.now()); setError(''); setEstadoCarga('listo'); }
      } catch (e) {
        if (activo) { setError(e?.code === '42P01' || e?.code === 'PGRST205' ? 'Ejecuta scripts/agrotrack-hunter-tiempo-real.sql en Supabase.' : e?.message || 'No se pudo consultar Hunter.'); setEstadoCarga('error'); }
      }
    }
    cargar(false);
    const timer = setInterval(() => cargar(true), 60000);
    return () => { activo = false; clearInterval(timer); };
  }, [empresaId, intento]);
  const categorias = ['En movimiento', 'Encendido / movimiento lento', 'Encendido / detenido', 'Apagado', 'Sin reporte reciente', 'Desconocido'];
  const conteos = useMemo(() => Object.fromEntries(categorias.map((c) => [c, filas.filter((f) => estado(f, ahora) === c).length])), [filas, ahora]);
  const ordenadas = useMemo(() => [...filas].sort(compararUnidades), [filas]);
  const opciones = useMemo(() => opcionesFiltrosHunter(ordenadas), [ordenadas]);
  const visibles = useMemo(() => {
    const consulta = normalizarBusqueda(busqueda.trim());
    const placa = consulta.replace(/[^a-z0-9]/g, '');
    return filtrarUnidadesHunter(ordenadas, { mostrar, opcionFiltro, filtroGeocerca, filtroArea }).filter((f) => {
      const texto = normalizarBusqueda(`${f.unidad || ''} ${f.equipo_id || ''} ${f.direccion || ''} ${f.area_operativa || ''} ${(f.grupos_operativos || []).join(' ')} ${geocercaHunter(f) || ''}`);
      const coincide = texto.includes(consulta) || (placa.length >= 3 && [f.unidad, f.equipo_id].some((v) => normalizarBusqueda(v).replace(/[^a-z0-9]/g, '').includes(placa)));
      return coincide && (filtroEstado === 'todos' || estado(f, ahora) === filtroEstado);
    });
  }, [ordenadas, ahora, busqueda, filtroEstado, mostrar, opcionFiltro, filtroGeocerca, filtroArea]);
  // Conserva el filtro visible si un refresco deja su geocerca o grupo vacío.
  const opcionesGrupo = mostrar === 'grupos' && opcionFiltro && !opciones.grupos.includes(opcionFiltro)
    ? [...opciones.grupos, opcionFiltro] : opciones.grupos;
  const opcionesGeocerca = filtroGeocerca && !opciones.geocercas.includes(filtroGeocerca)
    ? [...opciones.geocercas, filtroGeocerca] : opciones.geocercas;
  const opcionesArea = filtroArea && !opciones.areas.includes(filtroArea)
    ? [...opciones.areas, filtroArea] : opciones.areas;
  const opcionesUnidad = mostrar === 'unidades' && opcionFiltro && !opciones.unidades.some(({ valor }) => valor === opcionFiltro)
    ? [...opciones.unidades, { valor: opcionFiltro, etiqueta: opcionFiltro }] : opciones.unidades;
  const grupoSeleccionado = mostrar === 'grupos' ? opcionFiltro : '';
  const grupos = useMemo(
    () => agruparUnidadesHunter(visibles, agrupar, grupoSeleccionado),
    [visibles, agrupar, grupoSeleccionado],
  );
  const tonos = { 'En movimiento': 'bg-emerald-50 text-emerald-700 border-emerald-200', 'Encendido / movimiento lento': 'bg-amber-50 text-amber-700 border-amber-200', 'Encendido / detenido': 'bg-orange-50 text-orange-700 border-orange-200', Apagado: 'bg-slate-100 text-slate-600 border-slate-200', 'Sin reporte reciente': 'bg-rose-50 text-rose-700 border-rose-200', Desconocido: 'bg-slate-50 text-slate-500 border-slate-200' };
  async function descargar() {
    setErrorDescarga('');
    try { await exportarStatusHunterExcel(visibles, { fecha, clasificar: (f) => estado(f, ahora) }); }
    catch (e) { setErrorDescarga(e?.message || 'No se pudo generar el Excel.'); }
  }
  async function compartir() {
    setAvisoCompartir('');
    if (visibles.length > 150) { setAvisoCompartir('Aplica un filtro para compartir hasta 150 unidades por imagen.'); return; }
    setCompartiendo(true);
    try {
      const filtros = [opcionFiltro && `${mostrar === 'grupos' ? 'Grupo' : 'Unidad'}: ${opcionFiltro}`, filtroArea && `Área: ${filtroArea}`, filtroGeocerca && `Geocerca: ${filtroGeocerca}`, filtroEstado !== 'todos' && `Estado: ${filtroEstado}`, busqueda && `Búsqueda: ${busqueda}`].filter(Boolean).join(' · ');
      const reporte = prepararStatusCompartido(visibles, { fecha, clasificar: (f) => estado(f, ahora), geocerca: geocercaHunter, filtros, generado: new Date().toISOString() });
      const blob = await imagenStatusHunter(reporte);
      const archivo = new File([blob], 'agrilux-status-hunter.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [archivo] })) {
        await navigator.share({ title: 'Status de maquinaria · Hunter 360', files: [archivo] });
      } else {
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = archivo.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        setAvisoCompartir('Imagen descargada. Ábrela desde Descargas para compartirla.');
      }
    } catch (e) { if (e?.name !== 'AbortError') setAvisoCompartir('No se pudo compartir la imagen. Intenta de nuevo o usa Descargar Excel.'); }
    finally { setCompartiendo(false); }
  }
  return <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-100 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><MapPinned size={19} /></span><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-bold text-slate-900">Status de maquinaria</h2><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Hunter 360</span></div><p className="mt-0.5 text-xs text-slate-500">Última posición informada por Hunter · consulta de pantalla cada minuto</p></div></div><div className="flex gap-2"><button type="button" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50" onClick={() => setIntento((n) => n + 1)}><RefreshCw size={14} /> Actualizar</button><button type="button" disabled={estadoCarga !== 'listo' || !visibles.length} onClick={descargar} className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-900 disabled:opacity-40"><FileSpreadsheet size={14} /> Descargar Excel</button></div></div>
      {errorDescarga && <p role="alert" className="text-xs text-red-700">{errorDescarga}</p>}
      <button type="button" disabled={estadoCarga !== 'listo' || !visibles.length || compartiendo} onClick={compartir} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><Share2 size={14} />{compartiendo ? 'Preparando imagen…' : 'Compartir reporte'}</button>
      {avisoCompartir && <p role="status" className="text-xs text-slate-600">{avisoCompartir}</p>}
      {estadoCarga === 'listo' && filas.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Filtrar por estado"><button type="button" aria-pressed={filtroEstado === 'todos'} onClick={() => setFiltroEstado('todos')} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${filtroEstado === 'todos' ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-200 text-slate-600'}`}>Todas <span className="ml-1 tabular-nums">{filas.length}</span></button>{categorias.map((c) => <button type="button" key={c} aria-pressed={filtroEstado === c} onClick={() => setFiltroEstado(c)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${filtroEstado === c ? 'ring-2 ring-emerald-500 ring-offset-1' : ''} ${tonos[c]}`}>{c} <span className="ml-1 tabular-nums">{conteos[c]}</span></button>)}</div>}
      <div className="flex flex-wrap items-end gap-3">
        <ControlesFiltroUnidadGrupo
          mostrar={mostrar}
          setMostrar={(modo) => {
            if (modo === mostrar) return;
            setMostrar(modo);
            setOpcionFiltro('');
            setAgrupar((actual) => actual === 'geocerca' ? actual : modo === 'grupos' ? 'grupo' : 'ninguno');
          }}
          opcionFiltro={opcionFiltro}
          setOpcionFiltro={setOpcionFiltro}
          opcionesGrupos={opcionesGrupo}
          opcionesUnidades={opcionesUnidad}
        />
        <label className="min-w-0">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Área</span>
          <select value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)} className="min-w-[185px] max-w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">
            <option value="">Todas las áreas</option>
            {opcionesArea.map((area) => <option key={area} value={area}>{area}</option>)}
          </select>
        </label>
        <label className="min-w-0">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Geocerca</span>
          <select
            value={filtroGeocerca}
            onChange={(e) => setFiltroGeocerca(e.target.value)}
            className="min-w-[185px] max-w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">Todas las geocercas</option>
            {opcionesGeocerca.map((nombre) => <option key={nombre} value={nombre}>{nombre}</option>)}
          </select>
        </label>
        <label className="relative block w-full max-w-xs sm:w-64">
          <Search size={14} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <span className="sr-only">Buscar unidad, placa, área o geocerca</span>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar unidad, placa o área"
            className="w-full rounded-lg border border-slate-200 py-1.5 pl-9 pr-3 text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        {(opcionFiltro || filtroGeocerca || filtroArea || busqueda || filtroEstado !== 'todos') && (
          <button type="button" onClick={() => { setOpcionFiltro(''); setFiltroGeocerca(''); setFiltroArea(''); setBusqueda(''); setFiltroEstado('todos'); }} className="rounded-lg px-2 py-1.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700">
            Quitar filtros
          </button>
        )}
        <p className="pb-1.5 text-xs text-slate-500 sm:ml-auto">{visibles.length} de {filas.length} unidades · Hora Perú</p>
      </div>
      <p className="text-[11px] text-slate-500">Clasificación orientativa de la última posición: detenido = 0 km/h; movimiento lento = más de 0 hasta 5 km/h; movimiento = más de 5 km/h. Estar detenido o lento no determina si la máquina está trabajando. Sin reporte reciente: posición mayor a 30 min o fecha no válida. No equivale al historial de Hunter.</p>
      {!geocercasDisponibles && <p role="status" className="text-xs text-amber-700">Para mostrar geocercas, ejecuta scripts/agrotrack-hunter-geocercas.sql en Supabase.</p>}
      {!departamentosDisponibles && <p role="status" className="text-xs text-amber-700">Para mostrar departamentos, ejecuta scripts/agrotrack-departamentos-peru.sql en Supabase.</p>}
      {!gruposDisponibles && <p role="status" className="text-xs text-amber-700">Para usar grupos Hunter, ejecuta scripts/agrotrack-hunter-grupos.sql en Supabase.</p>}
      {!areasDisponibles && <p role="status" className="text-xs text-amber-700">Para mostrar áreas Hunter, ejecuta scripts/agrotrack-hunter-grupos.sql en Supabase.</p>}
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <label className="inline-flex items-center gap-2">
          Agrupar por
          <select className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700" value={agrupar} onChange={(e) => setAgrupar(e.target.value)}>
            <option value="ninguno">Sin agrupar</option>
            <option value="grupo">Grupo operativo</option>
            <option value="geocerca">Geocerca</option>
          </select>
        </label>
        <span>Las unidades sin grupo operativo aparecen como «Sin grupo asignado». Si no hay geocerca operativa, se muestra el departamento.</span>
      </div>
    </div>
    {estadoCarga === 'cargando' && <p role="status" className="p-5 text-sm text-slate-500">Cargando unidades Hunter…</p>}
    {estadoCarga === 'error' && <p role="alert" className="p-5 text-sm text-red-700">{error}</p>}
    {estadoCarga === 'listo' && !filas.length && <p className="p-5 text-sm text-slate-500">No hay posiciones Hunter guardadas para esta empresa.</p>}
    {estadoCarga === 'listo' && filas.length > 0 && !visibles.length && <p className="p-5 text-sm text-slate-500">Ninguna unidad coincide con los filtros.</p>}
    {estadoCarga === 'listo' && visibles.length > 0 && (
      <div className="max-h-[65vh] overflow-auto">
        <div className="space-y-3 p-3 lg:hidden">
          {grupos.map(([grupo, unidades]) => <section key={grupo} className="space-y-2">
            {agrupar !== 'ninguno' && <h3 className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900">{grupo} · {unidades.length} unidades</h3>}
            <div className="grid gap-2 sm:grid-cols-2">{unidades.map((f) => { const categoria = estado(f, ahora); return <article key={f.equipo_id} className="min-w-0 rounded-lg border border-slate-200 p-3 text-xs text-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-slate-900">{f.unidad || f.equipo_id}</strong><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${tonos[categoria]}`}>{categoria}</span></div>
              <p className="mt-1">Área: {f.area_operativa || 'Sin área asignada'}</p><p>Geocerca: {geocercaHunter(f)}</p><p>Velocidad: {f.velocidad_kmh == null ? '—' : `${f.velocidad_kmh} km/h`}</p><p>Última posición: {fecha(f.fecha)} (Perú)</p><p className="break-words">Dirección: {f.direccion || '—'}</p><p>Sincronización: {fecha(f.actualizado_en)}</p>
            </article>; })}</div>
          </section>)}
        </div>
        <table className="hidden w-full text-left text-xs text-slate-600 lg:table">
          <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400 shadow-sm">
            <tr>
              {COLUMNAS.map((titulo) => <th key={titulo} scope="col" className="whitespace-nowrap px-3 py-2.5 font-bold">{titulo}</th>)}
            </tr>
          </thead>
          {grupos.map(([grupo, unidades]) => (
            <tbody key={grupo}>
              {agrupar !== 'ninguno' && (
                <tr className={agrupar === 'geocerca' ? 'bg-slate-100' : 'bg-emerald-50/70'}>
                  <th scope="rowgroup" colSpan={COLUMNAS.length} className={`px-3 py-2 text-left font-semibold ${agrupar === 'geocerca' ? 'text-slate-700' : 'text-forest'}`}>
                    {grupo} · {unidades.length} {unidades.length === 1 ? 'unidad' : 'unidades'}
                  </th>
                </tr>
              )}
              {unidades.map((f) => {
                const categoria = estado(f, ahora);
                return (
                  <tr className="border-t border-slate-100 hover:bg-slate-50/70" key={f.equipo_id}>
                    <td className="whitespace-nowrap px-3 py-1.5 font-bold text-slate-800">{f.unidad || f.equipo_id}</td>
                    <td className="whitespace-nowrap px-3 py-1.5">{f.area_operativa || 'Sin área asignada'}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{fecha(f.fecha)}</td>
                    <td className="whitespace-nowrap px-3 py-1.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tonos[categoria]}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />{categoria}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{f.velocidad_kmh == null ? '—' : `${f.velocidad_kmh} km/h`}</td>
                    <td className="whitespace-nowrap px-3 py-1.5">{geocercaHunter(f)}</td>
                    <td className="min-w-[180px] max-w-xs truncate px-3 py-1.5" title={f.direccion || ''}>{f.direccion || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{fecha(f.actualizado_en)}</td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    )}
  </section>;
}
