import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import {
  collection, query, where, onSnapshot, doc, updateDoc,
  getDoc
} from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import {
  Package, Clock, CheckCircle, Truck, MapPin,
  Phone, Loader2, Navigation, X, Send
} from 'lucide-react';

const ESTADOS = {
  confirmado: { label: 'Pendiente aceptación', color: 'bg-blue-100 text-blue-700', icon: '✅' },
  en_camino:  { label: 'En camino',           color: 'bg-purple-100 text-purple-700', icon: '🏍️' },
  entregado:  { label: 'Entregado',            color: 'bg-green-100 text-green-700',  icon: '📦' },
};

function ModalAceptarPedido({ pedido, onClose, onAceptado }) {
  const [costo, setCosto] = useState('');
  const [horaEstimada, setHoraEstimada] = useState('');
  const [loading, setLoading] = useState(false);

  const aceptar = async () => {
    if (!costo || !horaEstimada) { alert('Completa costo y hora estimada'); return; }
    setLoading(true);
    try {
      await updateDoc(doc(db, 'pedidos', pedido.id), {
        estado: 'en_camino',
        costoDelivery: parseFloat(costo),
        horaEstimada: new Date(horaEstimada).toISOString(),
      });
      onAceptado();
    } catch (e) { alert('Error al aceptar pedido'); }
    setLoading(false);
  };

  const now = new Date();
  const minTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl w-full max-w-[430px] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-lg">Aceptar Pedido</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        <div className="bg-gray-50 rounded-2xl p-4">
          <p className="font-bold text-gray-800">{pedido.productoNombre}</p>
          <p className="text-xs text-gray-500 mt-1">📍 {pedido.direccionEntrega}</p>
          {pedido.referencia && <p className="text-xs text-gray-400">📌 {pedido.referencia}</p>}
          <div className="flex gap-4 mt-2">
            <p className="text-xs text-gray-500">👤 {pedido.agricultorNombre}</p>
            <a href={`https://wa.me/51${pedido.agricultorCelular?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
              className="text-xs text-primary font-semibold flex items-center gap-1">
              <Phone size={12} /> {pedido.agricultorCelular}
            </a>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Costo de delivery (S/) *</label>
            <input type="number" step="0.50" min="0" value={costo}
              onChange={e => setCosto(e.target.value)}
              placeholder="Ej: 15.00"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1">Hora estimada de entrega *</label>
            <input type="time" value={horaEstimada}
              onChange={e => setHoraEstimada(e.target.value)}
              min={minTime}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary" />
          </div>
          <button onClick={aceptar} disabled={loading || !costo || !horaEstimada}
            className="w-full bg-primary text-white font-bold py-4 rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
            {loading ? 'Aceptando...' : 'Aceptar y salir a entregar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MotorizadoPanel() {
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalPedido, setModalPedido] = useState(null);
  const [gpsActivo, setGpsActivo] = useState(false);
  const watchIdRef = useRef(null);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'pedidos'),
      where('motorizadoId', '==', user.uid),
      where('estado', 'in', ['confirmado', 'en_camino'])
    );
    const unsub = onSnapshot(q, snap => {
      setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || !gpsActivo) return;
    const options = { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 };
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          await updateDoc(doc(db, 'usuarios', user.uid), {
            ubicacionActual: { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: new Date().toISOString() }
          });
          const activeOrders = pedidos.filter(p => p.estado === 'en_camino');
          for (const p of activeOrders) {
            await updateDoc(doc(db, 'pedidos', p.id), {
              ubicacionMotorizado: { lat: pos.coords.latitude, lng: pos.coords.longitude }
            });
          }
        } catch (e) { /* silencioso */ }
      },
      () => {},
      options
    );
    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [user?.uid, gpsActivo, pedidos]);

  const toggleGPS = () => {
    if (gpsActivo) {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
      setGpsActivo(false);
    } else {
      if (!navigator.geolocation) { alert('Tu dispositivo no soporta GPS'); return; }
      navigator.geolocation.getCurrentPosition(
        () => setGpsActivo(true),
        () => alert('Activa los permisos de ubicación')
      );
    }
  };

  const marcarEntregado = async (pedido) => {
    try {
      await updateDoc(doc(db, 'pedidos', pedido.id), { estado: 'entregado' });
    } catch (e) { alert('Error al marcar entrega'); }
  };

  const pedidoActivo = pedidos.find(p => p.estado === 'en_camino');

  return (
    <div className="min-h-screen pb-24 bg-gray-50">
      <div className="bg-primary text-white px-6 pt-10 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-display font-bold">🏍️ Panel Delivery</h1>
            <p className="text-white/70 text-sm">{user?.nombre}</p>
          </div>
          <button onClick={toggleGPS}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              gpsActivo ? 'bg-green-500 text-white' : 'bg-white/20 text-white'
            }`}>
            <Navigation size={14} className={gpsActivo ? 'animate-pulse' : ''} />
            GPS {gpsActivo ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {pedidoActivo && (
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Truck size={16} className="text-purple-600" />
              <p className="text-sm font-bold text-purple-700">Pedido activo — Entregando</p>
            </div>
            <p className="text-sm font-semibold text-gray-800">{pedidoActivo.productoNombre}</p>
            <p className="text-xs text-gray-600 mt-1">📍 {pedidoActivo.direccionEntrega}</p>
            {pedidoActivo.referencia && <p className="text-xs text-gray-400">📌 {pedidoActivo.referencia}</p>}
            <div className="flex items-center gap-3 mt-2">
              <a href={`https://wa.me/51${pedidoActivo.agricultorCelular?.replace(/\D/g, '')}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-xs text-primary font-semibold">
                <Phone size={12} /> {pedidoActivo.agricultorCelular}
              </a>
              {pedidoActivo.costoDelivery > 0 && (
                <p className="text-xs text-gray-500">S/ {pedidoActivo.costoDelivery}</p>
              )}
              {pedidoActivo.horaEstimada && (
                <p className="text-xs text-gray-500">🕐 {new Date(pedidoActivo.horaEstimada).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</p>
              )}
            </div>
            <button onClick={() => marcarEntregado(pedidoActivo)}
              className="w-full mt-3 bg-green-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
              <CheckCircle size={16} /> Marcar como entregado
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            Pedidos pendientes ({pedidos.filter(p => p.estado === 'confirmado').length})
          </p>
        </div>

        {loading
          ? <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-primary" /></div>
          : pedidos.filter(p => p.estado === 'confirmado').length === 0
            ? <div className="bg-white rounded-2xl p-8 text-center">
                <Package size={36} className="mx-auto text-gray-200 mb-2" />
                <p className="text-gray-400 text-sm">No hay pedidos pendientes</p>
                <p className="text-gray-300 text-xs mt-1">Los nuevos pedidos aparecerán aquí</p>
              </div>
            : pedidos.filter(p => p.estado === 'confirmado').map(p => (
              <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-bold text-sm text-gray-800">{p.productoNombre}</p>
                    <p className="text-xs text-gray-500">{p.tiendaEmpresa}</p>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700">✅ Nuevo</span>
                </div>
                <p className="text-xs text-gray-600 mb-1">📍 {p.direccionEntrega}</p>
                {p.referencia && <p className="text-xs text-gray-400 mb-2">📌 {p.referencia}</p>}
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-sm font-bold text-primary">S/ {p.total?.toFixed(2)}</p>
                  <p className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="flex gap-2">
                  <a href={`https://wa.me/51${p.tiendaCelular?.replace(/\D/g, '')}`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-primary font-semibold bg-primary/5 px-3 py-2 rounded-xl">
                    <Phone size={12} /> Tienda
                  </a>
                  <a href={`https://wa.me/51${p.agricultorCelular?.replace(/\D/g, '')}`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-green-600 font-semibold bg-green-50 px-3 py-2 rounded-xl">
                    <Phone size={12} /> Cliente
                  </a>
                </div>
                <button onClick={() => setModalPedido(p)}
                  className="w-full mt-3 bg-primary text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                  <CheckCircle size={16} /> Aceptar pedido
                </button>
              </div>
            ))
        }
      </div>

      {modalPedido && (
        <ModalAceptarPedido pedido={modalPedido}
          onClose={() => setModalPedido(null)}
          onAceptado={() => setModalPedido(null)} />
      )}
    </div>
  );
}
