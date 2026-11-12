import React, { useState } from 'react';
import { AlertTriangle, Loader2, RotateCw, Sparkles, Sun } from 'lucide-react';
import { armarContextoBriefing } from '../../../lib/briefingFlota';
import { llamarIaGestion } from '../../../lib/agrotrackIa';

/**
 * Briefing diario de flota (IA en Gestión).
 *
 * Cada mañana (o cuando lo pidas) resume en 3 bloques lo que la consola ya
 * tiene en memoria: KPIs del panel, alertas del periodo y órdenes de corte.
 * Se manda SOLO lo agregado (nunca posiciones crudas) y la IA solo redacta:
 * los números los calcula SQL.
 */
export default function BriefingFlota({
  empresaNombre = '',
  periodo = null,
  unidades = [],
  alertas = [],
  cortesPendientes = 0,
  cortesAplicados = 0,
  fuente = 'demo',
}) {
  const [texto, setTexto] = useState('');
  const [generadoEn, setGeneradoEn] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const sinDatos = !unidades.length && !alertas.length;

  const generar = async () => {
    setCargando(true);
    setError(null);
    try {
      const contexto = armarContextoBriefing({
        empresa: empresaNombre,
        periodo,
        unidades,
        alertas,
        cortesPendientes,
        cortesAplicados,
      });
      const data = await llamarIaGestion({ modo: 'briefing', contexto });
      if (!data.texto) throw new Error('La IA no devolvió texto para el briefing.');
      setTexto(data.texto);
      setGeneradoEn(new Date());
    } catch (e) {
      setError(e?.message || 'No se pudo generar el briefing.');
    } finally {
      setCargando(false);
    }
  };

  const lineas = texto.split('\n').map((l) => l.trim()).filter(Boolean);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm min-w-0">
      <div className="p-4 sm:p-5 border-b border-slate-50 flex flex-wrap items-center gap-3">
        <span className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
          <Sun size={17} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900">Briefing del día</h2>
          <p className="text-xs text-slate-500">
            Resumen ejecutivo de la flota con IA: qué pasó, qué preocupa y qué hacer hoy.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {generadoEn ? (
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
              {generadoEn.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : null}
          <button
            type="button"
            onClick={generar}
            disabled={cargando || sinDatos}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={sinDatos ? 'Carga primero los datos de la flota' : 'Generar el briefing con IA'}
          >
            {cargando ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {cargando ? 'Redactando…' : texto ? 'Regenerar' : 'Generar briefing'}
          </button>
        </div>
      </div>

      {cargando ? (
        <div className="p-6 flex flex-col items-center gap-2 text-slate-500">
          <Loader2 size={18} className="animate-spin" />
          <p className="text-xs">Armando el briefing con los datos ya agregados del periodo…</p>
        </div>
      ) : null}

      {error ? (
        <div className="p-6 text-center">
          <div className="mx-auto w-9 h-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
            <AlertTriangle size={17} />
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-700">No se pudo generar el briefing</p>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">{error}</p>
          <button
            type="button"
            onClick={generar}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-forest hover:text-forest transition-colors"
          >
            <RotateCw size={12} /> Reintentar
          </button>
        </div>
      ) : null}

      {!cargando && !error && !texto ? (
        <div className="p-6 text-center">
          <p className="text-sm font-semibold text-slate-600">Sin briefing todavía</p>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-md mx-auto">
            {sinDatos
              ? 'Esta empresa todavía no tiene filas en agrotrack_posiciones, así que no hay cifras que resumir.'
              : 'Pulsa "Generar briefing" para recibir en una pantalla: lo importante hoy, los riesgos y 3 acciones concretas. Coste: una llamada corta de IA.'}
          </p>
        </div>
      ) : null}

      {!cargando && texto ? (
        <div className="p-4 sm:p-5 space-y-1.5">
          {lineas.map((linea, i) => {
            const esTitulo = /^(•|-\s|\d+\.)/.test(linea) === false && linea.length < 46 && /[A-ZÁÉÍÓÚÑ]/.test(linea[0]);
            const esViñeta = /^[•\-]/.test(linea);
            return (
              <p
                key={`${i}-${linea.slice(0, 16)}`}
                className={
                  esViñeta
                    ? 'text-xs text-slate-700 leading-relaxed pl-3'
                    : esTitulo
                      ? 'text-[11px] font-bold uppercase tracking-wide text-slate-500 pt-2'
                      : 'text-xs text-slate-600 leading-relaxed'
                }
              >
                {linea}
              </p>
            );
          })}
          <p className="text-[10px] text-slate-400 border-t border-slate-100 pt-3 leading-relaxed">
            Generado con las cifras ya agregadas del periodo ({fuente === 'real' ? 'datos reales' : 'datos de demostración'});
            la IA solo redacta, no calcula. No sustituye la revisión del responsable de flota.
          </p>
        </div>
      ) : null}
    </div>
  );
}
