# AGRILUX — Resumen Ejecutivo
## Para: Aldo B. Schenone — Spyke Systems | Reunión: Miércoles 5 agosto

---

## ¿Qué es Agrilux?

Plataforma de **agricultura inteligente** que sirve tanto a **pequeños agricultores** (freemium) como a **empresas agroindustriales** (enterprise). Combina IA + datos climáticos + satélite + suelo + conocimiento local para optimizar la producción agrícola.

**Link:** https://www.vitalfarmbright.store

---

## El Problema (en números)

- 30-50% de producción perdida por plagas/enfermedades
- >80% de agricultores sin acceso a asesoría técnica
- Uso inadecuado de agroquímicos → contaminación + resistencia
- Eventos climáticos extremos destruyen cosechas sin aviso
- Datos de suelo caros ($500-2000 por estudio) → Agricultores no saben qué aplicar
- **Empresas**: Falta de integración entre datos de campo, clima y sistema de decisión

---

## Nuestra Solución

### Para el Agricultor (Freemium)

| Función | Qué hace | Fuente de datos |
|---------|----------|-----------------|
| 📸 **Diagnóstico con IA** | Foto → identifica plaga/enfermedad → recomienda producto | Gemini 2.5 + DeepSeek + GitHub Models |
| 🎤 **Voz en español** | Conversa con agrónomo virtual en acento peruano | Speech Recognition + TTS |
| 📅 **Ciclo del cultivo** | Calendario completo con etapas + alertas preventivas por día | Conocimiento agronómico local |
| 🔍 **Búsqueda local** | Encuentra tiendas de insumos + redes sociales del agricultor | Google Places + base de datos local |
| 🛰 **Satélite** | NDVI, clorofila, humedad del suelo, biomasa, punto de rocío | Sentinel-2 (10m resolución) + ESRI |
| 🌧 **Clima real** | Temperatura, humedad, viento, lluvia en tiempo real | Open-Meteo (27km) + 70 estaciones SENAMHI |
| 🌱 **Suelo** | pH, textura, materia orgánica, salinidad, calcio | SoilGrids250m (ML + imágenes satelitales) |
| 🔥 **Alertas NASA** | Monitoreo de incendios forestales en tiempo real | NASA FIRMS |
| 📊 **Predictivo** | Calcula riesgo de enfermedades ANTES de que aparezcan | Clima + etapa + historial clínico |

### Para Empresas Agroindustriales (Enterprise)

| Función | Beneficio |
|---------|-----------|
| 📊 **Dashboard administrativo** | Vista completa de todas las parcelas en un solo lugar |
| 🗺 **Mapa de parcelas** | Visualización georreferenciada de todas las áreas |
| 📈 **Analítica avanzada** | Reportes de rendimiento, eficiencia, tendencias |
| 🔗 **API de integración** | Conectar con ERPs agrícolas existentes |
| 🤖 **Modelos personalizados** | IA entrenada con datos específicos de la empresa |
| 👥 **Multi-usuario** | Acceso para agrónomos, gerentes, field workers |
| 📱 **App móvil** | Acceso offline en campo sin internet |
| 💾 **Exportación de datos** | Excel, PDF, integración con sistemas externos |
| 🎯 **Calibración de suelo** | Modelos calibrados con datos de campo propios |
| 🛰 **Análisis satelital** | NDVI histórico, alertas de estrés hídrico |

---

## Cultivos Soportados (con etapas pre-siembra + siembra + cosecha)

🥔 Papa · 🌽 Maíz · 🥑 Palta · 🫐 Arándano · 🎋 Caña de azúcar · 🍌 Plátano · 🍈 Papaya

**Regiones:** Perú (Costa Norte, Sierra, Selva) → Colombia → Ecuador → Bolivia

---

## Cómo Calculamos los Datos (Técnico)

### 🌡️ Clima
1. **Open-Meteo** (principal): Datos de 30+ modelos meteorológicos oficiales (ECMWF, NOAA, DWD). Resolución 0.25° (~27km). Actualización cada hora.
2. **SENAMHI** (pronóstico oficial): Fuente gubernamental de Perú. Pronósticos diarios por ubicación.
3. **70 estaciones propias**: Datos históricos de estaciones automáticas (Código: A001-A620). Haversine para encontrar la más cercana.

### 🌱 Suelo
1. **SoilGrids250m**: Machine learning + imágenes satelitales de 250m. 76% de fiabilidad global. Fusión de datos de campo + satélite.
2. **Parámetros**: pH, textura, materia orgánica, salinidad (CE), PSI, calcio, nitrógeno, fósforo, potasio.
3. **Capas**: 0-5cm, 5-35cm, 35-65cm, 65-95cm de profundidad.
4. **Calibración local**: Posibilidad de calibrar con datos de campo del agricultor (Pomalca tiene 5000+ muestras para calibrar en 40km lineales).

### 🛰️ Satélite (NDVI + Parámetros)
1. **Sentinel-2**: Imágenes de 10m de resolución (mejor que NAX de 15m).
2. **Parámetros extraídos**: NDVI, clorofila, humedad de la hoja, humedad del suelo, punto de rocío, cantidad de biomasa.
3. **ESRI**: Capas de satélite de alta resolución para monitoreo visual.

### 🔍 Interpolación de Datos
- **IDW** (Inverse Distance Weighting): Para datos de suelo y clima.
- **Kriging**: Para modelos geoestadísticos.
- **Métodos ArcGIS**: Natural Neighbor, Spline, Topo to Raster.
- A mayor densidad de datos → mayor exactitud.

---

## Caso de Uso: Agroindustrial Pomalca

**Cliente**: Empresa agroindustrial en Lambayeque, Perú  
**Cultivo principal**: Caña de azúcar  
**Datos disponibles**: 5000+ muestras de suelo en 40km lineales  

### Beneficios para Pomalca:
1. **Calibración de modelos**: Usar datos de campo para mejorar predicciones de suelo
2. **Dashboard de monitoreo**: Ver todas las parcelas en un mapa
3. **Alertas preventivas**: Notificaciones automáticas de plagas y enfermedades
4. **Optimización de riego**: Datos de humedad del suelo en tiempo real
5. **Análisis de rendimiento**: Comparar producción entre parcelas
6. **Integración con sistemas existentes**: API para conectar con ERP agrícola
7. **Reportes automáticos**: Generación de informes para gerencia
8. **Multi-usuario**: Acceso para agrónomos, gerentes y field workers

---

## Diferenciadores vs Competencia

| | Agrilux | Competencia |
|--|---------|-------------|
| Sin internet | ✅ PWA offline | ❌ Requiere internet |
| Voz español local | ✅ es-PE peruano | ❌ Genérico |
| Costo | Gratis (freemium) | $10-50/mes |
| Cultivos peruanos | ✅ 7 con ciclos completos | Genéricos |
| Diagnóstico predictivo | ✅ Antes de que aparezca | ❌ Solo reactivo |
| Satélite + suelo | ✅ Sentinel-2 + SoilGrids | Limitado |
| Búsqueda tiendas | ✅ + redes sociales | ❌ |
| Agentes sincronizados | ✅ Diagnóstico + Voz + Ciclo + Búsqueda | ❌ |
| **Para empresas** | ✅ Dashboard + API + multi-usuario | Limitado |

---

## Estado Actual

✅ **Plataforma web en producción** (vitalfarmbright.store)  
✅ **IA funcionando** (Gemini 2.5 Flash + DeepSeek + GitHub Phi-4 + HuggingFace)  
✅ **7 cultivos** con etapas pre-siembra + siembra + cosecha  
✅ **70 estaciones meteorológicas** Perú (20+ en Lambayeque)  
✅ **Sistema de aprendizaje activo** (historial clínico por parcela)  
✅ **Alertas preventivas** calculadas por clima + etapa + historial  
✅ **4 agentes sincronizados**: Diagnóstico, Ciclo, Voz, Búsqueda  
✅ **Búsqueda de tiendas** con enlaces a redes sociales  
✅ **Mapa interactivo** para seleccionar ubicación  
✅ **Satélite Sentinel-2** con NDVI + parámetros extra  
✅ **Suelo SoilGrids250m** con calibración local  
✅ **Offline-first** con IndexedDB + Service Worker  

🔧 **App móvil nativa** (Capacitor)  
🔧 **Dashboard enterprise** para empresas  
🔧 **API de integración** con ERPs agrícolas  
🔧 **Calibración de SoilGrids** con datos locales  
🔧 **Parámetros satelitales extendidos** (agua foliar, biomasa)  

---

## Modelo de Negocio

### Para Agricultores (Freemium)

| Segmento | Precio |
|----------|--------|
| Agricultor pequeño | Gratis |
| Agricultor mediano (Field Plus) | $10/mes |
| Agrónomo/Empresa (Pro) | $50/mes |

### Para Empresas Agroindustriales (Enterprise)

| Segmento | Precio | Incluye |
|----------|--------|---------|
| Empresa pequeña (<100 ha) | $200/mes | Dashboard + 1 usuario |
| Empresa mediana (100-1000 ha) | $500/mes | Dashboard + 5 usuarios + API |
| Empresa grande (>1000 ha) | $1,000+/mes | Dashboard + usuarios ilimitados + API + modelos personalizados |

**Proyección Año 3:** $563,000 anuales

---

## Apoyo Buscado

- Alianza técnica con Spyke Systems
- Co-desarrollo de funcionalidades
- Distribución a través de red de clientes
- Integración con ERPs agrícolas
- Acceso a datos de campo para calibrar modelos

---

## Contacto

**José Llanos**  
📧 jose.llanos.d@uni.pe  
📱 +51 935 211 605  
🌐 vitalfarmbright.store
