/**
 * Utilidades compartidas para índices de vegetación (NDVI, MSAVI2, NDRE).
 * MSAVI2 → siembra/emergencia | NDVI → crecimiento | NDRE → maduración/nitrógeno
 */

export const INDICES_INFO = {
  msavi2: {
    id: 'msavi2',
    nombre: 'MSAVI2',
    titulo: 'Índice de vegetación modificado',
    etapa: 'Siembra y emergencia',
    descripcion: 'Mejor con poca cobertura vegetal y suelo visible. Ideal para caña y maíz al inicio.',
    color: '#3B82F6',
  },
  ndvi: {
    id: 'ndvi',
    nombre: 'NDVI',
    titulo: 'Índice de vegetación normalizado',
    etapa: 'Crecimiento activo',
    descripcion: 'Mide biomasa y vigor en el pico vegetativo del cultivo.',
    color: '#22C55E',
  },
  ndre: {
    id: 'ndre',
    nombre: 'NDRE',
    titulo: 'Índice de borde rojo',
    etapa: 'Maduración / nitrógeno',
    descripcion: 'Detecta estrés de clorofila y nitrógeno antes de cosecha. Clave en caña y maíz.',
    color: '#A855F7',
  },
};

export function getNivelIndice(valor, tipo = 'ndvi') {
  if (valor == null) return { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Sin datos' };
  const umbrales = {
    msavi2: [0.55, 0.4, 0.25, 0.1],
    ndvi: [0.7, 0.5, 0.3, 0.1],
    ndre: [0.6, 0.45, 0.3, 0.12],
  };
  const [a, b, c, d] = umbrales[tipo] || umbrales.ndvi;
  if (valor >= a) return { bg: 'bg-green-100', text: 'text-green-700', label: 'Excelente' };
  if (valor >= b) return { bg: 'bg-lime-100', text: 'text-lime-700', label: 'Buena' };
  if (valor >= c) return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Regular' };
  if (valor >= d) return { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Baja' };
  return { bg: 'bg-red-100', text: 'text-red-700', label: 'Crítica' };
}

export function esCultivoMaizOCana(cultivo = '') {
  const c = cultivo.toLowerCase();
  return c.includes('maíz') || c.includes('maiz') || c.includes('caña') || c.includes('cana') || c === 'maiz' || c === 'cana';
}

export function recomendarIndice(cultivo = '', mes = new Date().getMonth() + 1, ndvi = 0.4) {
  if (!esCultivoMaizOCana(cultivo)) {
    return { id: 'ndvi', ...INDICES_INFO.ndvi, nota: 'NDVI es el índice principal para este cultivo.' };
  }
  // Costa Perú: siembra maíz Sep-Dic; caña todo el año
  if ((mes >= 9 && mes <= 12) || ndvi < 0.35) {
    return { id: 'msavi2', ...INDICES_INFO.msavi2, nota: 'Recomendado ahora: etapa temprana en costa.' };
  }
  if ((mes >= 1 && mes <= 5) || ndvi >= 0.5) {
    return { id: 'ndre', ...INDICES_INFO.ndre, nota: 'Recomendado ahora: monitorear nitrógeno y maduración.' };
  }
  return { id: 'ndvi', ...INDICES_INFO.ndvi, nota: 'Recomendado ahora: pico de crecimiento vegetativo.' };
}
