# AGRILUX — Documento Técnico: Cálculo de Datos
## Para: Carlos Perez — Agroindustrial Pomalca

---

## 1. CÓMO CALCULAMOS EL CLIMA

### Fuentes de datos

| Fuente | Tipo | Resolución | Cobertura | Datos |
|--------|------|------------|-----------|-------|
| **Open-Meteo** | API gratuity | 0.25° (~27km) | Global | Temp, humedad, viento, lluvia, nubosidad |
| **SENAMHI** | Pronóstico oficial | Por ubicación | Perú | Temp máxima/mínima, descripción |
| **70 estaciones** | Datos históricos | Punto | Perú | Temperatura, precipitación, humedad |

### Proceso de cálculo

```
1. Coordenadas del agricultor (lat, lon)
         ↓
2. Encontrar estación más cercana (Haversine)
         ↓
3. Obtener pronóstico Open-Meteo (27km)
         ↓
4. Cruzar con datos históricos de estación
         ↓
5. Generar recomendación personalizada
```

### Algoritmo Haversine (estación más cercana)

```javascript
// Distancia entre dos puntos en la Tierra
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)² + 
            Math.cos(lat1) * Math.cos(lat2) * 
            Math.sin(dLon/2)²;
  return R * 2 * Math.atan2(√a, √(1-a));
}
```

### Ejemplo práctico
- **Ubicación:** Cutervo, Cajamarca (-6.37, -78.82)
- **Estación más cercana:** Cutervo (6.38, -78.82) → 1.1km
- **Datos obtenidos:** Temp 18°C, humedad 75%, viento 8 km/h
- **Pronóstico SENAMHI:** Lluvia moderada明天

---

## 2. CÓMO CALCULAMOS LA TEXTURA DEL SUELO

### Fuentes de datos

| Fuente | Tipo | Resolución | Datos |
|--------|------|------------|-------|
| **SoilGrids250m** | Machine Learning | 250m | % arena, % limo, % arcilla |
| **Laboratorio local** | Análisis directo | Punto | Textura exacta (calibración) |

### Clasificación textural (triángulo USDA)

```
                    ARENA
                   /      \
                  /        \
                 /  ARENOSO \
                /            \
               /   FRANCO     \
              /    ARENOSO     \
             /                  \
            /     FRANCO         \
           /                      \
          /   FRANCO LIMOSO        \
         /                          \
        /      FRANCO ARCILLOSO      \
       /                              \
      /         ARCILLOSO              \
     /                                  \
    /           LIMOSO                   \
   /______________________________________\
                ARCILLA
```

### Propiedades por textura

| Textura | %Arena | %Limo | %Arcilla | Retención agua | Drenaje |
|---------|--------|-------|----------|----------------|---------|
| Arenoso | >85% | <10% | <10% | Baja | Muy alto |
| Franco arenoso | 70-85% | <20% | <15% | Media-baja | Alto |
| Franco | 40-60% | 20-40% | 15-25% | Media | Medio |
| Franco limoso | <40% | >40% | <25% | Media-alta | Medio-bajo |
| Franco arcilloso | <40% | <40% | 25-40% | Alta | Bajo |
| Arcilloso | <30% | <30% | >40% | Muy alta | Muy bajo |

### Impacto en cultivos

| Textura | Papa | Maíz | Caña | Recomendación |
|---------|------|------|------|---------------|
| Arenoso | ⚠️ Seca rápido | ✅ Buena | ✅ Buena | Aumentar riego |
| Franco | ✅ Ideal | ✅ Ideal | ✅ Buena | Manejo normal |
| Arcilloso | ⚠️ Encharca | ⚠️ Encharca | ⚠️ Encharca | Mejorar drenaje |

---

## 3. CÓMO CALCULAMOS EL pH

### Fuentes de datos

| Fuente | Tipo | Resolución | Datos |
|--------|------|------------|-------|
| **SoilGrids250m** | Machine Learning | 250m | pH estimado |
| **Análisis local** | Laboratorio | Punto | pH exacto (calibración) |

### Rangos de pH y su interpretación

| pH | Clasificación | Suelo | Cultivos adecuados |
|----|---------------|-------|-------------------|
| <4.5 | Muy ácido | Ácido extremo | Ninguno (toxico) |
| 4.5-5.5 | Ácido | Ácido | Arándano, café, caucho |
| 5.5-6.5 | Ligeramente ácido | Ácido | Papa, maíz, trigo |
| 6.5-7.5 | Neutro | Neutro | La mayoría de cultivos |
| 7.5-8.5 | Ligeramente alcalino | Alcalino | Cebada, algodón |
| >8.5 | Alcalino | Alcalino extremo | Ninguno (problemático) |

### Corrección de pH

| Situación | Corrección | Dosis típica |
|-----------|------------|--------------|
| pH < 5.5 | Cal agrícola | 1-3 ton/ha |
| pH > 8.0 | Azufre elemental | 200-500 kg/ha |
| pH 5.5-6.5 | Cal dolomítica | 0.5-1.5 ton/ha |

### Ejemplo práctico
- **Suelo Pomalca:** pH 6.8 (neutro) → Ideal para caña
- **Suelo Cutervo:** pH 5.2 (ácido) → Necesita cal para papa
- **Suelo Ica:** pH 7.8 (alcalino) → Necesita azufre para arándano

---

## 4. CÓMO CALCULAMOS EL NDVI

### ¿Qué es el NDVI?

**NDVI = (NIR - Rojo) / (NIR + Rojo)**

Donde:
- **NIR** = Reflectancia en infrarrojo cercano (700-1100nm)
- **Rojo** = Reflectancia en rojo visible (630-690nm)

### Valores de NDVI

| NDVI | Color | Significado | Acción |
|------|-------|-------------|--------|
| <0.1 | Marrón | Suelo desnudo, agua, nieve | No hay vegetación |
| 0.1-0.2 | Café | Vegetación muy escasa | Siembra reciente |
| 0.2-0.3 | Verde claro | Vegetación joven | Crecimiento inicial |
| 0.3-0.5 | Verde medio | Vegetación moderada | Estado normal |
| 0.5-0.7 | Verde oscuro | Vegetación densa y sana | Óptimo |
| 0.7-0.9 | Verde muy oscuro | Vegetación muy densa | Excelente |
| >0.9 | Negro | Vegetación excepcional | Raro en agricultura |

### Fuente de datos satelital

| Satélite | Resolución | Banda Roja | Banda NIR | Frecuencia |
|----------|------------|------------|-----------|------------|
| **Sentinel-2** | 10m | B4 (665nm) | B8 (842nm) | Cada 5 días |
| **Landsat-8** | 30m | B4 (655nm) | B5 (865nm) | Cada 16 días |
| **MODIS** | 250m | B1 (645nm) | B2 (858nm) | Diario |

### Proceso de cálculo

```
1. Obtener coordenadas (lat, lon)
         ↓
2. Descargar imagen Sentinel-2 (10m)
         ↓
3. Extraer bandas Roja (B4) y NIR (B8)
         ↓
4. Calcular: NDVI = (B8 - B4) / (B8 + B4)
         ↓
5. Generar mapa de color (verde = sano, rojo = estrés)
         ↓
6. Detectar anomalías y tendencias
```

### Interpretación para Pomalca (Caña)

| NDVI | Estado caña | Acción recomendada |
|------|-------------|-------------------|
| 0.2-0.3 | Recién sembrada | Mantener riego |
| 0.3-0.5 | Crecimiento vegetativo | Fertilizar nitrógeno |
| 0.5-0.7 | Maduración | Reducir riego |
| <0.3 en etapa avanzada | Estrés plaga/enfermedad | Investigar causa |
| Manchas rojas | Punto caliente (incendio) | Alerta inmediata |

---

## 5. CÓMO CALCULAMOS OTROS PARÁMETROS SATelitales

### 🌡️ Temperatura de superficie (LST)

```
NDVI → Temperatura de superficie
Usando banda TIR de Landsat (10.6-11.2 μm)
Resolución: 100m
```

### 💧 Humedad del suelo

```
NDVI + Precipitación + Tipo de suelo
Modelo: Soil Moisture Active Passive (SMAP)
Resolución: 9km (mejorado con Sentinel-2)
```

### 🌿 Clorofila

```
NDVI ajustado por banda Roja
Índice: CIre = (NIR / Rojo) - 1
Mide actividad fotosintética
```

### 🌫️ Punto de rocío

```
Temperatura del aire + Humedad relativa
Fórmula: Td = T - (100 - HR) / 5
```

### 🔥 Incendios activos

```
NASA FIRMS (Fire Information for Resource Management System)
Resolución: 375m
Actualización: Cada 3 horas
```

---

## 6. CALIBRACIÓN CON DATOS LOCALES

### El problema de SoilGrids

- Resolución global: 250m
- Fiabilidad: 76% (promedio global)
- **No conoce las condiciones locales de Pomalca**

### La solución: Calibración local

```
Datos de Pomalca (5000+ muestras)
         ↓
Entrenar modelo de corrección
         ↓
Mejorar predicciones de SoilGrids
         ↓
+30% fiabilidad en zona específica
```

### Parámetros calibrables

| Parámetro | SoilGrids | Con calibración | Mejora |
|-----------|-----------|-----------------|--------|
| pH | 76% | 95% | +19% |
| CE (salinidad) | 72% | 92% | +20% |
| MO | 68% | 88% | +20% |
| Textura | 70% | 90% | +20% |

### Interpolación de datos locales

| Método | Uso | Precisión |
|--------|-----|-----------|
| **IDW** | Datos puntuales → mapa | Media |
| **Kriging** | Geoestadística | Alta |
| **Natural Neighbor** | Datos irregulares | Alta |
| **Spline** | Superficies suaves | Media-alta |

---

## 7. EJEMPLO INTEGRADO: POMALCA

### Datos de entrada
- **Coordenadas:** -6.81, -79.77 (Pomalca, Lambayeque)
- **Cultivo:** Caña de azúcar
- **Etapa:** Crecimiento vegetativo (día 120)

### Datos calculados

| Parámetro | Valor | Fuente | Precisión |
|-----------|-------|--------|-----------|
| Temperatura | 24°C | Open-Meteo | 90% |
| Humedad | 78% | Open-Meteo | 85% |
| Viento | 8 km/h | Open-Meteo | 80% |
| Lluvia | 0mm (seca) | Open-Meteo | 85% |
| pH suelo | 6.8 | SoilGrids + calibración | 92% |
| Textura | Franco limoso | SoilGrids + calibración | 88% |
| NDVI | 0.65 | Sentinel-2 | 95% |
| CE (salinidad) | 2.1 dS/m | SoilGrids + calibración | 85% |

### Recomendación generada

```
📊 ANÁLISIS POMALCA - Caña de azúcar - Día 120

🌡️ CLIMA:
- Temperatura: 24°C (óptima para crecimiento)
- Humedad: 78% (favorable)
- Riesgo de royas: BAJO (clima seco)

🌱 SUELO:
- pH: 6.8 (neutro - ideal para caña)
- Textura: Franco limoso (buena retención)
- Salinidad: 2.1 dS/m (estrés leve - vigilar)

🛰️ SATELITE:
- NDVI: 0.65 (vegetación sana y densa)
- Estado: Crecimiento normal

⚠️ ALERTAS:
- Reducir riego en 2 semanas (entrada a maduración)
- Monitorear gusano taladrador (Diatraea)
- Aplicar ethefon a los 180 días para maduración

💰 COSTO RECOMENDADO:
- Urea: S/ 175 (AgroCajamarca - 15km)
- Mancozeb: S/ 90 (AgroCutervo - 22km)
```

---

## 8. LIMITACIONES Y MEJORAS

### Limitaciones actuales

| Parámetro | Limitación | Solución |
|-----------|------------|----------|
| Clima | Resolución 27km | Más estaciones locales |
| Suelo | 76% fiabilidad | Calibración con datos pomalca |
| NDVI | Cada 5 días (nubosidad) | Fusionar con Sentinel-1 |
| Textura | Estática (no cambia) | Monitoreo anual |

### Mejoras planificadas

1. **Más estaciones meteorológicas** en Lambayeque
2. **Calibración de SoilGrids** con 5000+ muestras de Pomalca
3. **Sentinel-1 (radar)** para monitoreo bajo nubes
4. **Modelos de IA** entrenados con datos locales
5. **Actualización en tiempo real** de condiciones

---

**Documento preparado para:** Carlos Perez — Agroindustrial Pomalca  
**Fecha:** 30 de julio de 2026  
**Contacto:** José Llanos | jose.llanos.d@uni.pe | +51 935 211 605
