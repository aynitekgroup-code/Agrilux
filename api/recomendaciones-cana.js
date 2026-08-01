/**
 * api/recomendaciones-cana.js
 * Recomendaciones específicas para manejo de caña de azúcar por etapa
 *
 * GET: ?etapa=crecimiento&lat=-6.81&lon=-79.77&variedad=H32-8560&dias=120
 * Returns: { recomendaciones: {...}, acciones: [...], alertas: [...] }
 */

const ETAPAS_CANA = {
  preparacion: {
    nombre: 'Preparación del terreno',
    dias: '0-15 días antes de siembra',
    acciones: [
      { accion: 'Arar y rastrillar a 30cm de profundidad', prioridad: 'alta', costo: 'S/ 400-600/ha' },
      { accion: 'Nivelar el terreno para riego por gravedad', prioridad: 'alta', costo: 'S/ 200-300/ha' },
      { accion: 'Aplicar gallinaza 10-15 ton/ha + fosfato 200 kg/ha', prioridad: 'alta', costo: 'S/ 1,500-2,500/ha' },
      { accion: 'Formar surcos a 1.5m de distancia', prioridad: 'media', costo: 'S/ 150-250/ha' },
      { accion: 'Aplicar fumigante de suelo si hay nematodos', prioridad: 'baja', costo: 'S/ 300-500/ha' },
    ],
    alertas: ['Suelo compactado reduce rendimiento 30%', 'Análisis de suelo previo para detectar salinidad (CEe)'],
    inversion: 'S/ 2,550-4,150/ha',
    tiempoEstimado: '7-15 días',
  },
  siembra: {
    nombre: 'Siembra',
    dias: '0-15 días',
    acciones: [
      { accion: 'Cortar caña sana en semilla de 3-4 yemas (25-30cm)', prioridad: 'alta', costo: 'Incluido' },
      { accion: 'Plantar inclinada en surco, cubrir 5-8cm de tierra', prioridad: 'alta', costo: 'S/ 800-1,200/ha (mano de obra)' },
      { accion: 'Densidad: 100,000-120,000 plantas/ha', prioridad: 'alta', costo: 'S/ 2,000-3,000/ha (semilla)' },
      { accion: 'Aplicar insecticida contra broca de la caña', prioridad: 'media', costo: 'S/ 150-250/ha' },
    ],
    alertas: ['Semilla vieja (>7 días desde corte) pierde viabilidad', 'No usar semilla de campos con mosaico (enfermedad viral)'],
    inversion: 'S/ 2,950-4,450/ha',
    tiempoEstimado: '5-10 días',
  },
  germinacion: {
    nombre: 'Germinación y macollaje',
    dias: '15-60 días',
    acciones: [
      { accion: 'Mantener humedad del suelo al 60-70%', prioridad: 'alta', costo: 'S/ 200-400/ha (riego)' },
      { accion: 'Primera escarda mecánica a los 30 días', prioridad: 'media', costo: 'S/ 300-500/ha' },
      { accion: 'Controlar malezas con glifosato entre surcos', prioridad: 'media', costo: 'S/ 100-150/ha' },
      { accion: 'Evaluar porcentaje de germinación (>70% es aceptable)', prioridad: 'baja', costo: 'Incluido' },
    ],
    alertas: ['Sequía en germinación = pérdida de 40% de plantas', 'Exceso de humedad causa pudrición de yemas'],
    inversion: 'S/ 600-1,050/ha',
    tiempoEstimado: '45 días',
  },
  crecimiento: {
    nombre: 'Crecimiento vegetativo',
    dias: '60-180 días',
    acciones: [
      { accion: 'Segunda escarda + aporque a los 60 días', prioridad: 'alta', costo: 'S/ 400-600/ha' },
      { accion: 'Fertilizar con urea: 200 kg/ha a los 45 y 90 días', prioridad: 'alta', costo: 'S/ 350-400/ha' },
      { accion: 'Riego por surco cada 7-10 días (30-40mm/semana)', prioridad: 'alta', costo: 'S/ 300-500/ha/mes' },
      { accion: 'Aplicar regulador de crecimiento si tallo es muy largo', prioridad: 'baja', costo: 'S/ 200-300/ha' },
    ],
    alertas: ['Gusano taladrador (Diatraea) perfora tallos', 'Roya de la caña (Puccinia) en clima húmedo', 'Mosca blanca transmite virus del mosaico'],
    inversion: 'S/ 1,250-1,800/ha',
    tiempoEstimado: '120 días',
  },
  maduracion: {
    nombre: 'Maduración',
    dias: '180-300 días',
    acciones: [
      { accion: 'Reducir riego 2-3 meses antes de cosecha (estrés hídrico)', prioridad: 'alta', costo: 'S/ 0 (ahorro)' },
      { accion: 'NO aplicar nitrógeno (reduce contenido de azúcar)', prioridad: 'alta', costo: 'S/ 0' },
      { accion: 'Aplicar ethefon para maduración acelerada si necesario', prioridad: 'media', costo: 'S/ 250-400/ha' },
      { accion: 'Monitorear brix y sacarosa cada 15 días', prioridad: 'media', costo: 'S/ 100-200/ha' },
    ],
    alertas: ['Riego excesivo diluye azúcar', 'Aplicar quemada controlada si hay plagas (solo donde sea legal)'],
    inversion: 'S/ 350-600/ha',
    tiempoEstimado: '120 días',
  },
  cosecha: {
    nombre: 'Cosecha y zafra',
    dias: '300-365 días',
    acciones: [
      { accion: 'Cosechar a los 12-18 meses según variedad', prioridad: 'alta', costo: 'S/ 2,500-4,000/ha (mecanizada)' },
      { accion: 'Cortar a nivel del suelo (sin raíz)', prioridad: 'alta', costo: 'Incluido' },
      { accion: 'Transportar al trapiche en <24 horas (pierde sacarosa)', prioridad: 'alta', costo: 'S/ 500-800/ha' },
      { accion: 'Producción esperada: 80-200 ton/ha/año según variedad', prioridad: 'info', costo: 'Ingreso: S/ 12,000-30,000/ha' },
    ],
    alertas: ['Caña quemada pierde 20% de peso', 'No cosechar con escarcha (congela savia)', 'Cada hora sin procesar pierde 0.05% de sacarosa'],
    inversion: 'S/ 3,000-4,800/ha',
    tiempoEstimado: '30-60 días',
  },
};

const VARIEDADES = {
  'H32-8560': { rendimiento: '120-180 ton/ha', sacarosa: '14-16%', ciclo: '12-16 meses', tolerancia: 'Salinidad moderada' },
  'RB72-454': { rendimiento: '130-200 ton/ha', sacarosa: '13-15%', ciclo: '14-16 meses', tolerancia: 'Plagas comunes' },
  'H57-5174': { rendimiento: '100-160 ton/ha', sacarosa: '13-14%', ciclo: '12-15 meses', tolerancia: 'Alta salinidad' },
  'NA56': { rendimiento: '80-120 ton/ha', sacarosa: '12-14%', ciclo: '12-14 meses', tolerancia: 'Sequía' },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  const url = new URL(req.url, 'http://localhost');
  const etapa = url.searchParams.get('etapa') || 'crecimiento';
  const variedad = url.searchParams.get('variedad') || 'H32-8560';
  const dias = parseInt(url.searchParams.get('dias') || '0');

  const etapaData = ETAPAS_CANA[etapa];
  if (!etapaData) {
    return res.status(400).json({ error: 'Etapa no válida', etapas_disponibles: Object.keys(ETAPAS_CANA) });
  }

  const variedadData = VARIEDADES[variedad] || VARIEDADES['H32-8560'];

  return res.status(200).json({
    success: true,
    cultivo: 'Caña de azúcar',
    variedad,
    etapa: etapaData,
    info_variedad: variedadData,
    resumen_inversion: etapaData.inversion,
    proximas_acciones: etapaData.acciones.filter(a => a.prioridad === 'alta'),
    alertas_activas: etapaData.alertas,
    generated_at: new Date().toISOString(),
  });
}
