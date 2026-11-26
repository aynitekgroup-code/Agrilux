import React, { useRef } from 'react';
import { ChevronDown, FileChartColumn } from 'lucide-react';

const GRUPOS = [
  { nombre: 'Hunter 360', opciones: [
    ['hunter-actividad', 'Reporte de actividad · Hunter 360'],
    ['hunter-status', 'Status de maquinaria · Hunter 360'],
    ['hunter-reportes', 'Reportes Hunter 360'],
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

export default function MenuReportes() {
  const menu = useRef(null);
  return <details ref={menu} className="relative rounded-xl border border-emerald-200 bg-white" onKeyDown={(e) => { if (e.key === 'Escape') { menu.current.open = false; menu.current.querySelector('summary')?.focus(); } }}>
    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-bold text-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700">
      <FileChartColumn size={18} /> Menú de reportes <ChevronDown className="ml-auto" size={17} />
    </summary>
    <nav aria-label="Accesos directos a reportes" className="absolute left-0 top-full z-30 mt-1 max-h-[70vh] w-[min(90vw,360px)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
      {GRUPOS.map((grupo) => <div key={grupo.nombre}>
        <p className="px-3 pt-3 pb-1 text-xs font-bold uppercase text-slate-500">{grupo.nombre}</p>
        {grupo.opciones.map(([id, etiqueta]) => <a key={id} href={`#${id}`} onClick={() => { if (menu.current) menu.current.open = false; }} className="block rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:bg-emerald-50 hover:text-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest">{etiqueta}</a>)}
      </div>)}
    </nav>
  </details>;
}
