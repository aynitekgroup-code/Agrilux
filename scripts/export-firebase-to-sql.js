/**
 * Exporta Firestore -> SQL para pegar en Supabase SQL Editor
 * No requiere conexión a Supabase, solo a Firebase
 * Uso: node scripts/export-firebase-to-sql.js
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
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

const db = getFirestore(initializeApp(firebaseConfig));

function esc(str) {
  if (str == null) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}
function escJson(obj) {
  if (obj == null) return 'NULL';
  return `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`;
}
function toDate(iso) {
  if (!iso) return 'NULL';
  try { return `'${new Date(iso).toISOString()}'`; } catch { return 'NULL'; }
}

async function exportCol(firestoreName, table, mapper) {
  const snap = await getDocs(collection(db, firestoreName));
  if (snap.empty) return `-- ${table}: vacío\n`;
  let sql = `-- ${table}: ${snap.size} filas\n`;
  for (const d of snap.docs) {
    const data = { id: d.id, ...d.data() };
    sql += mapper(data) + '\n';
  }
  return sql;
}

async function main() {
  let out = '-- Supabase import generado desde Firebase agrilux-39485\n-- Pega esto en Supabase SQL Editor y Run\n\n';

  out += await exportCol('usuarios', 'usuarios', d => {
    const id = esc(d.id);
    const nombre = esc(d.nombre || '');
    const email = esc(d.email || d.emailSintetico || '');
    const ubicacion = d.ubicacion ? esc(d.ubicacion) : 'NULL';
    const whatsapp = d.whatsapp || d.celular ? esc(d.whatsapp || d.celular) : 'NULL';
    const coords = d.coords ? escJson(d.coords) : 'NULL';
    const rol = esc(d.rol || 'agricultor');
    const status = esc(d.status || 'aprobado');
    const creado_por = esc(d.creadoPor || 'self');
    const created_at = d.createdAt ? toDate(d.createdAt) : 'NOW()';
    const email_sintetico = d.emailSintetico ? esc(d.emailSintetico) : 'NULL';
    const celular = d.celular ? esc(d.celular) : 'NULL';
    const password_default = d.passwordDefault ? esc(d.passwordDefault) : 'NULL';
    return `INSERT INTO usuarios (id, nombre, email, ubicacion, whatsapp, coords, rol, status, creado_por, created_at, email_sintetico, celular, password_default) VALUES (${id}, ${nombre}, ${email}, ${ubicacion}, ${whatsapp}, ${coords}, ${rol}, ${status}, ${creado_por}, ${created_at}, ${email_sintetico}, ${celular}, ${password_default}) ON CONFLICT (id) DO NOTHING;`;
  });

  out += await exportCol('diagnosticos', 'diagnosticos', d => {
    return `INSERT INTO diagnosticos (id, user_id, user_name, user_email, cultivo, cultivo_nombre, con_foto, consulta_texto, clima_contexto, resultado, confirmado_por_usuario, fecha, mes) VALUES (${esc(d.id)}, ${d.userId ? esc(d.userId) : 'NULL'}, ${d.userName ? esc(d.userName) : 'NULL'}, ${d.userEmail ? esc(d.userEmail) : 'NULL'}, ${esc(d.cultivo || '')}, ${d.cultivoNombre ? esc(d.cultivoNombre) : 'NULL'}, ${d.conFoto ? 'true' : 'false'}, ${d.consultaTexto ? esc(d.consultaTexto) : 'NULL'}, ${d.climaContexto ? escJson(d.climaContexto) : 'NULL'}, ${d.resultado ? escJson(d.resultado) : 'NULL'}, ${d.confirmado_por_usuario == null ? 'NULL' : d.confirmado_por_usuario}, ${esc(d.fecha || new Date().toISOString())}, ${d.mes || new Date().getMonth()+1}) ON CONFLICT (id) DO NOTHING;`;
  });

  out += await exportCol('parcelas', 'parcelas', d => {
    return `INSERT INTO parcelas (id, user_id, user_name, nombre, cultivo, cultivo_nombre, cultivo_emoji, variedad, area, fecha_siembra, gps, coordenadas) VALUES (${esc(d.id)}, ${esc(d.userId||'')}, ${d.userName?esc(d.userName):'NULL'}, ${esc(d.nombre||'')}, ${d.cultivo?esc(d.cultivo):'NULL'}, ${d.cultivoNombre?esc(d.cultivoNombre):'NULL'}, ${d.cultivoEmoji?esc(d.cultivoEmoji):'NULL'}, ${d.variedad?esc(d.variedad):'NULL'}, ${d.area?esc(String(d.area)):'NULL'}, ${d.fechaSiembra?esc(d.fechaSiembra):'NULL'}, ${d.gps?esc(d.gps):'NULL'}, ${d.coordenadas?esc(typeof d.coordenadas==='string'?d.coordenadas:JSON.stringify(d.coordenadas)):'NULL'}) ON CONFLICT (id) DO NOTHING;`;
  });

  out += await exportCol('registrosParcela', 'registros_parcela', d => {
    return `INSERT INTO registros_parcela (id, parcela_id, user_id, foto, recomendacion, dias_desde_siembra, fecha) VALUES (${esc(d.id)}, ${esc(d.parcelaId||'')}, ${esc(d.userId||'')}, ${d.foto?esc(d.foto.substring(0,1000)+'...'): 'NULL'}, ${d.recomendacion?esc(d.recomendacion):'NULL'}, ${d.diasDesdeSiembra ?? 'NULL'}, ${esc(d.fecha||new Date().toISOString())}) ON CONFLICT (id) DO NOTHING;`;
  });

  out += await exportCol('historialClinico', 'historial_clinico', d => {
    return `INSERT INTO historial_clinico (id, user_id, parcela_id, parcela_nombre, cultivo, tiene_problema, problema, gravedad, recomendacion, fuente) VALUES (${esc(d.id)}, ${d.userId?esc(d.userId):'NULL'}, ${d.parcelaId?esc(d.parcelaId):'NULL'}, ${d.parcelaNombre?esc(d.parcelaNombre):'NULL'}, ${d.cultivo?esc(d.cultivo):'NULL'}, ${d.tieneProblema?'true':'false'}, ${d.problema?esc(d.problema):'NULL'}, ${d.gravedad?esc(d.gravedad):'NULL'}, ${d.recomendacion?esc(d.recomendacion):'NULL'}, ${d.fuente?esc(d.fuente):'NULL'}) ON CONFLICT (id) DO NOTHING;`;
  });
  out += await exportCol('tiendas_comunidad', 'tiendas_comunidad', d => {
    return `INSERT INTO tiendas_comunidad (id, nombre, direccion, distrito, departamento, whatsapp, verificada, activa) VALUES (${esc(d.id)}, ${esc(d.nombre||'')}, ${d.direccion?esc(d.direccion):'NULL'}, ${d.distrito?esc(d.distrito):'NULL'}, ${d.departamento?esc(d.departamento):'NULL'}, ${d.whatsapp?esc(d.whatsapp):'NULL'}, ${d.verificada?'true':'false'}, ${d.activa!==false?'true':'false'}) ON CONFLICT (id) DO NOTHING;`;
  });
  out += await exportCol('tiendas', 'tiendas', d => {
    return `INSERT INTO tiendas (id, nombre, direccion, region) VALUES (${esc(d.id)}, ${esc(d.nombre||'')}, ${d.direccion?esc(d.direccion):'NULL'}, ${d.region?esc(d.region):'NULL'}) ON CONFLICT (id) DO NOTHING;`;
  });
  out += await exportCol('aliados', 'aliados', d => {
    return `INSERT INTO aliados (id, nombre, whatsapp, empresa, ubicacion, tipo) VALUES (${esc(d.id)}, ${esc(d.nombre||'')}, ${d.whatsapp?esc(d.whatsapp):'NULL'}, ${d.empresa?esc(d.empresa):'NULL'}, ${d.ubicacion?esc(d.ubicacion):'NULL'}, ${d.tipo?esc(d.tipo):'NULL'}) ON CONFLICT (id) DO NOTHING;`;
  });
  out += await exportCol('comunidad', 'comunidad', d => {
    return `INSERT INTO comunidad (id, categoria, titulo, contenido, autor, autor_id, fecha, likes) VALUES (${esc(d.id)}, ${esc(d.categoria||'general')}, ${esc(d.titulo||'')}, ${esc(d.contenido||'')}, ${d.autor?esc(d.autor):'NULL'}, ${d.autorId?esc(d.autorId):'NULL'}, ${esc(d.fecha||new Date().toISOString())}, ${d.likes||0}) ON CONFLICT (id) DO NOTHING;`;
  });
  out += await exportCol('conversacionesVoz', 'conversaciones_voz', d => {
    return `INSERT INTO conversaciones_voz (id, user_id, mensajes) VALUES (${esc(d.id)}, ${esc(d.userId||'')}, ${d.mensajes?escJson(d.mensajes):'NULL'}) ON CONFLICT (id) DO NOTHING;`;
  });

  fs.writeFileSync('scripts/supabase-import.sql', out, 'utf8');
  console.log('✓ Generado scripts/supabase-import.sql');
  console.log('  Abre Supabase SQL Editor, pega el contenido y Run');
}

main().catch(e=>{console.error(e);process.exit(1)});
