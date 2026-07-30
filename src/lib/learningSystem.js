import { 
  collection, addDoc, query, where, orderBy, limit, 
  getDocs, updateDoc, doc, serverTimestamp, 
  onSnapshot, Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * Sistema de Aprendizaje Agrilux
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
    const docRef = await addDoc(collection(db, 'historialClinico'), {
      userId,
      parcelaId,
      parcelaNombre: parcelaNombre || '',
      cultivo,
      variedad: variedad || '',
      
      // Datos del diagnóstico
      tieneProblema: diagnostico.tiene_problema,
      problema: diagnostico.nombre_problema || '',
      problemaCientifico: diagnostico.nombre_cientifico || '',
      gravedad: diagnostico.gravedad || 'desconocida',
      severidad: diagnostico.porcentaje_severidad || 0,
      causa: diagnostico.causa || '',
      recomendacion: diagnostico.que_hacer || '',
      
      // Producto aplicado (si el usuario indica)
      productoAplicado,
      fechaAplicacion: null,
      
      // Resultado (se actualiza después)
      resultado: null, // 'mejoro' | 'empeoro' | 'sin_cambio' | 'resuelto'
      fechaResultado: null,
      observacionesResultado: null,
      
      // Calidad del diagnóstico (feedback)
      calificacion: null, // 1-5 estrellas
      util: null, // true | false | null
      comentarioFeedback: null,
      
      // Contexto ambiental
      clima: null,
      suelo: null,
      
      // Metadatos
      fuente: 'diagnostico', // 'diagnostico' | 'monitoreo' | 'voz'
      fotoUrl,
      lat,
      lon,
      
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log('[Historial] Guardado:', docRef.id);
    return docRef.id;
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
    const docRef = doc(db, 'historialClinico', historialId);
    await updateDoc(docRef, {
      calificacion,
      util,
      comentarioFeedback: comentario,
      updatedAt: serverTimestamp()
    });
    
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
    const docRef = doc(db, 'historialClinico', historialId);
    await updateDoc(docRef, {
      resultado,
      fechaResultado: serverTimestamp(),
      observacionesResultado: observaciones,
      updatedAt: serverTimestamp()
    });
    
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
    const docRef = doc(db, 'historialClinico', historialId);
    await updateDoc(docRef, {
      productoAplicado: producto,
      fechaAplicacion: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
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
    const q = query(
      collection(db, 'historialClinico'),
      where('parcelaId', '==', parcelaId),
      orderBy('createdAt', 'desc'),
      limit(limite)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      fechaAplicacion: doc.data().fechaAplicacion?.toDate(),
      fechaResultado: doc.data().fechaResultado?.toDate()
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
  
  // Contar problemas frecuentes
  const conteoProblemas = {};
  historial.forEach(d => {
    if (d.tieneProblema && d.problema) {
      const key = d.problema.toLowerCase();
      conteoProblemas[key] = (conteoProblemas[key] || 0) + 1;
    }
  });
  
  // Ordenar por frecuencia
  const problemasFrecuentes = Object.entries(conteoProblemas)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([problema, veces]) => ({ problema, veces }));
  
  // Último diagnóstico
  const ultimoDiagnostico = historial[0];
  
  // Detectar tendencia
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
  
  // Problemas activos (sin resolver)
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
  
  // Último diagnóstico
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
  
  // Problemas frecuentes
  if (resumen.problemasFrecuentes.length > 0) {
    contexto += `\n\n• Problemas más frecuentes en esta parcela:`;
    resumen.problemasFrecuentes.forEach(p => {
      contexto += `\n  - ${p.problema} (${p.veces} veces)`;
    });
  }
  
  // Tendencia
  if (resumen.tendencia === 'empeorando') {
    contexto += `\n\n⚠️ ALERTA: El cultivo está EMPEORANDO según los últimos diagnósticos.`;
  } else if (resumen.tendencia === 'mejorando') {
    contexto += `\n\n✅ El cultivo está MEJORANDO según los últimos diagnósticos.`;
  }
  
  // Problemas activos
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

/**
 * Analizar patrones de una zona específica
 */
export async function analizarPatronesZona(region, cultivo = null) {
  try {
    let q = query(
      collection(db, 'historialClinico'),
      where('parcelaNombre', '>=', region),
      where('parcelaNombre', '<=', region + '\uf8ff'),
      orderBy('parcelaNombre'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    
    if (cultivo) {
      q = query(
        collection(db, 'historialClinico'),
        where('cultivo', '==', cultivo),
        orderBy('createdAt', 'desc'),
        limit(200)
      );
    }
    
    const snapshot = await getDocs(q);
    const diagnosticos = snapshot.docs.map(doc => doc.data());
    
    if (diagnosticos.length === 0) {
      return null;
    }
    
    // Analizar distribución de problemas
    const problemasPorMes = {};
    const problemasPorCultivo = {};
    const severidadPromedio = {};
    
    diagnosticos.forEach(d => {
      if (!d.tieneProblema || !d.problema) return;
      
      const mes = d.createdAt?.toDate().getMonth() || 0;
      const problema = d.problema.toLowerCase();
      
      // Por mes
      if (!problemasPorMes[mes]) problemasPorMes[mes] = {};
      problemasPorMes[mes][problema] = (problemasPorMes[mes][problema] || 0) + 1;
      
      // Por cultivo
      if (!problemasPorCultivo[d.cultivo]) problemasPorCultivo[d.cultivo] = {};
      problemasPorCultivo[d.cultivo][problema] = (problemasPorCultivo[d.cultivo][problema] || 0) + 1;
      
      // Severidad
      if (!severidadPromedio[problema]) severidadPromedio[problema] = { total: 0, count: 0 };
      severidadPromedio[problema].total += d.severidad || 0;
      severidadPromedio[problema].count += 1;
    });
    
    // Calcular promedios de severidad
    const severidad = {};
    Object.entries(severidadPromedio).forEach(([problema, data]) => {
      severidad[problema] = Math.round(data.total / data.count);
    });
    
    return {
      region,
      cultivo,
      totalDiagnosticos: diagnosticos.length,
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

/**
 * Obtener alertas tempranas basadas en patrones
 */
export async function getAlertasTempranas(parcelaId, cultivo, region) {
  const resumen = await getResumenProblemas(parcelaId);
  const patrones = await analizarPatronesZona(region, cultivo);
  
  const alertas = [];
  
  // Alerta por tendencia
  if (resumen.tendencia === 'empeorando') {
    alertas.push({
      tipo: 'tendencia',
      severidad: 'alta',
      mensaje: 'El cultivo está empeorando. Considere consultar un agrónomo.',
      accion: 'Revisar historial y considerar cambio de tratamiento'
    });
  }
  
  // Alerta por problema recurrente
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
  
  // Alerta por patrones de zona
  if (patrones && patrones.problemasPorMes) {
    const mesActual = new Date().getMonth();
    const problemasMes = patrones.problemasPorMes[mesActual];
    
    if (problemasMes) {
      const topProblema = Object.entries(problemasMes)
        .sort(([,a], [,b]) => b - a)[0];
      
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

/**
 * Guardar conversación del asistente de voz
 */
export async function guardarConversacion(userId, mensajes) {
  try {
    await addDoc(collection(db, 'conversacionesVoz'), {
      userId,
      mensajes: mensajes.slice(-20), // Últimos 20 mensajes
      createdAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('[Conversación] Error al guardar:', error);
    return false;
  }
}

/**
 * Obtener historial de conversaciones del usuario
 */
export async function getHistorialConversaciones(userId, limite = 5) {
  try {
    const q = query(
      collection(db, 'conversacionesVoz'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limite)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate()
    }));
  } catch (error) {
    console.error('[Conversación] Error al consultar:', error);
    return [];
  }
}

/**
 * Obtener contexto de conversaciones previas para el LLM
 */
export async function getContextoConversacional(userId) {
  const historial = await getHistorialConversaciones(userId, 3);
  
  if (historial.length === 0) return '';
  
  let contexto = '\n\n💬 CONVERSACIONES RECIENTES DEL USUARIO:\n';
  
  historial.forEach((conv, i) => {
    contexto += `\nConversación ${i + 1} (${conv.createdAt?.toLocaleDateString('es-PE')}):`;
    conv.mensajes.slice(-6).forEach(m => {
      const rol = m.role === 'user' ? 'Usuario' : 'PlaguIA';
      const contenido = m.content.substring(0, 100);
      contexto += `\n  ${rol}: ${contenido}`;
    });
  });
  
  return contexto;
}
