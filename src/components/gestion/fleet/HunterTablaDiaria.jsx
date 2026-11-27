import React, { useEffect, useMemo, useState } from 'react';
import { prepararRecorrido } from '../../../../agentes/hunter/parse-core.mjs';
import { listarGeocercas } from '../../../lib/agrotrackGeocercas';
import { coberturaHunter, estimarHunterPorGeocerca } from '../../../lib/hunterGeocercasEstimadas';
import { formatearDuracion } from '../../../lib/duracionReporte';
import { supabase } from '../../../lib/supabase';
import { HunterDetalle } from './HunterReports';

const hoyPeru = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const duracionBalance = (valor) => {
  const segundos = Math.max(0, Math.floor(valor));
  return `${Math.floor(segundos / 3600)} h ${String(Math.floor(segundos % 3600 / 60)).padStart(2, '0')} min ${String(segundos % 60).padStart(2, '0')} s`;
};

export default function HunterTablaDiaria({ empresaId }) {
  const [dia, setDia] = useState(hoyPeru);
  const [busqueda, setBusqueda] = useState('');
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [intento, setIntento] = useState(0);
  const [detalle, setDetalle] = useState(false);
  const [equipoDetalle, setEquipoDetalle] = useState('');

  useEffect(() => {
    if (!empresaId || !dia || detalle) return undefined;
    if (dia > hoyPeru()) { setFilas([]); setCargando(false); setError('Elige una fecha hasta hoy; los días futuros aún no tienen datos.'); return undefined; }
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
              const ahora = Math.floor(Date.now() / 1000) * 1000;
              const puntos = recorrido.puntos.filter((p) => Date.parse(p.fecha) <= ahora);
              const estimacion = puntos.length >= 2 ? estimarHunterPorGeocerca(puntos, validas) : null;
              const inicioDia = Date.parse(`${dia}T00:00:00-05:00`);
              const cobertura = coberturaHunter(puntos, estimacion, new Date(inicioDia).toISOString(), new Date(inicioDia + 86400000).toISOString(), ahora);
              if (!cobertura) throw new Error('No se pudo calcular un balance válido.');
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

  const visibles = useMemo(() => filas.filter((f) => `${f.unidad || ''} ${f.equipo_id || ''} ${f.area || ''} ${(f.estimacion?.filas || []).map((g) => g.geocerca).join(' ')}`.toLocaleLowerCase('es').includes(busqueda.trim().toLocaleLowerCase('es'))), [filas, busqueda]);
  const terminadas = filas.filter((f) => f.estado !== 'pendiente').length;
  return <section className="space-y-4 rounded-xl border border-emerald-200 bg-white p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">Horas diarias por geocerca <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-800">HUNTER 360</span></h2><p className="mt-1 text-sm text-slate-600">Estimación por unidad y geocerca · hora Perú · consulta directa a Hunter.</p></div><button type="button" onClick={() => setDetalle(!detalle)} className="rounded-lg border border-emerald-700 px-3 py-2 text-sm font-semibold text-forest">{detalle ? 'Volver a todas las unidades' : 'Detalle y descargas por unidad'}</button></div>
    {detalle ? <HunterDetalle empresaId={empresaId} equipoInicial={equipoDetalle} diaInicial={dia} /> : <>
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Estimación para revisión, no liquidación. Encendido / detenido: 0 km/h; movimiento lento: más de 0 y hasta 5 km/h; movimiento: más de 5 km/h. Los intervalos de hasta 5 minutos se asignan con igual estado y una geocerca única en ambos extremos. Un hueco mayor se asigna como apagado solo si Hunter muestra ignición apagada al inicio y apagada o un evento «Ignición ON» al final, ambos extremos con velocidad 0, a menos de 100 m y en la misma geocerca única. Sin determinar incluye el resto de huecos y el tiempo sin geocerca asignable; no implica que la máquina no reportó. Las horas pendientes aún no transcurrieron y no son horas trabajadas. El balance suma 24 horas incluyendo ambos conceptos. Contrasta con los partes diarios.</p>
      <div className="flex flex-wrap items-end gap-3 text-sm"><label className="font-semibold text-slate-700">Fecha<input type="date" max={hoyPeru()} value={dia} onChange={(e) => setDia(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label><label className="min-w-52 flex-1 font-semibold text-slate-700">Buscar máquina, identificador, área o geocerca<input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre o identificador de máquina…" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label><button type="button" onClick={() => setIntento((n) => n + 1)} className="rounded-lg border border-slate-300 px-3 py-2 font-semibold">Actualizar</button></div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <p role="status" className="text-xs text-slate-600">{cargando ? `Consultando Hunter: ${terminadas} de ${filas.length || '…'} unidades.` : `${terminadas} unidades consultadas · ${filas.filter((f) => f.estado === 'error').length} con error.`}{' '}{areasMensaje(filas)}</p>
      {!error && filas.length > 0 && !visibles.length && <p className="text-sm text-slate-600">No hay unidades que coincidan con la búsqueda.</p>}
      {visibles.length > 0 && <div className="max-h-[65vh] overflow-auto rounded-lg border border-slate-200"><table className="w-full min-w-[1100px] text-left text-xs"><thead className="sticky top-0 z-10 bg-emerald-50 text-[11px] uppercase tracking-wide text-emerald-900"><tr>{['Unidad', 'Área', 'Geocerca', 'Apagado', 'Encendido / detenido', 'Encendido / movimiento lento', 'Movimiento', 'Transcurrido sin determinar', 'Pendiente del día', 'Cobertura asignada'].map((x) => <th key={x} className="border-b px-3 py-2">{x}</th>)}</tr></thead><tbody>{visibles.flatMap((u) => {
        const geos = u.estimacion?.filas || [];
        const lineas = geos.length ? geos : [null];
        return [...lineas.map((g, i) => <tr key={`${u.equipo_id}-${g?.id || 'sin'}`} className="border-b border-slate-100 hover:bg-emerald-50/50"><th className="px-3 py-2 font-semibold text-slate-900">{i === 0 ? <button type="button" onClick={() => { setEquipoDetalle(u.equipo_id); setDetalle(true); }} className="text-left text-emerald-800 underline">{u.unidad || u.equipo_id}</button> : ''}</th><td className="px-3 py-2 text-slate-600">{i === 0 ? u.area || 'Sin dato' : ''}</td><td className="px-3 py-2">{g?.geocerca || (u.estado === 'pendiente' ? 'Consultando…' : u.estado === 'error' ? 'Error al consultar' : u.puntos < 2 ? 'Puntos insuficientes' : 'Sin intervalos asignables')}</td>{['apagado', 'detenido', 'ralenti', 'movimiento'].map((k) => <td className="px-3 py-2 tabular-nums" key={k}>{g ? formatearDuracion(g[k]) : '—'}</td>)}<td className="px-3 py-2">—</td><td className="px-3 py-2">—</td><td className="px-3 py-2 text-slate-600">{i === 0 && u.estado === 'listo' ? `${u.cobertura ? u.cobertura.porcentaje.toFixed(1) + '% · ' : ''}${u.puntos} puntos · ${u.resumenDisponible ? u.paradas + ' paradas' : 'resumen no disponible'}` : '—'}</td></tr>), u.cobertura && <tr key={`${u.equipo_id}-total`} className="border-b bg-slate-50 font-semibold"><th className="px-3 py-2" colSpan={3}>Balance del día · {duracionBalance(u.cobertura.totalDia)}{u.cobertura.pendiente > 0 && <span className="block text-xs font-normal">Corte: {new Date(u.cobertura.corte).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', second: '2-digit' })} (Perú)</span>}</th>{['apagado', 'detenido', 'ralenti', 'movimiento'].map((k) => <td key={k} className="px-3 py-2 tabular-nums">{duracionBalance(geos.reduce((s, g) => s + g[k], 0))}</td>)}<td className="px-3 py-2 tabular-nums text-amber-800">{duracionBalance(u.cobertura.sinAsignar)}</td><td className="px-3 py-2 tabular-nums text-slate-600">{duracionBalance(u.cobertura.pendiente)}</td><td /></tr>];
      })}</tbody></table></div>}
    </>}
  </section>;
}

function areasMensaje(filas) { return filas.some((f) => !f.area) ? 'Área sin asignación disponible: «Sin dato».' : ''; }
