# AGRILUX — Informe General
## Plataforma de Agricultura Inteligente para Latinoamérica

**Fecha:** 30 de julio de 2026  
**Preparado para:** Aldo B. Schenone — Spyke Systems  
**Contacto:** jose.llanos.d@uni.pe  
**Plataforma:** https://www.vitalfarmbright.store

---

## 1. RESUMEN EJECUTIVO

**Agrilux** es una plataforma de agricultura inteligente diseñada para pequeños y medianos agricultores de Latinoamérica. Combina inteligencia artificial, datos climáticos en tiempo real, imágenes satelitales y conocimiento agronómico local para ayudar a los agricultores a tomar mejores decisiones.

**Misión:** Democratizar el acceso a tecnología agrícola avanzada para agricultores que actualmente no tienen acceso a asesoría profesional.

---

## 2. EL PROBLEMA

| Problema | Impacto |
|----------|---------|
| **Pérdidas por plagas y enfermedades** | 30-50% de la producción anual en cultivos afectados |
| **Falta de asesoría técnica** | >80% de pequeños agricultores no tienen acceso a agrónomos |
| **Uso inadecuado de agroquímicos** | Sobredosis → contaminación + resistencia de plagas |
| **Pérdidas por clima** | Eventos extremos no monitoreados destruyen cosechas |
| **Datos de suelo caros** | $500-2000 por estudio → agricultores no saben qué aplicar |

---

## 3. NUESTRA SOLUCIÓN

### 3.1 Diagnóstico con IA (Sin login requerido)
- El agricultor sube una foto de su cultivo
- La IA identifica plagas, enfermedades y deficiencias nutricionales
- Recomienda productos específicos con dosis y frecuencia
- **Funciona sin internet** (modo offline)
- **Cadena de modelos**: OpenRouter Gemini 2.5 → DeepSeek → GitHub Phi-4 → HuggingFace

### 3.2 Asistente de Voz en Español Peruano
- Conversación por voz con un agrónomo virtual
- Responde en el acento local del agricultor
- Accede a clima, suelo, alertas y recomendaciones
- **Ideal para agricultores con baja alfabetización digital**
- Detecta automáticamente cuando el agricultor busca tiendas

### 3.3 Ciclo del Cultivo
- Calendario completo de pre-siembra → siembra → cosecha
- Recomendaciones personalizadas por etapa + clima actual
- Alertas preventivas antes de que aparezcan problemas
- **7 cultivos peruanos detallados** con etapas pre-siembra

### 3.4 Búsqueda de Tiendas Locales
- Encuentra tiendas de insumos agrícolas cerca del agricultor
- Enlaces directos a Google Maps, Facebook, TikTok, WhatsApp
- **16 tiendas pre-cargadas** en todo Perú
- Integrada con el asistente de voz

### 3.5 Satélite y Monitoreo
- **Sentinel-2**: NDVI, clorofila, humedad de hoja, biomasa, punto de rocío (10m resolución)
- **NASA FIRMS**: Alertas de incendios forestales en tiempo real
- **ESRI**: Capas de satélite de alta resolución

### 3.6 Datos de Suelo
- **SoilGrids250m**: pH, textura, materia orgánica, salinidad, calcio, nitrógeno
- **4 capas de profundidad**: 0-5cm, 5-35cm, 35-65cm, 65-95cm
- **Calibración local**: Posibilidad de calibrar con datos de campo

### 3.7 Sistema de Aprendizaje
- Historial clínico por parcela
- Feedback del agricultor (👍/👎)
- Memoria entre sesiones
- Mejora continua de recomendaciones

---

## 4. CÓMO CALCULAMOS LOS DATOS (TÉCNICO)

### 🌡️ Clima
| Fuente | Resolución | Datos |
|--------|------------|-------|
| Open-Meteo (principal) | 0.25° (~27km) | 30+ modelos: ECMWF, NOAA, DWD, Meteo-France |
| SENAMHI (pronóstico oficial) | Por ubicación | Temperatura máxima/mínima, descripción |
| 70 estaciones propias | Haversine | Históricos automáticos (A001-A620) |

**Proceso**: Coordenadas → Buscar estación más cercana (Haversine) → Obtener pronóstico Open-Meteo → Cruzar con datos históricos → Generar recomendación.

### 🌱 Suelo
| Fuente | Resolución | Fiabilidad |
|--------|------------|------------|
| SoilGrids250m | 250m | 76% global |
| Datos de campo | Punto | 100% |

**Parámetros**: pH, CE (conductividad eléctrica), PSI (sodio), materia orgánica, calcio, nitrógeno, fósforo, potasio, textura (arcilla, limo, arena).

**Métodos de interpolación**: IDW, Kriging, Natural Neighbor, Spline, Topo to Raster.

### 🛰️ Satélite
| Satélite | Resolución | Parámetros |
|----------|------------|------------|
| Sentinel-2 | 10m | NDVI, clorofila, humedad hoja, biomasa, punto de rocío |
| NASA FIRMS | 375m | Incendios activos |
| ESRI | Variable | Imágenes de alta resolución |

**Proceso**: Coordenadas → Obtener imagen Sentinel-2 → Calcular índices espectrales → Generar mapa de NDVI → Detectar anomalías.

---

## 5. CULTIVOS SOPORTADOS

| Cultivo | Etapas | Detalles |
|---------|--------|----------|
| 🥔 Papa | Preparación → Siembra → Germinación → Crecimiento → Floración → Tuberización → Cosecha | 150 días, 6 variedades |
| 🌽 Maíz | Preparación → Siembra → Germinación → Crecimiento → Floración → Fructificación → Cosecha | 120 días, 4 variedades |
| 🥑 Palta | Preparación → Siembra → Crecimiento → Floración → Fructificación → Cosecha | 365 días, 4 variedades |
| 🫐 Arándano | Preparación → Siembra → Crecimiento → Floración → Fructificación → Cosecha | 240 días, 4 variedades |
| 🎋 Caña | Preparación → Siembra → Germinación → Crecimiento → Maduración → Cosecha | 365 días, 8 variedades |
| 🍌 Plátano | Preparación → Siembra → Crecimiento → Floración → Fructificación → Cosecha | 365 días, 5 variedades |
| 🍈 Papaya | Preparación → Siembra → Crecimiento → Floración → Fructificación → Cosecha | 210 días, 5 variedades |

**Regiones**: Perú (Costa Norte, Sierra, Selva) → Colombia → Ecuador → Bolivia

---

## 6. DIFERENCIADORES VS COMPETENCIA

| Característica | Agrilux | PlantVillage Nuru | Agrio | Yara CheckIT |
|----------------|---------|-------------------|-------|--------------|
| Sin internet | ✅ PWA offline | ❌ | ❌ | ❌ |
| Voz español local | ✅ es-PE peruano | ❌ | ❌ | ❌ |
| Costo | Gratis (freemium) | Gratis | $20/mes | $50/mes |
| Cultivos peruanos | ✅ 7 con ciclos completos | Genéricos | Genéricos | Genéricos |
| Diagnóstico predictivo | ✅ Antes de que aparezca | ❌ Solo reactivo | ❌ | ❌ |
| Satélite + suelo | ✅ Sentinel-2 + SoilGrids | ❌ | ❌ | Limitado |
| Búsqueda tiendas | ✅ + redes sociales | ❌ | ❌ | ❌ |
| Agentes sincronizados | ✅ Diagnóstico + Voz + Ciclo + Búsqueda | ❌ | ❌ | ❌ |
| Alertas preventivas | ✅ Por clima + etapa + historial | ❌ | ❌ | ❌ |

---

## 7. ESTADO ACTUAL

### ✅ Completado
- Plataforma web en producción (vitalfarmbright.store)
- IA funcionando (Gemini 2.5 Flash + DeepSeek + GitHub Phi-4 + HuggingFace)
- 7 cultivos con etapas pre-siembra + siembra + cosecha
- 70 estaciones meteorológicas Perú (20+ en Lambayeque)
- Sistema de aprendizaje activo (historial clínico por parcela)
- Alertas preventivas calculadas por clima + etapa + historial
- 4 agentes sincronizados: Diagnóstico, Ciclo, Voz, Búsqueda
- Búsqueda de tiendas con enlaces a redes sociales
- Mapa interactivo para seleccionar ubicación
- Satélite Sentinel-2 con NDVI + parámetros extra
- Suelo SoilGrids250m con calibración local
- Offline-first con IndexedDB + Service Worker

### 🔧 En Desarrollo
- App móvil nativa (Capacitor)
- Calibración de SoilGrids con datos locales
- Parámetros satelitales extendidos (agua foliar, biomasa)
- Integración con ERPs agrícolas

---

## 8. MODELO DE NEGOCIO

| Segmento | Precio | Funciones |
|----------|--------|-----------|
| Agricultor pequeño | Gratis | Diagnóstico, clima, voz básica |
| Agricultor mediano (Field Plus) | $10/mes | + Alertas predictivas, historial, exportación |
| Agrónomo/Empresa (Pro) | $50/mes | + Múltiples parcelas, reportes, API |
| Cooperativa/Estado (Enterprise) | $200/mes | + Dashboard administrativo, datos personalizados |

**Proyección Año 3:** $563,000 anuales

---

## 9. APOYO BUSCADO

- Alianza técnica con Spyke Systems
- Co-desarrollo de funcionalidades
- Distribución a través de red de clientes
- Integración con ERPs agrícolas
- Acceso a datos de campo para calibrar modelos

---

## 10. CONTACTO

**José Llanos**  
📧 jose.llanos.d@uni.pe  
📱 +51 935 211 605  
🌐 vitalfarmbright.store
