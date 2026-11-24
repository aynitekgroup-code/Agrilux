import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, BrainCircuit, Cable, Droplets, Leaf, Mail, MapPin, Phone, Radio, Sprout, Tractor } from 'lucide-react';

const soluciones = [
  { icon: Sprout, titulo: 'Monitoreo de cultivos', texto: 'Información del campo y herramientas de apoyo para el seguimiento de cultivos.' },
  { icon: Droplets, titulo: 'Riego inteligente', texto: 'Sensores y herramientas para conocer las condiciones del campo y gestionar el agua.' },
  { icon: BrainCircuit, titulo: 'Inteligencia artificial', texto: 'Asistentes y diagnóstico de apoyo para transformar información en decisiones.' },
  { icon: Tractor, titulo: 'Maquinaria y flota', texto: 'Ubicación, recorridos y reportes operativos mediante AgroTrack e integraciones.' },
  { icon: BarChart3, titulo: 'Gestión de recursos', texto: 'Datos para organizar operaciones y aprovechar mejor los recursos agrícolas.' },
  { icon: Cable, titulo: 'Soluciones a medida', texto: 'Integración de hardware, software, sensores y plataformas existentes.' },
];

export default function Bienvenida() {
  return (
    <div className="min-h-screen bg-[#f8faf6] text-slate-800">
      <header className="border-b border-emerald-900/10 bg-white">
        <nav aria-label="Navegación principal" className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <a href="#inicio" className="flex items-center gap-3" aria-label="Agrilux, inicio">
            <img src="/icons/Agrilux.logo%20(2).png" alt="" className="h-11 w-11 object-contain" />
            <span><span className="block text-lg font-extrabold tracking-[0.12em] text-[#174e35]">AGRILUX</span><span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">Tecnología para el campo</span></span>
          </a>
          <div className="flex items-center gap-4 sm:gap-6">
            <a href="#soluciones" className="hidden text-sm font-semibold text-slate-600 hover:text-emerald-800 sm:inline">Soluciones</a>
            <a href="#contacto" className="hidden text-sm font-semibold text-slate-600 hover:text-emerald-800 sm:inline">Contacto</a>
            <Link to="/diagnostico" className="inline-flex items-center gap-2 rounded-full bg-[#17613d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#104a30] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">Ingresar <ArrowRight size={16} /></Link>
          </div>
        </nav>
      </header>

      <main id="inicio">
        <section className="overflow-hidden bg-[#103d2d] text-white">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-100/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-emerald-100"><Leaf size={14} /> Innovación agrícola peruana</p>
              <h1 className="max-w-2xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">Inteligencia y tecnología <span className="text-[#b7e69b]">conectadas al campo.</span></h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-emerald-50/85 sm:text-lg">Agrilux es una startup peruana del grupo Lumajira. Desarrollamos e integramos plataformas digitales, agentes de inteligencia artificial y sensores IoT para el monitoreo de cultivos, la gestión del campo y el riego inteligente.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/diagnostico" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#c4eea9] px-6 py-3.5 text-sm font-bold text-[#103d2d] hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Ingresar a Agrilux <ArrowRight size={17} /></Link>
                <a href="#contacto" className="inline-flex items-center justify-center rounded-xl border border-white/40 px-6 py-3.5 text-sm font-bold text-white hover:bg-white/10">Solicitar información</a>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-gradient-to-br from-[#2e7752] via-[#1c5a3c] to-[#0b3024] p-8 shadow-2xl sm:p-12">
              <div className="absolute -right-12 -top-16 h-56 w-56 rounded-full bg-lime-300/10 blur-3xl" />
              <div className="relative rounded-3xl border border-white/20 bg-white/10 p-6 backdrop-blur-sm sm:p-8">
                <Radio className="text-[#c4eea9]" size={30} />
                <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-emerald-100/75">Del dato a la decisión</p>
                <h2 className="mt-3 text-2xl font-bold leading-snug sm:text-3xl">Un campo más conectado empieza con mejor información.</h2>
                <p className="mt-4 text-sm leading-6 text-emerald-50/80">Integramos tecnología y conocimiento agrícola para acompañar a productores y empresas en la gestión de sus operaciones.</p>
                <div className="mt-8 flex flex-wrap gap-2 text-xs font-semibold text-emerald-50">{['Sensores IoT', 'IA', 'Gestión agrícola'].map((item) => <span key={item} className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">{item}</span>)}</div>
              </div>
            </div>
          </div>
        </section>

        <section id="soluciones" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Lo que hacemos</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#153d2e] sm:text-4xl">Soluciones para una agricultura más inteligente</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">Combinamos herramientas digitales y tecnología de campo para responder a las necesidades de cada operación agrícola.</p>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {soluciones.map(({ icon: Icon, titulo, texto }) => <article key={titulo} className="rounded-2xl border border-emerald-900/10 bg-white p-6 shadow-sm"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon size={21} /></div><h3 className="mt-5 text-lg font-bold text-[#153d2e]">{titulo}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{texto}</p></article>)}
          </div>
          <p className="mt-5 text-xs leading-5 text-slate-500">Las soluciones pueden estar disponibles, desarrollarse a medida o encontrarse en evolución. Contáctanos para conocer su alcance.</p>
        </section>

        <section className="bg-[#eaf2e8] px-5 py-16 sm:px-8">
          <div className="mx-auto max-w-7xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Cómo trabajamos</p><h2 className="mt-3 text-3xl font-bold text-[#153d2e]">Del campo a decisiones mejor informadas</h2><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['01', 'Conectamos', 'Sensores y fuentes de datos.'], ['02', 'Monitoreamos', 'Cultivos y operaciones.'], ['03', 'Analizamos', 'Información relevante del campo.'], ['04', 'Acompañamos', 'Decisiones y gestión agrícola.']].map(([n, titulo, texto]) => <div key={n} className="rounded-2xl bg-white/70 p-5"><span className="text-xs font-bold text-emerald-600">{n}</span><h3 className="mt-2 font-bold text-[#153d2e]">{titulo}</h3><p className="mt-1 text-sm text-slate-600">{texto}</p></div>)}</div></div>
        </section>

        <section id="contacto" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="grid gap-8 rounded-3xl bg-[#153d2e] p-7 text-white sm:p-10 lg:grid-cols-2 lg:p-12"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b7e69b]">Conversemos</p><h2 className="mt-3 text-3xl font-bold">Construyamos soluciones para tu campo.</h2><p className="mt-4 max-w-lg text-sm leading-6 text-emerald-50/80">Cuéntanos sobre tu operación y conoce cómo Agrilux puede acompañar tus proyectos agrícolas.</p></div><div className="space-y-4 text-sm"><a href="mailto:aynitek.group@gmail.com" className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 p-4 hover:bg-white/10"><Mail size={20} className="text-[#b7e69b]" /><span><span className="block text-xs text-emerald-100/70">Correo</span>aynitek.group@gmail.com</span></a><a href="tel:+51920789045" className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 p-4 hover:bg-white/10"><Phone size={20} className="text-[#b7e69b]" /><span><span className="block text-xs text-emerald-100/70">Teléfono</span>920 789 045</span></a><p className="flex items-center gap-3 px-4 text-emerald-50/80"><MapPin size={18} /> Perú</p></div></div>
        </section>
      </main>
      <footer className="border-t border-emerald-900/10 bg-white px-5 py-6 sm:px-8"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 text-xs text-slate-500"><p>© {new Date().getFullYear()} Agrilux · Una empresa del grupo Lumajira</p><div className="flex gap-5"><Link to="/diagnostico" className="hover:text-emerald-700">Ingresar</Link><a href="#contacto" className="hover:text-emerald-700">Contacto</a><Link to="/privacy" className="hover:text-emerald-700">Política de privacidad</Link></div></div></footer>
    </div>
  );
}
