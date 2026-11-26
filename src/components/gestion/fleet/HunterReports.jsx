import React, { useState } from 'react';
import { prepararRecorrido } from '../../../../agentes/hunter/parse-core.mjs';
import { generarReportesCsv } from '../../../../agentes/hunter/reportes.mjs';
import { listarGeocercas } from '../../../lib/agrotrackGeocercas';
import { estimarHunterPorGeocerca } from '../../../lib/hunterGeocercasEstimadas';
import { formatearDuracion } from '../../../lib/duracionReporte';

const etiquetas = { distancia: 'Distancia', velocidad_maxima: 'Velocidad máxima', velocidad_promedio: 'Velocidad promedio', detenido: 'Tiempo detenido', movimiento: 'Movimiento', estacionado: 'Estacionado', ralenti: 'Ralentí', motor: 'Uso de motor', total: 'Tiempo total', parada_minima: 'Parada mínima' };
const valor = (v) => v == null ? 'No disponible' : typeof v === 'object' ? (v.maxSpeed ?? v.total_hours ?? JSON.stringify(v)) : String(v);

export default function HunterReports({ empresaId }) {
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [estimacion, setEstimacion] = useState(null);
  const [errorGeocerca, setErrorGeocerca] = useState('');
  const [calculando, setCalculando] = useState(false);

  async function cargar(e) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setResultado(null); setEstimacion(null); setErrorGeocerca(''); setError(''); setCargando(true); setPagina(0);
    try {
      if (archivo.size > 20 * 1024 * 1024) throw new Error('La captura supera el límite de 20 MB.');
      setResultado(prepararRecorrido(JSON.parse(await archivo.text())));
    } catch (err) {
      setError(err instanceof SyntaxError ? 'El archivo no contiene JSON válido.' : err.message);
    } finally { setCargando(false); }
  }

  async function calcularGeocercas() {
    if (!empresaId || !resultado) return;
    setCalculando(true); setErrorGeocerca(''); setEstimacion(null);
    try {
      const geocercas = await listarGeocercas(empresaId);
      const validas = geocercas.filter((g) => ['Polygon', 'MultiPolygon'].includes(g.geometria?.type) && Array.isArray(g.geometria?.coordinates));
      if (!validas.length) throw new Error('No hay geocercas activas con geometría disponible.');
      setEstimacion(estimarHunterPorGeocerca(resultado.puntos, validas));
    } catch (e) { setErrorGeocerca(e.message || 'No se pudo calcular la estimación.'); }
    finally { setCalculando(false); }
  }

  function descargar(nombre) {
    const contenido = generarReportesCsv(resultado)[nombre];
    const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }));
    const enlace = document.createElement('a'); enlace.href = url; enlace.download = nombre; enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className="rounded-xl border border-emerald-200 bg-white p-4 space-y-4">
    <div><h2 className="text-lg font-semibold">Reportes Hunter 360</h2>
      <p className="text-sm text-slate-600">Carga manual de una captura JSON validada. Los datos se procesan en este navegador, no se guardan ni se sincronizan con Agrilux y no se mezclan con Zonar.</p>
      <p className="text-sm text-amber-700">Hunter agrupa algunas paradas: se cuentan por separado y no se duplican como puntos GPS. El detalle de viajes y paradas se muestra solo si la captura lo incluye; los eventos dentro de una parada pueden no estar disponibles. El resumen conserva los valores de Hunter y no usa los criterios de Zonar.</p></div>
    <label className="block text-sm font-medium">Captura Hunter <input className="block mt-1" type="file" accept=".json,application/json" onChange={cargar} /></label>
    {cargando && <p role="status">Procesando captura…</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {!resultado && !cargando && !error && <p className="text-sm text-slate-500">Selecciona una captura para ver el reporte.</p>}
    {resultado && <>
      <p className="text-sm">Equipo: {resultado.equipo_id} · {resultado.desde} a {resultado.hasta} · {resultado.puntos.length} puntos válidos · {resultado.descartes.paradas_agrupadas} paradas agrupadas · {resultado.descartes.invalidos} inválidos · {resultado.descartes.duplicados} duplicados</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{Object.entries(etiquetas).map(([k, titulo]) => <div className="rounded bg-slate-50 p-2 text-sm" key={k}><div className="text-slate-500">{titulo}</div><strong>{valor(resultado.resumen_hunter[k])}</strong></div>)}</div>
      <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <h3 className="font-semibold">Estimación experimental por geocerca</h3>
        <p className="text-sm">No es el tiempo oficial de Hunter ni una liquidación. Solo se asignan intervalos de hasta 5 minutos cuando ambos puntos tienen el mismo estado y coinciden en una única geocerca. Los cambios, solapamientos, datos faltantes y huecos mayores quedan sin asignar. Los períodos antes del primer punto y después del último no están incluidos. Contrasta con Hunter antes de cualquier pago.</p>
        <button type="button" disabled={calculando || !empresaId || resultado.puntos.length < 2} onClick={calcularGeocercas} className="rounded bg-forest px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{calculando ? 'Calculando…' : 'Estimar tiempo por geocerca'}</button>
        {resultado.puntos.length < 2 && <p>Se necesitan al menos dos puntos GPS válidos.</p>}
        {errorGeocerca && <p role="alert" className="text-red-700">{errorGeocerca}</p>}
        {estimacion && <><p role="status">Tiempo sin asignar entre puntos: {formatearDuracion(estimacion.incierto)}.</p>{!estimacion.filas.length ? <p>No hay intervalos que cumplan las condiciones de esta estimación.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Geocerca', 'Apagado', 'Encendido lento / detenido', 'Movimiento'].map((t) => <th className="p-2" key={t}>{t}</th>)}</tr></thead><tbody>{estimacion.filas.map((f) => <tr className="border-t" key={f.id}><td className="p-2">{f.geocerca}</td><td className="p-2">{formatearDuracion(f.apagado)}</td><td className="p-2">{formatearDuracion(f.ralenti)}</td><td className="p-2">{formatearDuracion(f.movimiento)}</td></tr>)}</tbody></table></div>}</>}
      </div>
      <div className="flex flex-wrap gap-2">{[['hunter-resumen.csv', 'Resumen'], ['hunter-puntos.csv', 'Puntos'], ['hunter-viajes-paradas.csv', 'Viajes y paradas']].map(([archivo, titulo]) => <button type="button" key={archivo} onClick={() => descargar(archivo)} className="rounded border px-3 py-1 text-sm">Descargar {titulo} CSV</button>)}</div>
      <h3 className="font-semibold">Viajes y paradas de Hunter</h3>
      {!resultado.viajes_disponibles ? <p>La captura no contiene el detalle de viajes y paradas.</p> : resultado.viajes.length === 0 ? <p>No hay viajes ni paradas en la captura.</p> : <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr><th>Tipo</th><th>Inicio</th><th>Fin</th><th>Duración</th><th>Distancia</th></tr></thead><tbody>{resultado.viajes.map((v, i) => <tr key={i}><td>{v.tipo}</td><td>{valor(v.inicio)}</td><td>{valor(v.fin)}</td><td>{valor(v.duracion)}</td><td>{valor(v.distancia)}</td></tr>)}</tbody></table></div>}
      <h3 className="font-semibold">Puntos GPS</h3>
      {!resultado.puntos.length ? <p>No hay puntos GPS válidos en la captura.</p> : <><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr><th>Fecha y hora Perú</th><th>Unidad</th><th>Velocidad km/h</th><th>Ignición</th><th>Evento</th></tr></thead><tbody>{resultado.puntos.slice(pagina * 50, (pagina + 1) * 50).map((p) => <tr key={p.punto_id}><td>{p.fecha}</td><td>{p.unidad}</td><td>{p.velocidad_kmh}</td><td>{p.ignicion == null ? 'Desconocida' : p.ignicion ? 'Encendida' : 'Apagada'}</td><td>{p.evento || '—'}</td></tr>)}</tbody></table></div><div className="flex gap-3 text-sm"><button type="button" disabled={!pagina} onClick={() => setPagina(pagina - 1)}>Anterior</button><span>Página {pagina + 1} de {Math.ceil(resultado.puntos.length / 50)}</span><button type="button" disabled={(pagina + 1) * 50 >= resultado.puntos.length} onClick={() => setPagina(pagina + 1)}>Siguiente</button></div></>}
    </>}
  </section>;
}
