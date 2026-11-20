import React from 'react';
import {
  BookOpen,
  Database,
  FileCode2,
  LockKeyhole,
  Server,
  ShieldCheck,
  Store,
  Upload,
} from 'lucide-react';

const scriptGroups = [
  {
    title: 'Acceso y autorización',
    icon: LockKeyhole,
    color: 'bg-red-50 text-red-700 border-red-100',
    items: [
      ['src/pages/admin/Admin.jsx', 'Login, clave, sesiones, pestañas y operaciones del panel.'],
      ['src/components/Layout.jsx', 'Abre el acceso administrador desde el menú de la aplicación.'],
      ['api/alertas-preventivas.js', 'Valida la clave ADMIN_KEY en el servidor.'],
    ],
  },
  {
    title: 'Usuarios y diagnósticos',
    icon: Database,
    color: 'bg-blue-50 text-blue-700 border-blue-100',
    items: [
      ['src/lib/supabase.js', 'Crea el cliente de conexión a Supabase.'],
      ['Supabase: usuarios', 'Carga, crea, edita y elimina usuarios desde el panel.'],
      ['Supabase: diagnosticos', 'Consulta el historial para revisión y exportación.'],
    ],
  },
  {
    title: 'Tiendas y mercado',
    icon: Store,
    color: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    items: [
      ['api/tiendas.js', 'Administra tiendas, comunidad y operaciones protegidas por ADMIN_KEY.'],
      ['src/lib/tiendasComunidad.js', 'Elimina o consulta tiendas de la comunidad.'],
      ['src/components/Marketing.jsx', 'Gestiona contenido y acciones de marketing del panel.'],
    ],
  },
  {
    title: 'Exportación y dataset',
    icon: Upload,
    color: 'bg-violet-50 text-violet-700 border-violet-100',
    items: [
      ['jszip', 'Genera el ZIP con JSON, CSV y training.jsonl en el navegador.'],
      ['VITE_GOOGLE_CLIENT_ID', 'Permite subir el dataset a Google Drive.'],
      ['Exportar en src/pages/admin/Admin.jsx', 'Excluye password_default y registra el resumen de exportación.'],
    ],
  },
];

const architecture = [
  ['Administrador', 'Ingresa correo autorizado + clave de servidor.'],
  ['Admin.jsx', 'Muestra el panel solo después de autorización.'],
  ['Supabase', 'Entrega usuarios, diagnósticos, tiendas y datos operativos.'],
  ['APIs serverless', 'Protegen operaciones especiales y claves privadas.'],
  ['Exportación', 'Genera archivos locales o los sube a Drive.'],
];

export default function AdminDocs() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gray-900 p-5 text-white">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-green-500/20 p-3 text-green-300">
            <BookOpen size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-green-400">Documentación privada</p>
            <h2 className="mt-1 text-xl font-bold">Mapa del modo administrador</h2>
            <p className="mt-2 text-sm text-gray-400">
              Esta información solo se muestra dentro del panel autorizado y resume los archivos que intervienen en cada operación.
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck size={18} className="text-green-600" />
          <h3 className="font-bold text-gray-800">Flujo de acceso</h3>
        </div>
        <div className="space-y-2">
          {architecture.map(([title, detail], index) => (
            <div key={title} className="flex items-start gap-3 rounded-xl bg-gray-50 p-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">{index + 1}</span>
              <div>
                <p className="text-sm font-bold text-gray-800">{title}</p>
                <p className="mt-0.5 text-xs text-gray-500">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {scriptGroups.map(({ title, icon: Icon, color, items }) => (
          <section key={title} className={`rounded-2xl border p-4 ${color}`}>
            <div className="mb-3 flex items-center gap-2">
              <Icon size={18} />
              <h3 className="font-bold">{title}</h3>
            </div>
            <div className="space-y-3">
              {items.map(([file, description]) => (
                <div key={file}>
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <FileCode2 size={13} />
                    <code>{file}</code>
                  </div>
                  <p className="mt-1 text-xs opacity-80">{description}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <Server size={18} className="mt-0.5 shrink-0 text-amber-700" />
          <div>
            <h3 className="font-bold text-amber-900">Regla de seguridad</h3>
            <p className="mt-1 text-xs leading-relaxed text-amber-800">
              Las claves privadas permanecen en Vercel como variables de entorno. Esta pantalla documenta archivos y flujo, pero nunca muestra valores secretos.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
