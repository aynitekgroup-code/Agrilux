import React, { useState } from 'react';
import { Activity, Cloud, Droplets, Radio, Thermometer, Wifi } from 'lucide-react';

const metricas = [
  { titulo: 'Humedad de suelo', icono: Droplets, nota: 'Sensor de suelo · lectura pendiente de calibración' },
  { titulo: 'Temperatura del aire', icono: Thermometer, nota: 'DHT11 · ubicación según el diseño' },
  { titulo: 'Humedad del aire', icono: Droplets, nota: 'DHT11 · ubicación según el diseño' },
];

export default function InvernaderoPage() {
  const [diseno, setDiseno] = useState(1);
  return <main className="mx-auto max-w-6xl space-y-5 p-4 pb-8 sm:p-6">
    <header className="rounded-2xl bg-forest p-5 text-white sm:p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-200">Piloto IoT · monitoreo agrícola</p>
      <h1 className="mt-2 text-2xl font-bold">Invernadero</h1>
      <p className="mt-2 max-w-3xl text-sm text-emerald-50">Consulta de humedad de suelo, temperatura y humedad del aire mediante nodo LoRa y gateway conectado a internet. No controla el riego.</p>
    </header>

    <section aria-labelledby="lecturas-titulo" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="lecturas-titulo" className="text-lg font-bold text-slate-900">Lecturas del piloto</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Sin conexión de sensores</span></div>
      <p role="status" className="text-sm text-slate-600">Todavía no hay una fuente de mediciones conectada. Los valores y la última actualización aparecerán cuando el gateway y la recepción segura estén implementados.</p>
      <div className="grid gap-3 sm:grid-cols-3">{metricas.map(({ titulo, icono: Icono, nota }) => <article key={titulo} className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm"><Icono size={20} className="text-emerald-700" /><h3 className="mt-3 text-sm font-semibold text-slate-700">{titulo}</h3><p className="mt-2 text-2xl font-bold text-slate-400">—</p><p className="mt-2 text-xs text-slate-500">{nota}</p></article>)}</div>
    </section>

    <section className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5"><h2 className="text-lg font-bold text-slate-900">Flujo del piloto</h2><p className="mt-1 text-sm text-slate-600">La transmisión es una propuesta de instalación, no una conexión ya verificada.</p><ol className="mt-4 grid gap-2 sm:grid-cols-4">{[[Activity, 'Sensores', 'Suelo y aire'], [Radio, 'Nodo LoRa', 'ESP32-S3 emisor'], [Wifi, 'Gateway', 'ESP32-S3 receptor · WiFi'], [Cloud, 'Agrilux', 'HTTPS → Supabase → consulta']].map(([Icono, titulo, texto], i) => <li key={titulo} className="rounded-lg bg-emerald-50 p-3"><Icono size={18} className="text-emerald-700" /><p className="mt-2 text-sm font-semibold text-slate-800">{i + 1}. {titulo}</p><p className="text-xs text-slate-600">{texto}</p></li>)}</ol></section>

    <section className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm sm:p-5"><h2 className="text-lg font-bold text-slate-900">Diseños de prueba</h2><div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Seleccionar diseño del piloto">{[1, 2].map((n) => <button key={n} type="button" aria-pressed={diseno === n} onClick={() => setDiseno(n)} className={`rounded-lg border px-4 py-2 text-sm font-semibold ${diseno === n ? 'border-forest bg-forest text-white' : 'border-emerald-200 text-forest hover:bg-emerald-50'}`}>Diseño {n}{n === 1 ? ' · recomendado' : ' · alternativa'}</button>)}</div>
      {diseno === 1 ? <div className="mt-4 text-sm text-slate-700"><h3 className="font-bold">Estación de campo completa</h3><p className="mt-1">El nodo reúne el sensor de suelo, el DHT11 y LoRa; el gateway recibe por LoRa y envía por WiFi. Las tres mediciones corresponden a la ubicación del nodo.</p></div> : <div className="mt-4 text-sm text-slate-700"><h3 className="font-bold">Suelo en campo y aire en el gateway</h3><p className="mt-1">El nodo mide el suelo; el gateway mide el aire y combina los datos. Temperatura y humedad del aire corresponden al lugar del gateway, no necesariamente al campo.</p></div>}
      <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Antes de montar: confirmar modelo de placas, chip LoRa, frecuencia, antenas, alimentación y sensor de suelo con salida analógica. No transmitir sin antena. El uso de un GPIO para alimentar un sensor requiere comprobar consumo, picos y límites eléctricos de la placa; no conectar basándose solo en el esquema.</p>
    </section>
    <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700"><h2 className="font-bold text-slate-900">Estado y validación</h2><p className="mt-2">El objetivo del piloto es que al menos el 95 % de las lecturas enviadas llegue a Agrilux en pruebas de mesa con los mismos valores. Este objetivo aún no se ha medido. Se requiere recepción autenticada por gateway, HTTPS y permisos de datos; no colocar claves de servicio en las placas.</p><p className="mt-2 text-xs text-slate-500">Referencia: diseños de prueba del piloto IoT, factura E001-8094. MQTT se considera una ampliación futura.</p></section>
  </main>;
}
