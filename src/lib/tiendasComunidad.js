import { db } from './firebase';
import {
  collection,
  getDocs,
  writeBatch,
} from 'firebase/firestore';

const BATCH_SIZE = 450;

async function eliminarColeccion(nombre) {
  const snap = await getDocs(collection(db, nombre));
  const docs = snap.docs;
  let eliminados = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    docs.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(d.ref));
    await batch.commit();
    eliminados += Math.min(BATCH_SIZE, docs.length - i);
  }

  return eliminados;
}

/** Elimina todas las tiendas de mercado (tiendas_comunidad) y sus precios históricos. */
export async function eliminarTodasTiendasComunidad() {
  const precios = await eliminarColeccion('precios_historicos');
  const tiendas = await eliminarColeccion('tiendas_comunidad');
  return { tiendas, precios };
}
