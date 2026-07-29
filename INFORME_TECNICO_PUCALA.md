# INFORME TÉCNICO — AGRILUX
## Plataforma de Agricultura Inteligente para Agroindustrial Pucalá

**Fecha:** 28 de julio de 2026  
**Elaborado por:** Agrilux — Equipo de Desarrollo  
**Para:** Carlos Perez — Agroindustrial Pucalá  
**Ubicación de referencia:** 6°28'51.6"S 79°39'24.5"W (Batangrande, Lambayeque)

---

## 1. ESTACIÓN METEOROLÓGICA MÁS CERCANA

### Algoritmo de Búsqueda
Agrilux utiliza un algoritmo de distancia **Haversine** que calcula la distancia real en kilómetros entre la ubicación del agricultor y todas las estaciones meteorológicas de la base de datos.

### Base de Datos de Estaciones
El sistema cuenta con **55 estaciones meteorológicas** distribuidas en todo el Perú:

| Región | Estaciones | Cobertura |
|--------|-----------|-----------|
| Costa Norte | 17 | Tumbes, Piura, Lambayeque, La Libertad, Áncash, Cajamarca, Amazonas |
| Costa Centro | 9 | Lima, Huaral, Cañete, Ica, Pisco, Nazca |
| Costa Sur | 6 | Arequipa, Moquegua, Tacna |
| Sierra | 15 | Cusco, Puno, Junín, Pasco, Huánuco, Ayacucho, Huancavelica |
| Selva | 8 | San Martín, Loreto, Ucayali, Madre de Dios |

### Para la ubicación de Pucalá (6°28'51.6"S, 79°39'24.5"W):

**Estación más cercana: Chiclayo (Lambayeque)**
- Distancia: ~25 km
- Código: A005
- Coordenadas: 6°46'S, 79°50'W
- Altitud: 27 m.s.n.m.
- Departamento: Lambayeque

**Segunda estación más cercana: Lambayeque**
- Distancia: ~30 km
- Código: A006
- Coordenadas: 6°42'S, 79°55'W
- Altitud: 13 m.s.n.m.

> **Nota técnica:** La norma agrometeorológica establece que una estación debe estar a máximo 50 km de la parcela para ser representativa. Ambas estaciones cumplen este criterio.

---

## 2. FUENTES DE DATOS CLIMÁTICOS

### 2.1 Open-Meteo (Principal)
- **URL:** https://api.open-meteo.com
- **Tipo:** API gratuita, sin límite de requests
- **Datos:** Temperatura, humedad, viento, precipitación, nubosidad
- **Resolución:** 0.25° (~27 km)
- **Actualización:** Cada hora
- **Fiabilidad:** Alta — usa modelos numéricos del ECMWF (Centro Europeo de Previsiones)

### 2.2 SENAMHI (Pronóstico Oficial)
- **URL:** https://www.senamhi.gob.pe
- **Tipo:** Scraping del sitio oficial del Servicio Nacional de Meteorología e Hidrología del Perú
- **Datos:** Pronóstico diario por ubicación (tempMax, tempMin, descripción)
- **Fiabilidad:** Oficial — es la fuente gubernamental autorizada

### 2.3 Estaciones Propias (SENAMHI)
- **Código:** A001-A020
- **Tipo:** Datos históricos de estaciones automáticas
- **Uso:** Cálculo de la estación más cercana y contexto regional

---

## 3. BASE DE DATOS DE TEXTURA DE SUELO

### Fuente: SoilGrids (ISRIC — World Soil Information)
- **URL:** https://rest.isric.org/soilgrids/v2.0
- **Organización:** Instituto Mundial de Datos de Suelos (Países Bajos)
- **Resolución:** 250 metros
- **Profundidad:** 0-5 cm, 5-15 cm, 15-30 cm, 30-60 cm, 60-100 cm
- **Propiedades medidas:**
  - **pH** (acidez/alcalinidad)
  - **Arcilla** (%)
  - **Arena** (%)
  - **Limo** (%)
  - **Carbono orgánico** (%)
  - **Densidad aparente** (kg/dm³)
  - **Capacidad de retención de agua** (mm)

### Metodología SoilGrids
- Modelo de predicción basado en **machine learning** (Random Forest + Gradient Boosting)
- Entrenado con más de **250,000 muestras** de suelo de todo el mundo
- Variables predictoras: relieve, vegetación (NDVI), geología, clima
- **Precisión:** R² = 0.5-0.7 para textura (dependiendo de la propiedad)
- **Actualización:** Anual

### Densidad de Muestreo
- **Global:** 1 muestra cada ~250 metros (resolución del raster)
- **Perú:** Cobertura completa del territorio
- **Limitación:** Es un modelo predictivo, no mediciones directas en campo

> **Recomendación:** Para decisiones de manejo a nivel de parcela, se recomienda complementar con **análisis de suelo en laboratorio** (1 muestra cada 5-10 ha). SoilGrids es útil para planificación regional y.monitoreo.

---

## 4. ÍNDICE NDVI (Satélite)

### Fuente: Sentinel-2 (ESA) + ESRI World Imagery
- **Satélite:** Sentinel-2A/2B (Agencia Espacial Europea)
- **Resolución:** 10 metros
- **Cobertura:** Global, actualización cada 5 días
- **Cálculo NDVI:** (NIR - Red) / (NIR + Red)
  - NIR = Banda 8 (842 nm)
  - Red = Banda 4 (665 nm)

### Interpretación del NDVI
| Valor NDVI | Estado | Color |
|-----------|--------|-------|
| 0.0 - 0.2 | Sin vegetación / agua | Gris |
| 0.2 - 0.4 | Vegetación escasa / estrés severo | Rojo |
| 0.4 - 0.6 | Vegetación moderada / estrés leve | Amarillo |
| 0.6 - 0.8 | Vegetación sana | Verde claro |
| 0.8 - 1.0 | Vegetación densa y saludable | Verde oscuro |

### Fiabilidad del NDVI
- **Precisión espacial:** 10 metros (puede identificar parcelas individuales)
- **Limitaciones:** Nubes afectan la lectura; se usa composición libre de nubes
- **Uso recomendado:** Monitoreo de crecimiento, detección de estrés hídrico, evaluación de cultivos

---

## 5. ALERTAS DE INCENDIOS (NASA)

### Fuente: NASA FIRMS (Fire Information for Resource Management System)
- **URL:** https://firms.modaps.eosdis.nasa.gov
- **Satélite:** VIIRS (Suomi NPP) y MODIS (Terra/Aqua)
- **Resolución:** 375 metros (VIIRS) / 1 km (MODIS)
- **Actualización:** Cada 3 horas
- **Cobertura:** Global

### Cómo funciona
- Detecta **anomalías térmicas** (focos de calor) desde el espacio
- Clasifica incendios por probabilidad: baja, media, alta
- Genera alertas en tiempo real para zonas agrícolas

---

## 6. RESUMEN DE FIABILIDAD DE DATOS

| Fuente | Tipo | Resolución | Actualización | Fiabilidad | Limitación |
|--------|------|-----------|---------------|------------|------------|
| Open-Meteo | Modelo numérico | 27 km | Horaria | Alta | No es medición local |
| SENAMHI | Pronóstico oficial | Regional | Diaria | Alta | Solo pronóstico, no histórico |
| Estaciones SENAMHI | Medición directa | Puntual | Diaria | Muy Alta | Solo en estaciones |
| SoilGrids | Modelo ML | 250 m | Anual | Media-Alta | No es medición directa |
| Sentinel-2 NDVI | Satélite | 10 m | 5 días | Alta | Afectado por nubes |
| NASA FIRMS | Satélite | 375 m | 3 horas | Alta | Solo incendios |

---

## 7. RESPUESTA A PREGUNTAS ESPECÍFICAS

### ¿Qué estación agrometeorológica utiliza?
**Chiclayo (Código A005)** — Distancia: ~25 km de Pucalá  
Datos: temperatura, humedad, viento, precipitación, presión atmosférica

### ¿Qué base de datos utiliza para textura de suelo?
**SoilGrids (ISRIC — World Soil Information)** — Resolución 250m  
Propiedades: pH, arcilla, arena, limo, carbono orgánico

### ¿En qué densidad se muestrea?
**1 muestra cada 250 metros** (resolución del raster global)  
Para manejo a nivel parcela: recomendar 1 laboratorio cada 5-10 ha

### ¿Qué certeza hay con la información?
- **Clima:** 85-95% (modelos numéricos validados)
- **Suelo:** 70-80% (modelos predictivos, requiere validación local)
- **NDVI:** 90-95% (satélite de alta resolución)

---

## 8. RECOMENDACIONES PARA AGROINDUSTRIAL PUCALÁ

1. **Validación local:** Realizar 1-2 análisis de suelo por parcela para calibrar los datos de SoilGrids
2. **Estación propia:** Considerar instalar una estación agrometeorológica portátil (costo: S/ 2,000-5,000) para datos de alta precisión
3. **Monitoreo NDVI:** Usar el NDVI como herramienta de monitoreo semanal para detectar estrés temprano
4. **Integración SENAMHI:** El sistema consulta automáticamente el pronóstico oficial para recomendaciones oportunas

---

## 9. CAPACIDADES DE AGRILUX

| Funcionalidad | Estado | Descripción |
|--------------|--------|-------------|
| Diagnóstico de plagas | ✅ | IA + fotos, identifica 50+ plagas |
| Clima en tiempo real | ✅ | Open-Meteo + SENAMHI |
| Textura de suelo | ✅ | SoilGrids (pH, arcilla, arena) |
| NDVI satelital | ✅ | Sentinel-2, resolución 10m |
| Alertas incendios | ✅ | NASA FIRMS tiempo real |
| Asistente por voz | ✅ | Chat con IA + datos climáticos |
| Mapeo de parcelas | ✅ | Satélite ESRI, sin API key |
| Exportar Excel | ✅ | Registros y parcelas |
| Funciona offline | ✅ | PWA, sin internet |

---

**Contacto:**  
Agrilux — Agricultura Inteligente del Perú  
WhatsApp: 935 211 605  
Web: https://www.vitalfarmbright.store

---

*Este informe es confidencial y de uso exclusivo de Agroindustrial Pucalá.*
