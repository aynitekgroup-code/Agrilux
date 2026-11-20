const CATEGORIAS_BUSQUEDA = [
  'bomba de fumigacion', 'fumigadora mochila', 'pulverizador agricola',
  'tractor agricola', 'sembradora manual', 'cosechadora',
  'manguera riego goteo', 'bomba de riego', 'aspersionador',
  'pico agricola', 'lampa', 'pala', 'azada', 'machete',
  'dron fumigador agricola', 'sensor suelo', 'estacion meteorologica',
  'guantes trabajo', 'mascara fumigacion', 'overol proteccion',
  'semilla papa', 'semilla maiz', 'fertilizante urea',
  'carretilla', 'rastrillo', 'tijera podar',
  'silo almacenamiento', 'malla sombra', 'costal fibra',
];

function linkML(q) {
  return `https://listado.mercadolibre.com.pe/${encodeURIComponent(q.replace(/\s+/g, '-'))}`;
}

export async function buscarOfertasPublicas(busqueda = null) {
  const terminos = busqueda ? [busqueda] : CATEGORIAS_BUSQUEDA;
  const ofertas = [];

  for (const termino of terminos) {
    try {
      const url = `/api/ml-proxy?q=${encodeURIComponent(termino)}&limit=3`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
      clearTimeout(timeout);

      if (!res.ok) {
        ofertas.push({
          producto: termino,
          precio: null,
          tienda: 'MercadoLibre',
          url: linkML(termino),
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
          descuento: item.original_price ? Math.round((1 - item.price / item.original_price) * 100) : null,
          tienda: item.seller?.nickname || 'MercadoLibre',
          url: item.permalink,
          imagen: item.thumbnail?.replace('http:', 'https:').replace('-I.jpg', '-O.jpg'),
          fuente: 'MercadoLibre',
          ubicacion: item.address?.state_name || 'Perú',
          envio_gratis: item.shipping?.free_shipping || false,
          ventas: item.sold_quantity || 0,
          rating: item.reviews?.rating_average || null,
        });
      }
    } catch {
      ofertas.push({
        producto: termino,
        precio: null,
        tienda: 'MercadoLibre',
        url: linkML(termino),
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
