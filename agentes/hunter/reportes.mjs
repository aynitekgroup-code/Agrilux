// CSV con BOM para Excel. Valores externos que puedan interpretarse como
// fórmulas se neutralizan; los campos numéricos conservan su tipo textual.
function celda(valor) {
  if (valor == null) return '""';
  let texto = typeof valor === 'object' ? JSON.stringify(valor) : String(valor);
  if (/^[\s\u0000-\u001f]*[=+@\-]/.test(texto) && !/^-?\d+(?:\.\d+)?$/.test(texto)) texto = `'${texto}`;
  return `"${texto.replaceAll('"', '""')}"`;
}
function csv(columnas, filas) {
  return '\ufeff' + [columnas.map(([titulo]) => celda(titulo)).join(','),
    ...filas.map((f) => columnas.map(([, campo]) => celda(f[campo])).join(','))].join('\r\n') + '\r\n';
}
export function generarReportesCsv(resultado) {
  const resumen = Object.entries(resultado.resumen_hunter).map(([concepto, valor]) => ({ concepto, valor }));
  return {
    'hunter-resumen.csv': csv([['Concepto', 'concepto'], ['Valor informado por Hunter', 'valor']], resumen),
    'hunter-puntos.csv': csv([['Equipo', 'equipo_id'], ['Unidad', 'unidad'], ['Fecha hora Perú', 'fecha'],
      ['Evento', 'evento'], ['Ignición', 'ignicion'], ['Velocidad km/h', 'velocidad_kmh'],
      ['Latitud', 'latitud'], ['Longitud', 'longitud'], ['Dirección', 'direccion'], ['ID de punto', 'punto_id']], resultado.puntos),
    'hunter-viajes-paradas.csv': csv([['Tipo', 'tipo'], ['Inicio', 'inicio'], ['Fin', 'fin'], ['Duración', 'duracion'],
      ['Distancia', 'distancia'], ['Velocidad máxima', 'velocidad_maxima'], ['Dirección inicio', 'direccion_inicio'],
      ['Dirección fin', 'direccion_fin']], resultado.viajes),
  };
}
