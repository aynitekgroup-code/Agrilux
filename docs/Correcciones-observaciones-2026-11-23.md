# Corrección de «levantar observaciones.docx» — 23/11/2026

Base de revisión: `14658e0`. Sin cambios de RLS ni nuevas funciones serverless web.

## Cambios

1. **Actividad / Eventos resumidos:** unión de los resultados SQL con todas las
   unidades del padrón/localizador filtrado. Las que no tienen posiciones en el
   rango ya no desaparecen: recorrido registrado 0 y horas no disponibles, con
   aviso explícito. Ausencia de telemetría no equivale a 100 % de motor apagado.
2. **Excel:** Actividad usa las filas filtradas/ordenadas; Eventos usa las filas
   finales ya calculadas, sin recalcular ni perder filtros. Sin reportar usa las
   filas enriquecidas con antigüedad y ventana de 8/16/24/48 h. Status conserva
   también las unidades del padrón que no tienen telemetría.
3. **Corte horario de geocercas:** días completos reutilizan el respaldo. Los
   días parciales usan `agrotrack_visitas_rango_flota` por placa y día, con
   inicio/fin exactos y estados calculados por SQL. No se reparten horas de motor
   proporcionalmente ni se devuelven las horas del día completo por un rango
   parcial. Un timeout muestra error; una respuesta potencialmente truncada se
   bloquea. Cambiar el rango detiene los trabajos horarios pendientes.
4. **Mapa:** etiquetas permanentes de placa/descripción para todos los
   marcadores, coordenadas exportables debajo del mapa y sección histórica
   marcada como disponible. La paginación conserva el último instante del rango.
5. **Zonas / voz:** preferencia por el estado en vivo y por los datos más nuevos
   de la consola, sin asociar GPS nuevo con geocerca antigua. Se distinguen
   posiciones recientes de antiguas, también en la respuesta hablada. Un
   reconocimiento vacío no selecciona una unidad accidentalmente.
6. **Respaldo diario:** la tabla comprueba pendientes y bloquea Excel si el
   cálculo está incompleto. La Edge Function prioriza ayer antes de descargar
   hoy, alterna la recuperación del historial de ayer hasta las 6:30 y rota el
   orden de unidades para evitar que siempre queden sin procesar las últimas.
7. **Edge Functions:** presupuesto medido por solicitud, no desde la carga del
   isolate. Cliente de usuario local a cada corrida. La expiración cacheada usa
   el timestamp en segundos de Supabase convertido a milisegundos.

## Validación

- Pruebas de regresión: inclusión de 44 unidades, ausencia de datos sin horas
  inventadas, ventanas sin reportar, corte horario SQL, timeout/truncación,
  cancelación y extremos de páginas históricas.
- Handlers reales de `envivo` / `envivo-rapido` ejecutados con red/DB simuladas:
  segunda invocación reutilizada y rechazo de cron no autorizado.
- `npm test`: **100 pruebas aprobadas**; `npm run build`: correcto.
- SQL nuevo validado con `EXPLAIN` (sin crear la función) y consulta de solo
  lectura sobre la base real: placa 1414-1K, 22/11/2026, 10:00–11:00 Perú,
  una visita de 3600 segundos, límites correctos, 107 ms. La comprobación
  administrativa ejecutó el cuerpo de lectura; no instaló funciones ni alteró
  políticas. El despliegue conserva obligatoriamente el chequeo de membresía.
- Navegador local con cuenta de Carlos y datos reales: 44 filas en los totales
  de Actividad/Eventos, filtro de una máquina sin datos, 44 marcadores con 44
  etiquetas y tabla de coordenadas inferior.
- Descarga y lectura de los tres Excel: Actividad/Eventos con 44 unidades más
  total; Sin reportar solo con las filas de su ventana y estado correcto.
- Histórico real de 1414-1K (23/11, 00:00–01:00): 62 puntos, cuatro páginas de
  tabla, navegación y descarga solicitadas desde el navegador local.

## No confundir implementación con cierre operativo

- Estas modificaciones necesitan desplegar la web y ambas Edge Functions para
  aplicarse a producción. Ejecutar manualmente
  `scripts/agrotrack-visitas-rango-exacto.sql` antes de habilitar horas parciales.
  La prueba real del motor anterior superó el timeout; por eso se preparó este
  lector indexado nuevo. Si falta, la web avisa y los días completos siguen
  funcionando. La RPC nueva necesita validación con sesión autenticada tras su instalación.
- La diferencia del 10 % con Zonar solo puede cerrarse comparando exportaciones
  de ambas plataformas con iguales unidades, fechas y horas. No se accedió a
  Zonar: esa validación corresponde a Carlos.
- Priorizar el cálculo no garantiza disponibilidad a las 6:30 ante caídas de
  red, del proveedor o historial incompleto. Debe observarse una corrida real
  y comprobar pendientes en ese horario.
- El reconocimiento por micrófono requiere una prueba en el dispositivo con
  permiso de audio; una prueba de código no sustituye esa comprobación.
