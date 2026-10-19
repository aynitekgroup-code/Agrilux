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