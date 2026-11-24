import React, { useEffect, useState } from 'react';
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
  useEffect(() => {
    if (!empresaId) return undefined;
    let activo = true;
    async function cargar(silencioso) {
      if (!silencioso) setEstadoCarga('cargando');
      try {
        const todas = [];
        for (let inicio = 0; ; inicio += 500) {
          const { data, error: e } = await supabase.from('agrotrack_hunter_estado_vivo').select('equipo_id,unidad,fecha,velocidad_kmh,ignicion,direccion,actualizado_en').eq('empresa_id', empresaId).order('equipo_id').range(inicio, inicio + 499);
          if (e) throw e;
          todas.push(...(data || []));
          if ((data || []).length < 500) break;
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
  return <section className="rounded-xl border bg-white p-4 space-y-4">
    <div className="flex flex-wrap justify-between gap-2"><div><h2 className="text-lg font-semibold">Status de maquinaria · Hunter 360</h2><p className="text-sm text-slate-600">Última lectura de Hunter, separada de Zonar. El panel consulta cada minuto; la fuente puede actualizar con otra frecuencia.</p></div><button type="button" className="rounded border px-3 py-1" onClick={() => setIntento((n) => n + 1)}>Actualizar</button></div>
    {estadoCarga === 'cargando' && <p role="status">Cargando unidades Hunter…</p>}
    {estadoCarga === 'error' && <p role="alert" className="text-red-700">{error}</p>}
    {estadoCarga === 'listo' && !filas.length && <p>No hay posiciones Hunter guardadas para esta empresa.</p>}
    {estadoCarga === 'listo' && filas.length > 0 && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Unidad','Última posición (hora Perú)','Estado','Velocidad','Dirección','Última sincronización'].map((t) => <th className="p-2" key={t}>{t}</th>)}</tr></thead><tbody>{filas.map((f) => <tr className="border-t" key={f.equipo_id}><td className="p-2">{f.unidad || f.equipo_id}</td><td className="p-2">{fecha(f.fecha)}</td><td className="p-2">{estado(f, ahora)}</td><td className="p-2">{f.velocidad_kmh == null ? '—' : `${f.velocidad_kmh} km/h`}</td><td className="p-2">{f.direccion || '—'}</td><td className="p-2">{fecha(f.actualizado_en)}</td></tr>)}</tbody></table></div>}
  </section>;
}
