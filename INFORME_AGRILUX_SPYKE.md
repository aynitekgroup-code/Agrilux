# AGRILUX — Informe General
## Plataforma de Agricultura Inteligente para Latinoamérica

**Fecha:** 30 de julio de 2026  
**Preparado para:** Aldo B. Schenone — Spyke Systems  
**Contacto:** jose.llanos.d@uni.pe  
**Plataforma:** https://www.vitalfarmbright.store

---

## 1. RESUMEN EJECUTIVO

**Agrilux** es una plataforma de agricultura inteligente diseñada para pequeños y medianos agricultores de Latinoamérica. Combina inteligencia artificial, datos climáticos en tiempo real y conocimiento agronómico local para ayudar a los agricultores a tomar mejores decisiones.

**Misión:** Democratizar el acceso a tecnología agrícola avanzada para agricultores que actualmente no tienen acceso a asesoría profesional.

---

## 2. EL PROBLEMA

| Problema | Impacto |
|----------|---------|
| **Pérdidas por plagas y enfermedades** | 30-50% de la producción anual en cultivos afectados |
| **Falta de asesoría técnica** | >80% de pequeños agricultores no tienen acceso a agrónomos |
| **Uso inadecuado de agroquímicos** | Sobredosis → contaminación + resistencia de plagas |
| **Pérdidas por clima** | Eventos extremos no monitoreados destruyen cosechas |
| **Mercados informales** | Agricultores venden por debajo del precio justo |

---

## 3. NUESTRA SOLUCIÓN

### 3.1 Diagnóstico con IA (Sin login requerido)
- El agricultor sube una foto de su cultivo
- La IA identifica plagas, enfermedades y deficiencias nutricionales
- Recomienda productos específicos con dosis y frecuencia
- **Funciona sin internet** (modo offline)

### 3.2 Asistente de Voz en Español Peruano
- Conversación por voz con un agrónomo virtual
- Responde en el acento local del agricultor
- Accede a clima, suelo, alertas y recomendaciones
- **Ideal para agricultores con baja alfabetización digital**

### 3.3 Ciclo del Cultivo
- Calendario completo de siembra a cosecha
- Recomendaciones personalizadas por etapa
- Alertas preventivas antes de que aparezcan problemas
- **7 cultivos peruanos detallados** (papa, maíz, palta, arándano, caña, plátano, papaya)

### 3.4 Búsqueda Local de Insumos
- Encuentra tiendas de agroquímicos cerca del agricultor
- Genera enlaces directos a Facebook, Google Maps, TikTok
- Conecta agricultores con proveedores locales

### 3.5 Monitoreo Satelital
- Análisis NDVI (índice de salud vegetal)
- Alertas de incendios forestales (NASA FIRMS)
- Datos de suelo (pH, textura, materia orgánica)
- **Integración con SENAMHI** (meteorología oficial del Perú)

---

## 4. CULTIVOS Y PROBLEMAS QUE ABORDAMOS

### Cultivos Soportados
| Cultivo | Región Principal | Ciclo | Problemas Comunes |
|---------|-----------------|-------|-------------------|
| 🥔 Papa | Sierra (Cajamarca, Junín, Cusco) | 150 días | Tizón tardío, polilla guatemalteca |
| 🌽 Maíz | Costa y Sierra | 120 días | Gusano cogollero, roya |
| 🥑 Palta (Hass) | Costa (Ica, Lima) | 365 días | Gusano del brote, antracnosis |
| 🫐 Arándano | Sierra (Cajamarca, Cusco) | 240 días | Botrytis, pájaros |
| 🎋 Caña de azúcar | Costa (Lambayeque, La Libertad) | 365 días | Gusano taladrador, roya |
| 🍌 Plátano | Selva y Costa | 365 días | Sigatoka negra, picudo |
| 🍈 Papaya | Costa y Selva | 210 días | Chancro bacterial, mosca de la fruta |

### Regiones de Enfoque
- **Perú** (mercado principal): Costa Norte, Sierra Norte, Selva
- **Colombia** (expansión planeada)
- **Ecuador** (expansión planeada)
- **Bolivia** (expansión planeada)

---

## 5. ESTADO ACTUAL DEL DESARROLLO

### ✅ Completado
- [x] Plataforma web PWA (Progressive Web App)
- [x] Diagnóstico con IA (Gemini, DeepSeek, fallback a modelos gratuitos)
- [x] Asistente de voz en español peruano
- [x] 7 cultivos con ciclos completos
- [x] Integración con Open-Meteo (clima gratuito)
- [x] Integración con SENAMHI (meteorología oficial)
- [x] Datos de suelo (SoilGrids)
- [x] Alertas NASA FIRMS (incendios)
- [x] Sistema de aprendizaje (memoria entre sesiones)
- [x] Alertas preventivas (diagnóstico predictivo)
- [x] Búsqueda local de insumos
- [x] Monitoreo satelital (NDVI)
- [x] Funcionamiento offline
- [x] Despliegue en producción: vitalfarmbright.store

### 🔧 En Desarrollo
- [ ] App móvil nativa (Android/iOS)
- [ ] Marketplace de insumos agrícolas
- [ ] Sistema de comunidades de agricultores
- [ ] IVR (llamadas automáticas para sin smartphone)
- [ ] Integración con cooperativas y asociaciones

---

## 6. DIFERENCIADORES CLAVE

| Característica | Agrilux | Competencia |
|---------------|---------|-------------|
| **Funciona sin internet** | ✅ Sí | ❌ No (requieren conexión permanente) |
| **Voz en español local** | ✅ Peruano nativo | ❌ Genérico o inglés |
| **Costo** | ✅ Gratuito para agricultores | 💰 $10-50/mes |
| **Cultivos peruanos** | ✅ 7 ciclos detallados | ❌ Genéricos |
| **Datos locales** | ✅ SENAMHI + 55 estaciones | ❌ Solo datos globales |
| **Sin login para diagnosticar** | ✅ Acceso inmediato | ❌ Requiere registro |
| **Diagnóstico predictivo** | ✅ Antes de que aparezca | ❌ Solo reactivo |

---

## 7. MODELO DE NEGOCIO

### Segmentos
| Segmento | Precio | Descripción |
|----------|--------|-------------|
| **Agricultor pequeño** | Gratis | Diagnóstico, recomendaciones, voz, clima |
| **Agricultor mediano** | $10/mes | + Monitoreo satelital, historial, reportes |
| **Agrónomo/Empresa** | $50/mes | + Gestión de múltiples parcelas, exportación |
| **Cooperativa/Estado** | $200/mes | + Dashboard administrativo, analytics, API |

### Proyecciones de Ingresos
| Año | Usuarios | Ingreso Mensual | Ingreso Anual |
|-----|----------|----------------|---------------|
| 1 | 500 | $6,000 | $72,000 |
| 2 | 2,000 | $19,400 | $233,000 |
| 3 | 5,000 | $46,900 | $563,000 |

---

## 8. APOYO BUSCADO

### 8.1 Alianza Estratégica con Spyke Systems
- **Integración técnica** con plataformas existentes
- **Co-desarrollo** de funcionalidades específicas
- **Distribución** a través de la red de clientes de Spyke

### 8.2 Áreas de Colaboración Potencial
| Área | Oportunidad |
|------|-------------|
| **Infraestructura cloud** | Optimización de costos y escalabilidad |
| **Integración con ERPs agrícolas** | Conectar con sistemas de gestión existentes |
| **Módulos financieros** | Créditos agrícolas, seguros, pagos |
| **Logística inversa** | Conectar productores con mercados |
| **Capacitación** | Programas de adopción tecnológica |

### 8.3 Próximos Pasos (si hay interés)
1. Demo en vivo de la plataforma
2. Revisión técnica detallada
3. Definición de alcance de colaboración
4. Acuerdo de confidencialidad (si aplica)
5. Piloto con un grupo de agricultores

---

## 9. MÉTRICAS ACTUALES

| Métrica | Valor |
|---------|-------|
| **Usuarios registrados** | En crecimiento |
| **Diagnósticos realizados** | Activo |
| **Cultivos soportados** | 7 |
| **Estaciones meteorológicas** | 55 en Perú |
| **Disponibilidad** | 99.9% (Vercel) |
| **Tiempo de respuesta** | <2 segundos |

---

## 10. CONTACTO

| Dato | Valor |
|------|-------|
| **Nombre** | José Llanos |
| **Email** | jose.llanos.d@uni.pe |
| **WhatsApp** | +51 935 211 605 |
| **Plataforma** | https://www.vitalfarmbright.store |
| **Reunión programada** | Miércoles 5 de agosto, 2026 |

---

## 11. NOTA DE CONFIDENCIALIDAD

Este documento contiene información general sobre el proyecto Agrilux. No incluye código fuente, datos técnicos sensibles ni información proprietaria. Cualquier información adicional compartida será tratada con reserva y puede ser cubierta por un acuerdo de confidencialidad si ambas partes lo consideran necesario.

---

*"La tecnología debe servir a quien más la necesita, no a quien más puede pagarla."*
