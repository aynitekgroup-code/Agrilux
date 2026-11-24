import React, { useEffect, useMemo, useState } from 'react';
import { MapPinned, RefreshCw, Search } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

const fecha = (valor) => valor ? new Date(valor).toLocaleString('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' }) : '—';
function estado(f, ahora) {
  const edad = ahora - Date.parse(f.fecha);
  if (!Number.isFinite(edad) || edad < -300000 || edad > 30 * 60000) return 'Sin reporte reciente';
  if (f.ignicion === false) return 'Apagado';
  if (f.ignicion === true && f.velocidad_kmh != null) return Number(f.velocidad_kmh) > 5 ? 'En movimiento' : 'Encendido / lento';
  return 'Desconocido';
}
export default function HunterEstadoVivo({ empresaId }) {
  const [filas, setFilas] = useState([]);
  const [estadoCarga, setEstadoCarga] = useState('cargando');
  const [error, setError] = useState('');
  const [ahora, setAhora] = useState(Date.now());
  const [intento, setIntento] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [agrupar, setAgrupar] = useState(false);
  const [geocercasDisponibles, setGeocercasDisponibles] = useState(true);
  useEffect(() => {
    if (!empresaId) return undefined;
    let activo = true;
    async function cargar(silencioso) {
      if (!silencioso) setEstadoCarga('cargando');
      try {
        const todas = [];
        for (let inicio = 0; ; inicio += 200) {
          let { data, error: e } = await supabase.rpc('agrotrack_hunter_estado_geocercas', { p_empresa_id: empresaId, p_offset: inicio, p_limite: 200 });
          if (e?.code === 'PGRST202') {
            if (activo) setGeocercasDisponibles(false);
            ({ data, error: e } = await supabase.from('agrotrack_hunter_estado_vivo').select('equipo_id,unidad,fecha,velocidad_kmh,ignicion,direccion,actualizado_en').eq('empresa_id', empresaId).order('equipo_id').range(inicio, inicio + 199));
          } else if (!e && activo) setGeocercasDisponibles(true);
          if (e) throw e;
          todas.push(...(data || []));
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
  const categorias = ['En movimiento', 'Encendido / lento', 'Apagado', 'Sin reporte reciente', 'Desconocido'];
  const conteos = useMemo(() => Object.fromEntries(categorias.map((c) => [c, filas.filter((f) => estado(f, ahora) === c).length])), [filas, ahora]);
  const visibles = useMemo(() => filas.filter((f) => {
    const texto = `${f.unidad || ''} ${f.equipo_id} ${f.direccion || ''}`.toLocaleLowerCase('es');
    return texto.includes(busqueda.trim().toLocaleLowerCase('es')) && (filtroEstado === 'todos' || estado(f, ahora) === filtroEstado);
  }), [filas, ahora, busqueda, filtroEstado]);
  const grupos = useMemo(() => {
    if (!agrupar) return [['', visibles]];
    const mapa = new Map();
    for (const fila of visibles) {
      const nombre = fila.geocerca || 'Sin geocerca coincidente';
      if (!mapa.has(nombre)) mapa.set(nombre, []);
      mapa.get(nombre).push(fila);
    }
    return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'));
  }, [visibles, agrupar]);
  const tonos = { 'En movimiento': 'bg-emerald-50 text-emerald-700 border-emerald-200', 'Encendido / lento': 'bg-amber-50 text-amber-700 border-amber-200', Apagado: 'bg-slate-100 text-slate-600 border-slate-200', 'Sin reporte reciente': 'bg-rose-50 text-rose-700 border-rose-200', Desconocido: 'bg-slate-50 text-slate-500 border-slate-200' };
  return <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-100 p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><MapPinned size={19} /></span><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-bold text-slate-900">Status de maquinaria</h2><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Hunter 360</span></div><p className="mt-0.5 text-xs text-slate-500">Última posición informada por Hunter · consulta de pantalla cada minuto</p></div></div><button type="button" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50" onClick={() => setIntento((n) => n + 1)}><RefreshCw size={14} /> Actualizar</button></div>
      {estadoCarga === 'listo' && filas.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Filtrar por estado"><button type="button" aria-pressed={filtroEstado === 'todos'} onClick={() => setFiltroEstado('todos')} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${filtroEstado === 'todos' ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-200 text-slate-600'}`}>Todas <span className="ml-1 tabular-nums">{filas.length}</span></button>{categorias.map((c) => <button type="button" key={c} aria-pressed={filtroEstado === c} onClick={() => setFiltroEstado(c)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${filtroEstado === c ? 'ring-2 ring-emerald-500 ring-offset-1' : ''} ${tonos[c]}`}>{c} <span className="ml-1 tabular-nums">{conteos[c]}</span></button>)}</div>}
      <div className="flex flex-wrap items-center justify-between gap-2"><label className="relative block w-full max-w-xs"><Search size={14} className="absolute left-3 top-2.5 text-slate-400" /><span className="sr-only">Buscar unidad o dirección</span><input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar unidad o dirección" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" /></label><p className="text-xs text-slate-500">{visibles.length} de {filas.length} unidades · Hora Perú</p></div>
      <p className="text-[11px] text-slate-500">Sin reporte reciente: última posición mayor a 30 min o fecha no válida. Las categorías son orientativas y no equivalen al resumen histórico de Hunter.</p>
      {!geocercasDisponibles && <p role="status" className="text-xs text-amber-700">Para mostrar geocercas, ejecuta scripts/agrotrack-hunter-geocercas.sql en Supabase.</p>}
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600"><label className="inline-flex items-center gap-2"><input type="checkbox" checked={agrupar} onChange={(e) => setAgrupar(e.target.checked)} /> Agrupar por geocerca</label><span>La división es geográfica; los grupos y áreas operativas de Hunter aún no están disponibles.</span></div>
    </div>
    {estadoCarga === 'cargando' && <p role="status" className="p-5 text-sm text-slate-500">Cargando unidades Hunter…</p>}
    {estadoCarga === 'error' && <p role="alert" className="p-5 text-sm text-red-700">{error}</p>}
    {estadoCarga === 'listo' && !filas.length && <p className="p-5 text-sm text-slate-500">No hay posiciones Hunter guardadas para esta empresa.</p>}
    {estadoCarga === 'listo' && filas.length > 0 && !visibles.length && <p className="p-5 text-sm text-slate-500">Ninguna unidad coincide con los filtros.</p>}
    {estadoCarga === 'listo' && visibles.length > 0 && <div className="overflow-x-auto"><table className="w-full text-left text-xs text-slate-600"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400"><tr>{['Unidad','Última posición','Estado','Velocidad','Geocerca','División geográfica','Dirección','Sincronización'].map((t) => <th className="whitespace-nowrap px-3 py-2.5 font-bold" key={t}>{t}</th>)}</tr></thead><tbody>{grupos.map(([grupo, unidades]) => <React.Fragment key={grupo}>{agrupar && <tr className="bg-slate-100"><th colSpan={8} className="px-3 py-2 text-left font-semibold text-slate-700">{grupo} · {unidades.length} unidad{unidades.length === 1 ? '' : 'es'}</th></tr>}{unidades.map((f) => { const categoria = estado(f, ahora); return <tr className="border-t border-slate-100 hover:bg-slate-50/70" key={f.equipo_id}><td className="whitespace-nowrap px-3 py-1.5 font-bold text-slate-800">{f.unidad || f.equipo_id}</td><td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{fecha(f.fecha)}</td><td className="whitespace-nowrap px-3 py-1.5"><span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tonos[categoria]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />{categoria}</span></td><td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{f.velocidad_kmh == null ? '—' : `${f.velocidad_kmh} km/h`}</td><td className="whitespace-nowrap px-3 py-1.5">{f.geocerca || 'Sin coincidencia'}</td><td className="whitespace-nowrap px-3 py-1.5">{f.division_geografica || '—'}</td><td className="min-w-[180px] max-w-xs truncate px-3 py-1.5" title={f.direccion || ''}>{f.direccion || '—'}</td><td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{fecha(f.actualizado_en)}</td></tr>; })}</React.Fragment>)}</tbody></table></div>}
  </section>;
}
