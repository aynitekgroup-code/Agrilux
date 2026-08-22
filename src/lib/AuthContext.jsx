/**
 * src/lib/AuthContext.jsx
 *
 * Registro: nombre completo + correo + celular + contraseña → status: 'pendiente'
 * Login:    correo + contraseña → si status !== 'aprobado', bloqueado
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from './firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import {
  doc, setDoc, getDoc,
} from 'firebase/firestore';

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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const snap = await getDoc(doc(db, 'usuarios', firebaseUser.uid));
        const perfil = snap.exists() ? snap.data() : {};
        setUser({
          uid:    firebaseUser.uid,
          email:  firebaseUser.email,
          nombre: firebaseUser.displayName || perfil.nombre || '',
          whatsapp: perfil.whatsapp || '',
          status: perfil.status || 'aprobado', // default aprobado para admins creados
          ...perfil,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Registro: status = 'aprobado' (acceso inmediato) ──────
  const register = async ({ nombre, email, password, ubicacion, coords, whatsapp }) => {
    const whatsappNormalizado = normalizarWhatsapp(whatsapp);
    const cred = await createUserWithEmailAndPassword(
      auth,
      email.trim().toLowerCase(),
      password
    );
    await updateProfile(cred.user, { displayName: nombre.trim() });
    await setDoc(doc(db, 'usuarios', cred.user.uid), {
      nombre:    nombre.trim(),
      email:     email.trim().toLowerCase(),
      ubicacion: ubicacion || '',
      whatsapp:  whatsappNormalizado || null,
      coords:    coords || null,
      rol:       'agricultor',
      status:    'aprobado',
      creadoPor: 'self',
      createdAt: new Date().toISOString(),
    });
    setUser({
      uid:    cred.user.uid,
      email:  email.trim().toLowerCase(),
      nombre: nombre.trim(),
      ubicacion: ubicacion || '',
      whatsapp: whatsappNormalizado || '',
      coords:    coords || null,
      rol:    'agricultor',
      status: 'aprobado',
    });
    return cred.user;
  };

  // ── Login: correo + contraseña ─────────────────────────────────────────────
  const login = async ({ email, password }) => {
    const cred = await signInWithEmailAndPassword(
      auth,
      email.trim().toLowerCase(),
      password
    );
    return cred.user;
  };

  const updateUbicacion = async (ubicacion, coords = null) => {
    if (!user?.uid) throw new Error('No hay sesión');
    const data = { ubicacion };
    if (coords) data.coords = coords;
    await setDoc(doc(db, 'usuarios', user.uid), data, { merge: true });
    setUser(prev => ({ ...prev, ubicacion, coords: coords || prev.coords }));
  };

  const updatePerfil = async ({ nombre, ubicacion, whatsapp, coords = null }) => {
    if (!user?.uid) throw new Error('No hay sesión');

    const nombreFinal = (nombre ?? user.nombre ?? '').trim();
    const ubicacionFinal = ubicacion ?? user.ubicacion ?? '';
    const whatsappFinal = normalizarWhatsapp(whatsapp ?? user.whatsapp ?? '');

    const data = {
      nombre: nombreFinal,
      ubicacion: ubicacionFinal,
      whatsapp: whatsappFinal || null,
      ...(coords ? { coords } : {}),
    };

    await setDoc(doc(db, 'usuarios', user.uid), data, { merge: true });
    setUser(prev => ({
      ...prev,
      nombre: nombreFinal,
      ubicacion: ubicacionFinal,
      whatsapp: whatsappFinal,
      coords: coords || prev.coords,
    }));

    return data;
  };

  const logout = async () => {
    await signOut(auth);
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