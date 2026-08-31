import { supabase } from './supabase';

/**
 * Sistema de Aprendizaje Agrilux (Supabase)
 * Maneja historial clínico, feedback y patrones por parcela/zona
 */

// ═══════════════════════════════════════════════════════════════
// 1. HISTORIAL CLÍNICO POR PARCELA
// ═══════════════════════════════════════════════════════════════

/**
 * Guardar un diagnóstico en el historial clínico
 */
export async function guardarHistorialClinico({
  userId,
  parcelaId,
  parcelaNombre,
  cultivo,
  variedad,
  diagnostico,
  productoAplicado = null,
  fotoUrl = null,
  lat = null,
  lon = null
}) {
  try {
    const payload = {
      userId,
      parcelaId,
      parcelaNombre: parcelaNombre || '',
      cultivo,
      variedad: variedad || '',
      tieneProblema: diagnostico.tiene_problema,
      problema: diagnostico.nombre_problema || '',
      problemaCientifico: diagnostico.nombre_cientifico || '',
      gravedad: diagnostico.gravedad || 'desconocida',
      severidad: diagnostico.porcentaje_severidad || 0,
      causa: diagnostico.causa || '',
      recomendacion: diagnostico.que_hacer || '',
      productoAplicado,
      fechaAplicacion: null,
      resultado: null,
      fechaResultado: null,
      observacionesResultado: null,
      calificacion: null,
      util: null,
      comentarioFeedback: null,
      clima: null,
      suelo: null,
      fuente: 'diagnostico',
      fotoUrl,
      lat,
      lon,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const { data, error } = await supabase.from('historial_clinico').insert(payload).select().single();
    if (error) throw error;
    console.log('[Historial] Guardado:', data.id);
    return data.id;
  } catch (error) {
    console.error('[Historial] Error al guardar:', error);
    throw error;
  }
}

/**
 * Actualizar feedback del usuario sobre un diagnóstico
 */
export async function calificarDiagnostico(historialId, calificacion, util, comentario = '') {
  try {
    const { error } = await supabase.from('historial_clinico').update({
      calificacion,
      util,
      comentarioFeedback: comentario,
      updatedAt: new Date().toISOString()
    }).eq('id', historialId);
    if (error) throw error;
    console.log('[Historial] Feedback guardado:', historialId);
    return true;
  } catch (error) {
    console.error('[Historial] Error al actualizar feedback:', error);
    throw error;
  }
}

/**
 * Actualizar resultado después de aplicar tratamiento
 */
export async function actualizarResultado(historialId, resultado, observaciones = '') {
  try {
    const { error } = await supabase.from('historial_clinico').update({
      resultado,
      fechaResultado: new Date().toISOString(),
      observacionesResultado: observaciones,
      updatedAt: new Date().toISOString()
    }).eq('id', historialId);
    if (error) throw error;
    console.log('[Historial] Resultado actualizado:', historialId);
    return true;
  } catch (error) {
    console.error('[Historial] Error al actualizar resultado:', error);
    throw error;
  }
}

/**
 * Registrar producto aplicado
 */
export async function registrarProductoAplicado(historialId, producto) {
  try {
    const { error } = await supabase.from('historial_clinico').update({
      productoAplicado: producto,
      fechaAplicacion: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).eq('id', historialId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[Historial] Error al registrar producto:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// 2. CONSULTAR HISTORIAL
// ═══════════════════════════════════════════════════════════════

/**
 * Obtener historial clínico de una parcela
 */
export async function getHistorialParcela(parcelaId, limite = 20) {
  try {
    const { data, error } = await supabase.from('historial_clinico').select('*').eq('parcelaId', parcelaId).order('createdAt', { ascending: false }).limit(limite);
    if (error) throw error;
    return (data || []).map(d => ({
      id: d.id,
      ...d,
      createdAt: d.createdAt ? new Date(d.createdAt) : null,
      fechaAplicacion: d.fechaAplicacion ? new Date(d.fechaAplicacion) : null,
      fechaResultado: d.fechaResultado ? new Date(d.fechaResultado) : null
    }));
  } catch (error) {
    console.error('[Historial] Error al consultar:', error);
    return [];
  }
}

/**
 * Obtener resumen de problemas de una parcela
 */
export async function getResumenProblemas(parcelaId) {
  const historial = await getHistorialParcela(parcelaId, 50);
  
  if (historial.length === 0) {
    return {
      totalDiagnosticos: 0,
      problemasFrecuentes: [],
      ultimoDiagnostico: null,
      tendencia: 'sin_datos',
      problemasActivos: []
    };
  }
  
  const conteoProblemas = {};
  historial.forEach(d => {
    if (d.tieneProblema && d.problema) {
      const key = d.problema.toLowerCase();
      conteoProblemas[key] = (conteoProblemas[key] || 0) + 1;
    }
  });
  
  const problemasFrecuentes = Object.entries(conteoProblemas)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([problema, veces]) => ({ problema, veces }));
  
  const ultimoDiagnostico = historial[0];
  
  const diagnosticosConProblema = historial.filter(d => d.tieneProblema);
  const recientes = diagnosticosConProblema.slice(0, 3);
  const anteriores = diagnosticosConProblema.slice(3, 6);
  
  let tendencia = 'estable';
  if (recientes.length > 0 && anteriores.length > 0) {
    const severidadReciente = recientes.reduce((sum, d) => sum + (d.severidad || 0), 0) / recientes.length;
    const severidadAnterior = anteriores.reduce((sum, d) => sum + (d.severidad || 0), 0) / anteriores.length;
    
    if (severidadReciente > severidadAnterior + 10) {
      tendencia = 'empeorando';
    } else if (severidadReciente < severidadAnterior - 10) {
      tendencia = 'mejorando';
    }
  }
  
  const problemasActivos = historial.filter(d => 
    d.tieneProblema && 
    d.resultado !== 'resuelto' &&
    d.resultado !== 'mejoro'
  ).slice(0, 5);
  
  return {
    totalDiagnosticos: historial.length,
    problemasFrecuentes,
    ultimoDiagnostico,
    tendencia,
    problemasActivos,
    historialReciente: historial.slice(0, 10)
  };
}

/**
 * Obtener contexto para el LLM antes de diagnosticar
 */
export async function getContextoHistorial(parcelaId, cultivo) {
  const resumen = await getResumenProblemas(parcelaId);
  
  if (resumen.totalDiagnosticos === 0) {
    return null;
  }
  
  let contexto = `\n\n📋 HISTORIAL DE LA PARCELA (${resumen.totalDiagnosticos} diagnósticos anteriores):\n`;
  
  if (resumen.ultimoDiagnostico) {
    const ultimo = resumen.ultimoDiagnostico;
    const fecha = ultimo.createdAt ? ultimo.createdAt.toLocaleDateString('es-PE') : 'desconocida';
    contexto += `\n• Último diagnóstico (${fecha}): ${ultimo.problema || 'sin problema'} - ${ultimo.gravedad}`;
    
    if (ultimo.productoAplicado) {
      contexto += `\n  Producto aplicado: ${ultimo.productoAplicado}`;
    }
    
    if (ultimo.resultado) {
      contexto += `\n  Resultado: ${ultimo.resultado}`;
    }
  }
  
  if (resumen.problemasFrecuentes.length > 0) {
    contexto += `\n\n• Problemas más frecuentes en esta parcela:`;
    resumen.problemasFrecuentes.forEach(p => {
      contexto += `\n  - ${p.problema} (${p.veces} veces)`;
    });
  }
  
  if (resumen.tendencia === 'empeorando') {
    contexto += `\n\n⚠️ ALERTA: El cultivo está EMPEORANDO según los últimos diagnósticos.`;
  } else if (resumen.tendencia === 'mejorando') {
    contexto += `\n\n✅ El cultivo está MEJORANDO según los últimos diagnósticos.`;
  }
  
  if (resumen.problemasActivos.length > 0) {
    contexto += `\n\n• Problemas ACTIVOS sin resolver:`;
    resumen.problemasActivos.forEach(p => {
      contexto += `\n  - ${p.problema} (${p.gravedad})`;
    });
  }
  
  return contexto;
}

// ═══════════════════════════════════════════════════════════════
// 3. PATRONES POR ZONA
// ═══════════════════════════════════════════════════════════════

export async function analizarPatronesZona(region, cultivo = null) {
  try {
    let data = [];
    if (cultivo) {
      const { data: rows, error } = await supabase.from('historial_clinico').select('*').eq('cultivo', cultivo).order('createdAt', { ascending: false }).limit(200);
      if (error) throw error;
      data = rows || [];
    } else {
      const { data: rows, error } = await supabase.from('historial_clinico').select('*').order('createdAt', { ascending: false }).limit(100);
      if (error) throw error;
      const lower = (region || '').toLowerCase();
      data = (rows || []).filter(d => (d.parcelaNombre || '').toLowerCase().includes(lower));
    }
    
    if (data.length === 0) return null;
    
    const problemasPorMes = {};
    const problemasPorCultivo = {};
    const severidadPromedio = {};
    
    data.forEach(d => {
      if (!d.tieneProblema || !d.problema) return;
      const mes = d.createdAt ? new Date(d.createdAt).getMonth() : 0;
      const problema = d.problema.toLowerCase();
      if (!problemasPorMes[mes]) problemasPorMes[mes] = {};
      problemasPorMes[mes][problema] = (problemasPorMes[mes][problema] || 0) + 1;
      if (!problemasPorCultivo[d.cultivo]) problemasPorCultivo[d.cultivo] = {};
      problemasPorCultivo[d.cultivo][problema] = (problemasPorCultivo[d.cultivo][problema] || 0) + 1;
      if (!severidadPromedio[problema]) severidadPromedio[problema] = { total: 0, count: 0 };
      severidadPromedio[problema].total += d.severidad || 0;
      severidadPromedio[problema].count += 1;
    });
    
    const severidad = {};
    Object.entries(severidadPromedio).forEach(([problema, d]) => {
      severidad[problema] = Math.round(d.total / d.count);
    });
    
    return {
      region,
      cultivo,
      totalDiagnosticos: data.length,
      problemasPorMes,
      problemasPorCultivo,
      severidadPromedio: severidad,
      fechaAnalisis: new Date()
    };
    
  } catch (error) {
    console.error('[Patrones] Error al analizar:', error);
    return null;
  }
}

export async function getAlertasTempranas(parcelaId, cultivo, region) {
  const resumen = await getResumenProblemas(parcelaId);
  const patrones = await analizarPatronesZona(region, cultivo);
  
  const alertas = [];
  
  if (resumen.tendencia === 'empeorando') {
    alertas.push({
      tipo: 'tendencia',
      severidad: 'alta',
      mensaje: 'El cultivo está empeorando. Considere consultar un agrónomo.',
      accion: 'Revisar historial y considerar cambio de tratamiento'
    });
  }
  
  if (resumen.problemasFrecuentes.length > 0) {
    const masFrecuente = resumen.problemasFrecuentes[0];
    if (masFrecuente.veces >= 3) {
      alertas.push({
        tipo: 'recurrencia',
        severidad: 'media',
        mensaje: `${masFrecuente.problema} ha aparecido ${masFrecuente.veces} veces. Posible problema crónico.`,
        accion: 'Evaluar causas raíz y considerar manejo integrado'
      });
    }
  }
  
  if (patrones && patrones.problemasPorMes) {
    const mesActual = new Date().getMonth();
    const problemasMes = patrones.problemasPorMes[mesActual];
    
    if (problemasMes) {
      const topProblema = Object.entries(problemasMes).sort(([,a], [,b]) => b - a)[0];
      if (topProblema && topProblema[1] >= 5) {
        alertas.push({
          tipo: 'zona',
          severidad: 'media',
          mensaje: `En ${region}, ${topProblema[0]} es común este mes (${topProblema[1]} casos).`,
          accion: 'Monitorear Preventivamente'
        });
      }
    }
  }
  
  return alertas;
}

// ═══════════════════════════════════════════════════════════════
// 4. MEMORIA DEL ASISTENTE DE VOZ
// ═══════════════════════════════════════════════════════════════

export async function guardarConversacion(userId, mensajes) {
  try {
    const { error } = await supabase.from('conversaciones_voz').insert({
      userId,
      mensajes: mensajes.slice(-20),
      createdAt: new Date().toISOString()
    });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[Conversación] Error al guardar:', error);
    return false;
  }
}

export async function getHistorialConversaciones(userId, limite = 5) {
  try {
    const { data, error } = await supabase.from('conversaciones_voz').select('*').eq('userId', userId).order('createdAt', { ascending: false }).limit(limite);
    if (error) throw error;
    return (data || []).map(d => ({
      id: d.id,
      ...d,
      createdAt: d.createdAt ? new Date(d.createdAt) : null
    }));
  } catch (error) {
    console.error('[Conversación] Error al consultar:', error);
    return [];
  }
}

export async function getContextoConversacional(userId) {
  const historial = await getHistorialConversaciones(userId, 3);
  
  if (historial.length === 0) return '';
  
  let contexto = '\n\n💬 CONVERSACIONES RECIENTES DEL USUARIO:\n';
  
  historial.forEach((conv, i) => {
    contexto += `\nConversación ${i + 1} (${conv.createdAt?.toLocaleDateString('es-PE')}):`;
    (conv.mensajes || []).slice(-6).forEach(m => {
      const rol = m.role === 'user' ? 'Usuario' : 'PlaguIA';
      const contenido = (m.content || '').substring(0, 100);
      contexto += `\n  ${rol}: ${contenido}`;
    });
  });
  
  return contexto;
}
