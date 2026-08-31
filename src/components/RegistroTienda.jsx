/**
 * src/components/RegistroTienda.jsx
 *
 * Formulario para que usuarios registren su tienda agrícola
 * Se almacena en Supabase tabla 'tiendas_comunidad'
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import {
  Store, MapPin, Globe, Camera, Image as ImageIcon,
  CheckCircle, Loader2, X, ChevronDown, Lock, Trash2,
} from 'lucide-react';

const DEPARTAMENTOS = [
  'Amazonas', 'Áncash', 'Apurímac', 'Arequipa', 'Ayacucho',
  'Cajamarca', 'Callao', 'Cusco', 'Huancavelica', 'Huánuco',
  'Ica', 'Junín', 'La Libertad', 'Lambayeque', 'Lima',
  'Loreto', 'Madre de Dios', 'Moquegua', 'Pasco', 'Piura',
  'Puno', 'San Martín', 'Tacna', 'Tumbes', 'Ucayali',
];

const ESPECIALIDADES = [
  'Fertilizantes', 'Semillas', 'Agroquímicos', 'Herramientas',
  'Riego', 'Maquinaria', 'Alimentos animales', 'Veterinaria',
  'Abonos orgánicos', 'Control biológico',
];

function tiendaAFormulario(tienda) {
  const wa = String(tienda.whatsapp || tienda.whatsappFormateado || '').replace(/\D/g, '');
  return {
    nombre: tienda.nombre || '',
    direccion: tienda.direccion || '',
    distrito: tienda.distrito || '',
    departamento: tienda.departamento || '',
    lat: tienda.lat != null ? String(tienda.lat) : '',
    lon: tienda.lon != null ? String(tienda.lon) : '',
    whatsapp: wa.startsWith('51') ? wa.slice(2) : wa,
    facebook: tienda.facebook || '',
    instagram: tienda.instagram || '',
    web: tienda.web || '',
    especialidades: tienda.especialidades || [],
    horario: tienda.horario || '',
    descripcion: tienda.descripcion || '',
    fotos: tienda.fotos || [],
  };
}

function puedeEditarTienda(tienda, user) {
  const uid = user?.id || user?.uid;
  if (!uid || !tienda) return false;
  if (tienda.propietarioId === uid) return true;
  if (user.email && tienda.propietarioEmail === user.email) return true;
  return false;
}

export default function RegistroTienda({ onCerrado, onRegistrada, tienda = null }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const esEdicion = !!tienda?.id;
  const [form, setForm] = useState(() => (tienda ? tiendaAFormulario(tienda) : {
    nombre: '',
    direccion: '',
    distrito: '',
    departamento: '',
    lat: '',
    lon: '',
    whatsapp: '',
    facebook: '',
    instagram: '',
    web: '',
    especialidades: [],
    horario: '',
    descripcion: '',
    fotos: [],
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);
  const [buscandoCoord, setBuscandoCoord] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  useEffect(() => {
    if (tienda) setForm(tiendaAFormulario(tienda));
  }, [tienda]);

  const handleChange = (key, value) => {
    setForm(f => ({ ...f, [key]: value }));
  };

  const toggleEspecialidad = (esp) => {
    setForm(f => ({
      ...f,
      especialidades: f.especialidades.includes(esp)
        ? f.especialidades.filter(e => e !== esp)
        : [...f.especialidades, esp],
    }));
  };

  const buscarCoordenadas = async () => {
    if (!form.direccion && !form.distrito) {
      setError('Escribe una dirección o distrito primero');
      return;
    }
    setBuscandoCoord(true);
    setError('');
    try {
      const query = [form.direccion, form.distrito, form.departamento, 'Perú']
        .filter(Boolean)
        .join(', ');
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.lat && data.lon) {
        setForm(f => ({ ...f, lat: data.lat, lon: data.lon }));
      } else {
        setError('No se encontraron coordenadas. Intenta con otra dirección.');
      }
    } catch {
      setError('Error al buscar coordenadas');
    }
    setBuscandoCoord(false);
  };

  const subirFoto = async (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) {
      setError('Solo se permiten imágenes');
      return;
    }
    if (archivo.size > 5 * 1024 * 1024) {
      setError('La imagen no puede superar 5MB');
      return;
    }
    if (form.fotos.length >= 5) {
      setError('Maximo 5 fotos por tienda');
      return;
    }

    setSubiendoFoto(true);
    setError('');
    try {
      const userId = user?.id || user?.uid;
      const timestamp = Date.now();
      const extension = archivo.name.split('.').pop();
      const fileName = `${userId}_${timestamp}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('tiendas').upload(fileName, archivo, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('tiendas').getPublicUrl(fileName);
      setForm(f => ({ ...f, fotos: [...f.fotos, publicUrl] }));
    } catch (err) {
      setError('Error al subir imagen: ' + err.message);
    }
    setSubiendoFoto(false);
    e.target.value = '';
  };

  const eliminarFoto = (index) => {
    setForm(f => ({ ...f, fotos: f.fotos.filter((_, i) => i !== index) }));
  };

  const guardar = async () => {
    const uid = user?.id || user?.uid;
    if (!uid) {
      setError('Debes iniciar sesión para registrar tu tienda');
      return;
    }
    if (esEdicion && !puedeEditarTienda(tienda, user)) {
      setError('No tienes permiso para editar esta tienda');
      return;
    }
    if (!form.nombre.trim()) { setError('El nombre de la tienda es obligatorio'); return; }
    if (!form.whatsapp.trim()) { setError('El número de WhatsApp es obligatorio'); return; }

    setLoading(true);
    setError('');
    try {
      const whatsappLimpio = form.whatsapp.replace(/\D/g, '');
      const payload = {
        nombre: form.nombre.trim(),
        direccion: form.direccion.trim() || null,
        distrito: form.distrito.trim() || null,
        departamento: form.departamento || null,
        lat: form.lat ? parseFloat(form.lat) : null,
        lon: form.lon ? parseFloat(form.lon) : null,
        whatsapp: whatsappLimpio,
        whatsappFormateado: `51${whatsappLimpio}`,
        facebook: form.facebook.trim() || null,
        instagram: form.instagram.trim() || null,
        web: form.web.trim() || null,
        especialidades: form.especialidades,
        horario: form.horario.trim() || null,
        descripcion: form.descripcion.trim() || null,
        fotos: form.fotos,
        updatedAt: new Date().toISOString(),
      };

      if (esEdicion) {
        const { error } = await supabase.from('tiendas_comunidad').update(payload).eq('id', tienda.id);
        if (error) throw error;
        setExito(true);
        if (onRegistrada) {
          onRegistrada({ id: tienda.id, ...tienda, ...payload });
        }
      } else {
        const tiendaData = {
          ...payload,
          propietarioId: uid,
          propietarioNombre: user?.nombre || null,
          propietarioEmail: user?.email || null,
          fuente: 'comunidad',
          verificada: false,
          activa: true,
          ventas: 0,
          ultimaConsulta: null,
          createdAt: new Date().toISOString(),
        };

        const { data, error } = await supabase.from('tiendas_comunidad').insert(tiendaData).select().single();
        if (error) throw error;
        setExito(true);
        if (onRegistrada) {
          onRegistrada({ id: data.id, ...tiendaData });
        }
      }
    } catch (e) {
      setError((esEdicion ? 'Error al actualizar: ' : 'Error al registrar: ') + e.message);
    }
    setLoading(false);
  };

  if (!(user?.id || user?.uid)) {
    return (
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl w-full max-w-sm p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
            <Lock size={32} className="text-amber-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-800">Inicia sesión primero</h3>
          <p className="text-gray-500 text-sm">
            Para registrar tu tienda agrícola necesitas una cuenta Agrilux.
          </p>
          <button
            type="button"
            onClick={() => { onCerrado(); navigate('/registro?redirect=/mercado&tab=mitienda'); }}
            className="w-full bg-green-600 text-white font-bold py-3 rounded-xl"
          >
            Iniciar sesión / Crear cuenta
          </button>
          <button type="button" onClick={onCerrado} className="text-sm text-gray-400">
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  if (exito) {
    return (
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl w-full max-w-sm p-8 text-center space-y-4">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={40} className="text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-800">
            {esEdicion ? '¡Tienda actualizada!' : '¡Tienda registrada!'}
          </h3>
          <p className="text-gray-500 text-sm">
            Tu tienda <strong>{form.nombre}</strong> fue {esEdicion ? 'actualizada' : 'registrada'} exitosamente.
            {!esEdicion && ' Nuestro equipo la verificará pronto.'}
          </p>
          {!esEdicion && (
          <p className="text-xs text-gray-400">
            Recibirás un mensaje de WhatsApp de bienvenida.
          </p>
          )}
          <button
            onClick={onCerrado}
            className="w-full bg-green-600 text-white font-bold py-3 rounded-xl"
          >
            Entendido
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl w-full max-w-[430px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <Store size={20} className="text-green-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">
                {esEdicion ? 'Editar mi tienda' : 'Registrar mi tienda'}
              </h3>
              <p className="text-xs text-gray-400">
                {esEdicion ? 'Actualiza los datos de tu tienda' : 'Aparecerá en el buscador de insumos'}
              </p>
            </div>
          </div>
          <button onClick={onCerrado} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <X size={15} className="text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Nombre */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">
              Nombre de la tienda *
            </label>
            <input
              value={form.nombre}
              onChange={e => handleChange('nombre', e.target.value)}
              placeholder="Ej: AgroCutervo"
              className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500"
            />
          </div>

          {/* Departamento */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">
              Departamento *
            </label>
            <div className="relative">
              <select
                value={form.departamento}
                onChange={e => handleChange('departamento', e.target.value)}
                className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500 appearance-none"
              >
                <option value="">Seleccionar departamento</option>
                {DEPARTAMENTOS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Distrito */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">
              Distrito / Ciudad *
            </label>
            <input
              value={form.distrito}
              onChange={e => handleChange('distrito', e.target.value)}
              placeholder="Ej: Cutervo"
              className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500"
            />
          </div>

          {/* Dirección */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">
              Dirección completa
            </label>
            <input
              value={form.direccion}
              onChange={e => handleChange('direccion', e.target.value)}
              placeholder="Ej: Av. Principal s/n, frente al mercado"
              className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500"
            />
          </div>

          {/* Coordenadas */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-600 block mb-1">Latitud</label>
              <input
                value={form.lat}
                onChange={e => handleChange('lat', e.target.value)}
                placeholder="-6.381234"
                type="number"
                step="any"
                className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-600 block mb-1">Longitud</label>
              <input
                value={form.lon}
                onChange={e => handleChange('lon', e.target.value)}
                placeholder="-78.821567"
                type="number"
                step="any"
                className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500"
              />
            </div>
            <button
              onClick={buscarCoordenadas}
              disabled={buscandoCoord || (!form.direccion && !form.distrito)}
              className="self-end bg-gray-900 text-white rounded-xl px-3 py-2.5 text-sm font-semibold disabled:opacity-40 flex items-center gap-1"
            >
              {buscandoCoord ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
              GPS
            </button>
          </div>

          {/* WhatsApp */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">
              WhatsApp *
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">+51</span>
              <input
                value={form.whatsapp}
                onChange={e => handleChange('whatsapp', e.target.value)}
                placeholder="987654321"
                type="tel"
                className="flex-1 border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Te contactaremos por WhatsApp para verificar tu tienda
            </p>
          </div>

          {/* Redes sociales */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-600">Redes sociales (opcional)</p>
            
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Globe size={14} className="text-blue-600" />
              </div>
              <input
                value={form.facebook}
                onChange={e => handleChange('facebook', e.target.value)}
                placeholder="Facebook (nombre de página)"
                className="flex-1 border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center">
                <Camera size={14} className="text-pink-600" />
              </div>
              <input
                value={form.instagram}
                onChange={e => handleChange('instagram', e.target.value)}
                placeholder="Instagram (@usuario)"
                className="flex-1 border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <Globe size={14} className="text-gray-600" />
              </div>
              <input
                value={form.web}
                onChange={e => handleChange('web', e.target.value)}
                placeholder="Sitio web (https://...)"
                className="flex-1 border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500"
              />
            </div>
          </div>

          {/* Especialidades */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-2">
              ¿Qué vendes? (selecciona todas las que apliquen)
            </label>
            <div className="flex flex-wrap gap-2">
              {ESPECIALIDADES.map(esp => (
                <button
                  key={esp}
                  onClick={() => toggleEspecialidad(esp)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    form.especialidades.includes(esp)
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {esp}
                </button>
              ))}
            </div>
          </div>

          {/* Horario */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">
              Horario de atención
            </label>
            <input
              value={form.horario}
              onChange={e => handleChange('horario', e.target.value)}
              placeholder="Ej: Lun-Sáb 8am-6pm"
              className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500"
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">
              Cuéntanos sobre tu tienda
            </label>
            <textarea
              value={form.descripcion}
              onChange={e => handleChange('descripcion', e.target.value)}
              placeholder="Ej: Somos la tienda agrícola más grande de Cutervo, con 20 años de experiencia..."
              rows={3}
              className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-green-500 resize-none"
            />
          </div>

          {/* Fotos de la tienda */}
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-2">
              Fotos de la tienda (max. 5)
            </label>
            {form.fotos.length > 0 && (
              <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                {form.fotos.map((foto, idx) => (
                  <div key={idx} className="relative flex-shrink-0">
                    <img
                      src={foto}
                      alt={`Foto ${idx + 1}`}
                      className="w-20 h-20 object-cover rounded-xl border-2 border-gray-100"
                    />
                    <button
                      type="button"
                      onClick={() => eliminarFoto(idx)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {form.fotos.length < 5 && (
              <label className={`flex items-center justify-center gap-2 w-full border-2 border-dashed rounded-xl py-3 text-sm cursor-pointer transition-all ${
                subiendoFoto ? 'border-green-300 bg-green-50 text-green-600' : 'border-gray-200 text-gray-500 hover:border-green-400 hover:bg-green-50'
              }`}>
                {subiendoFoto ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <ImageIcon size={16} />
                    Seleccionar foto
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={subirFoto}
                  disabled={subiendoFoto}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Botón registrar */}
          <button
            onClick={guardar}
            disabled={loading || !form.nombre.trim() || !form.whatsapp.trim()}
            className="w-full bg-green-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {esEdicion ? 'Guardando...' : 'Registrando...'}
              </>
            ) : (
              <>
                <Store size={16} />
                {esEdicion ? 'Guardar cambios' : 'Registrar mi tienda'}
              </>
            )}
          </button>

          <p className="text-xs text-gray-400 text-center">
            {esEdicion
              ? 'Los cambios se reflejan de inmediato en Ofertas y Mi tienda.'
              : 'Al registrar, aceptas que tu información sea pública en el buscador de insumos.'}
          </p>
        </div>
      </div>
    </div>
  );
}
