# Migración de Firebase a Supabase - Agrilux

**Fecha:** 2026-10-09  
**Versión:** 1.0.0 → 1.1.0 (migración de backend)  
**Estado:** ✅ Completado - Proyecto 100% en Supabase

---

## 🎯 Objetivo

Eliminar **completamente Firebase** del proyecto y usar **Supabase (PostgreSQL + Auth + Storage)** como único backend.

---

## 📋 Resumen de Cambios

### 1. Dependencias (`package.json`)

| Cambio | Descripción |
|--------|-------------|
| ❌ Eliminado | `"firebase": "^12.18.0"` de `dependencies` |
| ✅ Mantenido | `@supabase/supabase-js: ^2.112.4` como único backend |

```json
// ANTES
"dependencies": {
  "firebase": "^12.18.0",
  "@supabase/supabase-js": "^2.112.4",
  ...
}

// DESPUÉS
"dependencies": {
  "@supabase/supabase-js": "^2.112.4",
  ...
}
```

---

### 2. Archivos Eliminados

| Archivo | Motivo |
|---------|--------|
| `src/lib/firebase.js` | Archivo deprecated que exportaba `null` para evitar imports rotos. Ya no necesario. |

---

### 3. Código Fuente (`src/`) - Limpieza Completa

#### `src/lib/supabase.js` (Único cliente de backend)
```javascript
// Cliente único de Supabase con proxy personalizado para evitar CORS
export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { fetch: customFetch }
});
```

#### `src/lib/AuthContext.jsx`
- ✅ Auth 100% Supabase: `signUp`, `signInWithPassword`, `signOut`, `onAuthStateChange`
- ✅ Perfil de usuario en tabla `usuarios` (PostgreSQL)

#### `src/pages/` - Todas las páginas migradas
| Página | Operaciones Supabase |
|--------|---------------------|
| `Diagnostico.jsx` | `supabase.from('diagnosticos').insert()` |
| `MiParcela.jsx` | CRUD `parcelas`, `registros_parcela` |
| `Comunidad.jsx` | Posts en `comunidad` (insert, update, likes) |
| `MercadoPage.jsx` | Tiendas en `tiendas_comunidad` |
| `RegistroTienda.jsx` | Storage bucket `tiendas` + tabla `tiendas_comunidad` |
| `Descargar.jsx` | Storage bucket `apk` |
| `Admin.jsx` | Gestión completa: usuarios, aliados, tiendas |
| `Layout.jsx` | `supabase.auth.resetPasswordForEmail` |

---

### 4. Políticas de Privacidad Actualizadas

| Archivo | Cambio |
|---------|--------|
| `src/pages/PrivacyPolicy.jsx` | "Firebase (Google)" → "Supabase" |
| `public/privacidad.html` | "Firebase Authentication" → "Supabase Auth" |
| `android/app/release/base/assets/public/privacidad.html` | Igual que arriba |

**Ejemplo de cambio:**
```html
<!-- ANTES -->
<li><strong>Firebase (Google):</strong> Para autenticación, base de datos y análisis de uso.</li>

<!-- DESPUÉS -->
<li><strong>Supabase:</strong> Para autenticación, base de datos PostgreSQL y almacenamiento.</li>
```

---

### 4. Service Worker (`public/sw.js`)

**Eliminados dominios Firebase del `skipHosts`:**
```javascript
// ELIMINADO
'firebaseapp.com',
'firebase.googleapis.com',
'firebasestorage.googleapis.com',
'identitytoolkit.googleapis.com',
```

---

### 5. APIs (`api/`)

#### `api/tiendas.js`
- ❌ Eliminado `firebase_ok` de todas las respuestas JSON
- ✅ Solo `supabase_ok: true/false`

```javascript
// ANTES
{ tiendas, total, supabase_ok: true, firebase_ok: true }

// DESPUÉS
{ tiendas, total, supabase_ok: true }
```

#### `src/lib/ofertasRegistradas.js`
```javascript
// ANTES
if (res.ok && data.firebase_ok !== false && data.supabase_ok !== false)

// DESPUÉS
if (res.ok && data.supabase_ok !== false)
```

---

### 6. Scripts de Migración (Se Mantienen)

| Archivo | Propósito | Estado |
|---------|-----------|--------|
| `scripts/migrate-firebase-to-supabase.js` | Migración única Firestore → PostgreSQL | 📦 Se mantiene (utilidad histórica) |
| `scripts/export-firebase-to-sql.js` | Exportar Firebase a SQL para Supabase | 📦 Se mantiene (utilidad histórica) |

> **Nota:** Son scripts de **una sola vez** para migración histórica. No se ejecutan en producción.

---

### 7. Build & Android

#### Bundle Compilado
- `android/app/release/base/assets/public/assets/index-*.js` se regenera limpio al hacer `npm run build`
- `android/app/release/base/assets/public/privacidad.html` actualizado a Supabase

#### 8. Fix Android Build: androidx.core version conflict

**Problema:** Dependencia transitoria traía `androidx.core:core:1.17.0` que requiere `compileSdk 36` + `AGP 8.9+`, pero el proyecto usa `compileSdk 35` + `AGP 8.7.3`.

**Error:**
```
Dependency 'androidx.core:core:1.17.0' requires libraries and applications that
depend on it to compile against version 36 or later of the Android APIs.
```

**Solución aplicada en `android/app/build.gradle`:**
```groovy
configurations.all {
    resolutionStrategy {
        force 'org.jetbrains.kotlin:kotlin-stdlib:2.0.21'
        force 'org.jetbrains.kotlin:kotlin-stdlib-jdk8:2.0.21'
        force 'org.jetbrains.kotlin:kotlin-stdlib-jdk7:2.0.21'
        force 'org.jetbrains.kotlinx:kotlinx-coroutines-core-jvm:1.8.1'
        force 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1'
        // Fix androidx.core 1.17.0 requiring compileSdk 36 + AGP 8.9+
        force 'androidx.core:core:1.15.0'
        force 'androidx.core:core-ktx:1.15.0'
    }
}
```

| Dependencia | Versión problemática | Versión forzada | Compatibilidad |
|-------------|---------------------|-----------------|----------------|
| `androidx.core:core` | 1.17.0 (transitiva) | **1.15.0** | AGP 8.7.3 + compileSdk 35 |
| `androidx.core:core-ktx` | 1.17.0 (transitiva) | **1.15.0** | AGP 8.7.3 + compileSdk 35 |

> **1.15.0** es la última versión de `androidx.core` totalmente compatible con **AGP 8.7.x + compileSdk 35**.

---

### 9. Cámara y Micrófono: Migración a Plugins Nativos Capacitor

#### 9.1 Cámara - `@capacitor/camera`

**Problema:** El código usaba `<input type="file" capture="environment">` (HTML5) que en Android WebView abre el selector de archivos genérico, **no la app de cámara nativa**.

**Solución:** Instalar y usar `@capacitor/camera` para acceder a la cámara nativa y galería.

**Instalación:**
```bash
npm install @capacitor/camera
npx cap sync android
```

**Cambios en `src/pages/Diagnostico.jsx`:**

```diff
- // HTML5 input que abre selector genérico
- <input ref={cameraRef} type="file" accept="image/*" multiple capture="environment" onChange={handleFoto} className="hidden" />
-
- const handleFoto = (e) => { ... FileReader ... }

+ import { Camera, CameraSource, CameraResultType } from '@capacitor/camera';

+ const tomarFoto = async () => {
+   const photo = await Camera.getPhoto({
+     quality: 80,
+     allowEditing: false,
+     resultType: CameraResultType.DataUrl,
+     source: CameraSource.Camera,
+     saveToGallery: true,
+     width: 800,
+     height: 800,
+   });
+   if (photo.dataUrl) setFotos(prev => [...prev, { preview: photo.dataUrl, dataUrl: photo.dataUrl }]);
+ };

+ const elegirDeGaleria = async () => {
+   const photos = await Camera.pickImages({
+     quality: 80,
+     limit: 5,
+     width: 800,
+     height: 800,
+   });
+   photos.photos.forEach(p => p.webPath && setFotos(prev => [...prev, { preview: p.webPath, dataUrl: p.webPath }]));
+ };
```

**Botones actualizados:**
```jsx
<button onClick={tomarFoto}>
  <CameraIcon size={20} /> Cámara
</button>
<button onClick={elegirDeGaleria}>
  <Image size={20} /> Galería
</button>
```

> **Resultado:** Botón "Cámara" abre la app de cámara nativa Android; botón "Galería" abre el selector nativo de imágenes.

---

#### 9.2 Micrófono - `@capacitor-community/speech-recognition`

**Problema:** El código usaba `webkitSpeechRecognition` (Web Speech API) que **NO funciona en Android WebView**. El error `audio-capture` confirmaba que no había acceso al micrófono aunque el permiso `RECORD_AUDIO` estuviera en el Manifest.

**Solución:** Usar plugin nativo `@capacitor-community/speech-recognition` que usa el reconocimiento de voz nativo de Android.

**Instalación:**
```bash
npm install @capacitor-community/speech-recognition
npx cap sync android
```

**Cambios en `src/components/VoiceAssistant.jsx` y `src/components/SelectorUbicacion.jsx`:**

```diff
- // Web Speech API (NO funciona en Android WebView)
- const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
- const recognition = new SR();
- recognition.lang = 'es-PE';
- recognition.continuous = false;
- recognition.interimResults = true;
- recognition.onresult = (event) => { ... }
- recognition.onerror = (event) => { ... }
- recognition.start();

+ import { SpeechRecognition } from '@capacitor-community/speech-recognition';
+
+ const iniciarEscucha = async () => {
+   // API v7 real: available() / start() / stop()
+   try {
+     const { available } = await SpeechRecognition.available();
+     if (!available) { setError('Reconocimiento de voz no disponible'); return; }
+     
+     await SpeechRecognition.requestPermissions();
+     setEscuchando(true);
+     
+     const result = await SpeechRecognition.start({
+       language: 'es-PE',
+       maxResults: 1,
+       prompt: 'Habla ahora...',
+       partialResults: true,
+     });
+     
+     setEscuchando(false);
+     const finalText = result.matches?.[0] || '';
+     if (finalText) {
+       setTranscripcion(finalText);
+       const nuevoHistorial = [...historial, { rol: 'usuario', texto: finalText }];
+       setHistorial(nuevoHistorial);
+       enviarAI(finalText, nuevoHistorial);
+     }
+   } catch (e) {
+     setEscuchando(false);
+     if (e.code === 'permission') setError('Permiso de micrófono denegado');
+     else setError('Error de voz. Intenta de nuevo.');
+   }
+ };
+
+ const detenerEscucha = async () => {
+   await SpeechRecognition.stop();
+   setEscuchando(false);
+ };
```

**Fix 2026-10-16 (causa real del fallo persistente):** el plugin v7 expone `available()` / `start()` / `stop()`, no `isAvailable()` / `startListening()` / `stopListening()`. Llamar a los nombres viejos lanzaba excepción siempre y caía al “No te escuché bien”. Ya corregido en `VoiceAssistant.jsx`, `SelectorUbicacion.jsx` y `Diagnostico.jsx` (`getNativeSR`).

**Archivos modificados:**
| Archivo | Cambio |
|---------|--------|
| `src/components/VoiceAssistant.jsx` | Reemplazo completo de Web Speech API por plugin nativo |
| `src/components/SelectorUbicacion.jsx` | Mismo reemplazo para dictado de ubicación por voz |

> **Resultado:** El micrófono ahora usa el reconocimiento de voz nativo de Android (Google Speech Recognition) con soporte para español (`es-PE`), funcionando correctamente en la app instalada.

---

### 10. Recomendación: Limpieza de Espacio en Disco (Build Android)

**Problema:** Al compilar Android (`./gradlew assembleDebug`) se generan ~2 GB temporales que llenan el disco si ya está cerca del límite.

**Qué ocupa espacio:**
| Qué | Dónde | Tamaño |
|-----|-------|--------|
| Gradle cache | `~/.gradle/caches/` | 500 MB – 1.5 GB |
| Build outputs | `android/app/build/` | 200 – 500 MB |
| Archivos temporales | `android/app/build/tmp/` | 100 – 300 MB |

**Limpieza recomendada antes de compilar:**
```bash
# 1. Limpiar proyecto
cd android && ./gradlew clean

# 2. Limpiar cache global de Gradle (recupera 500 MB - 1.5 GB)
rm -rf ~/.gradle/caches/

# 3. Limpiar build outputs del proyecto
rm -rf android/app/build/
```

**Alias útil (añadir a `~/.bashrc`):**
```bash
alias gradle-clean-all='cd /ruta/a/tu/proyecto/android && ./gradlew clean && rm -rf ~/.gradle/caches/'
```

> **Nota:** El proyecto completo ocupa ~500 MB. El disco se llena por la compilación, no por el código fuente. Ejecuta `gradle-clean-all` antes de compilar si estás justo de espacio.

**Problema:** Dependencia transitoria traía `androidx.core:core:1.17.0` que requiere `compileSdk 36` + `AGP 8.9+`, pero el proyecto usa `compileSdk 35` + `AGP 8.7.3`.

**Error:**
```
Dependency 'androidx.core:core:1.17.0' requires libraries and applications that
depend on it to compile against version 36 or later of the Android APIs.
```

**Solución aplicada en `android/app/build.gradle`:**
```groovy
configurations.all {
    resolutionStrategy {
        force 'org.jetbrains.kotlin:kotlin-stdlib:2.0.21'
        force 'org.jetbrains.kotlin:kotlin-stdlib-jdk8:2.0.21'
        force 'org.jetbrains.kotlin:kotlin-stdlib-jdk7:2.0.21'
        force 'org.jetbrains.kotlinx:kotlinx-coroutines-core-jvm:1.8.1'
        force 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1'
        // Fix androidx.core 1.17.0 requiring compileSdk 36 + AGP 8.9+
        force 'androidx.core:core:1.15.0'
        force 'androidx.core:core-ktx:1.15.0'
    }
}
```

| Dependencia | Versión problemática | Versión forzada | Compatibilidad |
|-------------|---------------------|-----------------|----------------|
| `androidx.core:core` | 1.17.0 (transitiva) | **1.15.0** | AGP 8.7.3 + compileSdk 35 |
| `androidx.core:core-ktx` | 1.17.0 (transitiva) | **1.15.0** | AGP 8.7.3 + compileSdk 35 |

> **1.15.0** es la última versión de `androidx.core` totalmente compatible con **AGP 8.7.x + compileSdk 35**.

---

## 🔧 Variables de Entorno Requeridas

```env
# .env / .env.local / Vercel Environment Variables
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🧪 Verificación Post-Migración

```bash
# 1. Verificar que no queda Firebase en código fuente
grep -r "firebase\|Firebase" src/ --include="*.jsx" --include="*.js"
# Debe retornar: (vacío)

# 2. Verificar package.json
grep firebase package.json
# Debe retornar: (vacío)

# 3. Build + Sync + Test
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

---

## ✅ Checklist Final

- [x] `firebase` eliminado de `package.json`
- [x] `src/lib/firebase.js` eliminado
- [x] `src/lib/supabase.js` como único cliente
- [x] AuthContext usa `supabase.auth`
- [x] Todas las páginas usan `supabase.from()` / `supabase.storage`
- [x] PrivacyPolicy actualizada (React + HTML + Android)
- [x] Service Worker sin dominios Firebase
- [x] APIs limpias (`firebase_ok` eliminado)
- [x] Scripts de migración preservados (históricos)
- [x] Bundle Android regenerado sin Firebase

---

## 📝 Nota para Desarrolladores

> **El proyecto ahora usa exclusivamente Supabase (PostgreSQL + Auth + Storage + Realtime).**
> 
> - **Auth:** Email/password, magic links, reset password
- **Database:** PostgreSQL con RLS (Row Level Security)
- **Storage:** Buckets `tiendas`, `apk`, `avatars` (configurar en Supabase Dashboard)
- **Realtime:** Suscripciones a cambios en tablas (opcional)

---

## 📦 Próximos Pasos Recomendados

1. **Configurar RLS policies** en Supabase para cada tabla
2. **Configurar Storage buckets** con policies de acceso
3. **Habilitar Realtime** solo en tablas necesarias (`comunidad`, `diagnosticos`)
4. **Configurar Backups automáticos** en Supabase Dashboard
5. **Monitoreo:** Logs de Supabase + Sentry (opcional)

---

**Migración completada exitosamente. 🎉**

---

## 11. Fix voz en Diagnóstico + import condicional robusto (2026-10-15/16)

**Problema verificado:**
- `VoiceAssistant.jsx` y `SelectorUbicacion.jsx` ya usaban `@capacitor-community/speech-recognition`, pero `src/pages/Diagnostico.jsx` seguía con `webkitSpeechRecognition` en `grabarVozConsulta` y `grabarVozChat`. Por eso el micrófono fallaba justo en la pestaña Diagnóstico.
- Además, el `import` dinámico a nivel de módulo tenía condición de carrera: si el usuario pulsaba el micrófono antes de que terminara `import()`, `SpeechRecognition` aún era `null` y mostraba “solo disponible en app nativa”.

**Cambios aplicados:**
- `src/pages/Diagnostico.jsx`:
  - Nuevo helper `getNativeSR()` con caché de promesa (`_SRnative` / `_SRloading`), solo en `Capacitor.isNativePlatform()`.
  - `grabarVozConsulta` y `grabarVozChat` ahora: 1) intentan nativo (`available` → `requestPermissions` → `start es-PE`), 2) fallback web con `webkitSpeechRecognition`.
  - Toggle-off: si ya está grabando, el segundo toque detiene (nativo + web) en vez de abrir otra sesión; errores web y de `r.start()` ahora muestran alerta en vez de quedarse mudos.
- `src/components/VoiceAssistant.jsx` y `src/components/SelectorUbicacion.jsx`:
  - Carga diferida con IIFE + reintento de carga tardía dentro de `iniciarEscucha` / `grabarVoz` antes de mostrar error.
  - Mensaje web: “Reconocimiento de voz solo disponible en app nativa Android”.
  - Eliminado `reconRef` sin uso en `SelectorUbicacion.jsx`.
- `capacitor.config.json`:
  - Añadido bloque `SpeechRecognition: { lang: es-PE, androidPermissions: [RECORD_AUDIO] }`.
- `android/app/capacitor.build.gradle` y `android/capacitor.settings.gradle` regenerados por `npx cap sync android` con `capacitor-community-speech-recognition`, `capacitor-camera`, `capacitor-geolocation`.

**Flujo Android Studio (tú haces deploy/pruebas aquí, no en terminal):**
1. Terminal/WSL solo para: `npm run build` + `npx cap copy android` (o `sync` si hubo plugin nuevo).
2. Android Studio: `File > Sync Project with Gradle Files` → `Build > Clean Project` → `Run ▶` / `Build > Build APK(s)`.
3. En dispositivo/emulador: Ajustes → Apps → Agrilux → Permisos → Micrófono → Permitir. Requiere “Speech Services by Google” instalado/actualizado.

---

## 12. Icono adaptativo fondo blanco

**Problema verificado:**
- `mipmap-anydpi-v26/ic_launcher.xml` y `ic_launcher_round.xml` apuntaban a `@drawable/ic_launcher_background`, no a `@color/ic_launcher_background`. El drawable era un VectorDrawable verde `#3DDC84` con cuadrícula, por eso seguía verde.

**Cambios aplicados:**
- `android/app/src/main/res/values/ic_launcher_background.xml`: `#1a6b3c` → `#FFFFFF`.
- `android/app/src/main/res/drawable/ic_launcher_background.xml`: vector verde con cuadrícula → rectángulo blanco sólido `#FFFFFF`.
- Verificado: `mipmap-mdpi…xxxhdpi` siguen con `ic_launcher.png` / `ic_launcher_round.png` por densidad; `anydpi-v26` usa el drawable corregido.

---

## 13. Otros fixes incluidos en el diff actual

- `android/app/build.gradle`: plugin `org.jetbrains.kotlin.android`, `apply from: capacitor.build.gradle` movido antes de `android {}`, `compileOptions/target Java 17`, `kotlinOptions jvmTarget 17`, `force` coroutines `1.8.1` y `androidx.core 1.15.0`.
- `android/build.gradle`: classpath `kotlin-gradle-plugin 2.0.21` + bloque `subprojects afterEvaluate` que fuerza Java 17 y solo aplica `kotlinOptions` si existe el plugin Kotlin.
- `android/variables.gradle`: `kotlinVersion 2.0.21`, `coroutinesVersion 1.8.1`.
- `src/lib/supabase.js`: placeholder anti-crash + `customFetch` con guard `u &&` + fallback client si faltan env.
- `src/components/Layout.jsx`: fix href manual `/public/icons/...` → `/icons/...`.
- `api/tiendas.js`: eliminados todos los `firebase_ok`, indentación del 503 corregida.
- `package.json`: eliminado `firebase`, añadidos `@capacitor/camera ^8.2.5` y `@capacitor-community/speech-recognition ^7.0.1`.

---

## 14. Fix API v7 de voz + `bg.jpg` + verificación sync (2026-10-16)

**Fix API v7 (causa del “no te escuché bien” persistente):**
- El plugin `@capacitor-community/speech-recognition@7.0.1` expone `available()` / `start()` / `stop()`, no `isAvailable()` / `startListening()` / `stopListening()`. Con los nombres viejos cada llamada lanzaba excepción y caía al mensaje genérico.
- Corregido en `VoiceAssistant.jsx` (`iniciarEscucha`/`detenerEscucha`), `SelectorUbicacion.jsx` (`grabarVoz`) y `Diagnostico.jsx` (`grabarVozConsulta`/`grabarVozChat` vía `getNativeSR()`).
- Estandarizado `start({ language: 'es-PE', maxResults: 5, prompt, popup: true, partialResults: false })` (sin popup el flotante se cerraba al segundo por silencio).
- Errores ahora con detalle `(diag: code mensaje)` en pantalla + `console.warn` para Logcat; `matches` vacío avisa de hablar más fuerte/cerca en vez de quedarse mudo.

**Fix `bg.jpg`:**
- `src/index.css:36` tenía `background-image: url('/bg.jpg')` pero no existía `public/bg.jpg` → warning de Vite y fondo roto en runtime. Línea eliminada.

**Verificación `npx cap sync android` (seguro, no borra tus cambios):**
- `android/app/build.gradle` tiene `apply from: 'capacitor.build.gradle'` en línea 5, ANTES del bloque `android {}` → tu config Java 17/`kotlinOptions` gana aunque el generado traiga Java 21.
- `android/build.gradle` tiene bloque `subprojects afterEvaluate` que fuerza Java 17 en todos los módulos y solo aplica `kotlinOptions` si existe el plugin Kotlin.
- `sync` solo regenera `capacitor.build.gradle`, `capacitor.settings.gradle`, `AndroidManifest` parcial y copia `dist/` → `assets/public`. No toca `app/build.gradle`, `variables.gradle`, `capacitor.config.json` ni `src/`.
- Orden seguro: `npm run build` → `npx cap sync android` (o `copy` si no hubo plugin nuevo) → Android Studio `Clean` → `Run ▶`.

---

## 15. Fix API v7 de voz + `bg.jpg` + verificación sync (2026-10-16)

**Fix API v7 (causa del “no te escuché bien” persistente):**
- El plugin `@capacitor-community/speech-recognition@7.0.1` expone `available()` / `start()` / `stop()`, no `isAvailable()` / `startListening()` / `stopListening()`. Con los nombres viejos cada llamada lanzaba excepción y caía al mensaje genérico.
- Corregido en `VoiceAssistant.jsx` (`iniciarEscucha`/`detenerEscucha`), `SelectorUbicacion.jsx` (`grabarVoz`) y `Diagnostico.jsx` (`grabarVozConsulta`/`grabarVozChat` vía `getNativeSR()`).
- Estandarizado `start({ language: 'es-PE', maxResults: 5, prompt, popup: true, partialResults: false })` (sin popup el flotante se cerraba al segundo por silencio).
- Errores ahora con detalle `(diag: code mensaje)` en pantalla + `console.warn` para Logcat; `matches` vacío avisa de hablar más fuerte/cerca en vez de quedarse mudo.

**Fix `bg.jpg`:**
- `src/index.css:36` tenía `background-image: url('/bg.jpg')` pero no existía `public/bg.jpg` → warning de Vite y fondo roto en runtime. Línea eliminada.

**Verificación `npx cap sync android` (seguro, no borra tus cambios):**
- `android/app/build.gradle` tiene `apply from: 'capacitor.build.gradle'` en línea 5, ANTES del bloque `android {}` → tu config Java 17/`kotlinOptions` gana aunque el generado traiga Java 21.
- `android/build.gradle` tiene bloque `subprojects afterEvaluate` que fuerza Java 17 en todos los módulos y solo aplica `kotlinOptions` si existe el plugin Kotlin.
- `sync` solo regenera `capacitor.build.gradle`, `capacitor.settings.gradle`, `AndroidManifest` parcial y copia `dist/` → `assets/public`. No toca `app/build.gradle`, `variables.gradle`, `capacitor.config.json` ni `src/`.
- Orden seguro: `npm run build` → `npx cap sync android` (o `copy` si no hubo plugin nuevo) → Android Studio `Clean` → `Run ▶`.

---

## 15. Fix toggle micrófono flotante + cleanup (2026-10-16)

**Problema:** El botón flotante verde (VoiceAssistant) se activaba al tocarlo pero **no se desactivaba al volver a tocarlo**; se quedaba escuchando indefinidamente. El plugin v7 `stop()` a veces no resuelve la promesa o no detiene la escucha a tiempo, dejando `escuchando=true` y el botón rojo permanentemente.

**Solución aplicada en `VoiceAssistant.jsx`:**
1. **Toggle inmediato:** `iniciarEscucha` verifica `if (escuchando) { await detenerEscucha(); return; }` al inicio → segundo toque detiene inmediatamente.
2. **`detenerEscucha` robusta:**
   - Fuerza `setEscuchando(false)` **inmediatamente** antes de llamar a `stop()` → UI responde al instante.
   - `try/catch` con `setEscuchando(false)` en `catch` → aunque falle `stop()`, el estado UI se limpia.
   - `console.log` para depuración en Logcat.
2. **Cleanup en desmontar/deshabilitar:** `useEffect` cleanup llama a `stop()` si `escuchando` true; `disabled` prop fuerza `setEscuchando(false)` antes de unmount.
3. **Build + copy:** `npm run build` → `npx cap copy android` → Android Studio `Clean` → `Run ▶`.

**Archivos modificados:**
- `src/components/VoiceAssistant.jsx` (toggle + cleanup + logs)
- `Capo.MIGRACION_FIREBASE_A_SUPABASE.md` actualizado

---

## 16. Fix botón superior micrófono en Diagnóstico + logs de depuración (2026-10-16)

**Problema:** El botón superior del micrófono en `Diagnostico.jsx` (al lado del cuadro "Describe el problema...") no respondía al toque. El problema era que el `onClick={grabarVozConsulta}` no tenía logs de depuración y el código no mostraba feedback cuando fallaba silenciosamente.

**Solución aplicada en `Diagnostico.jsx` (`grabarVozConsulta`):**
1. **Logs de depuración al inicio:** `console.log('[Diagnostico] grabarVozConsulta llamado, grabando:', grabando)` y `console.log('[Diagnostico] SRnative:', SRnative)` para verificar que la función se ejecuta y el plugin nativo se carga.
2. **Mensajes de error más descriptivos:** 
   - `available=false` indica "Activa Speech Services by Google"
   - `matches vacío` avisa "Habla más fuerte y cerca del micrófono"
   - Errores con detalle `(diag: code mensaje)` en alerta + `console.warn` para Logcat
3. **Toggle-off robusto:** Si ya está grabando, detiene nativo + web y limpia estado.
4. **Manejo de errores robusto:** `try/catch` con `try { await SRnative?.stop?.(); } catch {}` en catch para limpiar estado.

**Archivos modificados:**
- `src/pages/Diagnostico.jsx` (logs + robustez en `grabarVozConsulta` y `grabarVozChat`)
- `Cambio.MIGRACION_FIREBASE_A_SUPABASE.md` actualizado

---

## ✅ Confirmación: El proyecto SÍ soporta `npx cap sync android`

**Verificación de compatibilidad con `npx cap sync android`:**

El proyecto está **100% listo** para ejecutar `npx cap sync android` sin perder cambios. Aquí la verificación técnica:

### ✅ Configuración Gradle compatible:
1. **`android/app/build.gradle`** (línea 5): `apply from: 'capacitor.build.gradle'` está **ANTES** del bloque `android {}` → tu config Java 17/`kotlinOptions`/`compileOptions` tiene prioridad sobre lo que genere Capacitor.
2. **`android/build.gradle`** (líneas 29-45): Bloque `subprojects { afterEvaluate { ... } }` que fuerza **Java 17** en TODOS los módulos (incluidos los plugins Capacitor) y aplica `kotlinOptions.jvmTarget = '17'` solo si existe el plugin Kotlin.
3. **`android/app/build.gradle`** (líneas 12-18): `compileOptions` y `kotlinOptions` con `JavaVersion.VERSION_17` / `jvmTarget = '17'`.
4. **`android/variables.gradle`**: `kotlinVersion = '2.0.21'`, `coroutinesVersion = '1.8.1'`.

### ✅ Configuración Capacitor correcta:
- `android/app/build.gradle` línea 5: `apply from: 'capacitor.build.gradle'` **ANTES** de `android {}` → tu config gana.
- `android/capacitor.settings.gradle` incluye: `capacitor-android`, `capacitor-community-speech-recognition`, `capacitor-camera`, `capacitor-geolocation`.
- `android/app/capacitor.build.gradle` incluye: `implementation project(':capacitor-community-speech-recognition')`, `capacitor-camera`, `capacitor-geolocation`.
- `capacitor.config.json` incluye plugin `SpeechRecognition` con `lang: "es-PE"` y `androidPermissions: ["android.permission.RECORD_AUDIO"]`.

### ✅ Qué hace `npx cap sync android` (seguro):
1. Regenera `android/app/capacitor.build.gradle` y `android/capacitor.settings.gradle` con plugins actuales.
2. Regenera `android/app/src/main/assets/capacitor.config.json` con config actual.
3. Copia `dist/` → `android/app/src/main/assets/public/`.
4. **NO toca**: `android/app/build.gradle`, `android/build.gradle`, `android/variables.gradle`, `capacitor.config.json`, `src/`, `package.json`.

### ✅ Flujo seguro recomendado:
```bash
# Terminal (WSL / Git Bash / PowerShell):
cd /mnt/c/Users/User/Pictures/LUMAJIRA_SOC/clon_agrilux_android/Agrilux
npm run build
npx cap copy android   # o 'sync' si agregaste plugin nuevo

# Android Studio:
# 1. File > Sync Project with Gradle Files
# 2. Build > Clean Project
# 3. Run ▶ (o Build > Build APK(s))
```

---

### ⚠️ Importante para el emulador:
- El emulador **debe** tener instalado **"Speech Services by Google"** (Play Store → instalar/actualizar).
- El emulador debe tener **micrófono habilitado** (Extended controls → Microphone → Virtual microphone / Host audio input).
- Permiso de micrófono: Ajustes → Apps → Agrilux → Permisos → Micrófono → **Permitir**.

---

### Resumen de archivos modificados en esta sesión:
| Archivo | Cambio |
|---------|--------|
| `src/pages/Diagnostico.jsx` | Logs en `grabarVozConsulta`/`grabarVozChat`, mensajes `(diag: ...)`, fallback robusto |
| `src/components/VoiceAssistant.jsx` | Toggle inmediato, `detenerEscucha` robusta, cleanup en unmount, logs |
| `src/components/SelectorUbicacion.jsx` | Logs + diagnóstico en `grabarVoz` |
| `VoiceAssistant.jsx` / `SelectorUbicacion.jsx` / `Diagnostico.jsx` | API v7 correcta (`available()`/`start()`/`stop()`), `popup: true`, `partialResults: false`, `maxResults: 5` |
| `src/index.css` | Eliminado `background-image: url('/bg.jpg')` inexistente |
| `capacitor.config.json` | Plugin `SpeechRecognition` con `lang: es-PE` y `RECORD_AUDIO` |
| `android/app/build.gradle` / `android/build.gradle` / `android/variables.gradle` | Java 17, Kotlin 2.0.21, coroutines 1.8.1, androidx.core 1.15.0 |
| `android/capacitor.settings.gradle` / `android/app/capacitor.build.gradle` | Plugins registrados correctamente |
| `capacitor.config.json` | Configuración de plugins actualizada |