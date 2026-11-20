/**
 * scripts/migrate-firebase-to-supabase.js
 * Migra datos de Firebase Firestore → Supabase Postgres
 * Uso: node scripts/migrate-firebase-to-supabase.js
 * Requiere: .env con credenciales Firebase + SUPABASE_SERVICE_ROLE_KEY
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY en .env (Settings → API Keys → secret key)');
  process.exit(1);
}

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const COLLECTIONS = [
  { firestore: 'usuarios', supabase: 'usuarios', idField: 'id' },
  { firestore: 'diagnosticos', supabase: 'diagnosticos' },
  { firestore: 'parcelas', supabase: 'parcelas' },
  { firestore: 'registrosParcela', supabase: 'registros_parcela' },
  { firestore: 'historialClinico', supabase: 'historial_clinico' },
  { firestore: 'tiendas_comunidad', supabase: 'tiendas_comunidad' },
  { firestore: 'precios_historicos', supabase: 'precios_historicos' },
  { firestore: 'tiendas', supabase: 'tiendas' },
  { firestore: 'aliados', supabase: 'aliados' },
  { firestore: 'comunidad', supabase: 'comunidad' },
  { firestore: 'contactos_marketing', supabase: 'contactos_marketing' },
  { firestore: 'conversacionesVoz', supabase: 'conversaciones_voz' },
];

function mapDoc(col, doc) {
  const d = { ...doc };
  // Normalizar campos camelCase → snake_case donde Supabase espera
  if (col === 'usuarios') {
    return {
      id: doc.id,
      nombre: doc.nombre,
      email: doc.email || doc.emailSintetico,
      ubicacion: doc.ubicacion || null,
      whatsapp: doc.whatsapp || doc.celular || null,
      coords: doc.coords || null,
      rol: doc.rol || 'agricultor',
      status: doc.status || 'aprobado',
      creado_por: doc.creadoPor || 'self',
      created_at: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
      email_sintetico: doc.emailSintetico || null,
      celular: doc.celular || null,
      password_default: doc.passwordDefault || null,
    };
  }
  if (col === 'diagnosticos') {
    return {
      id: doc.id,
      user_id: doc.userId || null,
      user_name: doc.userName || null,
      user_email: doc.userEmail || null,
      cultivo: doc.cultivo,
      cultivo_nombre: doc.cultivoNombre || null,
      con_foto: doc.conFoto || false,
      consulta_texto: doc.consultaTexto || null,
      clima_contexto: doc.climaContexto || null,
      resultado: doc.resultado || null,
      confirmado_por_usuario: doc.confirmado_por_usuario ?? null,
      fecha: doc.fecha,
      mes: doc.mes,
      created_at: doc.fecha ? new Date(doc.fecha).toISOString() : new Date().toISOString(),
    };
  }
  // Para el resto, copiar tal cual mapeando claves conocidas
  return d;
}

async function migrateCollection({ firestore, supabase: table, idField }) {
  console.log(`\n→ Migrando ${firestore} → ${table} ...`);
  const snap = await getDocs(collection(db, firestore));
  if (snap.empty) { console.log(`  (vacío)`); return 0; }
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`  Encontrados: ${docs.length}`);

  // Insertar en lotes de 100
  let inserted = 0;
  for (let i = 0; i < docs.length; i += 100) {
    const chunk = docs.slice(i, i + 100).map(d => mapDoc(table, d));
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id' });
    if (error) {
      console.error(`  Error lote ${i}:`, error.message);
      // Intentar insert uno por uno para ver cuál falla
      for (const doc of chunk) {
        const { error: e2 } = await supabase.from(table).upsert(doc, { onConflict: 'id' });
        if (e2) console.error(`   - ${doc.id}: ${e2.message}`);
        else inserted++;
      }
    } else inserted += chunk.length;
  }
  console.log(`  Insertados: ${inserted}`);
  return inserted;
}

async function main() {
  console.log('=== Migración Firebase → Supabase ===');
  console.log(`Firebase project: ${firebaseConfig.projectId}`);
  console.log(`Supabase URL: ${supabaseUrl}`);
  let total = 0;
  for (const col of COLLECTIONS) {
    try { total += await migrateCollection(col); }
    catch (e) { console.error(`Error en ${col.firestore}:`, e.message); }
  }
  console.log(`\n✓ Migración completa. Total documentos: ${total}`);
  console.log('Nota: Usuarios de Firebase Auth no se migran automáticamente.');
  console.log('Los usuarios deberán hacer "Recuperar contraseña" en Supabase o registrarse de nuevo.');
}

main();
