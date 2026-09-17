const PRODUCTOS_POR_CATEGORIA = {
  '🧫 Fertilizantes': [
    'fertilizante urea', 'superfosfato triple', 'cloruro potasio',
    'nitrato amonio', 'sulfato amonio', 'fosfato diamonico',
    'abono organico compost', 'humus de lombriz', 'guano isla',
    'fertilizante foliar', 'condicionador de suelo'
  ],
  '🛡️ Fungicidas e Insecticidas': [
    'mancozeb', 'cipermetrina', 'glifosato', 'imidacloprid',
    'abamectina', 'lambda cialotrina', 'bifentrina',
    'trichoderma', 'beauveria bassiana', 'caldo bordales',
    'sulfato cobre', 'oxido cuprico'
  ],
  '💧 Riego y Bombas': [
    'bomba de riego centrifuga', 'bomba de riego sumergible',
    'manguera de goteo', 'cinta de riego', 'aspersor riego',
    'kit riego por goteo', 'timer riego automatico',
    'bomba de presion', 'motobomba'
  ],
  '🧴 Bombas Fumigadoras': [
    'bomba fumigadora de mochila', 'fumigadora electrica',
    'pulverizador manual', 'pulverizador a bateria',
    'fumigadora a gasolina', 'nebulizador agricola',
    'mochila fumigadora 20 litros', 'fumigadora truper'
  ],
  '🚜 Maquinaria': [
    'tractor agricola', 'cultivador manual', 'arado',
    'sembradora manual', 'cosechadora', 'desmalezadora',
    'trilladora', 'descascaradora de arroz', 'beneficiadora de cafe'
  ],
  '🔧 Herramientas': [
    'pico agricola', 'lampa', 'pala agricola', 'azada',
    'rastrillo', 'machete agricola', 'tijera de podar',
    'sierra de mano', 'barreta', 'carretilla',
    'almadana', 'hacha', 'palita'
  ],
  '🤖 Tecnología': [
    'dron agricola fumigador', 'dron pulidor', 'drone sembrador',
    'sensor humedad suelo', 'estacion meteorologica',
    'gps agricola', 'tablet campo', 'medidor ph suelo'
  ],
  '🧤 Protección': [
    'guantes trabajo agricola', 'mascara fumigacion',
    'overol protección', 'botas caucho', 'gafas protección',
    'tapones oidos', 'cara completa fumigador'
  ],
  '🌱 Semillas': [
    'semilla papa certificada', 'semilla maiz hibrido',
    'semilla frijol', 'semilla cebada', 'semilla trigo',
    'semilla tomate', 'semilla cebolla', 'semilla lechuga'
  ],
  '📦 Otros': [
    'silo almacenamiento', 'bodega agricola', 'costal fibra',
    'tendido secado', 'balanza digital', 'báscula agricola',
    'malla sombra', 'polietileno invernadero'
  ]
};

const PRECIOS_MIDAGRI = {
  urea: { precio: 175, unidad: 'S/ por kg' },
  superfosfato: { precio: 185, unidad: 'S/ por kg' },
  mancozeb: { precio: 87, unidad: 'S/ por kg' },
  clorotalonil: { precio: 95, unidad: 'S/ por kg' },
  glifosato: { precio: 47, unidad: 'S/ por litro' },
  cipermetrina: { precio: 78, unidad: 'S/ por litro' },
  imidacloprid: { precio: 112, unidad: 'S/ por litro' },
  abono_organico: { precio: 125, unidad: 'S/ por kg' },
  semilla_papa: { precio: 290, unidad: 'S/ por kg' },
  semilla_maiz: { precio: 188, unidad: 'S/ por kg' },
};

function linkML(q) {
  return `https://listado.mercadolibre.com.pe/${encodeURIComponent(q.replace(/\s+/g, '-'))}`;
}

async function buscarMLProductos(termino, limit = 3) {
  try {
    const url = `/api/ml-proxy?q=${encodeURIComponent(termino)}&limit=${limit}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map(item => ({
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
    }));
  } catch {
    return [];
  }
}

export async function buscarOfertasAgricolas(producto = null) {
  const todasLasOfertas = [];

  if (producto) {
    // Búsqueda específica
    const clave = producto.toLowerCase().replace(/\s+/g, '_');
    if (PRECIOS_MIDAGRI[clave]) {
      todasLasOfertas.push({
        producto, precio: PRECIOS_MIDAGRI[clave].precio,
        unidad: PRECIOS_MIDAGRI[clave].unidad,
        tienda: 'Precio de referencia MIDAGRI',
        url: linkML(producto), fuente: 'MIDAGRI', ubicacion: 'Nacional'
      });
    }
    const ml = await buscarMLProductos(producto, 8);
    todasLasOfertas.push(...ml);
    return todasLasOfertas;
  }

  // Búsqueda general: tomar 1 producto por categoría
  for (const [categoria, productos] of Object.entries(PRODUCTOS_POR_CATEGORIA)) {
    const prod = productos[0];
    const ml = await buscarMLProductos(prod, 2);
    if (ml.length > 0) {
      todasLasOfertas.push(...ml);
    }
  }

  // Agregar precios MIDAGRI
  for (const [clave, datos] of Object.entries(PRECIOS_MIDAGRI)) {
    todasLasOfertas.push({
      producto: clave.replace(/_/g, ' '),
      precio: datos.precio,
      unidad: datos.unidad,
      tienda: 'Precio de referencia MIDAGRI',
      url: linkML(clave.replace(/_/g, ' ')),
      fuente: 'MIDAGRI',
      ubicacion: 'Nacional'
    });
  }

  return todasLasOfertas;
}

export function filtrarOfertasPorZona(ofertas, departamento) {
  if (!departamento) return ofertas;
  return ofertas.filter(o => o.ubicacion?.toLowerCase().includes(departamento.toLowerCase()));
}

export function ordenarPorPrecio(ofertas, asc = true) {
  return [...ofertas].sort((a, b) => (a.precio || 9999) - (b.precio || 9999));
}
