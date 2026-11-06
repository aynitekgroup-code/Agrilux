/**
 * src/lib/AuthContext.jsx
 *
 * Registro: nombre completo + correo + celular + contraseña → status: 'aprobado'
 * Login:    correo + contraseña → si status !== 'aprobado', bloqueado
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';
import { listarEmpresasDelUsuario, cambiarEmpresaActiva } from './empresaApi';

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
  const [empresa_activa_id, setEmpresaActivaId] = useState(null);
  const [empresas_disponibles, setEmpresasDisponibles] = useState([]);

  const fetchPerfil = async (sessionUser) => {
    if (!sessionUser) return null;
    try {
      const { data, error } = await supabase.from('usuarios').select('*').eq('id', sessionUser.id).single();
      if (error) {
        console.warn('fetchPerfil error:', error.message);
        return null;
      }
      return data;
    } catch (e) {
      console.warn('fetchPerfil catch:', e.message);
      return null;
    }
  };

  const parseCoords = (raw) => {
    try { return JSON.parse(raw); } catch { return null; }
  };

  useEffect(() => {
    // Cargar sesión inicial
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const perfil = await fetchPerfil(session.user);
        const ubicacionLS = localStorage.getItem('agrilux_ubicacion') || '';
        const coordsLS = parseCoords(localStorage.getItem('agrilux_coords'));
        setUser({
          ...perfil,
          id: session.user.id,
          uid: session.user.id,
          email: session.user.email,
          nombre: perfil?.nombre || session.user.user_metadata?.nombre || '',
          whatsapp: perfil?.whatsapp || '',
          status: perfil?.status || 'aprobado',
          ubicacion: perfil?.ubicacion || ubicacionLS || '',
          coords: perfil?.coords || coordsLS || null,
        });

        // Cargar empresas donde el usuario es miembro activo
        try {
          const empresas = await listarEmpresasDelUsuario(session.user.id);
          setEmpresasDisponibles(empresas);
          // Si no hay empresa activa seleccionada y hay empresas disponibles, seleccionar la primera
          if (!empresa_activa_id && empresas.length > 0) {
            setEmpresaActivaId(empresas[0].id);
          }
        } catch (e) {
          console.warn('Error cargando empresas del usuario:', e.message);
        }
      } else {
        setUser(null);
        setEmpresasDisponibles([]);
        setEmpresaActivaId(null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const perfil = await fetchPerfil(session.user);
        const ubicacionLS = localStorage.getItem('agrilux_ubicacion') || '';
        const coordsLS = parseCoords(localStorage.getItem('agrilux_coords'));
        setUser({
          ...perfil,
          id: session.user.id,
          uid: session.user.id,
          email: session.user.email,
          nombre: perfil?.nombre || session.user.user_metadata?.nombre || '',
          whatsapp: perfil?.whatsapp || '',
          status: perfil?.status || 'aprobado',
          ubicacion: perfil?.ubicacion || ubicacionLS || '',
          coords: perfil?.coords || coordsLS || null,
        });

        // Cargar empresas donde el usuario es miembro activo
        try {
          const empresas = await listarEmpresasDelUsuario(session.user.id);
          setEmpresasDisponibles(empresas);
          // Si no hay empresa activa seleccionada y hay empresas disponibles, seleccionar la primera
          if (!empresa_activa_id && empresas.length > 0) {
            setEmpresaActivaId(empresas[0].id);
          }
        } catch (e) {
          console.warn('Error cargando empresas del usuario:', e.message);
        }
      } else {
        setUser(null);
        setEmpresasDisponibles([]);
        setEmpresaActivaId(null);
      }
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Registro: requiere sesión real (o confirmación de correo) ─────────────
  const register = async ({ nombre, email, password, ubicacion, coords, whatsapp }) => {
    const whatsappNormalizado = normalizarWhatsapp(whatsapp);
    const emailNorm = email.trim().toLowerCase();
    const emailRedirectTo = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;
    const { data, error } = await supabase.auth.signUp({
      email: emailNorm,
      password,
      options: {
        data: { nombre: nombre.trim() },
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
      },
    });
    if (error) throw error;
    const uid = data.user?.id;
    if (!uid) throw new Error('No se pudo crear el usuario');

    // Si Supabase exige confirmar el correo, no hay sesión todavía.
    // No se debe marcar al usuario como autenticado localmente.
    if (!data.session) {
      const confirmError = new Error(
        'Tu cuenta fue creada. Revisa tu correo electrónico y confirma el enlace para poder iniciar sesión.'
      );
      confirmError.code = 'email_not_confirmed';
      confirmError.email = emailNorm;
      throw confirmError;
    }

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
    const { error: perfilError } = await supabase.from('usuarios').insert(perfil);
    if (perfilError) {
      console.warn('No se pudo crear el perfil en usuarios:', perfilError.message);
    }
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

    // Si el usuario se registró con confirmación de correo pendiente, el perfil
    // no pudo insertarse en el registro. Se repara aquí, ya con sesión activa.
    const authUser = data.user;
    if (authUser) {
      const { data: perfil, error: perfilError } = await supabase
        .from('usuarios')
        .select('id')
        .eq('id', authUser.id)
        .maybeSingle();

      if (!perfilError && !perfil) {
        const { error: insertError } = await supabase.from('usuarios').insert({
          id: authUser.id,
          nombre: authUser.user_metadata?.nombre || authUser.email?.split('@')[0] || 'Usuario Agrilux',
          email: authUser.email,
          rol: 'agricultor',
          status: 'aprobado',
          creado_por: 'self',
        });
        if (insertError) {
          console.warn('No se pudo reparar el perfil en usuarios:', insertError.message);
        }
      }
    }

    return data.user;
  };

  // ── Reenvío de correo de confirmación ──────────────────────────────────────
  const resendConfirmation = async (email) => {
    const emailNorm = String(email || '').trim().toLowerCase();
    if (!emailNorm) throw new Error('Ingresa tu correo electrónico.');
    const emailRedirectTo = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: emailNorm,
      ...(emailRedirectTo ? { options: { emailRedirectTo } } : {}),
    });
    if (error) throw error;
  };

  const updateUbicacion = async (ubicacion, coords = null) => {
    const uid = user?.id || user?.uid;
    if (!uid) throw new Error('No hay sesión');
    const prevUbicacion = user.ubicacion;
    const prevCoords = user.coords;
    localStorage.setItem('agrilux_ubicacion', ubicacion);
    if (coords) localStorage.setItem('agrilux_coords', JSON.stringify(coords));
    setUser(prev => ({ ...prev, ubicacion, coords: coords || prev.coords }));
    try {
      const data = { ubicacion, ...(coords ? { coords } : {}) };
      const { data: resultado, error } = await supabase.from('usuarios').update(data).eq('id', uid).select();
      if (error) {
        console.warn('Supabase update ubicación:', error.message);
        setUser(prev => ({ ...prev, ubicacion: prevUbicacion, coords: prevCoords }));
        localStorage.setItem('agrilux_ubicacion', prevUbicacion);
      } else if (!resultado || resultado.length === 0) {
        console.warn('Update ubicación: 0 filas. uid=', uid);
      }
    } catch (e) {
      console.warn('update ubicación offline:', e.message);
      setUser(prev => ({ ...prev, ubicacion: prevUbicacion, coords: prevCoords }));
      localStorage.setItem('agrilux_ubicacion', prevUbicacion);
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

  // Cambiar empresa activa (validar membresía)
  const setEmpresaActiva = async (empresaId) => {
    try {
      const resultado = await cambiarEmpresaActiva(empresaId, user?.id || user?.uid);
      if (resultado) {
        setEmpresaActivaId(empresaId);
        return true;
      }
      return false;
    } catch (e) {
      console.warn('No se pudo cambiar la empresa activa:', e.message);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout, resendConfirmation, updateUbicacion, updatePerfil, isAprobado, empresa_activa_id, empresas_disponibles, setEmpresaActiva }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);