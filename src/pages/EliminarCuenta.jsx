import React from 'react';
import { Mail, MessageCircle, Trash2 } from 'lucide-react';

export default function EliminarCuenta() {
  return (
    <main className="min-h-screen bg-white px-5 py-8 text-gray-700">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-red-50 p-3 text-red-600">
            <Trash2 size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Cuenta autenticada</p>
            <h1 className="text-2xl font-bold text-gray-900">Eliminar cuenta y datos</h1>
          </div>
        </div>

        <p className="text-sm leading-6">
          Puedes solicitar la eliminación de tu cuenta de Agrilux y de los datos asociados.
        </p>

        <div className="mt-6 space-y-4">
          <section className="rounded-xl border border-green-100 bg-green-50 p-5">
            <h2 className="font-bold text-green-800">Solicitar por correo</h2>
            <p className="mt-2 text-sm">Indica el correo con el que te registraste.</p>
            <a
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white"
              href="mailto:aynitek.group@gmail.com?subject=Solicitud%20de%20eliminaci%C3%B3n%20de%20cuenta"
            >
              <Mail size={16} /> aynitek.group@gmail.com
            </a>
          </section>

          <section className="rounded-xl border border-green-100 bg-green-50 p-5">
            <h2 className="font-bold text-green-800">Solicitar por WhatsApp</h2>
            <p className="mt-2 text-sm">También puedes escribir al +51 935 211 605.</p>
            <a
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white"
              href="https://wa.me/51935211605"
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={16} /> Contactar
            </a>
          </section>
        </div>

        <section className="mt-6 text-sm leading-6">
          <h2 className="font-bold text-gray-900">Datos que se eliminan</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Cuenta, nombre y credenciales de acceso.</li>
            <li>Fotos e historial de diagnósticos.</li>
            <li>Ubicación guardada y preferencias.</li>
          </ul>
          <p className="mt-4 text-gray-500">
            La solicitud se procesa en un máximo de 7 días hábiles y la eliminación se completa hasta en 30 días.
          </p>
        </section>
      </div>
    </main>
  );
}
