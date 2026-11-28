// La imagen usa los datos ya visibles; no consulta ni inventa posiciones.
export function prepararStatusCompartido(filas, { fecha, clasificar, geocerca, filtros, generado }) {
  return {
    generado: fecha(generado), filtros: filtros || 'Todos',
    filas: filas.map((f) => ({ unidad: String(f.unidad || f.equipo_id || '—'), area: String(f.area_operativa || 'Sin área'), estado: clasificar(f), geocerca: String(geocerca(f) || '—'), posicion: fecha(f.fecha) })),
  };
}

export async function imagenStatusHunter(reporte) {
  const ancho = 1000, altoFila = 70, alto = 210 + reporte.filas.length * altoFila;
  const canvas = document.createElement('canvas'); canvas.width = ancho; canvas.height = alto;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear la imagen del reporte.');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, ancho, alto);
  ctx.fillStyle = '#064e3b'; ctx.fillRect(0, 0, ancho, 100);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 30px sans-serif'; ctx.fillText('AGRILUX · STATUS DE MAQUINARIA', 28, 42);
  ctx.font = '19px sans-serif'; ctx.fillText(`Hunter 360 · Generado: ${reporte.generado} (Perú)`, 28, 77);
  ctx.fillStyle = '#334155'; ctx.font = '18px sans-serif'; ctx.fillText(`Filtros: ${reporte.filtros}`, 28, 130, 940);
  ctx.fillText(`${reporte.filas.length} unidades · Estado orientativo de la última posición`, 28, 161, 940);
  ctx.fillStyle = '#e2e8f0'; ctx.fillRect(20, 180, 960, 1);
  reporte.filas.forEach((f, i) => {
    const y = 197 + i * altoFila;
    if (i % 2 === 0) { ctx.fillStyle = '#f0fdf4'; ctx.fillRect(20, y - 8, 960, altoFila); }
    ctx.fillStyle = '#0f172a'; ctx.font = 'bold 20px sans-serif'; ctx.fillText(f.unidad, 30, y + 14, 280);
    ctx.fillStyle = '#065f46'; ctx.font = 'bold 17px sans-serif'; ctx.fillText(f.estado, 330, y + 14, 620);
    ctx.fillStyle = '#475569'; ctx.font = '16px sans-serif'; ctx.fillText(`Área: ${f.area} · Geocerca: ${f.geocerca} · Última posición: ${f.posicion}`, 30, y + 43, 940);
  });
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen.')), 'image/png'));
}
