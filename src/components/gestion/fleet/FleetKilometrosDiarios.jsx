import React, { useEffect, useMemo, useState } from 'react';
import { obtenerActividadFlota } from '../../../lib/agrotrackFlota';
import { obtenerEstadoUnidadesFlota } from '../../../lib/agrotrackReportesGeocerca';
import { diaMapaPeru } from '../../../lib/fechasMapa';
import { matrizKilometros } from '../../../lib/matrizKilometros';
import { codigoArea } from '../../../lib/agrotrackVisitasDia';
import { normalizarPlaca } from '../../../lib/agrotrackGrupos';
import {
  ControlesFiltroUnidadGrupo,
  filtrarFilasPorPlaca,
  useFiltroUnidadGrupo,
} from './reportesComunes';

function tieneRecorrido(fila, dias) {
  return dias.some((dia) => Number(fila.valores?.[dia]) > 0);
}

function geocercaDeUnidad(unidad) {
  return String(
    unidad?.geocerca_actual
    || unidad?.geocerca
    || unidad?.geocerca_ultima
    || unidad?.geocerca_id
    || '',
  ).trim();
}

export default function FleetKilometrosDiarios({ empresaId, vehicles = [] }) {
  const [hasta, setHasta] = useState(() => diaMapaPeru(Date.now()));
  const [estado, setEstado] = useState('cargando');
  const [error, setError] = useState('');
  const [datos, setDatos] = useState({ dias: [], filas: [] });
  const [busqueda, setBusqueda] = useState('');
  const [filtroGeocerca, setFiltroGeocerca] = useState('');
  const [soloSinRecorrido, setSoloSinRecorrido] = useState(false);
  const [geocercasPorPlaca, setGeocercasPorPlaca] = useState({});
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!empresaId || !hasta) return undefined;
    let cancelado = false;
    const fin = Date.parse(`${hasta}T12:00:00Z`);
    if (!Number.isFinite(fin)) {
      setEstado('error');
      setError('Selecciona una fecha válida.');
      return undefined;
    }
    const dias = Array.from({ length: 7 }, (_, i) => new Date(fin - (6 - i) * 86400000).toISOString().slice(0, 10));
    setEstado('cargando');
    setError('');
    (async () => {
      try {
        const resultados = [];
        for (const dia of dias) {
          const filas = await obtenerActividadFlota(empresaId, {
            desde: `${dia}T00:00:00-05:00`,
            hasta: `${dia}T23:59:59-05:00`,
            agrupar: 'unidad',
            limite: 1000,
          });
          if (cancelado) return;
          if (filas.length >= 1000) throw new Error('El resultado podría estar incompleto. Reduce el alcance antes de usarlo.');
          resultados.push(filas);
        }
        if (!cancelado) {
          setDatos({ dias, filas: matrizKilometros(dias, resultados) });
          setEstado('listo');
        }
      } catch (e) {
        if (!cancelado) {
          setError(e.message || 'No se pudo cargar la matriz.');
          setEstado('error');
        }
      }
    })();
    return () => { cancelado = true; };
  }, [empresaId, hasta, intento]);

  const geocercasBase = useMemo(() => {
    const resultado = {};
    vehicles.forEach((unidad) => {
      const placa = normalizarPlaca(unidad?.placa || unidad?.id);
      const geocerca = geocercaDeUnidad(unidad);
      if (placa && geocerca) resultado[placa] = geocerca;
    });
    return resultado;
  }, [vehicles]);

  useEffect(() => {
    if (!empresaId || !hasta) {
      setGeocercasPorPlaca(geocercasBase);
      return undefined;
    }
    let cancelado = false;
    setGeocercasPorPlaca(geocercasBase);
    obtenerEstadoUnidadesFlota(empresaId, {
      desde: `${hasta}T00:00:00-05:00`,
      hasta: `${hasta}T23:59:59-05:00`,
    })
      .then((filas) => {
        if (cancelado) return;
        const resultado = { ...geocercasBase };
        filas.forEach((fila) => {
          const placa = normalizarPlaca(fila?.placa);
          const geocerca = String(fila?.geocerca || fila?.geocerca_ultima || '').trim();
          if (placa && geocerca) resultado[placa] = geocerca;
        });
        setGeocercasPorPlaca(resultado);
      })
      // El reporte de kilómetros se mantiene disponible si la RPC de geocercas no existe.
      .catch(() => {});
    return () => { cancelado = true; };
  }, [empresaId, hasta, geocercasBase]);

  const filas = useMemo(() => {
    const completas = matrizKilometros(datos.dias, [], vehicles).map((unidad) => {
      const medida = datos.filas.find((fila) => fila.placa === unidad.placa);
      return medida ? { ...medida, unidad: medida.unidad || unidad.unidad } : unidad;
    });
    const conocidas = new Set(completas.map((fila) => fila.placa));
    datos.filas.forEach((fila) => {
      if (!conocidas.has(fila.placa)) completas.push(fila);
    });
    return completas;
  }, [datos, vehicles]);

  const vehiculosFiltro = useMemo(
    () => filas.map((fila) => ({ placa: fila.placa, descripcion: fila.unidad || '' })),
    [filas],
  );
  const {
    mostrar,
    setMostrar,
    opcionFiltro,
    setOpcionFiltro,
    gruposInfo,
    opcionesGrupos,
    unidades,
    placasFiltro,
  } = useFiltroUnidadGrupo({ vehicles: vehiculosFiltro, empresaId });

  const opcionesUnidades = useMemo(
    () => filas.map((fila) => ({
      valor: fila.placa,
      etiqueta: `${fila.placa}${fila.unidad ? ` - ${fila.unidad}` : ''}`,
    })),
    [filas],
  );
  const opcionesGeocercas = useMemo(
    () => [...new Set(filas
      .map((fila) => geocercasPorPlaca[normalizarPlaca(fila.placa)])
      .filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [filas, geocercasPorPlaca],
  );

  useEffect(() => {
    if (filtroGeocerca && !opcionesGeocercas.includes(filtroGeocerca)) setFiltroGeocerca('');
  }, [filtroGeocerca, opcionesGeocercas]);

  const filasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return filtrarFilasPorPlaca(filas, placasFiltro)
      .filter((fila) => !filtroGeocerca || geocercasPorPlaca[normalizarPlaca(fila.placa)] === filtroGeocerca)
      .filter((fila) => !texto || [fila.placa, fila.unidad].some((valor) => String(valor || '').toLowerCase().includes(texto)));
  }, [filas, placasFiltro, filtroGeocerca, geocercasPorPlaca, busqueda]);
  const cantidadSinRecorrido = useMemo(
    () => filasFiltradas.filter((fila) => !tieneRecorrido(fila, datos.dias)).length,
    [filasFiltradas, datos.dias],
  );
  const visibles = useMemo(
    () => (soloSinRecorrido ? filasFiltradas.filter((fila) => !tieneRecorrido(fila, datos.dias)) : filasFiltradas),
    [filasFiltradas, soloSinRecorrido, datos.dias],
  );

  return (
    <section className="space-y-3 rounded-xl border bg-white p-4">
      <h2 className="text-lg font-semibold">Kilómetros diarios por unidad · Zonar</h2>
      <p className="text-sm text-slate-600">Últimos 7 días hasta la fecha seleccionada. Rojo: cero kilómetros o sin dato. Cero kilómetros no confirma que el motor haya estado encendido.</p>
      <label className="text-sm">
        Hasta (hora Perú)
        <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="ml-2 rounded border p-2" />
      </label>

      <div className="flex flex-wrap items-end gap-3 border-y border-slate-100 py-3">
        <ControlesFiltroUnidadGrupo
          mostrar={mostrar}
          setMostrar={setMostrar}
          opcionFiltro={opcionFiltro}
          setOpcionFiltro={setOpcionFiltro}
          unidades={unidades}
          opcionesUnidades={opcionesUnidades}
          opcionesGrupos={opcionesGrupos}
          gruposInfo={gruposInfo}
        />
        <label className="min-w-0">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Geocerca</span>
          <select
            value={filtroGeocerca}
            onChange={(event) => setFiltroGeocerca(event.target.value)}
            className="min-w-[240px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">Todas las geocercas</option>
            {opcionesGeocercas.map((geocerca) => <option key={geocerca} value={geocerca}>{geocerca}</option>)}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setSoloSinRecorrido((activo) => !activo)}
          aria-pressed={soloSinRecorrido}
          className={`min-h-8 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
            soloSinRecorrido
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-slate-200 bg-white text-slate-600 hover:border-red-200 hover:text-red-700'
          }`}
        >
          Solo sin recorrido ({cantidadSinRecorrido})
        </button>
      </div>

      <label className="block text-sm">
        Buscar unidad
        <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="ml-2 rounded border p-2" placeholder="Placa o máquina" />
      </label>
      {estado === 'cargando' && <p role="status">Cargando distancias diarias…</p>}
      {estado === 'error' && <p role="alert" className="text-red-700">{error} <button type="button" className="underline" onClick={() => setIntento((n) => n + 1)}>Reintentar</button></p>}
      {estado === 'listo' && !datos.filas.length && <p>No hay distancias disponibles en estos días.</p>}
      {estado === 'listo' && !visibles.length && <p>No hay unidades que coincidan con los filtros.</p>}
      {estado === 'listo' && visibles.length > 0 ? (
        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full text-right text-xs">
            <thead className="sticky top-0 bg-white">
              <tr>
                <th className="px-2 py-1 text-left">Unidad</th>
                <th className="px-2 py-1 text-left">Área</th>
                {datos.dias.map((dia) => <th key={dia} className="whitespace-nowrap px-2 py-1">{dia}</th>)}
              </tr>
            </thead>
            <tbody>
              {visibles.map((fila) => (
                <tr key={fila.placa} className="border-t">
                  <th className="px-2 py-1 text-left">{fila.placa}</th>
                  <td className="px-2 py-1 text-left">{codigoArea(fila.unidad, fila.placa) || 'Sin dato'}</td>
                  {datos.dias.map((dia) => {
                    const km = fila.valores[dia];
                    return (
                      <td key={dia} className={`px-2 py-1 tabular-nums ${km == null || km === 0 ? 'bg-red-600 font-bold text-white' : ''}`}>
                        {km == null ? '—' : km.toLocaleString('es-PE', { maximumFractionDigits: 2 })}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
