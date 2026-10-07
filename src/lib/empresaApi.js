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

export async function crearEmpresa({ nombre, ruc, telefono, ubicacion, created_by }) {
  const { data, error } = await supabase.from('empresas')
    .insert({ nombre, ruc, telefono, ubicacion, campana_activa: '2026-A', created_by })
    .select().single();
  if (error) throw error;
  return data;
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
