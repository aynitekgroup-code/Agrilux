import React, { useEffect, useMemo, useState } from 'react';
import { prepararRecorrido } from '../../../../agentes/hunter/parse-core.mjs';
import { listarGeocercas } from '../../../lib/agrotrackGeocercas';
import { coberturaHunter, estimarHunterPorGeocerca } from '../../../lib/hunterGeocercasEstimadas';
import { formatearDuracion } from '../../../lib/duracionReporte';
import { supabase } from '../../../lib/supabase';
import { HunterDetalle } from './HunterReports';

const hoyPeru = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export default function HunterTablaDiaria({ empresaId }) {
  const [dia, setDia] = useState(hoyPeru);
  const [busqueda, setBusqueda] = useState('');
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [intento, setIntento] = useState(0);
  const [detalle, setDetalle] = useState(false);

  useEffect(() => {
    if (!empresaId || !dia || detalle) return undefined;
    let activo = true;
    setCargando(true); setError(''); setFilas([]);
    (async () => {
      try {
        const [{ data: unidades, error: err }, geocercas, areas] = await Promise.all([
          supabase.from('agrotrack_hunter_estado_vivo').select('equipo_id,unidad').eq('empresa_id', empresaId).order('unidad').limit(1000),
          listarGeocercas(empresaId),
          supabase.from('agrotrack_hunter_areas').select('equipo_id,area').eq('empresa_id', empresaId).limit(1000),
        ]);
        if (err) throw new Error('No se pudo cargar el padrón Hunter.');
        if (!unidades?.length) throw new Error('No hay unidades Hunter disponibles para esta empresa.');
        const validas = geocercas.filter((g) => ['Polygon', 'MultiPolygon'].includes(g.geometria?.type) && Array.isArray(g.geometria?.coordinates));
        if (!validas.length) throw new Error('No hay geocercas activas con geometría disponible.');
        const areaPorEquipo = new Map((areas.data || []).map((a) => [a.equipo_id, a.area]));
        const inicial = unidades.map((u) => ({ ...u, area: areaPorEquipo.get(u.equipo_id) || '', estado: 'pendiente' }));
        if (!activo) return;
        setFilas(inicial);
        let siguiente = 0;
        async function trabajador() {
          while (activo) {
            const indice = siguiente++;
            if (indice >= inicial.length) break;
            const unidad = inicial[indice];
            let actual;
            try {
              const { data, error: fallo } = await supabase.functions.invoke('hunter-recorrido', { body: { equipo: unidad.equipo_id, dia } });
              if (fallo) throw fallo;
              const recorrido = prepararRecorrido(data);
              const ahora = Date.now();
              const puntos = recorrido.puntos.filter((p) => Date.parse(p.fecha) <= ahora);
              const estimacion = puntos.length >= 2 ? estimarHunterPorGeocerca(puntos, validas) : null;
              const cobertura = coberturaHunter(puntos, estimacion, recorrido.desde, recorrido.hasta, ahora);
              actual = { ...unidad, estado: 'listo', puntos: puntos.length, paradas: (data.agrupado?.data || []).filter((p) => p.stopNum || p.parado_desde || p.parado_hasta).length, resumenDisponible: !!data.agrupado, estimacion, cobertura };
            } catch { actual = { ...unidad, estado: 'error' }; }
            if (activo) setFilas((anteriores) => anteriores.map((f, i) => i === indice ? actual : f));
          }
        }
        await Promise.all([trabajador(), trabajador()]);
      } catch (e) { if (activo) setError(e.message || 'No se pudo cargar el reporte.'); }
      finally { if (activo) setCargando(false); }
    })();
    return () => { activo = false; };
  }, [empresaId, dia, intento, detalle]);

  const visibles = useMemo(() => filas.filter((f) => `${f.unidad || ''} ${f.area || ''} ${(f.estimacion?.filas || []).map((g) => g.geocerca).join(' ')}`.toLocaleLowerCase('es').includes(busqueda.trim().toLocaleLowerCase('es'))), [filas, busqueda]);
  const terminadas = filas.filter((f) => f.estado !== 'pendiente').length;
  return <section className="space-y-4 rounded-xl border border-emerald-200 bg-white p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">Horas diarias por geocerca <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-800">HUNTER 360</span></h2><p className="mt-1 text-sm text-slate-600">Estimación por unidad y geocerca · hora Perú · consulta directa a Hunter.</p></div><button type="button" onClick={() => setDetalle(!detalle)} className="rounded-lg border border-emerald-700 px-3 py-2 text-sm font-semibold text-forest">{detalle ? 'Volver a todas las unidades' : 'Detalle y descargas por unidad'}</button></div>
    {detalle ? <HunterDetalle empresaId={empresaId} /> : <>
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Para revisión, no liquidación. Apagado: ignición apagada; encendido lento: ignición encendida y hasta 5 km/h; movimiento: ignición encendida y más de 5 km/h. Se asignan solo intervalos de hasta 5 minutos con igual estado y una misma geocerca única en ambos puntos. Un «0 s» indica que no se asignaron intervalos de ese estado, no que el día completo haya sido medido. Paradas agrupadas, huecos y extremos del día pueden quedar sin cobertura; contrasta con los partes diarios.</p>
      <div className="flex flex-wrap items-end gap-3 text-sm"><label className="font-semibold text-slate-700">Fecha<input type="date" value={dia} onChange={(e) => setDia(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label><label className="min-w-52 flex-1 font-semibold text-slate-700">Buscar unidad, área o geocerca<input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar…" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label><button type="button" onClick={() => setIntento((n) => n + 1)} className="rounded-lg border border-slate-300 px-3 py-2 font-semibold">Actualizar</button></div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <p role="status" className="text-xs text-slate-600">{cargando ? `Consultando Hunter: ${terminadas} de ${filas.length || '…'} unidades.` : `${terminadas} unidades consultadas · ${filas.filter((f) => f.estado === 'error').length} con error.`}{' '}{areasMensaje(filas)}</p>
      {!error && filas.length > 0 && !visibles.length && <p className="text-sm text-slate-600">No hay unidades que coincidan con la búsqueda.</p>}
      {visibles.length > 0 && <div className="max-h-[65vh] overflow-auto rounded-lg border border-slate-200"><table className="w-full min-w-[850px] text-left text-xs"><thead className="sticky top-0 z-10 bg-emerald-50 text-[11px] uppercase tracking-wide text-emerald-900"><tr>{['Unidad', 'Área', 'Geocerca', 'Apagado', 'Encendido lento', 'Movimiento', 'Sin asignar en el período', 'Cobertura asignada'].map((x) => <th key={x} className="border-b px-3 py-2">{x}</th>)}</tr></thead><tbody>{visibles.flatMap((u) => {
        const geos = u.estimacion?.filas || [];
        const lineas = geos.length ? geos : [null];
        return lineas.map((g, i) => <tr key={`${u.equipo_id}-${g?.id || 'sin'}`} className="border-b border-slate-100 hover:bg-emerald-50/50"><th className="px-3 py-2 font-semibold text-slate-900">{i === 0 ? u.unidad || u.equipo_id : ''}</th><td className="px-3 py-2 text-slate-600">{i === 0 ? u.area || 'Sin dato' : ''}</td><td className="px-3 py-2">{g?.geocerca || (u.estado === 'pendiente' ? 'Consultando…' : u.estado === 'error' ? 'Error al consultar' : u.puntos < 2 ? 'Puntos insuficientes' : 'Sin intervalos asignables')}</td>{['apagado', 'ralenti', 'movimiento'].map((k) => <td className="px-3 py-2 tabular-nums" key={k}>{g ? formatearDuracion(g[k]) : '—'}</td>)}<td className="px-3 py-2 tabular-nums text-amber-800">{i === 0 && u.cobertura ? formatearDuracion(u.cobertura.sinAsignar) : '—'}</td><td className="px-3 py-2 text-slate-600">{i === 0 && u.estado === 'listo' ? `${u.cobertura ? u.cobertura.porcentaje.toFixed(1) + '% · ' : ''}${u.puntos} puntos · ${u.resumenDisponible ? u.paradas + ' paradas' : 'resumen no disponible'}` : '—'}</td></tr>);
      })}</tbody></table></div>}
    </>}
  </section>;
}

function areasMensaje(filas) { return filas.some((f) => !f.area) ? 'Área sin asignación disponible: «Sin dato».' : ''; }
