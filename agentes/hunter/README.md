# Hunter 360 → Agrilux: diagnóstico inicial

El comando actual **solo valida una captura privada**; no inicia sesión en
Hunter, no consulta Agrilux ni sube datos. No es todavía una sincronización
automática ni un agente operativo. Nunca colocar capturas ni contraseñas en Git.

```powershell
node agentes/hunter/agente.mjs "RUTA_A_LA_CAPTURA_PRIVADA.json"
```

El formato de captura es `{fuente:"hunter360", equipo, desde, hasta,
recorrido:{data:[...]}}`. Se basa en una respuesta real observada de Hunter
para CASE 2 el 20/11/2026: el resumen incluyó 49,95 km y la lista 572 filas,
incluyendo paradas agrupadas. El parser separa estas últimas, valida coordenadas,
fecha Perú, velocidad e ID y usa una clave independiente `hunter:`. La
ignición desconocida permanece como `null`, nunca se inventa apagado.

Antes de ingerir en Agrilux falta validar la fuente oficial/autorizada, cómo
obtener posiciones completas (incluidas paradas), identidad de activos que
no tienen placa, límites, y una separación de fuente en base de datos y RPC.
La deduplicación por source_key NO impide mezclar las mismas placas de Hunter y
Zonar en los reportes existentes: por eso este módulo **no permite cargar**.
El resumen oficial de Hunter debe compararse con cálculos propios antes de
prometer paridad; las reglas de paradas dependen del equipo y configuración.
