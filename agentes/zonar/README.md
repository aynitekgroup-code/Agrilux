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
