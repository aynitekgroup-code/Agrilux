/**
 * src/lib/AuthContext.jsx
 *
 * Registro: nombre completo + correo + celular + contraseña
 * Login:    correo + contraseña
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
  collection, query, where, getDocs,
} from 'firebase/firestore';

const AuthContext = createContext();

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
          ...perfil,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Registro: nombre + email + celular + contraseña ────────────────────────
  const register = async ({ nombre, email, celular, password }) => {
    const q = query(collection(db, 'usuarios'), where('celular', '==', celular));
    const existe = await getDocs(q);
    if (!existe.empty) throw { code: 'agrilux/celular-en-uso' };

    const cred = await createUserWithEmailAndPassword(
      auth,
      email.trim().toLowerCase(),
      password
    );
    await updateProfile(cred.user, { displayName: nombre.trim() });
    await setDoc(doc(db, 'usuarios', cred.user.uid), {
      nombre:    nombre.trim(),
      email:     email.trim().toLowerCase(),
      celular,
      rol:       'agricultor',
      creadoPor: 'self',
      createdAt: new Date().toISOString(),
    });
    setUser({
      uid:    cred.user.uid,
      email:  email.trim().toLowerCase(),
      nombre: nombre.trim(),
      celular,
      rol:    'agricultor',
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

  const updateUbicacion = async (ubicacion) => {
    if (!user?.uid) throw new Error('No hay sesión');
    await setDoc(doc(db, 'usuarios', user.uid), { ubicacion }, { merge: true });
    setUser(prev => ({ ...prev, ubicacion }));
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout, updateUbicacion }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);