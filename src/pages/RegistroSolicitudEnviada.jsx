/**
 * src/pages/RegistroSolicitudEnviada.jsx
 *
 * Página de confirmación de solicitud de incorporación enviada.
 * El usuario debe esperar a que el administrador apruebe su solicitud.
 */

import React from 'react';
import { Clock, Mail, Phone } from 'lucide-react';

export default function RegistroSolicitudEnviada() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 text-center">
        <div className="flex justify-center mb-6">
          <Clock size={40} className="text-amber-500 mx-auto" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">Solicitud enviada</h2>
        <p className="text-gray-600 text-sm mt-4 mb-6">
          Tu solicitud de incorporación ha sido enviada al administrador de la empresa.
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <Clock size={16} className="text-amber-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-800">¿Qué sigue?</p>
              <p className="text-xs text-gray-600">
                El administrador revisará tu solicitud y te notificará por correo o WhatsApp cuando sea aprobada.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => window.location.href = '/registro'}
            className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-[#14522e] transition-colors"
          >
            Ir a iniciar sesión
          </button>
        </div>

        <div className="mt-6 flex items-center gap-2 justify-center text-xs text-gray-500">
          <Mail size={14} />
          <span>¿Preguntas? Contacta al administrador de la empresa</span>
          <Phone size={14} />
          <span>o al soporte de Agrilux</span>
        </div>
      </div>
    </div>
  );
}