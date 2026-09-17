const BUSQUEDAS_POPULARES = [
  'bomba de riego', 'manguera goteo', 'fertilizante urea',
  'semilla papa', 'cosechadora', 'pala agricola',
  'guantes trabajo', 'mochila fumigadora', 'pulverizador',
  'rastrillo', 'azada', 'pico', 'carretilla'
];

function buscarMLLink(producto) {
  return `https://listado.mercadolibre.com.pe/${encodeURIComponent(producto.replace(/\s+/g, '-'))}`;
}

export async function buscarOfertasPublicas(busqueda = null) {
  const terminos = busqueda ? [busqueda] : BUSQUEDAS_POPULARES.slice(0, 5);
  const ofertas = [];

  for (const termino of terminos) {
    try {
      const url = `/api/ml-proxy?q=${encodeURIComponent(termino)}&limit=5&sort=relevance`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeout);

      if (!res.ok) {
        // Si falla, agregar link de búsqueda
        ofertas.push({
          producto: `Buscar "${termino}" en MercadoLibre`,
          precio: null,
          tienda: 'MercadoLibre',
          url: buscarMLLink(termino),
          fuente: 'MercadoLibre',
          ubicacion: 'Perú'
        });
        continue;
      }

      const data = await res.json();
      if (!data.results) continue;

      for (const item of data.results) {
        ofertas.push({
          producto: item.title,
          precio: item.price,
          precio_original: item.original_price,
          descuento: item.original_price
            ? Math.round((1 - item.price / item.original_price) * 100)
            : null,
          tienda: item.seller?.nickname || 'MercadoLibre',
          url: item.permalink,
          imagen: item.thumbnail?.replace('http:', 'https:'),
          fuente: 'MercadoLibre',
          ubicacion: item.address?.state_name || 'Perú',
          envio_gratis: item.shipping?.free_shipping || false,
          rating: item.reviews?.rating_average || null,
          ventas: item.sold_quantity || 0
        });
      }
    } catch (e) {
      ofertas.push({
        producto: `Buscar "${termino}" en MercadoLibre`,
        precio: null,
        tienda: 'MercadoLibre',
        url: buscarMLLink(termino),
        fuente: 'MercadoLibre',
        ubicacion: 'Perú'
      });
    }
  }

  return ofertas;
}

export function calcularMejoresOfertas(ofertas) {
  return ofertas
    .filter(o => o.precio && o.precio > 0)
    .sort((a, b) => {
      const scoreA = (a.descuento || 0) + (a.envio_gratis ? 10 : 0) + (a.ventas || 0) * 0.01;
      const scoreB = (b.descuento || 0) + (b.envio_gratis ? 10 : 0) + (b.ventas || 0) * 0.01;
      return scoreB - scoreA;
    });
}

export function detectarOfertasFlash(ofertas) {
  return ofertas.filter(o =>
    o.descuento && o.descuento >= 30
  );
}
