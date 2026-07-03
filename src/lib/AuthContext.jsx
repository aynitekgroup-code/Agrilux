/**
 * src/lib/AuthContext.jsx
 *
 * Registro: nombre completo + correo + celular (9 dígitos)
 * Login:    solo celular → busca email en Firestore → inicia sesión
 *
 * El celular actúa como contraseña en Firebase Auth internamente.
 * El usuario solo necesita recordar su número de celular.
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

  // ── Registro: nombre + email + celular ────────────────────────────────────
  const register = async ({ nombre, email, celular }) => {
    // Verificar que el celular no esté ya registrado
    const q = query(collection(db, 'usuarios'), where('celular', '==', celular));
    const existe = await getDocs(q);
    if (!existe.empty) throw { code: 'agrilux/celular-en-uso' };

    // Celular como contraseña Firebase (9 dígitos = suficiente para Firebase min 6)
    const cred = await createUserWithEmailAndPassword(
      auth,
      email.trim().toLowerCase(),
      celular
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

  // ── Login: solo celular → encuentra email → inicia sesión ─────────────────
  const login = async ({ celular }) => {
    // Buscar usuario por celular en Firestore
    const q = query(collection(db, 'usuarios'), where('celular', '==', celular));
    const snap = await getDocs(q);

    if (snap.empty) throw { code: 'agrilux/celular-no-encontrado' };

    const perfil = snap.docs[0].data();
    const email  = perfil.email;
    if (!email) throw { code: 'agrilux/sin-email' };

    // El celular ES la contraseña en Firebase
    const cred = await signInWithEmailAndPassword(auth, email, celular);
    return cred.user;
  };

  // ── Login motorizado: código de entrega → inicia sesión ───────────────────
  const loginMotorizado = async ({ codigo }) => {
    const codigoLimpio = codigo.trim().toUpperCase();
    const q = query(collection(db, 'usuarios'), where('codigoEntrega', '==', codigoLimpio));
    const snap = await getDocs(q);

    if (snap.empty) throw { code: 'agrilux/codigo-no-encontrado' };

    const perfilDoc = snap.docs[0];
    const perfil = perfilDoc.data();
    const oldUid = perfilDoc.id;

    // Si ya tiene email en Firestore, ya tiene cuenta Firebase Auth
    if (perfil.email) {
      const cred = await signInWithEmailAndPassword(auth, perfil.email, codigoLimpio);
      return cred.user;
    }

    // Primer login: crear cuenta Firebase Auth con uid propio
    const emailFirebase = `moto-${codigoLimpio}@agrilux.app`;
    const cred = await createUserWithEmailAndPassword(auth, emailFirebase, codigoLimpio);
    await updateProfile(cred.user, { displayName: perfil.nombre });

    // Copiar datos al documento con el uid de Firebase Auth
    const { passwordDefault, ...datos } = perfil;
    await setDoc(doc(db, 'usuarios', cred.user.uid), {
      ...datos,
      email: emailFirebase,
      createdAt: new Date().toISOString(),
    });

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
    <AuthContext.Provider value={{ user, loading, register, login, loginMotorizado, logout, updateUbicacion }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);