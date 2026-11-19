# Agente Zonar → Agrilux

Este agente baja **solo** los reportes de Zonar ([app.tsomobile.com](https://app.tsomobile.com/))
—los que hoy se descargan uno por unidad, 44 en total— y los **ingresa solo a
Agrilux** (AgroTrack Pomalca), todos los días a las **05:30 a.m.**, listo para
el informe de estatus de las 6:30.

**Corre en ESTA computadora (la de Carlos):** todo el tráfico a Zonar sale con
la IP de esta máquina, y las credenciales se guardan solo aquí, en
`%APPDATA%\agrilux-zonar\config.json` (nunca se suben al repo ni a internet).

---

## Requisitos

- Windows 10/11 con **Node.js 18 o superior** (<https://nodejs.org>, versión LTS).
  Comprueba en una terminal: `node -v`
- Internet y la PC encendida a la hora de la corrida.

## Instalación (una sola vez)

Abre una terminal (`Win + R` → `cmd`) en esta carpeta y ejecuta en orden:

```bat
npm install                1) descarga las dependencias (una vez)
node configurar.mjs        2) pide usuario/contraseña de Zonar y de Agrilux
node agente.mjs descubrir  3) diagnóstico: baja unidades + 1 reporte de muestra
node agente.mjs correr --probar   4) prueba real con UNA sola unidad
node agente.mjs correr     5) corrida completa del día anterior
instalar-tarea.bat         6) activa la corrida automática a las 05:30
```

Si todo sale bien, el paso 5 imprime algo como:

```
Listo en 142s · unidades 44/44 · marcas 36180 · filas 36180 · nuevas 8124
```

## Tiempo real (Agrilux conectado a Zonar)

Además de la descarga diaria, el agente puede quedarse **conectado**:

| Cada | Qué hace |
| --- | --- |
| 10 min | Lee la posición actual de **todas** las unidades (una sola llamada a `GetUnitsLocator`) y la sube a Agrilux. La web (Status de maquinaria, mapa, localizador) se actualiza sola por Supabase Realtime. |
| 10 min | Baja el historial de **hoy** de cada unidad (los puntos cada 2 min) y recalcula las visitas a geocercas pendientes de hoy y ayer. |

Instalación (una vez, después de los pasos de arriba):

```bat
REM 1) En Supabase (SQL Editor), en este orden:
REM    scripts/agrotrack-reportes-flota.sql
REM    scripts/agrotrack-geocercas-reportes.sql
REM    scripts/agrotrack-visitas-diarias.sql
REM    scripts/agrotrack-tiempo-real.sql
REM 2) Prueba una sola vuelta:
node agente.mjs envivo --una-vez
REM 3) Déjalo corriendo siempre (arranca solo al iniciar sesión en Windows):
instalar-envivo.bat
```

| Comando | Qué hace |
| --- | --- |
| `node agente.mjs envivo` | Conectado: lee Zonar cada 10 min (Ctrl+C para salir) |
| `node agente.mjs envivo --una-vez` | Una sola vuelta (prueba) |
| `node agente.mjs envivo --intervalo=60 --historial=10` | Cambia los tiempos (segundos / minutos) |
| `instalar-envivo.bat` / `quitar-envivo.bat` | Activa / quita el arranque automático |

La web muestra “Zonar leído hace N min” (el **latido** del agente). Si pasa de
10 minutos, se pone en ámbar: revisa que la PC esté encendida y mira
`logs\envivo.log`.

> Conviene confirmar con Zonar/TSO Mobile que una lectura cada 10 minutos con
> el usuario de la empresa está dentro de su política de uso. Si Zonar ofrece
> su API oficial o un envío por *webhook*, el agente se reemplaza por esa
> integración sin cambiar nada en Supabase: basta con escribir en
> `agrotrack_posiciones` (el trigger y la web funcionan igual).

### Recuperación automática de días faltantes (18/11/2026)

`node agente.mjs correr` (la tarea de las 05:30) ya no baja solo **ayer**:
revisa los últimos 31 días en Agrilux y baja **día por día** los que falten o
estén incompletos (menos del 30 % de las posiciones de un día normal). Así un
apagón de la PC no deja huecos como el del 12 al 15/11. Se cambia con
`"corrida": { "dias_recuperar": 31 }` en la configuración (0 = solo ayer).

Para recuperar un rango a mano:

```bat
node agente.mjs correr --desde=2026-11-12 --hasta=2026-11-15
```

## Uso diario

No hay que hacer nada: la tarea **“AgroTrack Zonar diario”** corre sola a las
05:30. Para forzar una corrida manual, doble clic en `ejecutar-tarea.bat` o
abre una terminal y escribe `node agente.mjs correr`.

| Comando | Qué hace |
| --- | --- |
| `node agente.mjs correr` | Baja lo de **ayer** y lo ingresa a Agrilux |
| `node agente.mjs correr --probar` | Solo 1 unidad (prueba de humo) |
| `node agente.mjs correr --desde=2026-11-10 --hasta=2026-11-12` | Rango a medida |
| `node agente.mjs correr --sin-ingerir` | Solo descarga los JSON (no toca Agrilux) |
| `node agente.mjs correr --unidades=T-01,BPH-767` | Solo esas placas |
| `node agente.mjs correr --fecha-modo=utc` | Cambia cómo interpreta las fechas sin zona de Zonar |
| `node agente.mjs descubrir` | Diagnóstico de conexión y formatos |
| `node agente.mjs estado` | Último resumen de corrida |
| `node agente.mjs envivo` | Tiempo real (ver arriba) |

## Qué guarda dónde

Todo queda en `%APPDATA%\agrilux-zonar\` (fuera del repositorio):

- `config.json` — credenciales (solo locales).
- `logs\AAAA-MM-DD.log` — log de cada corrida + `logs\tarea.log` de la tarea.
- `descargas\AAAA-MM-DD_a_AAAA-MM-DD\*.json` — copia de lo bajado (retención: 30 días).
- `estado.json` — resumen de la última corrida.
- `descubrimiento\` — archivos del diagnóstico `descubrir`.

## Cómo se conecta (aclaraciones técnicas)

1. **Zonar:** login contra `/wcf/AuthenticationController/ValidateUser`
   (mismo flujo de la web, AppID 38), lista las unidades con
   `GetUnitsLocator` (`All Units` = `-99,0|`) y baja el historial GPS de cada
   unidad con `GetUnitsHistory` (`historicallocations`), el mismo dato que la
   UI exporta como Excel “Ubicaciones históricas”.
2. **Agrilux:** inicia sesión con tu correo/contraseña (Supabase Auth, igual que
   la web) y sube las posiciones a `agrotrack_posiciones` con la misma clave de
   deduplicación (`empresa_id, source_key`) que el botón **“Cargar reporte de
   unidades”**: lo que ya se cargó a mano **no se duplica**.
3. Las fechas se normalizan a la hora de Perú (UTC-5), igual que al importar el
   Excel a mano. Si alguna corrida muestra “nuevas: 0” con días que nunca se
   importaron, prueba `--fecha-modo=utc` y avísame.

## Solución de problemas

| Mensaje | Qué hacer |
| --- | --- |
| `Zonar rechazó el inicio de sesión` | Corrige usuario/contraseña: `node configurar.mjs` |
| `Falta la configuración…` | Ejecuta `node configurar.mjs` |
| `Falta la tabla agrotrack_posiciones…` | Ejecutar `scripts/agrotrack-posiciones.sql` en Supabase (lo hace Agrilux) |
| `Agrilux: correo o contraseña incorrectos` | Revisa las credenciales de Agrilux: `node configurar.mjs` |
| `unidades_con_error > 0` en el resumen | Revisa `logs\AAAA-MM-DD.log`; la corrida sigue en la próxima tarea |
| No corre a las 05:30 | `schtasks /Query /TN "AgroTrack Zonar diario" /V /FO LIST` — la PC debe estar encendida y con sesión iniciada |

Para quitar la automática: `quitar-tarea.bat`.
