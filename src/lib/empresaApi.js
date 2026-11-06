/**
 * src/lib/empresaApi.js
 * Capa de datos de la sección Parcela EMPRESAS.
 * Usa Supabase directo (sin /api/* para no superar el límite
 * de 12 serverless functions del plan Hobby de Vercel).
 * Si las tablas aún no existen → modo demo con datos de ejemplo.
 */
import { supabase } from './supabase';

export const ROLES = ['administrador', 'ingeniero', 'supervisor', 'operario'];
export const ESTADOS_TAREA = ['pendiente', 'en_curso', 'hecha', 'atrasada'];
export const TIPOS_LABOR = ['Siembra', 'Riego', 'Abonado', 'Fumigación', 'Deshierbo', 'Monitoreo', 'Cosecha', 'Otro'];
export const CATEGORIAS_GASTO = ['insumos', 'mano_obra', 'riego', 'maquinaria', 'otros'];

const normalizarWhatsapp = (valor) => {
  const numeros = String(valor || '').replace(/\D/g, '');
  if (!numeros) return '';
  if (numeros.startsWith('51')) return numeros;
  if (numeros.startsWith('0')) return `51${numeros.slice(1)}`;
  return `51${numeros}`;
};

// ── Datos de ejemplo (como los mockups) cuando no hay empresa ──
export const DEMO = {
  empresa: { id: 'demo', nombre: 'Agro Andina S.A.C.', campana_activa: '2026-A' },
  fundos: [
    { id: 'f1', nombre: 'Fundo Lima Sur' },
    { id: 'f2', nombre: 'Fundo Huaral' },
  ],
  lotes: [
    { id: 'l1', fundo_id: 'f1', fundo_nombre: 'Fundo Lima Sur', nombre: 'El Recuerdo', cultivo: 'papa', variedad: 'Yungay', area_ha: 0.05, fecha_siembra: '2025-08-06', etapa: 'Tuberización · día 62', riesgo: 'moderado', lat: -12.05, lon: -77.04 },
    { id: 'l2', fundo_id: 'f1', fundo_nombre: 'Fundo Lima Sur', nombre: 'San Martín 2', cultivo: 'papa', variedad: 'Canchán', area_ha: 1.2, fecha_siembra: '2025-09-19', etapa: 'Emergencia · día 18', riesgo: 'bajo', lat: -12.06, lon: -77.05 },
    { id: 'l3', fundo_id: 'f2', fundo_nombre: 'Fundo Huaral', nombre: 'La Joya', cultivo: 'palta', variedad: 'Hass', area_ha: 3.5, fecha_siembra: '2025-05-20', etapa: 'Floración · día 140', riesgo: 'alto', lat: -11.5, lon: -77.21 },
    { id: 'l4', fundo_id: 'f2', fundo_nombre: 'Fundo Huaral', nombre: 'Pampa Alta', cultivo: 'maiz', variedad: '', area_ha: 2.0, fecha_siembra: '2025-08-23', etapa: 'Crecimiento · día 45', riesgo: 'bajo', lat: -11.52, lon: -77.22 },
  ],
  labores: [
    { id: 'lb1', lote_id: 'l1', lote_nombre: 'El Recuerdo', tipo: 'Fumigación', producto: 'Ridomil Gold MZ', dosis: '25 g por mochila de 20 L', responsable_nombre: 'Carlos R.', fecha: new Date().toISOString().slice(0, 10), carencia_hasta: '2025-10-20', costo: 180 },
    { id: 'lb2', lote_id: 'l1', lote_nombre: 'El Recuerdo', tipo: 'Riego', producto: 'Riego por gravedad', dosis: '3 h', responsable_nombre: 'Luis M.', fecha: '2025-10-04', costo: 60 },
    { id: 'lb3', lote_id: 'l1', lote_nombre: 'El Recuerdo', tipo: 'Abonado', producto: 'Nitrogenado', dosis: '120 kg/ha', responsable_nombre: 'Ana P.', fecha: '2025-10-02', costo: 320 },
    { id: 'lb4', lote_id: 'l1', lote_nombre: 'El Recuerdo', tipo: 'Deshierbo', producto: '', dosis: '', responsable_nombre: 'Carlos R.', fecha: '2025-09-30', costo: 90 },
  ],
  tareas: [
    { id: 't1', lote_id: 'l1', lote_nombre: 'El Recuerdo', titulo: 'Fungicida en El Recuerdo', asignado_nombre: 'Carlos R.', vence: sumarDias(2), estado: 'pendiente' },
    { id: 't2', lote_id: 'l2', lote_nombre: 'San Martín 2', titulo: 'Riego en San Martín 2', asignado_nombre: 'Luis M.', vence: hoy(), estado: 'en_curso' },
    { id: 't3', lote_id: 'l3', lote_nombre: 'La Joya', titulo: 'Monitoreo con fotos en La Joya', asignado_nombre: 'Ana P.', vence: hoy(), estado: 'atrasada' },
    { id: 't4', lote_id: 'l4', lote_nombre: 'Pampa Alta', titulo: 'Abonado en Pampa Alta', asignado_nombre: 'Luis M.', vence: sumarDias(5), estado: 'pendiente' },
    { id: 't5', lote_id: 'l1', lote_nombre: 'El Recuerdo', titulo: 'Deshierbo en El Recuerdo', asignado_nombre: 'Carlos R.', vence: sumarDias(-1), estado: 'hecha' },
  ],
  cosechas: [
    { id: 'c1', lote_id: 'l1', lote_nombre: 'El Recuerdo', campana: '2025-B', fecha: '2025-03-10', sacos: 100, area_ha: 1, precio_unit: 120 },
    { id: 'c2', lote_id: 'l1', lote_nombre: 'El Recuerdo', campana: '2026-A', fecha: '2025-09-28', sacos: 117, area_ha: 1, precio_unit: 120 },
  ],
  gastos: [
    { id: 'g1', lote_id: 'l1', campana: '2026-A', categoria: 'insumos', concepto: 'Ridomil + fertilizantes', monto: 4300, fecha: '2025-09-01' },
    { id: 'g2', lote_id: 'l1', campana: '2026-A', categoria: 'mano_obra', concepto: 'Jornales campaña', monto: 3100, fecha: '2025-09-15' },
  ],
  miembros: [
    { id: 'm1', nombre: 'María Gómez', rol: 'administrador' },
    { id: 'm2', nombre: 'Jorge Torres', rol: 'ingeniero' },
    { id: 'm3', nombre: 'Carlos Ramos', rol: 'supervisor' },
    { id: 'm4', nombre: 'Luis Mendoza', rol: 'operario' },
  ],
  campanas: [{ id: 'cp1', nombre: '2026-A', activa: true }, { id: 'cp2', nombre: '2025-B', activa: false }],
};

function hoy() { return new Date().toISOString().slice(0, 10); }
function sumarDias(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const esTablaFaltante = (e) =>
  e && (e.code === '42P01' || /relation .* does not exist|Could not find the table|schema cache/i.test(e.message || ''));

// ── Empresas ─────────────────────────────────────────────
export async function listarEmpresas(userId) {
  try {
    const { data, error } = await supabase.from('empresas').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return { data: data || [], demo: false };
  } catch (e) {
    if (esTablaFaltante(e)) return { data: [], demo: true, faltaSQL: true };
    // Sin red u otro error: modo demo para no bloquear
    return { data: [], demo: true };
  }
}

// ── Lectura genérica por empresa ─────────────────────────
async function leer(tabla, empresaId, orden = 'created_at') {
  const { data, error } = await supabase.from(tabla).select('*').eq('empresa_id', empresaId).order(orden, { ascending: false }).limit(500);
  if (error) throw error;
  return data || [];
}

export async function cargarTodoEmpresa(empresaId) {
  const [fundos, lotes, labores, tareas, cosechas, gastos, miembros, campanas] = await Promise.all([
    leer('fundos', empresaId, 'nombre').catch(() => []),
    leer('lotes', empresaId, 'nombre').catch(() => []),
    leer('labores', empresaId, 'fecha').catch(() => []),
    leer('tareas', empresaId, 'created_at').catch(() => []),
    leer('cosechas', empresaId, 'fecha').catch(() => []),
    leer('gastos', empresaId, 'fecha').catch(() => []),
    leer('empresa_miembros', empresaId, 'nombre').catch(() => []),
    leer('campanas', empresaId, 'nombre').catch(() => []),
  ]);
  return { fundos, lotes, labores, tareas, cosechas, gastos, miembros, campanas };
}

// ── Escrituras genéricas ─────────────────────────────────
async function insertar(tabla, fila) {
  const { data, error } = await supabase.from(tabla).insert(fila).select().single();
  if (error) throw error;
  return data;
}
export const crearFundo = (f) => insertar('fundos', f);
export const crearLote = (f) => insertar('lotes', f);
export const crearCampana = (f) => insertar('campanas', f);
export const crearLabor = (f) => insertar('labores', f);
export const crearTarea = (f) => insertar('tareas', f);
export const crearCosecha = (f) => insertar('cosechas', f);
export const crearGasto = (f) => insertar('gastos', f);
export const crearHallazgo = (f) => insertar('hallazgos', f);
export const invitarMiembro = (f) => insertar('empresa_miembros', f);

export async function actualizarTarea(id, cambios) {
  const { error } = await supabase.from('tareas').update({ ...cambios, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}
export async function eliminarTarea(id) {
  const { error } = await supabase.from('tareas').delete().eq('id', id);
  if (error) throw error;
}

// Importar una parcela individual como lote de empresa
export async function importarParcelaComoLote(parcela, empresaId, fundoId) {
  return crearLote({
    empresa_id: empresaId,
    fundo_id: fundoId || null,
    parcela_id: parcela.id,
    nombre: parcela.nombre,
    cultivo: parcela.cultivo,
    variedad: parcela.variedad || '',
    area_ha: parseFloat(parcela.area) || 0,
    fecha_siembra: parcela.fechaSiembra || null,
    etapa: '',
    riesgo: 'bajo',
    gps: parcela.gps || '',
  });
}

// ── KPIs del panel ───────────────────────────────────────
export function calcularKPIs({ lotes, labores, tareas, cosechas, gastos, campana }) {
  const hectareas = lotes.reduce((a, l) => a + (parseFloat(l.area_ha) || 0), 0);
  const gastosCamp = gastos.filter((g) => !campana || g.campana === campana);
  const costoTotal = gastosCamp.reduce((a, g) => a + (parseFloat(g.monto) || 0), 0);
  const costoPorHa = hectareas > 0 ? costoTotal / hectareas : 0;
  const hoyStr = hoy();
  const alertas = tareas.filter((t) => t.estado !== 'hecha' && t.vence && t.vence <= hoyStr).length
    + lotes.filter((l) => l.riesgo === 'alto' || l.riesgo === 'critico').length;
  // Mejora: rendimiento actual vs campaña anterior (sacos/ha)
  const rend = (camp) => {
    const cs = cosechas.filter((c) => c.campana === camp);
    const sacos = cs.reduce((a, c) => a + (parseFloat(c.sacos) || 0), 0);
    const ha = cs.reduce((a, c) => a + (parseFloat(c.area_ha) || 0), 0);
    return ha > 0 ? sacos / ha : 0;
  };
  const actual = rend(campana); const anterior = rend(campana === '2026-A' ? '2025-B' : '');
  const mejora = anterior > 0 ? Math.round(((actual - anterior) / anterior) * 100) : 0;
  return { hectareas, costoTotal, costoPorHa, alertas, mejora, rendActual: actual, rendAnterior: anterior };
}

// ── Exportar CSV (bitácora, tareas, costos) ──────────────
export function exportarCSV(nombre, filas) {
  if (!filas?.length) return;
  const cols = Object.keys(filas[0]);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...filas.map((f) => cols.map((c) => esc(f[c])).join(','))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre.endsWith('.csv') ? nombre : `${nombre}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export const etiquetaRiesgo = { bajo: 'Bajo', moderado: 'Moderado', alto: 'Alto', critico: 'Crítico' };
export const colorRiesgo = {
  bajo: 'bg-green-100 text-green-700',
  moderado: 'bg-amber-100 text-amber-700',
  alto: 'bg-orange-100 text-orange-700',
  critico: 'bg-red-100 text-red-700',
};
export const iniciales = (n = '') => n.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

// ── Experiencia telefónica: validar códigos de invitación (token_hash) ───────
// Nota: el token plano viaja por HTTPS; el hash se compara en el backend
export async function validarCodigoInvitacion(token) {
  try {
    const { data, error } = await supabase.rpc('validar_codigo_invitacion', {
      p_token_plano: token
    });
    if (error) throw error;
    const resultado = Array.isArray(data) ? data[0] : data;
    return { data: resultado?.data || null, ok: Boolean(resultado?.ok), error: resultado?.mensaje || null };
  } catch (e) {
    return { data: null, ok: false, error: e.message };
  }
}

// ── Canje de invitación (orquestador) ─────────────────────────────────────────
// 1. Reserva la invitación (UPDATE ... WHERE estado_reserva = 'disponible')
// 2. Registra intento pendiente
// 3. Crea usuario en Supabase Auth (auth.signUp)
// 4. RPC confirmar_canje_invitacion (valida reserva, crea membresía, incrementa usos)
// 5. Si falla Auth: libera reserva, marca intento fallido
export async function canjearInvitacion({ token, nombre, email, password, ubicacion, whatsapp, coords }) {
  // Paso 1: Validar token y obtener reserva
  const { data: validacionRaw, error: valError } = await supabase.rpc('validar_codigo_invitacion', {
    p_token_plano: token
  });
  const validacion = Array.isArray(validacionRaw) ? validacionRaw[0] : validacionRaw;
  if (valError || !validacion?.ok) {
    throw new Error(valError?.message || 'Código de invitación inválido');
  }
  const reserva = validacion.data;
  if (!reserva || reserva.estado_reserva !== 'disponible') {
    throw new Error('La invitación no está disponible');
  }

  // Paso 2: Reservar la invitación
  const { data: reservaRaw, error: reservaError } = await supabase.rpc('reservar_codigo_invitacion', {
    p_token_plano: token,
    p_email_usuario: email.trim().toLowerCase()
  });
  const reservaData = Array.isArray(reservaRaw) ? reservaRaw[0] : reservaRaw;
  if (reservaError || !reservaData?.ok) {
    throw new Error(reservaError?.message || 'No se pudo reservar la invitación');
  }
  const reservaId = reservaData.reserva_id;

  // Paso 3: Crear usuario en Supabase Auth (FUERA de transacción PostgreSQL)
  let authUser;
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { nombre: nombre.trim() } }
    });
    if (error) throw error;
    authUser = data.user;
    if (!authUser || !data.session) {
      throw new Error('Confirma tu correo o desactiva la confirmación de correo para completar la invitación');
    }
    const { error: intentoError } = await supabase.from('invitacion_canjes').insert({
      invitacion_id: reserva.invitacion_id,
      reserva_id: reservaId,
      usuario_id: authUser.id,
      email_usado: email.trim().toLowerCase(),
      estado_intento: 'pendiente'
    });
    if (intentoError) throw intentoError;
  } catch (e) {
    // Liberar reserva
    await supabase.rpc('liberar_reserva_invitacion', { p_reserva_id: reservaId });
    // Marcar intento fallido
    await supabase.from('invitacion_canjes').update({
      estado_intento: 'fallido',
      motivo_fallo: e.message
    }).eq('reserva_id', reservaId).eq('estado_intento', 'pendiente');
    // Nota: Si se creó el usuario en Auth pero falló el canje, el usuario queda registrado.
    // Puede iniciar sesión y usar el código de invitación nuevamente; el canje es idempotente.
    throw e;
  }

  // Paso 5: RPC confirmar_canje_invitacion (transacción PostgreSQL atómica)
  try {
    const session = await waitForSession(5000);
    if (!session) throw new Error('Confirma tu correo o inicia sesión para completar la invitación');
    const { error: rpcError } = await supabase.rpc('confirmar_canje_invitacion', {
      p_reserva_id: reservaId,
      p_email_usado: email.trim().toLowerCase(),
      p_nombre: nombre.trim(),
      p_ubicacion: ubicacion || '',
      p_whatsapp: normalizarWhatsapp(whatsapp) || null
    });
    if (rpcError) throw rpcError;
  } catch (e) {
    // Liberar reserva
    await supabase.rpc('liberar_reserva_invitacion', { p_reserva_id: reservaId });
    // Marcar intento fallido
    await supabase.from('invitacion_canjes').update({
      estado_intento: 'fallido',
      motivo_fallo: e.message
    }).eq('reserva_id', reservaId).eq('estado_intento', 'pendiente');
    throw e;
  }

  return { user: authUser, empresa_id: reserva.empresa_id };
}

// ── Solicitud de incorporación a empresa ──────────────────────────────────────
export async function solicitarUnirseEmpresa({ empresa_id, cargo_id, area_trabajo, nombre, email, whatsapp }) {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) throw new Error('Usuario no autenticado');

  const { data, error } = await supabase.from('empresa_solicitudes').insert({
    empresa_id,
    user_id: user.id,
    email,
    nombre,
    cargo_id,
    area_trabajo,
    estado: 'pendiente'
  }).select().single();

  if (error) throw error;
  return data;
}

// ── Listar empresas donde el usuario es miembro activo ────────────────────────
export async function listarEmpresasDelUsuario(userId) {
  const { data, error } = await supabase
    .from('empresa_miembros')
    .select(`
      empresa_id,
      empresas (
        id,
        nombre,
        ruc,
        ubicacion,
        campana_activa
      )
    `)
    .eq('user_id', userId)
    .eq('activo', true);

  if (error) throw error;
  return data.map(m => ({
    id: m.empresa_id,
    nombre: m.empresas.nombre,
    ruc: m.empresas.ruc,
    ubicacion: m.empresas.ubicacion,
    campana_activa: m.empresas.campana_activa
  }));
}

// ── Crear empresa y registrar administrador inicial (orquestador) ─────────────
export async function registrarConEmpresa({ nombre, email, password, ubicacion, whatsapp, coords, nombreEmpresa, ruc, telefonoEmpresa, ubicacionEmpresa }) {
  // Paso 1: Crear usuario en Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { nombre: nombre.trim() } }
  });
  if (authError) throw authError;
  const uid = authData.user?.id;
  if (!uid) throw new Error('Supabase no devolvió el usuario creado');
  const authUser = authData.user;

  // Esperar a que la sesión esté activa (requerido si hay confirmación de correo)
  const session = await waitForSession(5000);
  if (!session) throw new Error('Confirma tu correo o desactiva la confirmación de correo para crear la empresa');

  // Paso 2: RPC transaccional PostgreSQL para crear perfil, empresa y membresía
  const { data, error: rpcError } = await supabase.rpc('crear_empresa_con_administrador', {
    p_nombre: nombre.trim(),
    p_email: email.trim().toLowerCase(),
    p_ubicacion: ubicacion || '',
    p_coords: coords || null,
    p_whatsapp: normalizarWhatsapp(whatsapp) || null,
    p_nombre_empresa: nombreEmpresa.trim(),
    p_ruc: ruc || null,
    p_telefono: telefonoEmpresa || null,
    p_ubicacion_empresa: ubicacionEmpresa || ''
  });

  if (rpcError) {
    throw rpcError;
  }

  return { user: authUser, empresa: data };
}

// ── Crear empresa para usuario autenticado existente (transaccional) ──────────
export async function crearEmpresaConMiembro({ nombreEmpresa, ruc, telefonoEmpresa, ubicacionEmpresa, usuarioId, usuarioNombre, usuarioEmail }) {
  const { data, error } = await supabase.rpc('crear_empresa_con_miembro_existente', {
    p_nombre_empresa: nombreEmpresa.trim(),
    p_ruc: ruc || null,
    p_telefono: telefonoEmpresa || null,
    p_ubicacion_empresa: ubicacionEmpresa || '',
    p_usuario_id: usuarioId,
    p_usuario_nombre: usuarioNombre.trim(),
    p_usuario_email: usuarioEmail.trim().toLowerCase()
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

// ── Crear empresa (legacy - solo insert, sin membresía ni plan) ───────────────
// DEPRECADO: usar crearEmpresaConMiembro o registrarConEmpresa para evitar
// empresas huérfanas sin administrador ni membresía.
// Esta función se mantiene solo por compatibilidad hacia atrás. Siempre delega
// en el flujo transaccional para garantizar que toda empresa tenga
// administrador y plan inicial.
export async function crearEmpresa({ nombre, ruc, telefono, ubicacion, created_by }) {
  if (!created_by) {
    throw new Error('created_by es obligatorio para crear una empresa');
  }
  return crearEmpresaConMiembro({
    nombreEmpresa: nombre,
    ruc,
    telefonoEmpresa: telefono,
    ubicacionEmpresa: ubicacion,
    usuarioId: created_by,
    usuarioNombre: '',
    usuarioEmail: ''
  });
}

export async function aprobarSolicitudEmpresa(solicitudId) {
  const { data, error } = await supabase.rpc('aprobar_solicitud_empresa', {
    p_solicitud_id: solicitudId
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function rechazarSolicitudEmpresa(solicitudId) {
  const { error } = await supabase.rpc('rechazar_solicitud_empresa', {
    p_solicitud_id: solicitudId
  });
  if (error) throw error;
}

// ── Cambiar empresa activa (solo validación de membresía) ─────────────────────
export async function cambiarEmpresaActiva(empresaId, userId) {
  // Verificar que el usuario es miembro activo de la empresa
  const { data, error } = await supabase
    .from('empresa_miembros')
    .select('empresa_id, rol, activo')
    .eq('empresa_id', empresaId)
    .eq('user_id', userId)
    .eq('activo', true)
    .single();

  if (error || !data) throw new Error('No eres miembro activo de esta empresa');

  return { empresa_id: empresaId, rol: data.rol };
}

// ── Esperar sesión activa después de signUp ───────────────────────────────────
// Algunos proveedores de Auth requieren confirmación de correo; la sesión puede
// no estar disponible inmediatamente tras signUp.
export async function waitForSession(timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  const { data } = await supabase.auth.getSession();
  return data.session;
}
