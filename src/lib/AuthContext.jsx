/**
 * src/lib/AuthContext.jsx
 *
 * Registro: nombre completo + correo + celular + contraseña → status: 'pendiente'
 * Login:    correo + contraseña → si status !== 'aprobado', bloqueado
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext();

const normalizarWhatsapp = (valor) => {
  const soloNumeros = String(valor || '').replace(/\D/g, '');
  if (!soloNumeros) return '';
  if (soloNumeros.startsWith('51')) return soloNumeros;
  if (soloNumeros.startsWith('0')) return `51${soloNumeros.slice(1)}`;
  return `51${soloNumeros}`;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchPerfil = async (sessionUser) => {
    if (!sessionUser) return null;
    try {
      const { data, error } = await supabase.from('usuarios').select('*').eq('id', sessionUser.id).single();
      if (error) {
        console.warn('fetchPerfil error:', error.message);
        return {};
      }
      return data || {};
    } catch (e) {
      console.warn('fetchPerfil catch:', e.message);
      return {};
    }
  };

  useEffect(() => {
    // Cargar sesión inicial
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const perfil = await fetchPerfil(session.user);
        const ubicacionLS = localStorage.getItem('agrilux_ubicacion') || '';
        const coordsLS = localStorage.getItem('agrilux_coords');
        setUser({
          ...perfil,
          id: session.user.id,
          uid: session.user.id,
          email: session.user.email,
          nombre: perfil.nombre || session.user.user_metadata?.nombre || '',
          whatsapp: perfil.whatsapp || '',
          status: perfil.status || 'aprobado',
          ubicacion: perfil.ubicacion || ubicacionLS || '',
          coords: perfil.coords || (coordsLS ? JSON.parse(coordsLS) : null),
        });
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const perfil = await fetchPerfil(session.user);
        const ubicacionLS = localStorage.getItem('agrilux_ubicacion') || '';
        const coordsLS = localStorage.getItem('agrilux_coords');
        setUser({
          ...perfil,
          id: session.user.id,
          uid: session.user.id,
          email: session.user.email,
          nombre: perfil.nombre || session.user.user_metadata?.nombre || '',
          whatsapp: perfil.whatsapp || '',
          status: perfil.status || 'aprobado',
          ubicacion: perfil.ubicacion || ubicacionLS || '',
          coords: perfil.coords || (coordsLS ? JSON.parse(coordsLS) : null),
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Registro: status = 'aprobado' (acceso inmediato) ──────
  const register = async ({ nombre, email, password, ubicacion, coords, whatsapp }) => {
    const whatsappNormalizado = normalizarWhatsapp(whatsapp);
    const emailNorm = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: emailNorm,
      password,
      options: { data: { nombre: nombre.trim() } }
    });
    if (error) throw error;
    const uid = data.user?.id;
    if (!uid) throw new Error('No se pudo crear el usuario');
    const perfil = {
      id: uid,
      nombre: nombre.trim(),
      email: emailNorm,
      ubicacion: ubicacion || '',
      whatsapp: whatsappNormalizado || null,
      coords: coords || null,
      rol: 'agricultor',
      status: 'aprobado',
      creado_por: 'self',
    };
    await supabase.from('usuarios').insert(perfil);
    setUser({
      id: uid,
      uid,
      email: emailNorm,
      nombre: nombre.trim(),
      ubicacion: ubicacion || '',
      whatsapp: whatsappNormalizado || '',
      coords: coords || null,
      rol: 'agricultor',
      status: 'aprobado',
      ...perfil,
    });
    return data.user;
  };

  // ── Login: correo + contraseña ─────────────────────────────────────────────
  const login = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error;
    return data.user;
  };

  const updateUbicacion = async (ubicacion, coords = null) => {
    const uid = user?.id || user?.uid;
    if (!uid) throw new Error('No hay sesión');
    localStorage.setItem('agrilux_ubicacion', ubicacion);
    if (coords) localStorage.setItem('agrilux_coords', JSON.stringify(coords));
    setUser(prev => ({ ...prev, ubicacion, coords: coords || prev.coords }));
    if (uid) {
      try {
        const data = { ubicacion, ...(coords ? { coords } : {}) };
        const { data: resultado, error } = await supabase.from('usuarios').update(data).eq('id', uid).select();
        if (error) console.warn('Supabase update ubicación:', error.message);
        else if (!resultado || resultado.length === 0) console.warn('Update ubicación: 0 filas. uid=', uid);
      } catch (e) {
        console.warn('update ubicación offline:', e.message);
      }
    }
  };

  const updatePerfil = async ({ nombre, ubicacion, whatsapp, coords = null }) => {
    const uid = user?.id || user?.uid;
    if (!uid) throw new Error('No hay sesión');
    const nombreFinal = (nombre ?? user.nombre ?? '').trim();
    const ubicacionFinal = ubicacion ?? user.ubicacion ?? '';
    const whatsappFinal = normalizarWhatsapp(whatsapp ?? user.whatsapp ?? '');
    setUser(prev => ({
      ...prev,
      nombre: nombreFinal,
      ubicacion: ubicacionFinal,
      whatsapp: whatsappFinal,
      coords: coords || prev.coords,
    }));
    try {
      const data = {
        nombre: nombreFinal,
        ubicacion: ubicacionFinal,
        whatsapp: whatsappFinal || null,
        ...(coords ? { coords } : {}),
      };
      const { error } = await supabase.from('usuarios').update(data).eq('id', uid);
      if (error) console.warn('Supabase updatePerfil:', error.message);
    } catch (e) {
      console.warn('updatePerfil offline:', e.message);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // Helper: ¿el usuario está aprobado?
  const isAprobado = user?.status === 'aprobado' || user?.rol === 'admin';

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout, updateUbicacion, updatePerfil, isAprobado }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);