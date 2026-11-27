/** Convierte una captura de recorrido Hunter en registros de prueba. No escribe BD. */
export function prepararRecorrido(captura, claveFuente = () => null) {
  if (captura?.fuente !== 'hunter360' || !captura.equipo || !Array.isArray(captura.recorrido?.data)) {
    throw new Error('Captura Hunter inválida: faltan fuente, equipo o puntos del recorrido.');
  }
  const inicio = Date.parse(captura.desde || '');
  const fin = Date.parse(captura.hasta || '');
  if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin <= inicio) {
    throw new Error('La captura debe tener un rango válido con zona horaria.');
  }
  const puntos = [];
  const ids = new Set();
  const descartes = { paradas_agrupadas: 0, invalidos: 0, duplicados: 0 };
  for (const p of captura.recorrido.data) {
    // Hunter mezcla puntos de GPS con filas descriptivas de parada. Nunca
    // interpretar una parada agrupada como un punto de telemetría adicional.
    if (p.stopNum || p.parado_desde || p.parado_hasta) { descartes.paradas_agrupadas++; continue; }
    const velocidad = String(p.velocidad ?? '').trim();
    const lat = Number(p.latitud), lon = Number(p.longitud);
    const fecha = String(p.fecha || ''), hora = String(p.hora || '');
    if (!p.id || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}:\d{2}$/.test(hora)
      || !/^\d+(?:\.\d+)?$/.test(velocidad) || p.latitud == null || p.longitud == null
      || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180
      || (lat === 0 && lon === 0)) { descartes.invalidos++; continue; }
    const instante = `${fecha}T${hora}-05:00`;
    const ms = Date.parse(instante);
    // Comprobar calendario, no aceptar fechas que JS normaliza silenciosamente.
    const peru = Number.isFinite(ms) ? new Date(ms - 5 * 3600000).toISOString().slice(0, 19) : '';
    if (peru !== `${fecha}T${hora}` || ms < inicio || ms > fin) { descartes.invalidos++; continue; }
    const id = String(p.id);
    if (ids.has(id)) { descartes.duplicados++; continue; }
    ids.add(id);
    const ignicion = String(p.ignicion ?? '').trim();
    puntos.push({
      fuente: 'hunter360', equipo_id: String(captura.equipo), punto_id: id,
      clave_fuente: claveFuente(String(captura.equipo), id),
      unidad: String(p.nombre_vehiculo || '').trim(), fecha: instante,
      latitud: lat, longitud: lon, velocidad_kmh: Number(velocidad),
      ignicion: ignicion === '1' ? true : ignicion === '0' ? false : null,
      evento: String(p.name_tipo_dato_gps || '').trim() || null,
      direccion: String(p.domicilio || '').trim() || null,
    });
  }
  puntos.sort((a, b) => Date.parse(a.fecha) - Date.parse(b.fecha) || a.punto_id.localeCompare(b.punto_id));
  const r = captura.agrupado || captura.recorrido;
  // La variante sin agrupar sirve para puntos, pero su resumen puede diferir
  // sustancialmente del informe agrupado de Hunter; no sustituirlo.
  const resumen = captura.agrupado || {};
  const viajes = Array.isArray(r.data_trips) ? r.data_trips.map((v) => ({
    tipo: v.type === 'stop' ? 'Parada' : v.type === 'trip' ? 'Viaje' : 'Desconocido',
    inicio: v.start ?? null, fin: v.end ?? null, duracion: v.time ?? null,
    distancia: v.distance ?? null, velocidad_maxima: v.max_speed ?? null,
    direccion_inicio: v.addr_start ?? null, direccion_fin: v.addr_end ?? null,
  })) : [];
  return { fuente: 'hunter360', equipo_id: String(captura.equipo), desde: captura.desde || null,
    hasta: captura.hasta || null, total_original: r.data.length, descartes, puntos,
    viajes, viajes_disponibles: Array.isArray(r.data_trips), resumen_agrupado_disponible: !!captura.agrupado,
    resumen_hunter: { distancia: resumen.distance ?? null, distancia_recta: null,
      velocidad_maxima: resumen.maximum_speed ?? null, velocidad_promedio: resumen.average_speed ?? null,
      detenido: resumen.time_stop ?? null, movimiento: resumen.time_mov ?? null, estacionado: resumen.time_estacionado ?? null,
      ralenti: resumen.time_ralenti ?? null, motor: resumen.use_engine ?? null, total: resumen.time_total ?? null,
      parada_minima: resumen.time_min_stop ?? null } };
}
