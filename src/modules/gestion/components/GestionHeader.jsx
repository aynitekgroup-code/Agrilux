import React from 'react';
import { ClipboardList } from 'lucide-react';

export default function GestionHeader() {
  return (
    <header className="bg-[#1e293b] text-white -mx-4 px-4 py-4 mb-3">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
          <ClipboardList size={23} />
        </div>
        <div>
          <h1 className="text-lg font-bold leading-tight">Gestión Agrilux</h1>
          <p className="text-[11px] text-slate-300">Administra tus recursos y operaciones</p>
        </div>
      </div>
    </header>
  );
}
