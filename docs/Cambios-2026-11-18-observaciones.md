# Cambios 18/11/2026 (tarde) — Levantamiento de observaciones I a X

Sobre el árbol de `docs/Cambios-2026-11-18.md`.

| Punto | Observación | Qué se hizo | Archivos |
|---|---|---|---|
| I / II | 10 % de diferencia con Zonar; datos cada 10 min para comparar | Ninguno de los dos sistemas interpola: ambos suman tramos entre reportes (ver *Metodología Stop/Ralentí/Conduciendo*). El agente en vivo ahora trae Zonar **cada 10 minutos** (posición de todas las unidades + historial de hoy con sus puntos cada 2 min), así se puede comparar el mismo día y la misma hora. | `agentes/zonar/src/config.js`, `envivo.js`, `README.md`, `*.bat` |
| III | Status cada 10 min | Mismo agente cada 10 min; la web se actualiza sola (Realtime) y el aviso ámbar aparece si pasan más de 25 min sin lectura. | `src/lib/agrotrackTiempoReal.js` |
| III | Distritos: "Distrito …" y abreviados (Distrito MAMM) | Regla: se antepone "Distrito"; 3 palabras o más (sin de/la/los…) → iniciales. `scripts/agrotrack-nombres-distritos.sql` renombra los existentes (con vista previa) y también el respaldo de visitas; el importador ya aplica la regla a los nuevos (sin cambiar su `source_key`). | `scripts/agrotrack-nombres-distritos.sql`, `src/lib/geocercasImportacion.js` |
| IV | "Tiempo en cada lote" no carga | Con días completos se lee de las visitas guardadas (`agrotrack_lotes_desde_visitas`, instantáneo). Con horas parciales se intenta el cálculo exacto en vivo y, si pasa de 8 s, se usan las visitas guardadas recortadas a la hora con aviso. | `scripts/agrotrack-visitas-diarias.sql` (sección 8), `src/lib/agrotrackReportesGeocerca.js`, `FleetGeofenceReports.jsx` |
| V | Botón de 4 h; mostrar solo las que exceden | Se agregó 4 h (4/8/16/24/48). El filtro "solo las que exceden la ventana" ya estaba; si aparecen todas es porque los datos están atrasados (ver IX). | `FleetSinReportar.jsx` |
| VII | Ubicaciones históricas | Ya existía en Mapas (unidad, desde/hasta con hora, páginas, tabla de coordenadas exportable), pero se ocultaba junto con X. Ahora se muestra siempre y busca también entre las 44 unidades del padrón, aunque no tengan posición en las últimas 24 h. | `FleetMap.jsx` |
| IX | Datos del 1 al 11 y desde el 16; faltan 12–15 | La corrida diaria ahora revisa los últimos 31 días y baja **día por día** los que falten o estén incompletos. Para hacerlo ya: `node agente.mjs correr --desde=2026-11-12 --hasta=2026-11-15`. | `agentes/zonar/agente.mjs`, `src/agrilux.js`, `src/config.js` |
| X | Mapas: no aparecen buscador de unidades, grupos ni coordenadas | Se ocultaban cuando la lista de unidades del panel no cargaba (timeout o SQL pendiente). Ahora: (1) se usa la última posición de la tabla en vivo como respaldo, (2) si tampoco hay, se muestra el motivo con botón **Reintentar**. | `AgroTrackPomalcaPage.jsx`, `FleetMap.jsx` |

## SQL a ejecutar (SQL Editor, en este orden)

1. `scripts/agrotrack-visitas-diarias.sql` (agrega la sección 8; repetible).
2. `scripts/agrotrack-nombres-distritos.sql` — primero solo el bloque **VISTA PREVIA**, luego el archivo completo.

## Agente

Copiar `agentes/zonar` a la PC del agente, `npm install`, y luego:

```bat
node agente.mjs correr --desde=2026-11-12 --hasta=2026-11-15
instalar-envivo.bat
```

Para que la tarea diaria use la recuperación automática no hay que reinstalarla.

## Adenda: "se envió del 1 al 11 de noviembre y no carga"

- `scripts/agrotrack-diagnostico-dias.sql` (solo lectura) muestra cuántas posiciones tiene Agrilux por día, cuándo se cargaron y si hay filas con fechas fuera de lugar.
- El importador "Cargar reporte de unidades" solo entendía la fecha en inglés de Zonar (`Nov 01 2026 12:01 AM`). Si el reporte salía con la interfaz en español (`01/11/2026 12:01 a. m.`) o el archivo se abrió y guardó en Excel (fecha como número), **todas las filas se descartaban**. Ahora acepta también `dd/mm/aaaa hh:mm a. m./p. m.`, `dd/mm/aaaa hh:mm:ss`, `aaaa-mm-dd hh:mm`, `12 nov 2026 04:00 PM` y el número de serie de Excel (siempre día/mes/año). El mensaje de error dice qué fecha no reconoció. Misma lógica en el agente (`agentes/zonar/lib/parse.js`).
- La corrida diaria del agente revisa los últimos **31** días (antes 15) para que alcance a recuperar todo el mes.
