const PRODUCTOS_BUSCAR = [
  'fertilizante', 'urea', 'superfosfato', 'cloruro potasio',
  'mancozeb', 'cipermetrina', 'glifosato', 'abono organico',
  'semilla papa', 'semilla maiz', 'huarochi', 'fungicida',
  'insecticida', 'herbicida', 'caldo bordelés', 'sulfato cobre',
  'peatrosol', 'trichoderma', 'beauveria', 'biodefensas'
];

const FUENTES = [
  {
    nombre: 'MercadoLibre',
    baseUrl: 'https://api.mercadolibre.com/sites/MLU/search?q=',
    parseResultado: (data) => {
      if (!data.results) return [];
      return data.results.slice(0, 5).map(item => ({
        producto: item.title,
        precio: item.price,
        tienda: item.seller?.nickname || 'MercadoLibre',
        url: item.permalink,
        fuente: 'MercadoLibre',
        ubicacion: item.address?.state_name || 'Perú'
      }));
    }
  },
  {
    nombre: 'SISAP',
    baseUrl: 'https://apps.fao.org/sisamc/api/v1/prices?commodity=',
    parseResultado: (data) => {
      if (!data?.data) return [];
      return data.data.slice(0, 3).map(item => ({
        producto: item.commodity_name,
        precio: item.value,
        tienda: 'SISAP (Oficial)',
        url: null,
        fuente: 'SISAP',
        ubicacion: item.department || 'Nacional'
      }));
    }
  }
];

export async function buscarOfertasAgricolas(producto = null) {
  const productosBusqueda = producto ? [producto] : PRODUCTOS_BUSCAR.slice(0, 5);
  const todasLasOfertas = [];

  for (const prod of productosBusqueda) {
    for (const fuente of FUENTES) {
      try {
        const url = `${fuente.baseUrl}${encodeURIComponent(prod)}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(url, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeout);

        if (!res.ok) continue;

        const data = await res.json();
        const ofertas = fuente.parseResultado(data);
        todasLasOfertas.push(...ofertas);
      } catch (e) {
        console.warn(`[AgentePrecios] Error en ${fuente.nombre} para "${prod}":`, e.message);
      }
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
