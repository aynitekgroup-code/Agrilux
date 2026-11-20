/**
 * Crea usuarios en Supabase Auth a partir de public.usuarios
 * Uso: node scripts/create-auth-users.js
 * Requiere SUPABASE_SERVICE_ROLE_KEY en .env
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) { console.error('Falta SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const TEMP_PASSWORD = 'Agrilux2024!';

async function main() {
  const { data: usuarios, error } = await supabase.from('usuarios').select('id, email, email_sintetico, nombre');
  if (error) { console.error(error.message); return; }
  console.log(`Encontrados ${usuarios.length} en public.usuarios`);

  let creados = 0, existentes = 0, fallos = 0;
  for (const u of usuarios) {
    const email = (u.email || u.email_sintetico || '').trim().toLowerCase();
    if (!email || !email.includes('@') || email.endsWith('@agrilux.app')) {
      console.log(`- Salta ${u.id} (${u.nombre}): sin email válido`);
      continue;
    }
    // Intentar crear
    const { data, error: err } = await supabase.auth.admin.createUser({
      email,
      password: TEMP_PASSWORD,
      email_confirm: true,
      user_metadata: { nombre: u.nombre }
    });
    if (err) {
      if (err.message.includes('already exists') || err.message.includes('already registered')) {
        existentes++;
        console.log(`- Ya existe: ${email}`);
        // Vincular id existente: buscar auth user por email y actualizar public.usuarios
        const { data: list } = await supabase.auth.admin.listUsers();
        const found = list?.users?.find(x => x.email?.toLowerCase() === email);
        if (found && found.id !== u.id) {
          await supabase.from('usuarios').update({ id: found.id }).eq('id', u.id);
          console.log(`  ↳ Vinculado ${u.id} -> ${found.id}`);
        }
      } else {
        fallos++;
        console.log(`- Error ${email}: ${err.message}`);
      }
    } else {
      creados++;
      const newId = data.user.id;
      console.log(`+ Creado ${email} -> ${newId}`);
      if (newId !== u.id) {
        const { error: updErr } = await supabase.from('usuarios').update({ id: newId }).eq('id', u.id);
        if (updErr) console.log(`  ↳ No se pudo actualizar id: ${updErr.message}`);
      }
    }
  }
  console.log(`\n✓ Creados: ${creados}, Ya existían: ${existentes}, Fallos: ${fallos}`);
  console.log(`Password temporal para todos: ${TEMP_PASSWORD}`);
  console.log(`Los usuarios ya pueden entrar con ese password o usar "Olvidé contraseña"`);
}

main();
