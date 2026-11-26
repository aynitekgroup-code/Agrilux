import React, { useEffect, useState } from 'react';
import { obtenerActividadFlota } from '../../../lib/agrotrackFlota';
import { diaMapaPeru } from '../../../lib/fechasMapa';
import { matrizKilometros } from '../../../lib/matrizKilometros';

export default function FleetKilometrosDiarios({ empresaId, vehicles = [] }) {
  const [hasta, setHasta] = useState(() => diaMapaPeru(Date.now()));
  const [estado, setEstado] = useState('cargando');
  const [error, setError] = useState('');
  const [datos, setDatos] = useState({ dias: [], filas: [] });
  const [busqueda, setBusqueda] = useState('');
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    if (!empresaId || !hasta) return undefined;
    let cancelado = false;
    const fin = Date.parse(`${hasta}T12:00:00Z`);
    if (!Number.isFinite(fin)) { setEstado('error'); setError('Selecciona una fecha válida.'); return undefined; }
    const dias = Array.from({ length: 7 }, (_, i) => new Date(fin - (6 - i) * 86400000).toISOString().slice(0, 10));
    setEstado('cargando'); setError('');
    (async () => {
      try {
        const resultados = [];
        for (const dia of dias) {
          const filas = await obtenerActividadFlota(empresaId, { desde: `${dia}T00:00:00-05:00`, hasta: `${dia}T23:59:59-05:00`, agrupar: 'unidad', limite: 1000 });
          if (cancelado) return;
          if (filas.length >= 1000) throw new Error('El resultado podría estar incompleto. Reduce el alcance antes de usarlo.');
          resultados.push(filas);
        }
        if (!cancelado) { setDatos({ dias, filas: matrizKilometros(dias, resultados) }); setEstado('listo'); }
      } catch (e) { if (!cancelado) { setError(e.message || 'No se pudo cargar la matriz.'); setEstado('error'); } }
    })();
    return () => { cancelado = true; };
  }, [empresaId, hasta, intento]);
  const filas = matrizKilometros(datos.dias, [], vehicles).map((unidad) => datos.filas.find((f) => f.placa === unidad.placa) || unidad);
  const conocidas = new Set(filas.map((fila) => fila.placa));
  datos.filas.forEach((fila) => { if (!conocidas.has(fila.placa)) filas.push(fila); });
  const visibles = filas.filter((fila) => fila.placa.toLowerCase().includes(busqueda.trim().toLowerCase()));
  return <section className="rounded-xl border bg-white p-4 space-y-3">
    <h2 className="text-lg font-semibold">Kilómetros diarios por unidad · Zonar</h2>
    <p className="text-sm text-slate-600">Últimos 7 días hasta la fecha seleccionada. Rojo: cero kilómetros o sin dato. Cero kilómetros no confirma que el motor haya estado encendido.</p>
    <label className="text-sm">Hasta (hora Perú) <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="rounded border p-2" /></label>
    <label className="block text-sm">Buscar unidad <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="ml-2 rounded border p-2" placeholder="Placa o máquina" /></label>
    {estado === 'cargando' && <p role="status">Cargando distancias diarias…</p>}
    {estado === 'error' && <p role="alert" className="text-red-700">{error} <button type="button" className="underline" onClick={() => setIntento((n) => n + 1)}>Reintentar</button></p>}
    {estado === 'listo' && !datos.filas.length && <p>No hay distancias disponibles en estos días.</p>}
    {estado === 'listo' && !visibles.length && <p>No hay unidades que coincidan con la búsqueda.</p>}
    {estado === 'listo' && visibles.length > 0 && <div className="overflow-auto"><table className="w-full text-sm text-right"><thead><tr><th className="p-2 text-left">Unidad</th>{datos.dias.map((dia) => <th key={dia} className="p-2 whitespace-nowrap">{dia}</th>)}</tr></thead><tbody>{visibles.map((fila) => <tr key={fila.placa} className="border-t"><th className="p-2 text-left">{fila.placa}</th>{datos.dias.map((dia) => { const km = fila.valores[dia]; return <td key={dia} className={`p-2 tabular-nums ${km == null || km === 0 ? 'bg-red-600 font-bold text-white' : ''}`}>{km == null ? '—' : km.toLocaleString('es-PE', { maximumFractionDigits: 2 })}</td>; })}</tr>)}</tbody></table></div>}
  </section>;
}
