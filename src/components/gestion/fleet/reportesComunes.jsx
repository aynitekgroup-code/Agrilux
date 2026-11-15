import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, AlertTriangle, RotateCw, CalendarClock, Database } from 'lucide-react';
import { rangoDiaLima, rangoMesLima, rangoLibreLima, formatearRango, ultimoDiaLima } from '../../../lib/agrotrackFlota';

/**
 * src/components/gestion/fleet/reportesComunes.jsx
 * Piezas compartidas por las tarjetas de reportes de flota (actividad,
 * eventos resumidos, estado de unidades y geocercas): el selector de rango
 * (todo / día / mes) y los cuatro estados de cada tarjeta (pendiente de
 * fecha, cargando, error, vacío). Un solo lugar para que todas las tarjetas
 * se comporten igual.
 */

export const RANGOS = [
  { id: 'todo', label: 'Todo el periodo' },
  { id: 'dia', label: 'Por día' },
  { id: 'mes', label: 'Por mes' },
  { id: 'libre', label: 'Desde / hasta' },
];

/** Número localizado con el mínimo de decimales pedido. */
export function numero(valor, decimales = 1) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('es-PE', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

/**
 * Cuánto tiempo hace desde una fecha ISO, en lenguaje llano:
 * "hace 12 h 30 min" · "hace 45 min" · "hace 3 d 4 h" · "hace instantes".
 * Lo usa el reporte "Unidades sin reportar" (Zonar) y su exportación a
 * Excel, para que el texto en pantalla y en el archivo sean idénticos.
 * @param {string} iso      fecha de la última comunicación (GPRS)
 * @param {Date}   ahora    instante contra el que se compara (por defecto, hoy)
 */
export function haceCuanto(iso, ahora = new Date()) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return 'sin reporte';
  const seg = Math.max(0, Math.floor((ahora.getTime() - t) / 1000));
  const dias = Math.floor(seg / 86400);
  const horas = Math.floor((seg % 86400) / 3600);
  const minutos = Math.floor((seg % 3600) / 60);
  if (dias > 0) return `hace ${dias} d ${horas} h`;
  if (horas > 0) return `hace ${horas} h ${minutos} min`;
  if (minutos > 0) return `hace ${minutos} min`;
  return 'hace instantes';
}

/**
 * Selector de rango (todo / día / mes) de una tarjeta. Precarga el día y el
 * mes con el último dato real y expone `consulta` ({ desde, hasta, texto })
 * listo para la RPC.
 */
export function useRango(periodo, rangoInicial = 'dia') {
  // 14/11/2026: por defecto "Por día". "Todo el periodo" recorre todo el
  // histórico y con varios meses cargados supera los 8 s de Supabase.
  const [rango, setRango] = useState(rangoInicial);
  const [dia, setDia] = useState('');
  const [mes, setMes] = useState('');
  // Rango libre con hora (pedido por el Ing. Carlos Perez): dos buscadores de
  // fecha+hora en formato datetime-local, interpretados en hora de Perú.
  const [desdeHora, setDesdeHora] = useState('');
  const [hastaHora, setHastaHora] = useState('');

  // Precarga con el último día (o mes) que trae datos reales.
  useEffect(() => {
    if (!periodo?.hasta) return;
    const ultimo = ultimoDiaLima(periodo.hasta);
    if (!ultimo) return;
    setDia((prev) => prev || ultimo);
    setMes((prev) => prev || ultimo.slice(0, 7));
    // El rango libre arranca como ese último día completo (00:00 a 23:59).
    setDesdeHora((prev) => prev || `${ultimo}T00:00`);
    setHastaHora((prev) => prev || `${ultimo}T23:59`);
  }, [periodo?.hasta]);

  const consulta = useMemo(() => {
    if (rango === 'dia') return { ...rangoDiaLima(dia), texto: dia };
    if (rango === 'mes') return { ...rangoMesLima(mes), texto: mes };
    if (rango === 'libre') return rangoLibreLima(desdeHora, hastaHora);
    return {
      desde: periodo?.desde || null,
      hasta: periodo?.hasta || null,
      texto: periodo?.desde ? formatearRango(periodo.desde, periodo.hasta) : '',
    };
  }, [rango, dia, mes, desdeHora, hastaHora, periodo]);

  const pendienteDeFecha =
    (rango === 'dia' && !dia) || (rango === 'mes' && !mes)
    || (rango === 'libre' && (!desdeHora || !hastaHora))
    || (rango === 'todo' && !periodo?.desde);

  return {
    rango, setRango, dia, setDia, mes, setMes,
    desdeHora, setDesdeHora, hastaHora, setHastaHora,
    consulta, pendienteDeFecha,
  };
}

/** Hoy en hora de Perú (YYYY-MM-DD). */
export function hoyLima(ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(ahora);
}

function sumarDias(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/**
 * Atajos de Zonar (Hoy · Ayer · Esta semana · Semana anterior) como rangos
 * "Desde / hasta" con hora: { desde: 'YYYY-MM-DDT00:00', hasta: '...T23:59' }.
 * La semana va de lunes a domingo, como en Zonar.
 */
export function rangoRapido(id, ahora = new Date()) {
  const hoy = hoyLima(ahora);
  const [y, m, d] = hoy.split('-').map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // 0 = lunes
  const lunes = sumarDias(hoy, -dow);
  const rangos = {
    hoy: [hoy, hoy],
    ayer: [sumarDias(hoy, -1), sumarDias(hoy, -1)],
    semana: [lunes, hoy],
    'semana-anterior': [sumarDias(lunes, -7), sumarDias(lunes, -1)],
  };
  const r = rangos[id];
  if (!r) return null;
  return { desde: `${r[0]}T00:00`, hasta: `${r[1]}T23:59` };
}

const ATAJOS = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'ayer', label: 'Ayer' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'semana-anterior', label: 'Semana anterior' },
];

/** Botones del rango + date/month/libre, compartidos por las tarjetas. */
export function ControlesRango({
  rango, setRango, dia, setDia, mes, setMes,
  desdeHora = '', setDesdeHora = () => {}, hastaHora = '', setHastaHora = () => {},
}) {
  const aplicarAtajo = (id) => {
    const r = rangoRapido(id);
    if (!r) return;
    if (id === 'hoy' || id === 'ayer') {
      setDia(r.desde.slice(0, 10));
      setRango('dia');
      return;
    }
    setDesdeHora(r.desde);
    setHastaHora(r.hasta);
    setRango('libre');
  };
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Atajos (como Zonar)</p>
        <div className="flex gap-1.5">
          {ATAJOS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => aplicarAtajo(a.id)}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-slate-200 bg-white text-slate-600 hover:border-forest hover:text-forest transition-colors"
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Rango</p>
        <div className="flex gap-1.5">
          {RANGOS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRango(r.id)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                rango === r.id ? 'bg-forest text-white' : 'bg-slate-50 text-slate-500 hover:text-forest'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {rango === 'dia' ? (
        <label className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Día</span>
          <input
            type="date"
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
      ) : null}

      {rango === 'mes' ? (
        <label className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Mes</span>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
      ) : null}

      {rango === 'libre' ? (
        <>
          <label className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Desde · hora de Perú</span>
            <input
              type="datetime-local"
              value={desdeHora}
              onChange={(e) => setDesdeHora(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <label className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Hasta · hora de Perú</span>
            <input
              type="datetime-local"
              value={hastaHora}
              onChange={(e) => setHastaHora(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
        </>
      ) : null}
    </div>
  );
}

/** Estados compartidos (pendiente / cargando / error / vacío) de una tarjeta. */
export function CuerpoEstado({ pendienteDeFecha, mensajePendiente, estado, error, onReintentar, mensajeVacio, children }) {
  if (pendienteDeFecha) {
    return (
      <div className="p-8 flex flex-col items-center gap-2 text-slate-400">
        <CalendarClock size={18} />
        <p className="text-xs text-center leading-relaxed max-w-md">{mensajePendiente}</p>
      </div>
    );
  }
  if (estado === 'cargando') {
    return (
      <div className="p-8 flex flex-col items-center gap-2 text-slate-500">
        <Loader2 size={18} className="animate-spin" />
        <p className="text-xs">Calculando el reporte en la base de datos…</p>
      </div>
    );
  }
  if (estado === 'error') {
    return (
      <div className="p-8 text-center">
        <div className="mx-auto w-9 h-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
          <AlertTriangle size={17} />
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-700">No se pudo cargar el reporte</p>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{error}</p>
        <button
          type="button"
          onClick={onReintentar}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-forest hover:text-forest transition-colors"
        >
          <RotateCw size={12} /> Reintentar
        </button>
      </div>
    );
  }
  if (estado === 'vacio') {
    return (
      <div className="p-8 text-center">
        <p className="text-sm font-semibold text-slate-600">Sin datos para ese rango</p>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{mensajeVacio}</p>
      </div>
    );
  }
  return children;
}

/**
 * Estado honesto de un reporte que todavía no tiene fuente real de datos:
 * en lugar de cifras inventadas se explica qué falta. Compartido por la
 * consola de flota y por ReportesPage (catálogo de módulos).
 */
export function PanelSinDatos({ titulo, descripcion, puntos = [], nota = null }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
          <Database size={18} />
        </span>
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
            Sin datos
          </span>
          <h3 className="mt-2 text-base font-bold text-slate-800">{titulo}</h3>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed max-w-3xl">{descripcion}</p>
          {puntos.length ? (
            <ul className="mt-3 space-y-1.5">
              {puntos.map((punto) => (
                <li key={punto} className="text-xs text-slate-500 flex items-start gap-2">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                  {punto}
                </li>
              ))}
            </ul>
          ) : null}
          {nota ? (
            <p className="mt-3 text-[11px] text-slate-400 border-t border-slate-100 pt-3 leading-relaxed">{nota}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
