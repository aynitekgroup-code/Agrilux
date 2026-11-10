import React, { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileSpreadsheet, LoaderCircle, X } from 'lucide-react';
import { cargarPosicionesZonar } from '../../../lib/agrotrackPosiciones';

const numberFormat = new Intl.NumberFormat('es-PE');

/**
 * Botón "Cargar reporte de unidades". Acepta el ZIP de Zonar o varios .xlsx.
 * El resumen se muestra debajo del encabezado de la tarjeta.
 */
export default function PosicionesImport({ empresaId, userId, disabled = false, onDone }) {
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length || !empresaId) return;

    setLoading(true);
    setError('');
    setSummary(null);
    setProgress(null);
    try {
      const result = await cargarPosicionesZonar(files, empresaId, userId, setProgress);
      setSummary(result);
      onDone?.(result);
    } catch (loadError) {
      setError(loadError.message || 'No se pudo cargar el reporte de unidades.');
    } finally {
      setLoading(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const percent = progress?.total ? Math.round((progress.actual / progress.total) * 100) : 0;

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || loading || !empresaId}
        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
      >
        {loading ? <LoaderCircle size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
        {loading ? 'Cargando…' : 'Cargar reporte de unidades'}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".zip,.xlsx,application/zip,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={handleFiles}
        aria-label="Seleccionar reporte por placa (ZIP o Excel)"
      />

      {/* Los avisos ocupan todo el ancho de la fila de botones */}
      {loading && progress ? (
        <div className="basis-full" role="status" aria-live="polite">
          <p className="text-[11px] text-slate-600">
            {progress.fase}: {numberFormat.format(progress.actual)} de {numberFormat.format(progress.total)}
          </p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${percent}%` }} />
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="basis-full flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1">{error}</span>
        </div>
      ) : null}

      {summary ? (
        <div className="basis-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900" role="status">
          <div className="flex items-start gap-2">
            <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
            <p className="min-w-0 flex-1">
              {summary.unidades} unidades en {summary.archivos} archivos:{' '}
              <strong>{numberFormat.format(summary.nuevas)}</strong> posiciones nuevas
              {summary.yaExistentes ? `, ${numberFormat.format(summary.yaExistentes)} ya estaban guardadas` : ''}
              {summary.duplicadasEnArchivo
                ? `, ${numberFormat.format(summary.duplicadasEnArchivo)} duplicadas descartadas`
                : ''}
              {summary.invalidas ? `, ${numberFormat.format(summary.invalidas)} filas inválidas` : ''}.
            </p>
            <button
              type="button"
              onClick={() => setSummary(null)}
              className="rounded p-0.5 text-emerald-700 hover:bg-emerald-100"
              aria-label="Cerrar resumen"
            >
              <X size={13} />
            </button>
          </div>
          {summary.archivosConError.length ? (
            <p className="mt-1 text-amber-800">No se pudieron leer: {summary.archivosConError.join('; ')}</p>
          ) : null}
          {summary.ejemplosInvalidas.length ? (
            <p className="mt-1 text-amber-800">Ejemplos de filas inválidas: {summary.ejemplosInvalidas.join('; ')}</p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}