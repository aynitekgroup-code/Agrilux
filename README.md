# Agrilux

PWA de gestión agrícola para agricultores de la sierra del Perú. Detecta plagas, analiza suelo, monitorea clima y guía el ciclo completo del cultivo desde siembra hasta cosecha.

**Stack:** React 18 + Vite + Tailwind CSS + Firebase + Vercel Serverless Functions

---

## Estrategia de diferenciación

### Por qué Agrilux gana en Latam

| Factor | Competencia (ORTH, etc.) | **Agrilux** |
|--------|--------------------------|-------------|
| **Interfaz** | Chat de texto | **Voice-First** — el agricultor HABLA y escucha respuestas en español |
| **Hardware** | App nativa pesada | **PWA ultra-liviana** — funciona en Moto E30, Android Go, 1GB RAM |
| **Sin internet** | No funciona | **Offline-first** — diagnósticos cacheados, service worker avanzado |
| **WhatsApp** | Solo empresas | **Chatbot WhatsApp** — manda foto, recibe diagnóstico sin abrir la app |
| **Mercado** | Global genérico | **Hiper-local** — cultivos peruanos, plagas locales, pisos altitudinales |
| **Precio** | $20-200/mes | **Gratis** (básico) + **$5-15/mes** (premium) |

### Las 5 diferencias clave

1. **Voice-First**: "Agrilux, mis hojas están amarillas, ¿qué hago?" → Responde por voz con recomendaciones concretas
2. **WhatsApp Bot**: El agricultor manda foto por WhatsApp → recibe diagnóstico IA sin abrir la app
3. **Offline**: En zonas sin señal, la app funciona con datos cacheados
4. **Hiper-local**: Conoce la polilla guatemalteca, el tizón tardío de la papa, la altitud de Cusco
5. **Low-end phones**: PWA que funciona en celulares de $50-100

---

## APIs implementadas

### 1. Análisis de imágenes con IA — `api/analizar-imagen.js`

**Qué hace:** Recibe una imagen (foto de una planta) y un prompt, y devuelve el análisis de IA.

**Cadena de proveedores (orden por calidad):**

| Prioridad | Proveedor | Modelo | Tipo | Costo | Soporte imágenes |
|-----------|-----------|--------|------|-------|-----------------|
| 1 | OpenRouter | `google/gemini-2.5-flash-preview` | Texto + Vision | $0.15/M tokens | Sí |
| 2 | DeepSeek | `deepseek-chat` | Solo texto | $0.14/M tokens | No |
| 3 | GitHub Models | `Phi-4-multimodal-instruct` | Texto + Vision | Gratis (1500 req/día) | Sí |

**Implementación:**
- POST a `/api/analizar-imagen` con `{ images: [base64], prompt, systemPrompt }`
- Si hay imágenes → intenta OpenRouter primero, luego DeepSeek (sin imagen), luego GitHub Phi-4
- Si es solo texto → misma cadena pero DeepSeek sí puede responder
- Retorna: `{ choices: [{ message: { content } }], modelo_usado }`
- Headers: `HTTP-Referer` y `X-Title` requeridos por OpenRouter

**Variables de entorno:** `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`, `GITHUB_TOKEN`

---

### 2. Clima — `api/weather.js`

**Qué hace:** Obtiene el pronóstico del tiempo para una coordenada GPS.

**Proveedores (cascada):**

| Prioridad | Proveedor | Costo | Datos |
|-----------|-----------|-------|-------|
| 1 | OpenWeatherMap | Requiere API key | Actual + 7 días, hora por hora |
| 2 | Open-Meteo | Gratis (sin key) | Actual + 7 días, diario |

**Implementación:**
- GET `/api/weather?lat=X&lon=Y&label=nombre`
- Si no hay lat/lon → geocodifica con Nominatim (OpenStreetMap)
- Si `OPENWEATHER_API_KEY` existe → usa OpenWeatherMap OneCall API
- Si no → usa Open-Meteo (fallback gratuito)
- Retorna: `{ source, location, current, daily, timezone }`
- Datos útiles: temperatura, humedad, precipitación, viento, código de clima

**Variables de entorno:** `OPENWEATHER_API_KEY` (opcional, Open-Meteo funciona sin key)

---

### 3. Suelo + NASA FIRMS — `api/soil-nasa.js`

**Qué hace:** Proxy combinado con dos acciones:

#### 3a. Datos de suelo — `?action=soil`
**Proveedor:** SoilGrids (ISRIC) — 100% gratuito, sin API key, resolución 250m

**Implementación:**
- GET `/api/soil-nasa?action=soil&lat=X&lon=Y`
- Consulta propiedades: pH, carbono orgánico (SOC), arcilla, arena, limo, nitrógeno
- Profundidad: 0-5cm (capa superficial)
- Incluye interpretación automática:
  - pH < 4.5 = "Muy ácido → Encalar urgente"
  - pH 6.5-7.5 = "Neutro → Óptimo para palta"
  - SOC < 1% = "Muy bajo → Aplicar materia orgánica urgente"
- Retorna: `{ source, suelo: { ph, carbono_organico, textura, nitrogeno }, resumen_agronómico }`

#### 3b. Alertas NASA — `?action=nasa`
**Proveedor:** NASA FIRMS (Fire Information for Resource Management System)

**Implementación:**
- GET `/api/soil-nasa?action=nasa&lat=X&lon=Y`
- Sensor: VIIRS SNPP (resolución 375m)
- Busca puntos de calor en radio de ~11km (bbox ±0.1°) en últimos 3 días
- Retorna: `{ incendios_activos, alerta, riesgo: 'ninguno'|'moderado'|'alto', mapa_url }`

**Variables de entorno:** `NASA_EARTHDATA_KEY` (gratis en earthdata.nasa.gov)

---

### 4. Imagen satelital NDVI — `api/sentinel.js`

**Qué hace:** Analiza la salud de la vegetación usando imágenes satelitales y calcula el índice NDVI.

**Métodos (cascada, sin autenticación obligatoria):**

| Prioridad | Método | Requiere | Calidad |
|-----------|--------|----------|---------|
| 1 | Sentinel Hub WMS | `SENTINEL_INSTANCE_ID` (opcional) | Imagen real + NDVI |
| 2 | Mapbox Satellite | `VITE_MAPBOX_TOKEN` (ya configurado) | Imagen real + NDVI estimado |
| 3 | Solo análisis | Nada | NDVI estimado por ubicación |

**Implementación:**
- GET `/api/sentinel?lat=X&lon=Y&radius=2`
- **Sin Sentinel Hub:** Usa Mapbox satellite como imagen base + NDVI estimado por ubicación y época del año
- **Con Sentinel Hub WMS:** Usa instance ID para obtener imagen real Sentinel-2 vía WMS (sin OAuth)
- Análisis NDVI estima salud basado en: latitud, época del año, temporada de lluvias
- Retorna: `{ satellite_image, ndvi_promedio, nivel_salud, color, recomendacion, legend }`
- Niveles: Saludable (>0.5), Moderado (0.3-0.5), Estrés (0.1-0.3), Crítico (<0.1)

**Variables de entorno:** `SENTINEL_INSTANCE_ID` (opcional), `VITE_MAPBOX_TOKEN` (ya configurado)

---

### 5. Identificación de enfermedades — `api/plant-disease.js`

**Qué hace:** Identifica enfermedades y plagas en cultivos a partir de fotos.

**Cadena de proveedores:**

| Prioridad | Proveedor | Costo | Especialidad |
|-----------|-----------|-------|-------------|
| 1 | Crop.health (Kindwise) | Requiere API key | Cultivos comerciales, base EPPO |
| 2 | Plant.id v2 | Requiere API key | Generalista, buena precisión |
| 3 | HuggingFace | Gratis (1500 req/día) | Modelo open-source |

**Implementación:**
- POST `/api/plant-disease` con `{ images: [base64] }`
- Crop.health retorna: nombre de enfermedad, causa, severidad, tratamiento químico, tratamiento biológico, prevención, imágenes similares
- Plant.id retorna: nombre común, descripción, estado de salud
- HuggingFace retorna: clasificación del modelo `vasudevgupta/plant-disease-classification`
- Normaliza todas las respuestas al mismo formato que usa `Diagnostico.jsx`
- Si no hay ningún proveedor configurado → retorna 204 (sin contenido)

**Variables de entorno:** `CROP_HEALTH_API_KEY`, `PLANT_ID_API_KEY`, `HUGGINGFACE_API_KEY`

---

### 6. Geocodificación — `api/geocode.js`

**Qué hace:** Convierte nombres de lugares a coordenadas GPS y viceversa.

**Proveedor:** Nominatim (OpenStreetMap) — 100% gratuito, sin API key

**Implementación:**
- **Forward geocode:** GET `/api/geocode?q=nombre+del+lugar` → `{ lat, lon, name, address }`
- **Reverse geocode:** GET `/api/geocode?lat=X&lon=Y` → `{ name, lat, lon, address }`
- Idioma: español (`accept-language=es`)
- User-Agent: `Agrilux/1.0`

**Variables de entorno:** Ninguna

---

### 7. Recomendaciones del ciclo del cultivo — `api/ciclo-recomendaciones.js`

**Qué hace:** Genera recomendaciones agronómicas personalizadas para la etapa actual del cultivo, combinando datos de clima, suelo y fase fenológica.

**Cadena de proveedores (solo texto):**

| Prioridad | Proveedor | Costo |
|-----------|-----------|-------|
| 1 | OpenRouter Gemini 2.5 Flash | $0.15/M tokens |
| 2 | DeepSeek Chat | $0.14/M tokens |
| 3 | GitHub Phi-4 | Gratis |

**Implementación:**
- POST `/api/ciclo-recomendaciones` con:
  ```json
  {
    "cultivo": "Papa",
    "etapa": "Tuberización",
    "diasDesdeSiembra": 85,
    "variedad": "Yungay",
    "lat": -13.5, "lon": -72.0,
    "clima": { "temperature": 18, "humidity": 65, ... },
    "suelo": { "ph": 5.8, "organic_matter": 2.5, ... },
    "registros": [{ "fecha": "...", "recomendacion": "..." }]
  }
  ```
- Prompt del sistema: "Eres un agrónomo experto de la sierra del Perú..."
- Recomendaciones incluyen: tareas prioritarias, fertilización, riego, plagas por etapa, próximo paso
- Retorna: `{ recomendaciones, modelo_usado }`

**Variables de entorno:** `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`, `GITHUB_TOKEN`

---

### 8. AgroMonitoring — `api/agromonitoring.js`

**Qué hace:** Proxy para AgroMonitoring (clima agrícola) y Nominatim (geocodificación).

**Implementación:**
- `?action=geocode&q=nombre` → geocodificación vía Nominatim
- `?action=weather&lat=X&lon=Y` → clima actual vía AgroMonitoring API
- Requiere `AGROMONITORING_API_KEY` (acepta también `OPENWEATHER_API_KEY`)

**Variables de entorno:** `AGROMONITORING_API_KEY`

---

### 9. Crop.health — `api/crop-health.js`

**Qué hace:** Proxy dedicado para Crop.health de Kindwise, especializado en enfermedades de cultivos comerciales (papa, palta, arándano).

**Implementación:**
- POST `/api/crop-health` con `{ images: [base64] }`
- Retorna: nombre de enfermedad, causa, severidad, tratamiento químico, tratamiento biológico, prevención, imágenes similares
- Normaliza la respuesta al mismo formato que Plant.id

**Variables de entorno:** `CROP_HEALTH_API_KEY` (gratis en crop.kindwise.com)

---

### 10. WhatsApp Bot — `api/whatsapp-webhook.js`

**Qué hace:** Recibe mensajes de WhatsApp (texto + fotos) y responde con diagnóstico agronómico IA.

**Proveedor:** Meta WhatsApp Cloud API (gratis para 1000 mensajes/mes)

**Implementación:**
- GET `/api/whatsapp-webhook` → Verificación del webhook (Meta lo solicita)
- POST `/api/whatsapp-webhook` → Recibe mensajes y responde
- Flujo: Agricultor manda foto por WhatsApp → Agrilux descarga la imagen → Analiza con OpenRouter/DeepSeek → Responde diagnóstico
- Responde en español peruano, tono cercano
- Incluye: qué tiene la planta, qué hacer, qué productos aplicar
- Si no hay imagen: responde como agrónomo experto por texto

**Configuración:**
1. Crear app en https://developers.facebook.com
2. Activar producto WhatsApp
3. Configurar webhook URL: `https://tudominio.com/api/whatsapp-webhook`
4. Subscribe a eventos: `messages`, `message_media`

**Variables de entorno:** `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN`

---

## Variables de entorno

### Requeridas (mínimo funcional)
| Variable | Descripción | Gratis |
|----------|-------------|--------|
| `VITE_FIREBASE_*` | Configuración de Firebase (auth + Firestore) | Sí (plan Spark) |
| `VITE_ADMIN_KEY` | Clave de administrador | Sí |

### APIs de IA (al menos una necesaria)
| Variable | Proveedor | Costo |
|----------|-----------|-------|
| `OPENROUTER_API_KEY` | OpenRouter (recomendado) | $0.15/M tokens |
| `DEEPSEEK_API_KEY` | DeepSeek | $0.14/M tokens |
| `GITHUB_TOKEN` | GitHub Models | Gratis (1500 req/día) |

### APIs de datos (opcionales, mejoran experiencia)
| Variable | Proveedor | Costo |
|----------|-----------|-------|
| `OPENWEATHER_API_KEY` | OpenWeatherMap | Gratis tier (1000 req/día) |
| `NASA_EARTHDATA_KEY` | NASA FIRMS | Gratis |
| `SENTINEL_INSTANCE_ID` | Sentinel Hub (ESA) | Gratis (30K unidades/mes) | Sí |
| `CROP_HEALTH_API_KEY` | Kindwise Crop.health | Gratis tier |
| `PLANT_ID_API_KEY` | Plant.id | Gratis tier |
| `HUGGINGFACE_API_KEY` | HuggingFace | Gratis (1500 req/día) |
| `AGROMONITORING_API_KEY` | AgroMonitoring | Gratis tier |
| `VITE_MAPBOX_TOKEN` | Mapbox | Gratis (50K req/mes) | Sí (ya configurado) |

### WhatsApp Bot (opcional)
| Variable | Descripción | Costo |
|----------|-------------|-------|
| `WHATSAPP_TOKEN` | Token de Meta Business | Gratis (1000 msg/mes) |
| `WHATSAPP_PHONE_ID` | ID del número Business | Gratis |
| `WHATSAPP_VERIFY_TOKEN` | Token de verificación del webhook | Gratis |

---

## Estructura del proyecto

```
agrilux/
├── api/                          # Serverless functions (Vercel)
│   ├── analizar-imagen.js        # IA: análisis de fotos (OpenRouter → DeepSeek → GitHub)
│   ├── ciclo-recomendaciones.js  # IA: recomendaciones por etapa del cultivo
│   ├── weather.js                # Clima (OpenWeatherMap → Open-Meteo)
│   ├── soil-nasa.js              # Suelo (SoilGrids) + alertas NASA FIRMS
│   ├── sentinel.js               # Imagen satelital NDVI (sin auth)
│   ├── plant-disease.js          # Enfermedades (Crop.health → Plant.id → HuggingFace)
│   ├── geocode.js                # Geocodificación (Nominatim)
│   ├── crop-health.js            # Crop.health proxy dedicado
│   ├── agromonitoring.js         # AgroMonitoring proxy
│   ├── whatsapp-webhook.js       # WhatsApp Bot: diagnóstico por WhatsApp
│   └── gemini.js                 # Legacy (redirige a analizar-imagen)
├── src/
│   ├── components/
│   │   ├── Layout.jsx            # Navegación inferior + menú
│   │   ├── TimelineEtapa.jsx     # Timeline visual del ciclo del cultivo
│   │   ├── SelectorUbicacion.jsx # Selector GPS/voz/texto
│   │   ├── VoiceAssistant.jsx    # Botón flotante de voz (voice-first)
│   │   ├── Marketing.jsx         # Hashtag monitor + templates
│   │   └── FacebookBot.jsx       # Meta Graph API posting
│   ├── pages/
│   │   ├── Diagnostico.jsx       # Diagnóstico de plagas con IA + voz
│   │   ├── CicloCultivo.jsx      # Calendario del ciclo + recomendaciones
│   │   ├── MiParcela.jsx         # Gestión de parcelas + monitoreo
│   │   ├── Home.jsx              # Dashboard con módulos
│   │   ├── Admin.jsx             # Panel administrativo
│   │   ├── Registro.jsx          # Login/registro
│   │   ├── Comunidad.jsx         # Foro de la comunidad
│   │   └── diagnostico/
│   │       └── diagnosticoPrompts.js  # Prompts del sistema de IA
│   ├── lib/
│   │   ├── AuthContext.jsx       # Autenticación Firebase
│   │   ├── firebase.js           # Config Firebase
│   │   ├── constants.js          # Cultivos + datos del ciclo fenológico
│   │   ├── externalApis.js       # Cliente para todas las APIs
│   │   ├── gemini.js             # Wrapper de invokeGemini()
│   │   └── ...
│   └── App.jsx                   # Rutas
├── public/
│   └── sw.js                     # Service Worker v2.0 (offline-first)
├── vercel.json                   # Reescrituras SPA
├── vite.config.js                # Vite + PWA
└── package.json
```

---

## Cultivos soportados

| Cultivo | Categoría | Etapas del ciclo | Días totales |
|---------|-----------|------------------|--------------|
| 🥔 Papa | Básico | Siembra → Germinación → Crecimiento → Floración → Tuberización → Cosecha | 120–150 |
| 🌽 Maíz | Básico | Siembra → Germinación → Crecimiento → Floración → Fructificación → Cosecha | 90–120 |
| 🥑 Palta | Frutal | Siembra → Crecimiento → Floración → Fructificación → Cosecha | 300–365 |
| 🫐 Arándano | Frutal | Siembra → Crecimiento → Floración → Fructificación → Cosecha | 200–240 |
| 🎋 Caña de azúcar | Industrial | Siembra → Crecimiento → Maduración → Cosecha | 300–365 |
| 🍌 Plátano | Frutal | Siembra → Crecimiento → Floración → Fructificación → Cosecha | 330–365 |
| 🍈 Papaya | Frutal | Siembra → Crecimiento → Floración → Fructificación → Cosecha | 180–210 |

---

## Flujo del agricultor

```
1. Sin login → Diagnóstico IA (sube foto, identifica plaga)
2. Login → Mi Parcela (registra parcela con cultivo, fecha de siembra, GPS)
3. Ciclo del Cultivo → Timeline visual con etapa actual + recomendaciones IA
4. Monitoreo → Fotos periódicas, la IA compara con etapa esperada
5. Alertas → Clima, suelo, NASA FIRMS, NDVI satelital
```

---

## Despliegue

1. Clonar repositorio
2. Configurar variables de entorno en Vercel
3. `npm install && npm run build`
4. Vercel despliega automáticamente desde el repo

---

## Licencia

Proyecto privado — Aynitek Group
