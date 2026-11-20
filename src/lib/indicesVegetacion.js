/**
 * Índices de vegetación — lógica según Carlos Pérez (Agrilux):
 * MSAVI2 → poco cultivo / agoste-cosecha
 * NDVI + NDRE → pleno crecimiento
 * Mapa de calor → detectar zonas no uniformes (estilo NAX)
 */

export const INDICES_INFO = {
  msavi2: {
    id: 'msavi2',
    nombre: 'MSAVI2',
    titulo: 'Índice de vegetación modificado',
    etapa: 'Poco cultivo · Agoste y cosecha',
    descripcion: 'Ideal con suelo visible, siembra, emergencia y etapa de agoste. Detecta manchas de estrés.',
    color: '#3B82F6',
  },
  ndvi: {
    id: 'ndvi',
    nombre: 'NDVI',
    titulo: 'Índice de vegetación normalizado',
    etapa: 'Pleno crecimiento',
    descripcion: 'Mide biomasa y vigor en el pico vegetativo. Junto con NDRE en pleno crecimiento.',
    color: '#22C55E',
  },
  ndre: {
    id: 'ndre',
    nombre: 'NDRE',
    titulo: 'NDRE / NDRED (borde rojo)',
    etapa: 'Pleno crecimiento',
    descripcion: 'Clorofila y nitrógeno en pleno crecimiento. Complementa al NDVI en caña y maíz.',
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

/** Etapa e índices recomendados según Carlos Pérez */
export function determinarEtapaCarlos(cultivo = '', diasDesdeSiembra = 0) {
  const dias = Number(diasDesdeSiembra) || 0;
  const esMaizOCana = esCultivoMaizOCana(cultivo);

  if (!esMaizOCana) {
    return {
      etapa: 'crecimiento',
      etapa_cultivo: 'crecimiento',
      indice_recomendado: 'ndvi',
      indices_recomendados: ['ndvi'],
      nota_etapa: 'NDVI es el índice principal para este cultivo.',
    };
  }

  // Caña: ciclos más largos; maíz: ~120-150 días
  const umbralTemprano = cultivo.toLowerCase().includes('cana') ? 60 : 45;
  const umbralCosecha = cultivo.toLowerCase().includes('cana') ? 300 : 130;

  if (dias < umbralTemprano) {
    return {
      etapa: 'poco_cultivo',
      etapa_cultivo: 'siembra_emergencia',
      indice_recomendado: 'msavi2',
      indices_recomendados: ['msavi2'],
      nota_etapa: 'Poco cultivo: usa MSAVI2. Ideal para detectar emergencia irregular.',
    };
  }
  if (dias < umbralCosecha) {
    return {
      etapa: 'pleno_crecimiento',
      etapa_cultivo: 'crecimiento',
      indice_recomendado: 'ndvi',
      indices_recomendados: ['ndvi', 'ndre'],
      nota_etapa: 'Pleno crecimiento: usa NDVI y NDRE (NDRED). Revisa mapa de calor para manchas.',
    };
  }
  return {
    etapa: 'agoste_cosecha',
    etapa_cultivo: 'maduracion',
    indice_recomendado: 'msavi2',
    indices_recomendados: ['msavi2'],
    nota_etapa: 'Agoste y cosecha: vuelve a MSAVI2. Las manchas rojas indican zonas con problemas.',
  };
}

export function valorAHeatmapColor(valor) {
  if (valor >= 0.55) return '#22C55E';
  if (valor >= 0.4) return '#84CC16';
  if (valor >= 0.28) return '#EAB308';
  if (valor >= 0.15) return '#F97316';
  return '#EF4444';
}

export function recomendarIndice(cultivo = '', mes = new Date().getMonth() + 1, ndvi = 0.4, dias = 0) {
  const etapa = determinarEtapaCarlos(cultivo, dias);
  const info = INDICES_INFO[etapa.indice_recomendado];
  return { id: etapa.indice_recomendado, ...info, nota: etapa.nota_etapa };
}
