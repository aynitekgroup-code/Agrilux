const PRODUCTOS_BUSCAR = [
  'fertilizante', 'urea', 'superfosfato', 'cloruro potasio',
  'mancozeb', 'cipermetrina', 'glifosato', 'abono organico',
  'semilla papa', 'semilla maiz', 'fungicida',
  'insecticida', 'herbicida', 'caldo bordeles', 'sulfato cobre',
  'trichoderma', 'beauveria'
];

const PRECIOS_MIDAGRI = {
  urea: { precio: 175, unidad: 'S/ por kg' },
  fosfato: { precio: 185, unidad: 'S/ por kg' },
  mancozeb: { precio: 87, unidad: 'S/ por kg' },
  clorotalonil: { precio: 95, unidad: 'S/ por kg' },
  glifosato: { precio: 47, unidad: 'S/ por litro' },
  abono_organico: { precio: 125, unidad: 'S/ por kg' },
  semilla_papa: { precio: 290, unidad: 'S/ por kg' },
  semilla_maiz: { precio: 188, unidad: 'S/ por kg' },
  cipermetrina: { precio: 78, unidad: 'S/ por litro' },
};

const MAPA_PRODUCTOS = {
  'urea': 'urea', 'nitrógeno': 'urea', 'nitrogeno': 'urea',
  'fosfato': 'fosfato', 'fósforo': 'fosfato', 'fosforo': 'fosfato',
  'mancozeb': 'mancozeb',
  'clorotalonil': 'clorotalonil', 'clorotalonilo': 'clorotalonil',
  'glifosato': 'glifosato', 'roundup': 'glifosato',
  'abono': 'abono_organico', 'abono organico': 'abono_organico', 'compost': 'abono_organico',
  'semilla papa': 'semilla_papa', 'papa': 'semilla_papa',
  'semilla maiz': 'semilla_maiz', 'maíz': 'semilla_maiz', 'maiz': 'semilla_maiz',
  'cipermetrina': 'cipermetrina',
};

function normalizarProducto(busqueda) {
  const lower = busqueda.toLowerCase().trim();
  for (const [key, val] of Object.entries(MAPA_PRODUCTOS)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

function buscarMLLink(producto) {
  return `https://listado.mercadolibre.com.pe/${encodeURIComponent(producto.replace(/\s+/g, '-'))}`;
}

export async function buscarOfertasAgricolas(producto = null) {
  const productosBusqueda = producto ? [producto] : PRODUCTOS_BUSCAR.slice(0, 5);
  const todasLasOfertas = [];

  // 1. Precios de referencia MIDAGRI con link a MercadoLibre
  for (const prod of productosBusqueda) {
    const clave = normalizarProducto(prod);
    if (clave && PRECIOS_MIDAGRI[clave]) {
      todasLasOfertas.push({
        producto: prod,
        precio: PRECIOS_MIDAGRI[clave].precio,
        unidad: PRECIOS_MIDAGRI[clave].unidad,
        tienda: 'Precio de referencia MIDAGRI',
        url: buscarMLLink(prod),
        fuente: 'MIDAGRI',
        ubicacion: 'Nacional'
      });
    }
  }

  // 2. Buscar en MercadoLibre vía proxy
  for (const prod of productosBusqueda.slice(0, 3)) {
    try {
      const url = `/api/ml-proxy?q=${encodeURIComponent(prod)}&limit=5`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeout);

      if (!res.ok) {
        // Si ML falla, agregar link de búsqueda
        todasLasOfertas.push({
          producto: `Buscar "${prod}" en MercadoLibre`,
          precio: null,
          tienda: 'MercadoLibre',
          url: buscarMLLink(prod),
          fuente: 'MercadoLibre',
          ubicacion: 'Perú'
        });
        continue;
      }

      const data = await res.json();
      if (!data.results) continue;

      const ofertas = data.results.slice(0, 5).map(item => ({
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
        ventas: item.sold_quantity || 0
      }));
      todasLasOfertas.push(...ofertas);
    } catch (e) {
      // Si falla, agregar link de búsqueda
      todasLasOfertas.push({
        producto: `Buscar "${prod}" en MercadoLibre`,
        precio: null,
        tienda: 'MercadoLibre',
        url: buscarMLLink(prod),
        fuente: 'MercadoLibre',
        ubicacion: 'Perú'
      });
    }
  }

  return todasLasOfertas;
}

export function filtrarOfertasPorZona(ofertas, departamento) {
  if (!departamento) return ofertas;
  return ofertas.filter(o =>
    o.ubicacion?.toLowerCase().includes(departamento.toLowerCase())
  );
}

export function ordenarPorPrecio(ofertas, asc = true) {
  return [...ofertas].sort((a, b) => asc ? a.precio - b.precio : b.precio - a.precio);
}
