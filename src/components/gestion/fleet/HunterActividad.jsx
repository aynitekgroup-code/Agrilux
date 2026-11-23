import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

const texto = (v) => v == null || v === '' ? '—' : typeof v === 'object' ? String(v.maxSpeed ?? v.total_hours ?? '—') : String(v);
const fechaPeru = (v) => new Date(v).toLocaleString('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' });
const fechaHoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export default function HunterActividad({ empresaId }) {
  const [desde, setDesde] = useState(() => `${fechaHoy()}T00:00`);
  const [hasta, setHasta] = useState(() => `${fechaHoy()}T23:59`);
  const [pagina, setPagina] = useState(0);
  const [intento, setIntento] = useState(0);
  const [estado, setEstado] = useState('cargando');
  const [error, setError] = useState('');
  const [filas, setFilas] = useState([]);
  useEffect(() => {
    let activo = true;
    if (!empresaId || !desde || !hasta || desde >= hasta) { setFilas([]); setEstado('invalido'); return undefined; }
    setEstado('cargando'); setError(''); setFilas([]);
    supabase.rpc('agrotrack_hunter_actividad', { p_empresa_id: empresaId, p_desde: `${desde}:00-05:00`, p_hasta: `${hasta}:59-05:00`, p_offset: pagina * 100, p_limite: 100 })
      .then(({ data, error: e }) => {
        if (!activo) return;
        if (e) { setError(e.code === 'PGRST202' || /schema cache|could not find/i.test(e.message || '') ? 'Falta la consulta de Hunter. Ejecuta scripts/agrotrack-hunter-reportes.sql en Supabase.' : e.message); setEstado('error'); return; }
        setFilas(data || []); setEstado('listo');
      }).catch((e) => { if (activo) { setError(e.message || 'No se pudo consultar Hunter.'); setEstado('error'); } });
    return () => { activo = false; };
  }, [empresaId, desde, hasta, pagina, intento]);

  return <section className="rounded-xl border bg-white p-4 space-y-4">
    <h2 className="font-semibold text-lg">Reporte de actividad · Hunter 360</h2>
    <p className="text-sm text-slate-600">Resúmenes originales de Hunter incluidos completos en el rango, separados de Zonar. Los intervalos solapados no se suman ni se recortan.</p>
    <div className="flex flex-wrap gap-3 items-end text-sm"><label>Desde (hora Perú)<input className="block rounded border p-2" type="datetime-local" value={desde} onChange={(e) => { setPagina(0); setDesde(e.target.value); }} /></label><label>Hasta (hora Perú)<input className="block rounded border p-2" type="datetime-local" value={hasta} onChange={(e) => { setPagina(0); setHasta(e.target.value); }} /></label><button className="rounded border px-3 py-2" type="button" onClick={() => setIntento((n) => n + 1)}>Actualizar</button></div>
    {estado === 'cargando' && <p role="status">Cargando reporte Hunter…</p>}
    {estado === 'invalido' && <p>Selecciona un rango válido y una empresa.</p>}
    {estado === 'error' && <p role="alert" className="text-red-700">{error}</p>}
    {estado === 'listo' && !filas.length && <p>No hay resúmenes Hunter guardados completos en este rango. La sincronización automática aún debe configurarse.</p>}
    {estado === 'listo' && filas.length > 0 && <><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Unidad', 'Período', 'Recorrido', 'Uso de motor', 'Movimiento', 'Ralentí', 'Vel. máxima'].map((x) => <th className="p-2" key={x}>{x}</th>)}</tr></thead><tbody>{filas.map((f) => <tr className="border-t" key={`${f.equipo_id}-${f.desde}-${f.hasta}`}><td className="p-2">{f.unidad || f.equipo_id}</td><td className="p-2">{fechaPeru(f.desde)} – {fechaPeru(f.hasta)}</td><td className="p-2">{texto(f.resumen.distancia)}</td><td className="p-2">{texto(f.resumen.motor)}</td><td className="p-2">{texto(f.resumen.movimiento)}</td><td className="p-2">{texto(f.resumen.ralenti)}</td><td className="p-2">{texto(f.resumen.velocidad_maxima)}</td></tr>)}</tbody></table></div><div className="flex gap-3 text-sm"><button disabled={pagina === 0} onClick={() => setPagina(pagina - 1)} type="button">Anterior</button><span>Página {pagina + 1}</span><button disabled={filas.length < 100} onClick={() => setPagina(pagina + 1)} type="button">Siguiente</button></div></>}
  </section>;
}
