/**
 * src/pages/Admin.jsx
 *
 * Acceso: protegido por VITE_ADMIN_KEY en .env
 * Solo tú (Lumajira SAC) puedes entrar.
 *
 * Funciones:
 *   - Ver todos los usuarios registrados
 *   - Agregar nuevos usuarios manualmente
 *   - Ver diagnósticos
 *   - Exportar dataset
 */

import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, query, orderBy, onSnapshot, doc, setDoc, deleteDoc, updateDoc, where } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import JSZip from 'jszip';
import {
  Users, Camera, Download, RefreshCw, ChevronDown, ChevronUp,
  Search, X, MapPin, Phone, Calendar, TrendingUp, CloudUpload,
  CheckCircle, AlertCircle, Loader2, FolderOpen, ExternalLink,
  Plus, Eye, EyeOff, Lock, UserPlus, LogOut, Truck, XCircle,
  Megaphone, UserCheck, UserX, Bell
} from 'lucide-react';
import Marketing from '../components/Marketing';
import { eliminarTodasTiendasComunidad } from '../lib/tiendasComunidad';

// ─── Config ────────────────────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID   = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const DRIVE_FOLDER_NAME  = 'Agrilux-Dataset';
const DRIVE_SCOPE        = 'https://www.googleapis.com/auth/drive.file';

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatFecha(val) {
  if (!val) return '—';
  if (val?.seconds) return new Date(val.seconds * 1000).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  if (typeof val === 'string') return new Date(val).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  return '—';
}

function serializarDoc(doc) {
  const out = {};
  for (const [k, v] of Object.entries(doc)) {
    if (v?.seconds) out[k] = new Date(v.seconds * 1000).toISOString();
    else if (Array.isArray(v)) out[k] = v;
    else if (v && typeof v === 'object') out[k] = serializarDoc(v);
    else out[k] = v ?? null;
  }
  return out;
}

function flattenCSV(obj, prefix = '') {
  return Object.keys(obj || {}).reduce((acc, key) => {
    const val = obj[key];
    const newKey = prefix ? `${prefix}_${key}` : key;
    if (val && typeof val === 'object' && !Array.isArray(val)) Object.assign(acc, flattenCSV(val, newKey));
    else if (Array.isArray(val)) acc[newKey] = val.join(' | ');
    else acc[newKey] = val ?? '';
    return acc;
  }, {});
}

function toCSV(data) {
  if (!data.length) return '';
  const flat = data.map(d => flattenCSV(serializarDoc(d)));
  const headers = [...new Set(flat.flatMap(Object.keys))];
  const rows = flat.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','));
  return [headers.join(','), ...rows].join('\n');
}

// Convierte nombre a email sintético (mismo que AuthContext)
function nombreToEmail(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '.')
    + '@agrilux.app';
}

// ─── Google Drive ──────────────────────────────────────────────────────────────
let driveToken = null;
async function obtenerTokenDrive() {
  return new Promise((resolve, reject) => {
    if (!window.google) { reject(new Error('Google SDK no cargado')); return; }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID, scope: DRIVE_SCOPE,
      callback: (res) => { if (res.error) reject(new Error(res.error)); else { driveToken = res.access_token; resolve(res.access_token); } },
    });
    client.requestAccessToken({ prompt: driveToken ? '' : 'consent' });
  });
}
async function buscarOCrearCarpeta(token, nombre) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${nombre}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name,webViewLink)`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (data.files?.length > 0) return data.files[0];
  const crear = await fetch('https://www.googleapis.com/drive/v3/files', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: nombre, mimeType: 'application/vnd.google-apps.folder' }) });
  return await crear.json();
}
async function subirArchivoADrive(token, carpetaId, nombre, blob) {
  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify({ name: nombre, parents: [carpetaId] })], { type: 'application/json' }));
  formData.append('file', blob);
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
  return await res.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
// PANTALLA DE LOGIN ADMIN
// ═══════════════════════════════════════════════════════════════════════════════
const ADMIN_EMAIL = 'jose.llanos.d@uni.pe';

function LoginAdmin({ onAcceso }) {
  const [email, setEmail]     = useState('');
  const [clave, setClave]     = useState('');
  const [verClave, setVer]    = useState(false);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [paso, setPaso]       = useState('email'); // email → clave

  const verificarEmail = () => {
    setError('');
    if (email.trim().toLowerCase() === ADMIN_EMAIL) {
      setPaso('clave');
    } else {
      setError('Este correo no tiene acceso de administrador.');
    }
  };

  const intentar = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/alertas-preventivas?type=auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave }),
      });
      const data = await res.json();
      if (data.ok) {
        onAcceso();
      } else {
        setError('Clave incorrecta. Intenta de nuevo.');
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-950">
      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Panel Admin</h1>
          <p className="text-gray-500 text-xs mt-1">Agrilux · Lumajira SAC</p>
        </div>

        <div className="bg-gray-900 rounded-2xl p-5 space-y-4">
          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded-xl p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {paso === 'email' ? (
            <>
              <div>
                <label className="text-xs text-gray-400 font-semibold block mb-1.5">Correo de administrador</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && verificarEmail()}
                  placeholder="jose.llanos.d@uni.pe"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-600"
                />
              </div>
              <button
                onClick={verificarEmail}
                disabled={loading || !email.trim()}
                className="w-full bg-green-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-40"
              >
                Continuar →
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-xs text-green-400">
                <span>✓</span>
                <span>{email}</span>
                <button onClick={() => { setPaso('email'); setClave(''); setError(''); }} className="text-gray-500 underline ml-auto">Cambiar</button>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-semibold block mb-1.5">Clave de administrador</label>
                <div className="relative">
                  <input
                    type={verClave ? 'text' : 'password'}
                    value={clave}
                    onChange={e => setClave(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && intentar()}
                    placeholder="••••••••••"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-600 pr-12"
                  />
                  <button onClick={() => setVer(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                    {verClave ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button
                onClick={intentar}
                disabled={loading || !clave}
                className="w-full bg-green-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-40"
              >
                {loading ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Verificando...</span> : 'Entrar →'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL AGREGAR USUARIO
// ═══════════════════════════════════════════════════════════════════════════════
function ModalAgregarUsuario({ onCerrar, onAgregado }) {
  const [form, setForm]   = useState({ nombre: '', rol: 'agricultor', celular: '', ubicacion: '' });
  const [pass, setPass]   = useState('agrilux2024');
  const [verPass, setVer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]    = useState('');

  const agregar = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    setLoading(true);
    setError('');
    try {
      const emailSintetico = nombreToEmail(form.nombre.trim());
      const uid = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await setDoc(doc(db, 'usuarios', uid), {
        nombre:         form.nombre.trim(),
        emailSintetico,
        rol:            form.rol,
        celular:        form.celular || null,
        ubicacion:      form.ubicacion || null,
        passwordDefault: pass,
        creadoPor:      'admin',
        createdAt:      new Date().toISOString(),
      });
      onAgregado({ id: uid, ...form, emailSintetico, creadoPor: 'admin' });
      onCerrar();
    } catch (e) {
      setError('Error al guardar: ' + e.message);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl w-full max-w-[430px] p-6 space-y-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-gray-800 text-lg">Agregar agricultor</h3>
          <button onClick={onCerrar} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <X size={15} className="text-gray-500" />
          </button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3"><p className="text-red-600 text-sm">{error}</p></div>}

        {[
          { label: 'Nombre completo *', key: 'nombre', placeholder: 'Ej: Juan Pérez García' },
          { label: 'Celular / WhatsApp', key: 'celular', placeholder: 'Ej: 987654321' },
          { label: 'Ubicación / Distrito', key: 'ubicacion', placeholder: 'Ej: Cutervo, Cajamarca' },
        ].map(({ label, key, placeholder }) => (
          <div key={key}>
            <label className="text-xs font-semibold text-gray-600 block mb-1">{label}</label>
            <input
              value={form[key]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
            />
          </div>
        ))}

        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Rol</label>
          <select
            value={form.rol}
            onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}
            className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
          >
            <option value="agricultor">🌾 Agricultor</option>
            <option value="agronomo">👨‍🔬 Agrónomo</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Contraseña para el usuario</label>
          <div className="relative">
            <input
              type={verPass ? 'text' : 'password'}
              value={pass}
              onChange={e => setPass(e.target.value)}
              className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary pr-10"
            />
            <button onClick={() => setVer(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {verPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">Dile esta clave al agricultor. Podrá ingresar con su nombre completo.</p>
        </div>

        {form.nombre.trim() && (
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-xs text-green-700 font-semibold">Vista previa de acceso:</p>
            <p className="text-xs text-green-600 mt-1">Nombre: <strong>{form.nombre}</strong></p>
            <p className="text-xs text-green-600">Contraseña: <strong>{pass}</strong></p>
          </div>
        )}

        <button
          onClick={agregar}
          disabled={loading || !form.nombre.trim()}
          className="w-full bg-primary text-white font-bold py-3.5 rounded-2xl text-sm disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {loading ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : <><UserPlus size={16} /> Agregar agricultor</>}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOLICITUDES PENDIENTES
// ═══════════════════════════════════════════════════════════════════════════════
function SolicitudesPendientes({ usuarios, diagnosticos, onActualizar }) {
  const [procesando, setProcesando] = useState(null);

  const pendientes = usuarios.filter(u => u.status === 'pendiente');
  const aprobados = usuarios.filter(u => u.status === 'aprobado' || (!u.status && u.creadoPor !== 'self'));
  const rechazados = usuarios.filter(u => u.status === 'rechazado');

  const aprobar = async (uid) => {
    setProcesando(uid);
    try {
      await updateDoc(doc(db, 'usuarios', uid), { status: 'aprobado' });
      onActualizar(uid, 'aprobado');
    } catch (e) {
      console.error('Error al aprobar:', e);
    }
    setProcesando(null);
  };

  const rechazar = async (uid) => {
    setProcesando(uid);
    try {
      await updateDoc(doc(db, 'usuarios', uid), { status: 'rechazado' });
      onActualizar(uid, 'rechazado');
    } catch (e) {
      console.error('Error al rechazar:', e);
    }
    setProcesando(null);
  };

  const restaurar = async (uid) => {
    setProcesando(uid);
    try {
      await updateDoc(doc(db, 'usuarios', uid), { status: 'aprobado' });
      onActualizar(uid, 'aprobado');
    } catch (e) {
      console.error('Error al restaurar:', e);
    }
    setProcesando(null);
  };

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Pendientes', val: pendientes.length, emoji: '⏳', color: 'bg-amber-50 text-amber-700' },
          { label: 'Aprobados', val: aprobados.length, emoji: '✅', color: 'bg-green-50 text-green-700' },
          { label: 'Rechazados', val: rechazados.length, emoji: '❌', color: 'bg-red-50 text-red-700' },
        ].map(s => (
          <div key={s.label} className={`${s.color} rounded-xl p-3 text-center`}>
            <p className="text-lg">{s.emoji}</p>
            <p className="text-lg font-bold">{s.val}</p>
            <p className="text-xs opacity-70">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Pendientes */}
      {pendientes.length > 0 && (
        <div>
          <p className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-2">⏳ Esperando aprobación ({pendientes.length})</p>
          <div className="space-y-2">
            {pendientes.map(u => (
              <div key={u.id} className="bg-white rounded-2xl shadow-sm p-4 border border-amber-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-lg font-bold text-amber-700">
                    {u.nombre?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800 truncate">{u.nombre}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                    {u.celular && <p className="text-xs text-gray-400">📱 {u.celular}</p>}
                    <p className="text-xs text-gray-300 mt-1">📅 {formatFecha(u.createdAt)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => aprobar(u.id)}
                    disabled={procesando === u.id}
                    className="flex-1 bg-green-600 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {procesando === u.id ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                    Aprobar
                  </button>
                  <button
                    onClick={() => rechazar(u.id)}
                    disabled={procesando === u.id}
                    className="flex-1 bg-red-100 text-red-600 font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {procesando === u.id ? <Loader2 size={14} className="animate-spin" /> : <UserX size={14} />}
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendientes.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-gray-500 text-sm">No hay solicitudes pendientes.</p>
          <p className="text-gray-400 text-xs mt-1">Cuando un usuario se registre, aparecerá aquí.</p>
        </div>
      )}

      {/* Rechazados (opcional) */}
      {rechazados.length > 0 && (
        <div>
          <p className="text-xs font-bold text-red-400 uppercase tracking-wide mb-2">❌ Rechazados ({rechazados.length})</p>
          <div className="space-y-2">
            {rechazados.map(u => (
              <div key={u.id} className="bg-white rounded-2xl shadow-sm p-4 border border-red-100 opacity-60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-sm font-bold text-red-400">
                    {u.nombre?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-600 truncate">{u.nombre}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </div>
                  <button
                    onClick={() => restaurar(u.id)}
                    disabled={procesando === u.id}
                    className="text-xs bg-green-100 text-green-600 px-3 py-1.5 rounded-lg font-semibold"
                  >
                    Restaurar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL AGREGAR/EDITAR TIENDA
// ═══════════════════════════════════════════════════════════════════════════════
function ModalTienda({ tienda, onCerrar, onGuardado }) {
  const [form, setForm] = useState({
    nombre:      tienda?.nombre || '',
    direccion:   tienda?.direccion || '',
    region:      tienda?.region || '',
    lat:         tienda?.lat || '',
    lon:         tienda?.lon || '',
    whatsapp:    tienda?.whatsapp || '',
    facebook:    tienda?.facebook || '',
    instagram:   tienda?.instagram || '',
    web:         tienda?.web || '',
    productos:   tienda?.productos || '',
    horario:     tienda?.horario || '',
    notas:       tienda?.notas || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [buscandoCoord, setBuscandoCoord] = useState(false);

  const esEdicion = tienda?.id;

  const buscarCoordenadas = async () => {
    if (!form.direccion && !form.region) { setError('Escribe una dirección o región primero'); return; }
    setBuscandoCoord(true);
    setError('');
    try {
      const query = [form.direccion, form.region, 'Perú'].filter(Boolean).join(', ');
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.lat && data.lon) {
        setForm(f => ({ ...f, lat: data.lat, lon: data.lon }));
      } else {
        setError('No se encontraron coordenadas para esa dirección');
      }
    } catch {
      setError('Error al buscar coordenadas');
    }
    setBuscandoCoord(false);
  };

  const guardar = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    setLoading(true);
    setError('');
    try {
      const datos = {
        nombre:    form.nombre.trim(),
        direccion: form.direccion.trim() || null,
        region:    form.region.trim() || null,
        lat:       form.lat ? parseFloat(form.lat) : null,
        lon:       form.lon ? parseFloat(form.lon) : null,
        whatsapp:  form.whatsapp.trim() || null,
        facebook:  form.facebook.trim() || null,
        instagram: form.instagram.trim() || null,
        web:       form.web.trim() || null,
        productos: form.productos.trim() || null,
        horario:   form.horario.trim() || null,
        notas:     form.notas.trim() || null,
        actualizadoEn: new Date().toISOString(),
      };

      if (esEdicion) {
        const ref = doc(db, 'tiendas', tienda.id);
        await updateDoc(ref, datos);
        onGuardado({ id: tienda.id, ...datos, createdAt: tienda.createdAt });
      } else {
        datos.createdAt = new Date().toISOString();
        datos.creadoPor = 'admin';
        const ref = await addDoc(collection(db, 'tiendas'), datos);
        onGuardado({ id: ref.id, ...datos });
      }
    } catch (e) {
      setError('Error al guardar: ' + e.message);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl w-full max-w-[430px] max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between mb-1 sticky top-0 bg-white pb-2">
          <h3 className="font-bold text-gray-800 text-lg">{esEdicion ? 'Editar tienda' : 'Agregar tienda'}</h3>
          <button onClick={onCerrar} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <X size={15} className="text-gray-500" />
          </button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3"><p className="text-red-600 text-sm">{error}</p></div>}

        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Nombre de la tienda *</label>
          <input
            value={form.nombre}
            onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
            placeholder="Ej: AgroCutervo"
            className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Dirección / Distrito</label>
          <input
            value={form.direccion}
            onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
            placeholder="Ej: Av. Principal s/n, Cutervo"
            className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Región / Departamento</label>
          <input
            value={form.region}
            onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
            placeholder="Ej: Cajamarca"
            className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs font-semibold text-gray-600 block mb-1">Latitud</label>
            <input
              value={form.lat}
              onChange={e => setForm(f => ({ ...f, lat: e.target.value }))}
              placeholder="-6.381234"
              type="number"
              step="any"
              className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-semibold text-gray-600 block mb-1">Longitud</label>
            <input
              value={form.lon}
              onChange={e => setForm(f => ({ ...f, lon: e.target.value }))}
              placeholder="-78.821567"
              type="number"
              step="any"
              className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={buscarCoordenadas}
            disabled={buscandoCoord || (!form.direccion && !form.region)}
            className="self-end bg-gray-900 text-white rounded-xl px-3 py-2.5 text-sm font-semibold disabled:opacity-40 flex items-center gap-1">
            {buscandoCoord ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
            GPS
          </button>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">WhatsApp</label>
          <input
            value={form.whatsapp}
            onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
            placeholder="Ej: 51941234567"
            className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Facebook</label>
          <input
            value={form.facebook}
            onChange={e => setForm(f => ({ ...f, facebook: e.target.value }))}
            placeholder="Ej: agrocutervo"
            className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Instagram</label>
          <input
            value={form.instagram}
            onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))}
            placeholder="Ej: @agrocutervo"
            className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Sitio web</label>
          <input
            value={form.web}
            onChange={e => setForm(f => ({ ...f, web: e.target.value }))}
            placeholder="Ej: https://agrocutervo.com"
            className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Productos principales</label>
          <input
            value={form.productos}
            onChange={e => setForm(f => ({ ...f, productos: e.target.value }))}
            placeholder="Ej: Fertilizantes, semillas, agroquímicos"
            className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Horario</label>
          <input
            value={form.horario}
            onChange={e => setForm(f => ({ ...f, horario: e.target.value }))}
            placeholder="Ej: Lun-Sáb 8am-6pm"
            className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Notas internas</label>
          <textarea
            value={form.notas}
            onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
            placeholder="Notas privadas sobre esta tienda..."
            rows={2}
            className="w-full border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary resize-none"
          />
        </div>

        <button
          onClick={guardar}
          disabled={loading || !form.nombre.trim()}
          className="w-full bg-green-600 text-white font-bold py-3 rounded-xl text-sm disabled:opacity-40">
          {loading ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Guardando...</span> : esEdicion ? 'Guardar cambios' : 'Agregar tienda'}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PANEL ADMIN PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function Admin() {
  const [autorizado, setAutorizado] = useState(false);
  const [tab, setTab]               = useState('usuarios');
  const [usuarios, setUsuarios]     = useState([]);
  const [diagnosticos, setDiagnosticos] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [busqueda, setBusqueda]     = useState('');
  const [expandido, setExpandido]   = useState(null);
  const [modalAgregar, setModalAgregar] = useState(false);
  const [modalTienda, setModalTienda] = useState(null); // null = cerrado, 'nueva' = agregar, objeto = editar
  const [tiendas, setTiendas] = useState([]);
  const [tiendasComunidad, setTiendasComunidad] = useState([]);
  const [purgingMercado, setPurgingMercado] = useState(false);

  // Exportar
  const [exportState, setExportState]     = useState('idle');
  const [exportProgress, setExportProgress] = useState({ paso: '', porcentaje: 0, detalle: '' });
  const [driveLink, setDriveLink]         = useState('');
  const [exportError, setExportError]     = useState('');
  const [ultimaExport, setUltimaExport]   = useState(null);

  // Guardar autorización en sessionStorage para no pedir clave al refrescar
  useEffect(() => {
    if (sessionStorage.getItem('agrilux_admin') === 'ok') setAutorizado(true);
  }, []);

  const handleAcceso = () => {
    sessionStorage.setItem('agrilux_admin', 'ok');
    setAutorizado(true);
  };

  const handleSalir = () => {
    sessionStorage.removeItem('agrilux_admin');
    setAutorizado(false);
  };

  // Cargar datos en tiempo real
  useEffect(() => {
    if (!autorizado) return;
    setLoading(true);
    const unsubs = [];

    const cargar = (colName, setter) => {
      try {
        const q = query(collection(db, colName), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q,
          snap => { setter(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
          async () => {
            const snap = await getDocs(collection(db, colName)).catch(() => ({ docs: [] }));
            setter(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false);
          }
        );
        unsubs.push(unsub);
      } catch { setLoading(false); }
    };

    cargar('usuarios', setUsuarios);
    cargar('diagnosticos', setDiagnosticos);
    cargar('tiendas', setTiendas);
    cargar('tiendas_comunidad', setTiendasComunidad);
    return () => unsubs.forEach(u => u());
  }, [autorizado]);

  // ── Exportar ────────────────────────────────────────────────────────────────
  const exportar = useCallback(async (destino) => {
    setExportState('preparando'); setExportError(''); setDriveLink('');
    try {
      const zip = new JSZip();
      const ahora = new Date();
      const fechaStr = ahora.toISOString().slice(0, 10);

      setExportProgress({ paso: '1/3', porcentaje: 20, detalle: 'Serializando datos...' });
      const diagSer  = diagnosticos.map(serializarDoc);
      const userSer  = usuarios.map(d => {
        // No exportar passwordDefault por seguridad
        const { passwordDefault, ...resto } = serializarDoc(d);
        return resto;
      });

      setExportProgress({ paso: '2/3', porcentaje: 60, detalle: 'Creando archivos...' });
      zip.file('dataset.json', JSON.stringify({ version: '1.0', exportado: ahora.toISOString(), usuarios: userSer, diagnosticos: diagSer }, null, 2));
      zip.file('usuarios.csv', '\uFEFF' + toCSV(userSer));
      zip.file('diagnosticos.csv', '\uFEFF' + toCSV(diagSer));

      const trainingLines = diagSer
        .filter(d => (d.pregunta || d.descripcion) && (d.resultado || d.respuesta))
        .map(d => JSON.stringify({
          messages: [
            { role: 'user', content: d.pregunta || d.descripcion || '' },
            { role: 'assistant', content: d.resultado || d.respuesta || '' },
          ],
        }));
      zip.file('training.jsonl', trainingLines.join('\n'));
      zip.file('README.md', `# Agrilux Dataset — ${fechaStr}\n\n- Usuarios: ${userSer.length}\n- Diagnósticos: ${diagSer.length}\n- Pares training: ${trainingLines.length}\n`);

      setExportProgress({ paso: '3/3', porcentaje: 80, detalle: 'Comprimiendo...' });
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const nombreZip = `agrilux_dataset_${fechaStr}.zip`;

      if (destino === 'local') {
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a'); a.href = url; a.download = nombreZip; a.click();
        URL.revokeObjectURL(url);
      } else {
        setExportProgress({ paso: '3/3', porcentaje: 85, detalle: 'Subiendo a Drive...' });
        if (!GOOGLE_CLIENT_ID) throw new Error('Falta VITE_GOOGLE_CLIENT_ID en .env');
        const token = await obtenerTokenDrive();
        const carpeta = await buscarOCrearCarpeta(token, DRIVE_FOLDER_NAME);
        await subirArchivoADrive(token, carpeta.id, nombreZip, zipBlob);
        setDriveLink(carpeta.webViewLink || `https://drive.google.com/drive/folders/${carpeta.id}`);
      }

      setUltimaExport({ fecha: ahora.toISOString(), usuarios: userSer.length, diagnosticos: diagSer.length, pares: trainingLines.length });
      setExportProgress({ paso: '✓', porcentaje: 100, detalle: 'Exportación completada.' });
      setExportState('listo');
    } catch (err) {
      setExportError(err.message || 'Error al exportar');
      setExportState('error');
    }
  }, [diagnosticos, usuarios]);

  // ── Filtros ────────────────────────────────────────────────────────────────
  const usuariosFiltrados = usuarios.filter(u =>
    !busqueda || u.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || u.ubicacion?.toLowerCase().includes(busqueda.toLowerCase())
  );
  const diagFiltrados = diagnosticos.filter(d =>
    !busqueda || d.cultivo?.toLowerCase().includes(busqueda.toLowerCase()) || (d.pregunta || '').toLowerCase().includes(busqueda.toLowerCase())
  );

  const enProceso = ['preparando', 'zipeando', 'subiendo_drive'].includes(exportState);
  const pendientesCount = usuarios.filter(u => u.status === 'pendiente').length;

  if (!autorizado) return <LoginAdmin onAcceso={handleAcceso} />;

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3 bg-gray-50">
      <Loader2 size={28} className="animate-spin text-primary" />
      <p className="text-sm text-gray-500">Cargando datos...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {modalAgregar && (
        <ModalAgregarUsuario
          onCerrar={() => setModalAgregar(false)}
          onAgregado={u => setUsuarios(prev => [u, ...prev])}
        />
      )}

      {/* Header */}
      <div className="bg-gray-900 text-white px-4 pt-10 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-green-400 font-semibold uppercase tracking-widest">Panel Admin</p>
            <h1 className="text-xl font-bold">Agrilux · Lumajira SAC</h1>
          </div>
          <button onClick={handleSalir} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white">
            <LogOut size={14} /> Salir
          </button>
        </div>

        {/* Stats rápidos */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: 'Usuarios', val: usuarios.length, emoji: '👥' },
            { label: 'Diagnósticos', val: diagnosticos.length, emoji: '🔬' },
            { label: 'Con IA', val: diagnosticos.filter(d => d.resultado?.tiene_problema !== undefined).length, emoji: '🤖' },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-lg">{s.emoji}</p>
              <p className="text-lg font-bold">{s.val}</p>
              <p className="text-xs text-white/50">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs - scroll horizontal */}
        <div className="relative">
          <div id="admin-tabs" className="flex gap-1 bg-white/10 rounded-xl p-1 overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.3) transparent' }}>
            {[
              { id: 'solicitudes', label: 'Solicitudes', icon: Bell },
              { id: 'usuarios', label: 'Usuarios', icon: Users },
              { id: 'tiendas', label: 'Tiendas', icon: Truck },
              { id: 'mercado', label: 'Mercado', icon: Truck },
              { id: 'marketing', label: 'Marketing', icon: Megaphone },
              { id: 'diagnosticos', label: 'Diagnósticos', icon: Camera },
              { id: 'exportar', label: 'Exportar', icon: Download },
            ].map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => { setTab(id); setBusqueda(''); setExpandido(null); }}
                className={`flex-shrink-0 flex flex-col items-center py-2 px-3 rounded-lg text-xs font-semibold gap-0.5 transition-all min-w-[70px] relative ${tab === id ? 'bg-white text-gray-900' : 'text-white/60'}`}>
                <Icon size={14} />
                {label}
                {id === 'solicitudes' && pendientesCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                    {pendientesCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-900 to-transparent pointer-events-none rounded-r-xl flex items-center justify-end pr-1">
            <span className="text-white/50 text-xs">›</span>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">

        {/* ── SOLICITUDES PENDIENTES ───────────────────────────────────────── */}
        {tab === 'solicitudes' && (
          <SolicitudesPendientes
            usuarios={usuarios}
            diagnosticos={diagnosticos}
            onActualizar={(uid, nuevoStatus) => {
              setUsuarios(prev => prev.map(u => u.id === uid ? { ...u, status: nuevoStatus } : u));
            }}
          />
        )}

        {/* ── USUARIOS ──────────────────────────────────────────────────────── */}
        {tab === 'usuarios' && (
          <>
            {/* Buscador + botón agregar */}
            <div className="flex gap-2">
              <div className="flex-1 flex items-center bg-white rounded-xl px-3 gap-2 shadow-sm border border-gray-100">
                <Search size={14} className="text-gray-400" />
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre o ubicación..."
                  className="flex-1 py-2.5 text-sm outline-none" />
                {busqueda && <button onClick={() => setBusqueda('')}><X size={14} className="text-gray-400" /></button>}
              </div>
              <button
                onClick={() => setModalAgregar(true)}
                className="bg-primary text-white rounded-xl px-4 flex items-center gap-1.5 text-sm font-bold shadow-sm">
                <Plus size={16} /> Agregar
              </button>
            </div>

            <p className="text-xs text-gray-400">{usuariosFiltrados.length} usuarios registrados</p>

            <div className="space-y-2">
              {usuariosFiltrados.length === 0 && (
                <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                  <p className="text-4xl mb-3">👥</p>
                  <p className="text-gray-500 text-sm">No hay usuarios aún.</p>
                  <button onClick={() => setModalAgregar(true)}
                    className="mt-4 bg-primary text-white font-bold px-6 py-2.5 rounded-xl text-sm">
                    + Agregar el primero
                  </button>
                </div>
              )}
              {usuariosFiltrados.map(u => (
                <div key={u.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <button onClick={() => setExpandido(expandido === u.id ? null : u.id)}
                    className="w-full flex items-center gap-3 p-4 text-left">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-base font-bold text-green-700 flex-shrink-0">
                      {u.nombre?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-800 truncate">{u.nombre || 'Sin nombre'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          u.rol === 'agronomo' ? 'bg-blue-100 text-blue-600'
                          : 'bg-green-100 text-green-600'
                        }`}>
                          {u.rol === 'agronomo' ? '👨‍🔬 Agrónomo' : '🌾 Agricultor'}
                        </span>
                        {u.creadoPor === 'admin' && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Admin</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <p className="text-xs text-gray-300">{formatFecha(u.createdAt)}</p>
                      {expandido === u.id ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                    </div>
                  </button>

                  {expandido === u.id && (
                    <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { icon: MapPin, label: 'Ubicación', val: u.ubicacion || '—' },
                          { icon: Phone, label: 'Celular', val: u.celular || '—' },
                          { icon: Calendar, label: 'Registro', val: formatFecha(u.createdAt) },
                          { icon: Users, label: 'Diagnósticos', val: diagnosticos.filter(d => d.userId === u.id).length },
                        ].map(({ icon: Icon, label, val }) => (
                          <div key={label} className="bg-gray-50 rounded-xl p-3">
                            <div className="flex items-center gap-1 mb-1"><Icon size={11} className="text-gray-400" /><p className="text-xs text-gray-400">{label}</p></div>
                            <p className="text-sm font-semibold text-gray-700 truncate">{val}</p>
                          </div>
                        ))}
                      </div>

                      {/* Credenciales de acceso */}
                      <div className="bg-blue-50 rounded-xl p-3">
                        <p className="text-xs font-bold text-blue-600 mb-1">🔑 Datos de acceso (solo tú ves esto)</p>
                        <p className="text-xs text-blue-700">Nombre: <strong>{u.nombre}</strong></p>
                        {u.passwordDefault && (
                          <p className="text-xs text-blue-700 mt-0.5">Contraseña: <strong>{u.passwordDefault}</strong></p>
                        )}
                      </div>

                      {u.celular && (
                        <a href={`https://wa.me/51${u.celular.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                          className="flex items-center justify-center gap-2 bg-green-500 text-white rounded-xl py-2.5 text-sm font-semibold">
                          💬 Contactar por WhatsApp
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── TIENDAS ──────────────────────────────────────────────────────── */}
        {tab === 'tiendas' && (
          <>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center bg-white rounded-xl px-3 gap-2 shadow-sm border border-gray-100">
                <Search size={14} className="text-gray-400" />
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar tienda por nombre o región..."
                  className="flex-1 py-2.5 text-sm outline-none" />
                {busqueda && <button onClick={() => setBusqueda('')}><X size={14} className="text-gray-400" /></button>}
              </div>
              <button
                onClick={() => setModalTienda('nueva')}
                className="bg-primary text-white rounded-xl px-4 flex items-center gap-1.5 text-sm font-bold shadow-sm">
                <Plus size={16} /> Agregar
              </button>
            </div>

            <p className="text-xs text-gray-400">{tiendas.filter(t => !busqueda || t.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || t.region?.toLowerCase().includes(busqueda.toLowerCase())).length} tiendas registradas</p>

            <div className="space-y-2">
              {tiendas.filter(t => !busqueda || t.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || t.region?.toLowerCase().includes(busqueda.toLowerCase())).length === 0 && (
                <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                  <p className="text-4xl mb-3">🏪</p>
                  <p className="text-gray-500 text-sm">No hay tiendas registradas.</p>
                  <button onClick={() => setModalTienda('nueva')}
                    className="mt-4 bg-primary text-white font-bold px-6 py-2.5 rounded-xl text-sm">
                    + Agregar la primera
                  </button>
                </div>
              )}
              {tiendas
                .filter(t => !busqueda || t.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || t.region?.toLowerCase().includes(busqueda.toLowerCase()))
                .map(t => (
                <div key={t.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 p-4">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-base font-bold text-orange-700 flex-shrink-0">
                      🏪
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-800 truncate">{t.nombre}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {t.region && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t.region}</span>}
                        {t.lat && t.lon && <span className="text-xs text-gray-400">📍 {t.lat?.toFixed(2)}, {t.lon?.toFixed(2)}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setModalTienda(t)}
                        className="p-2 bg-gray-100 rounded-lg text-gray-500 hover:bg-gray-200">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`¿Eliminar tienda "${t.nombre}"?`)) return;
                          await deleteDoc(doc(db, 'tiendas', t.id));
                          setTiendas(prev => prev.filter(x => x.id !== t.id));
                        }}
                        className="p-2 bg-red-50 rounded-lg text-red-500 hover:bg-red-100">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                  {t.whatsapp && (
                    <div className="px-4 pb-3">
                      <a href={`https://wa.me/51${t.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                        className="flex items-center justify-center gap-2 bg-green-500 text-white rounded-xl py-2 text-xs font-semibold">
                        💬 WhatsApp
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Modal agregar/editar tienda */}
            {modalTienda && (
              <ModalTienda
                tienda={modalTienda === 'nueva' ? null : modalTienda}
                onCerrar={() => setModalTienda(null)}
                onGuardado={(tienda) => {
                  if (modalTienda === 'nueva') {
                    setTiendas(prev => [tienda, ...prev]);
                  } else {
                    setTiendas(prev => prev.map(t => t.id === tienda.id ? tienda : t));
                  }
                  setModalTienda(null);
                }}
              />
            )}
          </>
        )}

        {/* ── MERCADO (tiendas_comunidad) ─────────────────────────────────── */}
        {tab === 'mercado' && (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-3">
              <p className="text-xs text-amber-800">
                Tiendas visibles en <strong>Mercado → Ofertas</strong>. Elimina aquí las tiendas de prueba.
              </p>
            </div>

            <div className="flex gap-2 mb-3">
              <p className="flex-1 text-xs text-gray-400 self-center">
                {tiendasComunidad.length} tienda(s) en Firestore
              </p>
              <button
                type="button"
                disabled={purgingMercado || tiendasComunidad.length === 0}
                onClick={async () => {
                  if (!confirm(`¿Eliminar las ${tiendasComunidad.length} tiendas del mercado y sus precios?`)) return;
                  setPurgingMercado(true);
                  try {
                    const r = await eliminarTodasTiendasComunidad();
                    setTiendasComunidad([]);
                    alert(`Eliminadas: ${r.tiendas} tiendas, ${r.precios} precios.`);
                  } catch (e) {
                    alert('Error: ' + e.message);
                  }
                  setPurgingMercado(false);
                }}
                className="bg-red-600 text-white rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-40 flex items-center gap-1"
              >
                {purgingMercado ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                Eliminar todas
              </button>
            </div>

            <div className="space-y-2">
              {tiendasComunidad.length === 0 && (
                <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                  <p className="text-gray-500 text-sm">No hay tiendas en el mercado.</p>
                </div>
              )}
              {tiendasComunidad.map((t) => (
                <div key={t.id} className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800 truncate">{t.nombre}</p>
                    <p className="text-xs text-gray-400">
                      {[t.distrito, t.departamento].filter(Boolean).join(', ') || 'Sin ubicación'}
                      {t.propietarioId ? ' · con dueño' : ' · sin sesión'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm(`¿Eliminar "${t.nombre}"?`)) return;
                      await deleteDoc(doc(db, 'tiendas_comunidad', t.id));
                      setTiendasComunidad((prev) => prev.filter((x) => x.id !== t.id));
                    }}
                    className="p-2 bg-red-50 rounded-lg text-red-500"
                  >
                    <XCircle size={16} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── MARKETING ──────────────────────────────────────────────────── */}
        {tab === 'marketing' && <Marketing />}

        {/* ── DIAGNÓSTICOS ──────────────────────────────────────────────────── */}
        {tab === 'diagnosticos' && (
          <>
            <div className="flex items-center bg-white rounded-xl px-3 gap-2 shadow-sm border border-gray-100">
              <Search size={14} className="text-gray-400" />
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por cultivo o consulta..."
                className="flex-1 py-2.5 text-sm outline-none" />
              {busqueda && <button onClick={() => setBusqueda('')}><X size={14} className="text-gray-400" /></button>}
            </div>
            <p className="text-xs text-gray-400">{diagFiltrados.length} diagnósticos</p>

            <div className="space-y-2">
              {diagFiltrados.map(d => {
                const autorNombre = usuarios.find(u => u.id === d.userId)?.nombre || d.userName || 'Desconocido';
                const res = d.resultado || {};
                return (
                  <div key={d.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <button onClick={() => setExpandido(expandido === d.id ? null : d.id)}
                      className="w-full flex items-center gap-3 p-4 text-left">
                      <span className="text-2xl flex-shrink-0">
                        {d.cultivo === 'papa' ? '🥔' : d.cultivo === 'palta' ? '🥑' : d.cultivo === 'arandano' ? '🫐' : '🌿'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-gray-800 capitalize">{d.cultivoNombre || d.cultivo || 'General'}</p>
                          {res.tiene_problema !== undefined && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${res.tiene_problema ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                              {res.tiene_problema ? '⚠ ' + (res.gravedad || 'problema') : '✓ sano'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate">{autorNombre} · {res.nombre_problema || d.consultaTexto || '—'}</p>
                      </div>
                      <p className="text-xs text-gray-300 flex-shrink-0">{formatFecha(d.fecha || d.createdAt)}</p>
                    </button>

                    {expandido === d.id && (
                      <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-gray-50 rounded-xl p-3">
                            <p className="text-xs text-gray-400 mb-1">Agricultor</p>
                            <p className="text-sm font-semibold text-gray-700">{autorNombre}</p>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-3">
                            <p className="text-xs text-gray-400 mb-1">Fecha</p>
                            <p className="text-sm font-semibold text-gray-700">{formatFecha(d.fecha || d.createdAt)}</p>
                          </div>
                        </div>
                        {res.nombre_problema && (
                          <div className={`rounded-xl p-3 border ${res.gravedad === 'critica' || res.gravedad === 'grave' ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
                            <p className="text-xs font-bold text-gray-500 mb-1">Diagnóstico IA</p>
                            <p className="text-sm font-semibold text-gray-800">{res.nombre_problema}</p>
                            {res.nombre_cientifico && <p className="text-xs text-gray-500 italic">{res.nombre_cientifico}</p>}
                            <p className="text-xs text-gray-600 mt-1">{res.que_tiene}</p>
                          </div>
                        )}
                        {d.climaContexto && (
                          <div className="bg-blue-50 rounded-xl p-3">
                            <p className="text-xs font-bold text-blue-600 mb-1">🌡 Contexto climático usado</p>
                            <p className="text-xs text-blue-700">{d.climaContexto}</p>
                          </div>
                        )}
                        {res.productos?.length > 0 && (
                          <div className="bg-gray-50 rounded-xl p-3">
                            <p className="text-xs font-bold text-gray-500 mb-2">💊 Productos recomendados</p>
                            {res.productos.slice(0, 2).map((p, i) => (
                              <p key={i} className="text-xs text-gray-600">• {p.nombre} — {p.dosis}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── EXPORTAR ──────────────────────────────────────────────────────── */}
        {tab === 'exportar' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-gray-900 to-green-950 rounded-2xl p-4 text-white">
              <p className="text-xs text-green-400 font-semibold uppercase tracking-wide mb-3">📊 Tu dataset actual</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { emoji: '👥', val: usuarios.length, label: 'Usuarios' },
                  { emoji: '🔬', val: diagnosticos.length, label: 'Diagnósticos' },
                  { emoji: '🤖', val: diagnosticos.filter(d => (d.resultado?.nombre_problema || d.pregunta) && d.resultado?.que_hacer).length, label: 'Pares training' },
                  { emoji: '🌡', val: diagnosticos.filter(d => d.climaContexto).length, label: 'Con contexto clima' },
                ].map(s => (
                  <div key={s.label} className="bg-white/10 rounded-xl p-3">
                    <p className="text-xl">{s.emoji}</p>
                    <p className="text-xl font-bold mt-1">{s.val}</p>
                    <p className="text-xs text-white/50">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {enProceso && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Loader2 size={16} className="text-green-600 animate-spin" />
                  <p className="text-sm font-semibold text-gray-700">Exportando... {exportProgress.paso}</p>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                  <div className="bg-green-600 h-2 rounded-full transition-all duration-500" style={{ width: `${exportProgress.porcentaje}%` }} />
                </div>
                <p className="text-xs text-gray-400">{exportProgress.detalle}</p>
              </div>
            )}

            {exportState === 'listo' && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                <div className="flex gap-2 items-start">
                  <CheckCircle size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-green-800">¡Exportación completa!</p>
                    {ultimaExport && <p className="text-xs text-green-600 mt-1">{ultimaExport.usuarios} usuarios · {ultimaExport.diagnosticos} diagnósticos · {ultimaExport.pares} pares training</p>}
                    {driveLink && <a href={driveLink} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1.5 text-xs text-green-700 font-semibold"><FolderOpen size={13} /> Abrir en Google Drive <ExternalLink size={11} /></a>}
                  </div>
                </div>
              </div>
            )}

            {exportState === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <div className="flex gap-2"><AlertCircle size={16} className="text-red-500" /><p className="text-sm text-red-700">{exportError}</p></div>
              </div>
            )}

            {!enProceso && (
              <>
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">⬇ Descargar en tu dispositivo</p>
                  <button onClick={() => exportar('local')}
                    className="w-full bg-gray-900 text-white rounded-xl py-4 flex items-center gap-3 px-4">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-xl">📦</div>
                    <div className="flex-1 text-left">
                      <p className="font-bold text-sm">Descargar ZIP</p>
                      <p className="text-xs text-white/50">JSON + CSV + JSONL training</p>
                    </div>
                    <Download size={18} className="text-white/60" />
                  </button>
                </div>

                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">☁ Google Drive</p>
                  <button onClick={() => exportar('drive')}
                    className="w-full bg-blue-600 text-white rounded-xl py-4 flex items-center gap-3 px-4">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-xl">📁</div>
                    <div className="flex-1 text-left">
                      <p className="font-bold text-sm">Subir a Google Drive</p>
                      <p className="text-xs text-white/50">Carpeta: Agrilux-Dataset/</p>
                    </div>
                    <CloudUpload size={18} className="text-white/60" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}