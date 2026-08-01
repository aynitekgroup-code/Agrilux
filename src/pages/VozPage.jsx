import React from 'react';
import { Mic, ShoppingCart, MapPin, Phone } from 'lucide-react';
import VoiceAssistant from '../components/VoiceAssistant';

export default function VozPage() {
  return (
    <div className="min-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-b-3xl -mx-4 -mt-2 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <Mic size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold">Agente de Ventas</h1>
            <p className="text-green-100 text-sm">Tu asistente agrícola por voz</p>
          </div>
        </div>
      </div>

      {/* Capacidades */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <ShoppingCart size={20} className="text-blue-600 mx-auto mb-1" />
          <p className="text-xs font-medium text-blue-800">Precios</p>
          <p className="text-[10px] text-blue-600">Consulta costos de insumos</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <MapPin size={20} className="text-green-600 mx-auto mb-1" />
          <p className="text-xs font-medium text-green-800">Tiendas</p>
          <p className="text-[10px] text-green-600">Encuentra proveedores cercanos</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-3 text-center">
          <Phone size={20} className="text-purple-600 mx-auto mb-1" />
          <p className="text-xs font-medium text-purple-800">Contacto</p>
          <p className="text-[10px] text-purple-600">WhatsApp y redes sociales</p>
        </div>
      </div>

      {/* Asistente de voz */}
      <VoiceAssistant fullPage={true} />
    </div>
  );
}
