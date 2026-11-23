// Normalización de la fotografía de /Moviles/getVehiculos. No inicia sesión ni
// escribe en ninguna tabla: el identificador pertenece exclusivamente a Hunter.
function numero(valor) {
  if (valor == null || String(valor).trim() === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

export function normalizarEstadoHunter(respuesta) {
  if (!respuesta || typeof respuesta !== 'object' || Array.isArray(respuesta)) {
    throw new Error('Hunter no devolvió una lista válida de unidades.');
  }
  return Object.entries(respuesta).map(([clave, unidad]) => {
    if (!unidad || typeof unidad !== 'object' || Array.isArray(unidad)) throw new Error('Hunter devolvió una unidad inválida.');
    // En la respuesta observada IdVehiculo es 0; la clave del objeto identifica
    // al equipo y no debe reemplazarse por ese campo.
    const id = String(clave).trim();
    if (!id) throw new Error('Falta el identificador de equipo Hunter.');
    const fecha = String(unidad.FechaHora ?? '').trim();
    const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/.exec(fecha);
    const instante = match ? `${match[1]}T${match[2]}-05:00` : null;
    const ms = instante ? Date.parse(instante) : NaN;
    const fechaValida = Number.isFinite(ms) && new Date(ms - 5 * 3600000).toISOString().slice(0, 19) === fecha.replace(' ', 'T');
    const lat = numero(unidad.Latitud), lon = numero(unidad.Longitud);
    const coordenadasValidas = lat != null && lon != null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && (lat !== 0 || lon !== 0);
    const velocidad = numero(unidad.Velocidad);
    const ignicion = String(unidad.Ignicion ?? '').trim().toLowerCase();
    return {
      fuente: 'hunter360', equipo_id: id, unidad: String(unidad.Nombre ?? '').trim(),
      fecha: fechaValida ? instante : null,
      latitud: coordenadasValidas ? lat : null, longitud: coordenadasValidas ? lon : null,
      velocidad_kmh: velocidad != null && velocidad >= 0 ? velocidad : null,
      ignicion: ignicion === 'encendido' ? true : ignicion === 'apagado' ? false : null,
      direccion: String(unidad.Address ?? '').trim() || null,
      grupo_id: String(unidad.Grupo ?? '').trim() || null,
    };
  });
}
