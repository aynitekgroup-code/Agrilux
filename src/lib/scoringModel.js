import { CULTIVOS } from './constants.js';

export const REGLAS_PLAGAS = {
  papa: {
    tizon_tardio: {
      nombre: 'Tizón Tardío',
      nombreCientifico: 'Phytophthora infestans',
      cultivos: ['papa'],
      icono: '🥔',
      condiciones: {
        temp: { min: 10, max: 25, peso: 0.3 },
        humedad: { min: 90, max: 100, peso: 0.3 },
        lluvia: { min: 2, peso: 0.2 },
        viento: { max: 20, peso: 0.1 },
        diasDesdeSiembra: { min: 45, max: 120, peso: 0.1 }
      },
      etapasRiesgo: ['floracion', 'tuberizacion'],
      diasAnticipacion: 3,
      gravedadDefault: 'alta',
      recomendaciones: [
        'Aplicar fungicida preventivo a base de mancozeb',
        'Mejorar drenaje del cultivo',
        'Eliminar restos infectados',
        'Monitorear condiciones de humedad foliar'
      ]
    },
    tizon_temprano: {
      nombre: 'Tizón Temprano',
      nombreCientifico: 'Alternaria solani',
      cultivos: ['papa'],
      icono: '🥔',
      condiciones: {
        temp: { min: 20, max: 30, peso: 0.25 },
        humedad: { min: 70, max: 90, peso: 0.25 },
        lluvia: { min: 1, peso: 0.2 },
        viento: { min: 5, peso: 0.15 },
        diasDesdeSiembra: { min: 30, max: 90, peso: 0.15 }
      },
      etapasRiesgo: ['crecimiento', 'floracion'],
      diasAnticipacion: 2,
      gravedadDefault: 'moderada',
      recomendaciones: [
        'Rotar cultivos en temporada siguiente',
        'Aplicar fungicidas preventivos',
        'Mantener buena nutrición de la planta',
        'Evitar exceso de nitrógeno'
      ]
    },
    polilla_guatemalteca: {
      nombre: 'Polilla Guatemalteca',
      nombreCientifico: 'Tecia solanivora',
      cultivos: ['papa'],
      icono: '🥔',
      condiciones: {
        temp: { min: 15, max: 28, peso: 0.25 },
        humedad: { min: 60, max: 85, peso: 0.2 },
        lluvia: { min: 0, peso: 0.15 },
        viento: { max: 15, peso: 0.1 },
        diasDesdeSiembra: { min: 20, max: 100, peso: 0.3 }
      },
      etapasRiesgo: ['crecimiento', 'tuberizacion'],
      diasAnticipacion: 7,
      gravedadDefault: 'alta',
      recomendaciones: [
        'Colocar trampas de feromonas',
        'Aplicar insecticida biológico (Bt)',
        'Cubrir tubérculos con tierra frecuentemente',
        'Monitorear presencia de larvas'
      ]
    },
    gusano_blanco: {
      nombre: 'Gusano Blanco',
      nombreCientifico: 'Phyllophaga spp.',
      cultivos: ['papa'],
      icono: '🥔',
      condiciones: {
        temp: { min: 12, max: 25, peso: 0.25 },
        humedad: { min: 60, peso: 0.25 },
        lluvia: { min: 3, peso: 0.2 },
        viento: { peso: 0.05 },
        diasDesdeSiembra: { min: 0, max: 60, peso: 0.25 }
      },
      etapasRiesgo: ['siembra', 'crecimiento'],
      diasAnticipacion: 5,
      gravedadDefault: 'moderada',
      recomendaciones: [
        'Aplicar control biológico (Bactigus)',
        'Realizar labranza profunda antes de siembra',
        'Monitorear con trampas de luz',
        'Evitar terrenos con historial de infestación'
      ]
    },
    rizoctonia: {
      nombre: 'Rizoctonia (Rosca Parda)',
      nombreCientifico: 'Rhizoctonia solani',
      cultivos: ['papa'],
      icono: '🥔',
      condiciones: {
        temp: { min: 15, max: 25, peso: 0.25 },
        humedad: { min: 70, max: 95, peso: 0.3 },
        lluvia: { min: 2, peso: 0.2 },
        viento: { peso: 0.05 },
        diasDesdeSiembra: { min: 10, max: 70, peso: 0.2 }
      },
      etapasRiesgo: ['siembra', 'crecimiento', 'tuberizacion'],
      diasAnticipacion: 4,
      gravedadDefault: 'moderada',
      recomendaciones: [
        'Usar semilla certificada libre de enfermedad',
        'Tratar semilla con fungicida antes de siembra',
        'Evitar exceso de humedad en suelo',
        'Mejorar drenaje del terreno'
      ]
    }
  },

  maiz: {
    gusano_cogollero: {
      nombre: 'Gusano Cogollero',
      nombreCientifico: 'Spodoptera frugiperda',
      cultivos: ['maiz'],
      icono: '🌽',
      condiciones: {
        temp: { min: 20, max: 35, peso: 0.3 },
        humedad: { min: 50, peso: 0.2 },
        lluvia: { min: 1, peso: 0.15 },
        viento: { max: 25, peso: 0.1 },
        diasDesdeSiembra: { min: 20, max: 70, peso: 0.25 }
      },
      etapasRiesgo: ['crecimiento', 'floracion'],
      diasAnticipacion: 5,
      gravedadDefault: 'alta',
      recomendaciones: [
        'Aplicar Bt (Bacillus thuringiensis) al aparecimiento',
        'Colocar trampas con feromonas',
        'Monitorear presencia de huevos y larvas',
        'Aplicar insecticida cuando sobrepase umbral'
      ]
    },
    polilla_mais: {
      nombre: 'Polilla del Maíz',
      nombreCientifico: 'Helicoverpa zea',
      cultivos: ['maiz'],
      icono: '🌽',
      condiciones: {
        temp: { min: 18, max: 32, peso: 0.25 },
        humedad: { min: 55, peso: 0.2 },
        lluvia: { min: 1, peso: 0.15 },
        viento: { max: 20, peso: 0.1 },
        diasDesdeSiembra: { min: 40, max: 90, peso: 0.3 }
      },
      etapasRiesgo: ['floracion', 'cosecha'],
      diasAnticipacion: 4,
      gravedadDefault: 'moderada',
      recomendaciones: [
        'Instalar trampas de luz',
        'Aplicar control biológico (Trichogramma)',
        'Monitorear mariposas nocturnas',
        'Aplicar insecticida en horas de la tarde'
      ]
    },
    tizon_stewart: {
      nombre: 'Tizón de Stewart',
      nombreCientifico: 'Pantoea stewartii',
      cultivos: ['maiz'],
      icono: '🌽',
      condiciones: {
        temp: { min: 15, max: 30, peso: 0.2 },
        humedad: { min: 70, peso: 0.25 },
        lluvia: { min: 2, peso: 0.2 },
        viento: { peso: 0.05 },
        diasDesdeSiembra: { min: 25, max: 80, peso: 0.3 }
      },
      etapasRiesgo: ['crecimiento', 'floracion'],
      diasAnticipacion: 3,
      gravedadDefault: 'moderada',
      recomendaciones: [
        'Controlar vectores (chicharritas)',
        'Usar variedades resistentes',
        'Eliminar residuos de cultivos anteriores',
        'Monitorear presencia de insectos vectores'
      ]
    }
  },

  palta: {
    antracnosis_palta: {
      nombre: 'Antracnosis',
      nombreCientifico: 'Colletotrichum gloeosporioides',
      cultivos: ['palta'],
      icono: '🥑',
      condiciones: {
        temp: { min: 20, max: 30, peso: 0.25 },
        humedad: { min: 75, peso: 0.3 },
        lluvia: { min: 3, peso: 0.25 },
        viento: { peso: 0.05 },
        diasDesdeSiembra: { min: 60, max: 365, peso: 0.15 }
      },
      etapasRiesgo: ['floracion', 'fructificacion'],
      diasAnticipacion: 5,
      gravedadDefault: 'alta',
      recomendaciones: [
        'Aplicar fungicida preventivo en floración',
        'Podar para mejorar circulación de aire',
        'Evitar heridas en frutos',
        'Cosechar en estado óptimo de madurez'
      ]
    },
    phytophthora_palta: {
      nombre: 'Phytophthora (Tizón)',
      nombreCientifico: 'Phytophthora cinnamomi',
      cultivos: ['palta'],
      icono: '🥑',
      condiciones: {
        temp: { min: 18, max: 28, peso: 0.2 },
        humedad: { min: 80, peso: 0.3 },
        lluvia: { min: 5, peso: 0.3 },
        viento: { peso: 0.05 },
        diasDesdeSiembra: { min: 30, max: 365, peso: 0.15 }
      },
      etapasRiesgo: ['crecimiento', 'fructificacion'],
      diasAnticipacion: 7,
      gravedadDefault: 'critica',
      recomendaciones: [
        'Mejorar drenaje del terreno',
        'Aplicar fosfitos de potasio',
        'Evitar encharcamientos',
        'Desinfectar herramientas de poda'
      ]
    },
    gusano_brote: {
      nombre: 'Gusano del Brote',
      nombreCientifico: 'Stenoma catenifer',
      cultivos: ['palta'],
      icono: '🥑',
      condiciones: {
        temp: { min: 18, max: 32, peso: 0.25 },
        humedad: { min: 60, peso: 0.2 },
        lluvia: { min: 1, peso: 0.15 },
        viento: { max: 20, peso: 0.1 },
        diasDesdeSiembra: { min: 30, max: 200, peso: 0.3 }
      },
      etapasRiesgo: ['crecimiento', 'floracion'],
      diasAnticipacion: 7,
      gravedadDefault: 'alta',
      recomendaciones: [
        'Colocar trampas con feromonas',
        'Cortar brotes infestados y quemarlos',
        'Aplicar insecticida sistémico',
        'Monitorear semanalmente'
      ]
    }
  },

  arandano: {
    botrytis: {
      nombre: 'Botrytis (Moho Gris)',
      nombreCientifico: 'Botrytis cinerea',
      cultivos: ['arandano'],
      icono: '🫐',
      condiciones: {
        temp: { min: 12, max: 22, peso: 0.25 },
        humedad: { min: 85, peso: 0.35 },
        lluvia: { min: 2, peso: 0.2 },
        viento: { max: 10, peso: 0.1 },
        diasDesdeSiembra: { min: 90, max: 300, peso: 0.1 }
      },
      etapasRiesgo: ['floracion', 'fructificacion', 'cosecha'],
      diasAnticipacion: 3,
      gravedadDefault: 'alta',
      recomendaciones: [
        'Mejorar ventilación con poda',
        'Reducir riego por encima del follaje',
        'Aplicar fungicida preventivo en floración',
        'Retirar frutos y flores infectadas'
      ]
    },
    antracnosis_arandano: {
      nombre: 'Antracnosis',
      nombreCientifico: 'Colletotrichum acutatum',
      cultivos: ['arandano'],
      icono: '🫐',
      condiciones: {
        temp: { min: 15, max: 28, peso: 0.25 },
        humedad: { min: 80, peso: 0.3 },
        lluvia: { min: 3, peso: 0.25 },
        viento: { peso: 0.05 },
        diasDesdeSiembra: { min: 60, max: 250, peso: 0.15 }
      },
      etapasRiesgo: ['floracion', 'fructificacion'],
      diasAnticipacion: 5,
      gravedadDefault: 'moderada',
      recomendaciones: [
        'Aplicar cobre preventivo en pre-floración',
        'Cosechar en el momento adecuado',
        'Evitar heridas en frutos',
        'Mantener cobertura vegetal'
      ]
    }
  },

  cana: {
    gusano_taladrador: {
      nombre: 'Gusano Taladrador',
      nombreCientifico: 'Diatraea saccharalis',
      cultivos: ['cana'],
      icono: '🌾',
      condiciones: {
        temp: { min: 20, max: 35, peso: 0.25 },
        humedad: { min: 60, peso: 0.2 },
        lluvia: { min: 2, peso: 0.15 },
        viento: { max: 25, peso: 0.1 },
        diasDesdeSiembra: { min: 30, max: 180, peso: 0.3 }
      },
      etapasRiesgo: ['crecimiento'],
      diasAnticipacion: 7,
      gravedadDefault: 'alta',
      recomendaciones: [
        'Liberar Trichogramma galloi',
        'Cortar tallos infestados y quemarlos',
        'Aplicar insecticida cuando sobrepase 10% tallos',
        'Monitorear con trampas de luz'
      ]
    },
    roya_cana: {
      nombre: 'Roya de la Caña',
      nombreCientifico: 'Puccinia melanocephala',
      cultivos: ['cana'],
      icono: '🌾',
      condiciones: {
        temp: { min: 18, max: 30, peso: 0.2 },
        humedad: { min: 80, peso: 0.3 },
        lluvia: { min: 3, peso: 0.25 },
        viento: { min: 5, peso: 0.15 },
        diasDesdeSiembra: { min: 60, max: 300, peso: 0.1 }
      },
      etapasRiesgo: ['crecimiento', 'cosecha'],
      diasAnticipacion: 5,
      gravedadDefault: 'moderada',
      recomendaciones: [
        'Usar variedades resistentes',
        'Aplicar fungicida azufre o triazoles',
        'Monitorear presencia de pústulas',
        'Evitar exceso de humedad foliar'
      ]
    },
    mosca_blanca: {
      nombre: 'Mosca Blanca',
      nombreCientifico: 'Saccharosydus sacchari',
      cultivos: ['cana'],
      icono: '🌾',
      condiciones: {
        temp: { min: 22, max: 35, peso: 0.25 },
        humedad: { min: 50, max: 80, peso: 0.2 },
        lluvia: { peso: 0.1 },
        viento: { max: 15, peso: 0.15 },
        diasDesdeSiembra: { min: 30, max: 250, peso: 0.3 }
      },
      etapasRiesgo: ['crecimiento'],
      diasAnticipacion: 5,
      gravedadDefault: 'moderada',
      recomendaciones: [
        'Instalar trampas amarillas pegajosas',
        'Aplicar jabón potásico',
        'Conservar enemigos naturales',
        'Evitar exceso de nitrógeno'
      ]
    }
  },

  platano: {
    sigatoka: {
      nombre: 'Sigatoka (Miedo)',
      nombreCientifico: 'Mycosphaerella fijiensis',
      cultivos: ['platano'],
      icono: '🍌',
      condiciones: {
        temp: { min: 20, max: 32, peso: 0.2 },
        humedad: { min: 75, peso: 0.35 },
        lluvia: { min: 3, peso: 0.25 },
        viento: { max: 15, peso: 0.1 },
        diasDesdeSiembra: { min: 30, max: 365, peso: 0.1 }
      },
      etapasRiesgo: ['crecimiento', 'floracion', 'fructificacion'],
      diasAnticipacion: 7,
      gravedadDefault: 'alta',
      recomendaciones: [
        'Aplicar fungicida sistémico cada 15 días',
        'Podar hojas secas y afectadas',
        'Mejorar drenaje',
        'Monitorear semanalmente las hojas'
      ]
    },
    picudo_platano: {
      nombre: 'Picudo del Plátano',
      nombreCientifico: 'Cosmopolites sordidus',
      cultivos: ['platano'],
      icono: '🍌',
      condiciones: {
        temp: { min: 20, max: 33, peso: 0.2 },
        humedad: { min: 55, peso: 0.2 },
        lluvia: { peso: 0.1 },
        viento: { peso: 0.05 },
        diasDesdeSiembra: { min: 15, max: 365, peso: 0.45 }
      },
      etapasRiesgo: ['crecimiento', 'floracion', 'fructificacion'],
      diasAnticipacion: 10,
      gravedadDefault: 'alta',
      recomendaciones: [
        'Colocar trampas con rizoma de plátano',
        'Aplicar insecticida al suelo alrededor del cormo',
        'Cortar pseudotallos infestados',
        'Inspeccionar material de propagación'
      ]
    }
  },

  papaya: {
    chancro_bacterial: {
      nombre: 'Chancro Bacteriano',
      nombreCientifico: 'Xanthomonas campestris pv. carotae',
      cultivos: ['papaya'],
      icono: '🍈',
      condiciones: {
        temp: { min: 25, max: 35, peso: 0.2 },
        humedad: { min: 70, peso: 0.25 },
        lluvia: { min: 2, peso: 0.25 },
        viento: { min: 5, peso: 0.15 },
        diasDesdeSiembra: { min: 60, max: 300, peso: 0.15 }
      },
      etapasRiesgo: ['crecimiento', 'fructificacion'],
      diasAnticipacion: 5,
      gravedadDefault: 'moderada',
      recomendaciones: [
        'Cortar y quemar frutos afectados',
        'Aplicar productos a base de cobre',
        'Evitar heridas en tronco y frutos',
        'Desinfectar herramientas de poda'
      ]
    },
    mosca_fruta: {
      nombre: 'Mosca de la Fruta',
      nombreCientifico: 'Anastrepha striata',
      cultivos: ['papaya'],
      icono: '🍈',
      condiciones: {
        temp: { min: 22, max: 35, peso: 0.25 },
        humedad: { min: 50, peso: 0.2 },
        lluvia: { peso: 0.1 },
        viento: { max: 20, peso: 0.1 },
        diasDesdeSiembra: { min: 90, max: 365, peso: 0.35 }
      },
      etapasRiesgo: ['fructificacion', 'cosecha'],
      diasAnticipacion: 7,
      gravedadDefault: 'alta',
      recomendaciones: [
        'Colocar trampas con atrayentes (ceraferina)',
        'Cosechar frutos en estado de corteza',
        'Colocar mosqueros en el cultivo',
        'Eliminar frutos caídos del suelo'
      ]
    }
  }
};

function evaluarFactorTemperatura(temp, condTemp) {
  if (!condTemp) return { puntos: 0, texto: '' };
  const { min, max, peso } = condTemp;

  if (temp >= min && temp <= max) {
    return {
      puntos: peso * 100,
      texto: 'Temperatura ' + temp.toFixed(1) + '°C dentro del rango ideal (' + min + '-' + max + '°C)'
    };
  }
  if (temp < min) {
    const margen = (min - temp) / min;
    if (margen <= 0.15) {
      const factor = 1 - margen / 0.15;
      return {
        puntos: peso * 100 * factor,
        texto: 'Temperatura ' + temp.toFixed(1) + '°C ligeramente bajo el rango (' + min + '-' + max + '°C)'
      };
    }
    return { puntos: 0, texto: '' };
  }
  if (temp > max) {
    const margen = (temp - max) / max;
    if (margen <= 0.15) {
      const factor = 1 - margen / 0.15;
      return {
        puntos: peso * 100 * factor,
        texto: 'Temperatura ' + temp.toFixed(1) + '°C ligeramente sobre el rango (' + min + '-' + max + '°C)'
      };
    }
    return { puntos: 0, texto: '' };
  }
  return { puntos: 0, texto: '' };
}

function evaluarFactorHumedad(humedad, condHumedad) {
  if (!condHumedad) return { puntos: 0, texto: '' };
  const { min, max, peso } = condHumedad;

  if (humedad >= min && (!max || humedad <= max)) {
    return {
      puntos: peso * 100,
      texto: 'Humedad ' + humedad.toFixed(1) + '% ' + (max ? 'dentro del rango (' + min + '-' + max + '%)' : 'superior a ' + min + '%')
    };
  }
  if (humedad < min) {
    const margen = (min - humedad) / min;
    if (margen <= 0.2) {
      const factor = 1 - margen / 0.2;
      return {
        puntos: peso * 100 * factor,
        texto: 'Humedad ' + humedad.toFixed(1) + '% ligeramente bajo el mínimo (' + min + '%)'
      };
    }
    return { puntos: 0, texto: '' };
  }
  if (max && humedad > max) {
    return { puntos: 0, texto: '' };
  }
  return { puntos: 0, texto: '' };
}

function evaluarFactorLluvia(lluvia, condLluvia) {
  if (!condLluvia) return { puntos: 0, texto: '' };
  const { min, peso } = condLluvia;

  if (lluvia >= min) {
    return {
      puntos: peso * 100,
      texto: 'Lluvia ' + lluvia.toFixed(1) + 'mm supera el umbral de ' + min + 'mm'
    };
  }
  if (min > 0) {
    const margen = (min - lluvia) / min;
    if (margen <= 0.3) {
      const factor = 1 - margen / 0.3;
      return {
        puntos: peso * 100 * factor,
        texto: 'Lluvia ' + lluvia.toFixed(1) + 'mm cercana al umbral de ' + min + 'mm'
      };
    }
  }
  return { puntos: 0, texto: '' };
}

function evaluarFactorViento(viento, condViento) {
  if (!condViento) return { puntos: 0, texto: '' };
  const { min, max, peso } = condViento;
  let puntos = 0;
  let textos = [];

  if (max !== undefined && viento <= max) {
    puntos += peso * 50;
    textos.push('Viento ' + viento.toFixed(1) + 'km/h bajo el límite de ' + max + 'km/h');
  } else if (max !== undefined && viento > max) {
    const margen = (viento - max) / max;
    if (margen <= 0.2) {
      puntos += peso * 50 * (1 - margen / 0.2);
      textos.push('Viento ' + viento.toFixed(1) + 'km/h ligeramente sobre el límite de ' + max + 'km/h');
    }
  }
  if (min !== undefined && viento >= min) {
    puntos += peso * 50;
    textos.push('Viento ' + viento.toFixed(1) + 'km/h supera el mínimo de ' + min + 'km/h');
  } else if (min !== undefined && viento < min) {
    const margen = (min - viento) / min;
    if (margen <= 0.2) {
      puntos += peso * 50 * (1 - margen / 0.2);
      textos.push('Viento ' + viento.toFixed(1) + 'km/h cercano al mínimo de ' + min + 'km/h');
    }
  }
  if (!min && !max) {
    return { puntos: 0, texto: '' };
  }
  return { puntos, texto: textos.join('. ') };
}

function evaluarFactorDias(diasDesdeSiembra, condDias) {
  if (!condDias) return { puntos: 0, texto: '' };
  const { min, max, peso } = condDias;

  if (diasDesdeSiembra >= min && diasDesdeSiembra <= max) {
    return {
      puntos: peso * 100,
      texto: 'Día ' + diasDesdeSiembra + ' dentro del rango de vulnerabilidad (' + min + '-' + max + ' días)'
    };
  }
  return { puntos: 0, texto: '' };
}

export function evaluarRiesgoPlaga(regla, clima, diasDesdeSiembra) {
  let totalPuntos = 0;
  const factores = [];

  const rTemp = evaluarFactorTemperatura(clima.temp, regla.condiciones.temp);
  totalPuntos += rTemp.puntos;
  if (rTemp.texto) factores.push(rTemp.texto);

  const rHumedad = evaluarFactorHumedad(clima.humedad, regla.condiciones.humedad);
  totalPuntos += rHumedad.puntos;
  if (rHumedad.texto) factores.push(rHumedad.texto);

  const rLluvia = evaluarFactorLluvia(clima.lluvia || 0, regla.condiciones.lluvia);
  totalPuntos += rLluvia.puntos;
  if (rLluvia.texto) factores.push(rLluvia.texto);

  const rViento = evaluarFactorViento(clima.viento || 0, regla.condiciones.viento);
  totalPuntos += rViento.puntos;
  if (rViento.texto) factores.push(rViento.texto);

  const rDias = evaluarFactorDias(diasDesdeSiembra, regla.condiciones.diasDesdeSiembra);
  totalPuntos += rDias.puntos;
  if (rDias.texto) factores.push(rDias.texto);

  const riesgo = Math.min(100, Math.max(0, Math.round(totalPuntos)));

  return { riesgo, factores };
}

export function getEtapaCultivo(cultivoId, diasDesdeSiembra) {
  const cultivo = CULTIVOS.find(c => c.id === cultivoId);
  if (!cultivo || !cultivo.ciclo) return 'desconocido';

  for (const etapa of cultivo.ciclo) {
    if (diasDesdeSiembra >= etapa.diasInicio && diasDesdeSiembra < etapa.diasFin) {
      return etapa.id;
    }
  }

  const ultimaEtapa = cultivo.ciclo[cultivo.ciclo.length - 1];
  if (diasDesdeSiembra >= ultimaEtapa.diasFin) {
    return ultimaEtapa.id;
  }

  return cultivo.ciclo[0].id;
}

function clasificarRiesgo(riesgo) {
  if (riesgo <= 10) return { nivel: 'minimo', color: 'green' };
  if (riesgo <= 30) return { nivel: 'bajo', color: 'yellow' };
  if (riesgo <= 50) return { nivel: 'moderado', color: 'orange' };
  if (riesgo <= 70) return { nivel: 'alto', color: 'red' };
  return { nivel: 'critico', color: 'red' };
}

function boostPorHistorial(riesgo, plagaKey, historialReciente) {
  if (!historialReciente || !Array.isArray(historialReciente)) return riesgo;
  const tieneProblema = historialReciente.some(function(h) {
    return h.plaga === plagaKey || h.plagaKey === plagaKey;
  });
  if (tieneProblema) {
    return Math.min(100, Math.round(riesgo * 1.15));
  }
  return riesgo;
}

function formatearFecha(diasOffset) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + diasOffset);
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return anio + '-' + mes + '-' + dia;
}

export function predecirPlagas(cultivoId, diasDesdeSiembra, pronostico16Dias, historialReciente) {
  const reglasCultivo = REGLAS_PLAGAS[cultivoId];
  if (!reglasCultivo || !pronostico16Dias || !Array.isArray(pronostico16Dias)) {
    return { timeline: [], resumen: null };
  }

  const etapaActual = getEtapaCultivo(cultivoId, diasDesdeSiembra);
  const timeline = [];

  for (let i = 0; i < pronostico16Dias.length; i++) {
    const clima = pronostico16Dias[i];
    const diasEnElDia = diasDesdeSiembra + i;
    const fecha = formatearFecha(i);

    const plagas = [];
    const entries = Object.entries(reglasCultivo);

    for (let j = 0; j < entries.length; j++) {
      const key = entries[j][0];
      const regla = entries[j][1];
      let resultado = evaluarRiesgoPlaga(regla, clima, diasEnElDia);

      resultado.riesgo = boostPorHistorial(resultado.riesgo, key, historialReciente);

      if (resultado.riesgo < 5) continue;

      const clasificacion = clasificarRiesgo(resultado.riesgo);

      const enEtapaRiesgo = regla.etapasRiesgo.includes(etapaActual);
      let gravedad = regla.gravedadDefault;
      if (enEtapaRiesgo) {
        resultado.riesgo = Math.min(100, Math.round(resultado.riesgo * 1.1));
      }
      if (enEtapaRiesgo && resultado.riesgo >= 50) {
        gravedad = 'critica';
      } else if (enEtapaRiesgo && resultado.riesgo >= 30) {
        gravedad = 'alta';
      }

      plagas.push({
        key: key,
        nombre: regla.nombre,
        icono: regla.icono,
        riesgo: resultado.riesgo,
        factores: resultado.factores,
        gravedad: gravedad,
        recomendaciones: regla.recomendaciones
      });
    }

    plagas.sort(function(a, b) { return b.riesgo - a.riesgo; });

    let riesgoGeneral = 0;
    if (plagas.length > 0) {
      let suma = 0;
      for (let k = 0; k < plagas.length; k++) {
        suma += plagas[k].riesgo;
      }
      riesgoGeneral = Math.min(100, Math.round(suma / plagas.length));
    }

    const clasificacionGeneral = clasificarRiesgo(riesgoGeneral);

    timeline.push({
      fecha: fecha,
      riesgoGeneral: riesgoGeneral,
      nivelRiesgo: clasificacionGeneral.nivel,
      color: clasificacionGeneral.color,
      plagas: plagas
    });
  }

  const todosLosRiesgos = [];
  for (let m = 0; m < timeline.length; m++) {
    if (timeline[m].riesgoGeneral > 0) {
      todosLosRiesgos.push(timeline[m].riesgoGeneral);
    }
  }
  let riesgoPromedio = 0;
  if (todosLosRiesgos.length > 0) {
    let sumaTotal = 0;
    for (let n = 0; n < todosLosRiesgos.length; n++) {
      sumaTotal += todosLosRiesgos[n];
    }
    riesgoPromedio = Math.round(sumaTotal / todosLosRiesgos.length);
  }

  const nivelGeneral = clasificarRiesgo(riesgoPromedio);

  let plagaPrincipal = null;
  let plagaPrincipalRiesgo = 0;
  for (let p = 0; p < timeline.length; p++) {
    for (let q = 0; q < timeline[p].plagas.length; q++) {
      if (timeline[p].plagas[q].riesgo > plagaPrincipalRiesgo) {
        plagaPrincipalRiesgo = timeline[p].plagas[q].riesgo;
        plagaPrincipal = timeline[p].plagas[q].nombre;
      }
    }
  }

  let diasCriticos = 0;
  for (let r = 0; r < timeline.length; r++) {
    if (timeline[r].riesgoGeneral >= 50) diasCriticos++;
  }

  const todasLasRecomendaciones = new Set();
  for (let s = 0; s < timeline.length; s++) {
    for (let t = 0; t < timeline[s].plagas.length; t++) {
      if (timeline[s].plagas[t].riesgo >= 30) {
        const recs = timeline[s].plagas[t].recomendaciones;
        for (let u = 0; u < recs.length; u++) {
          todasLasRecomendaciones.add(recs[u]);
        }
      }
    }
  }

  const recomendacionesPrincipales = Array.from(todasLasRecomendaciones).slice(0, 5);

  const resumen = {
    riesgoPromedio: riesgoPromedio,
    nivelGeneral: nivelGeneral.nivel,
    plagaPrincipal: plagaPrincipal || 'Ninguna',
    plagaPrincipalRiesgo: plagaPrincipalRiesgo,
    diasCriticos: diasCriticos,
    recomendacionesPrincipales: recomendacionesPrincipales
  };

  return { timeline: timeline, resumen: resumen };
}
