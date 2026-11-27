import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, FileChartColumn, X } from 'lucide-react';

export const GRUPOS = [
  { nombre: 'Hunter 360', opciones: [
    ['hunter-reportes', 'Horas por geocerca · Hunter 360'],
    ['hunter-actividad', 'Reporte de actividad · Hunter 360'],
    ['hunter-status', 'Status de maquinaria · Hunter 360'],
  ] },
  { nombre: 'Zonar', opciones: [
    ['zonar-kilometros', 'Kilómetros diarios por unidad · Zonar'],
    ['zonar-actividad', 'Reporte de actividad'],
    ['zonar-eventos', 'Eventos resumidos (Stop / Idle / Drive)'],
    ['zonar-status', 'Status de maquinaria'],
    ['zonar-sin-reportar', 'Unidades sin reportar'],
    ['zonar-geocercas', 'Estado por geocerca'],
  ] },
  { nombre: 'Otros', opciones: [
    ['reportes-vigia', 'Vigía de flota'],
    ['reportes-catalogo', 'Reportes del catálogo'],
  ] },
];

export default function MenuReportes({ onSeleccionar }) {
  const [abierto, setAbierto] = useState(false);
  const boton = useRef(null);
  useEffect(() => {
    if (!abierto) return undefined;
    const alPulsar = (evento) => { if (evento.key === 'Escape') { setAbierto(false); boton.current?.focus(); } };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [abierto]);
  return <>
    <button ref={boton} type="button" onClick={() => setAbierto(true)} aria-expanded={abierto} aria-haspopup="dialog" className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700">
      <FileChartColumn size={18} /> Menú de reportes <ChevronDown className="ml-auto" size={17} />
    </button>
    {abierto ? createPortal(<div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Menú de reportes">
      <button type="button" aria-label="Cerrar menú de reportes" onClick={() => setAbierto(false)} className="absolute inset-0 bg-black/45" />
      <div className="menu-lateral absolute inset-y-0 left-0 flex w-[min(86%,360px)] flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-forest px-4 py-3 text-sm font-bold text-white">Menú de reportes <button type="button" aria-label="Cerrar menú de reportes" onClick={() => setAbierto(false)} className="rounded-lg p-2 hover:bg-white/10"><X size={18} /></button></div>
        <nav aria-label="Accesos directos a reportes" className="flex-1 overflow-y-auto p-2">
          {GRUPOS.map((grupo) => <details key={grupo.nombre} open>
            <summary className="cursor-pointer rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold uppercase text-forest">{grupo.nombre}</summary>
            {grupo.opciones.map(([id, etiqueta]) => <button type="button" key={id} onClick={() => { setAbierto(false); onSeleccionar(id); }} className="block w-full rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-emerald-50 hover:text-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest">{etiqueta}</button>)}
          </details>)}
        </nav>
      </div>
    </div>, document.body) : null}
  </>;
}
