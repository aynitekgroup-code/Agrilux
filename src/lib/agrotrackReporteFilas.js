// Reglas compartidas por pantalla y Excel. No calculan telemetría: completan
// el padrón y distinguen «sin datos» de un cero medido por SQL.
const placaClave = (p) => String(p || '').trim().toUpperCase();

// Un cero medido no es lo mismo que ausencia de telemetría o de valor.
export function recorridoEsCero(fila) {
  const valor = fila?.km_recorridos;
  return !fila?.sin_datos_rango && valor != null && String(valor).trim() !== ''
    && Number.isFinite(Number(valor)) && Number(valor) === 0;
}

export function compararUnidades(a, b) {
  const nombre = (f) => String(f.unidad || f.equipo_id || f.placa || '').trim();
  return nombre(a).localeCompare(nombre(b), 'es', { numeric: true, sensitivity: 'base' })
    || String(a.equipo_id || a.placa || '').localeCompare(String(b.equipo_id || b.placa || ''), 'es', { numeric: true });
}

export function completarUnidadesReporte(filas = [], unidades = [], periodo = null) {
  const presentes = new Set(filas.map((f) => placaClave(f.placa)));
  const resultado = [...filas];
  for (const u of unidades) {
    const placa = placaClave(u.placa || u.id);
    if (!placa || presentes.has(placa)) continue;
    presentes.add(placa);
    resultado.push({
      placa,
      unidad: u.area || u.descripcion || u.modelo || placa,
      periodo,
      km_recorridos: 0,
      encendido_segundos: null,
      prendido_segundos: null,
      viaje_segundos: null,
      ralenti_segundos: null,
      vel_max_kmh: null,
      alertas: null,
      posiciones: 0,
      sin_datos_rango: true,
      sin_telemetria: Boolean(u.sin_telemetria),
    });
  }
  return resultado;
}

export function calcularSinReportar(filas = [], ahora = new Date(), ventanaHoras = 24) {
  const ms = new Date(ahora).getTime();
  return filas.map((f) => {
    const t = Date.parse(f.ultima_fecha || '');
    const valido = Number.isFinite(t);
    const antiguedadMs = valido ? Math.max(0, ms - t) : Infinity;
    const minutos = Math.floor(antiguedadMs / 60000);
    const dias = Math.floor(minutos / 1440);
    const horas = Math.floor((minutos % 1440) / 60);
    return {
      ...f,
      antiguedadMs,
      sinReportar: !valido || antiguedadMs > ventanaHoras * 3600000,
      transcurrido: !valido ? 'sin reporte' : dias > 0 ? `hace ${dias} d ${horas} h`
        : horas > 0 ? `hace ${horas} h ${minutos % 60} min` : `hace ${minutos} min`,
    };
  }).filter((f) => f.sinReportar)
    .sort((a, b) => a.antiguedadMs === b.antiguedadMs ? 0 : b.antiguedadMs - a.antiguedadMs);
}

export function describirPosicion(fecha, ahora = new Date(), umbralMinutos = 30) {
  const t = Date.parse(fecha || '');
  const edad = new Date(ahora).getTime() - t;
  const reciente = Number.isFinite(t) && edad >= -60000 && edad <= umbralMinutos * 60000;
  return { reciente, texto: reciente ? 'Última posición reciente' : 'Última posición conocida · sin reporte reciente' };
}
