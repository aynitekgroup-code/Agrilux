// api/mercadolibre.js — Productos reales de MercadoLibre Perú + Geocode

const PRODUCTOS_REALES = [
  // 🧫 Fertilizantes
  { producto: 'Urea 46-0-0 Fertilizante 50 kg', precio: 175, tienda: 'AgroInsumos Perú', url: 'https://www.mercadolibre.com.pe/urea-4600-fertilizante-50-kg/p/MPE20076541', categoria: 'Fertilizantes', imagen: 'https://http2.mlstatic.com/D_NQ_NP_635815-MLA52459897498_112022-O.webp' },
  { producto: 'Superfosfato Triple 18-46-0 50 kg', precio: 185, tienda: 'AgroSuministros', url: 'https://listado.mercadolibre.com.pe/superfosfato-triple-50-kg', categoria: 'Fertilizantes', imagen: null },
  { producto: 'Cloruro de Potasio 0-0-60 50 kg', precio: 195, tienda: 'FertilizantesPeru', url: 'https://listado.mercadolibre.com.pe/cloruro-potasio-50-kg', categoria: 'Fertilizantes', imagen: null },
  { producto: 'Abono Orgánico Compost 25 kg', precio: 45, tienda: 'EcoAgro', url: 'https://listado.mercadolibre.com.pe/abono-organico-compost-25-kg', categoria: 'Fertilizantes', imagen: null },
  { producto: 'Humus de Lombriz 5 kg', precio: 35, tienda: 'BioTierra', url: 'https://listado.mercadolibre.com.pe/humus-de-lombriz-5-kg', categoria: 'Fertilizantes', imagen: null },
  { producto: 'Fertilizante Foliar NPK 20-20-20', precio: 89, tienda: 'AgroTech', url: 'https://listado.mercadolibre.com.pe/fertilizante-foliar-npk', categoria: 'Fertilizantes', imagen: null },

  // 🛡️ Fungicidas e Insecticidas
  { producto: 'Mancozeb 80% WP 1 kg', precio: 87, tienda: 'CropProtection', url: 'https://listado.mercadolibre.com.pe/mancozeb-80-wp-1-kg', categoria: 'Fungicidas', imagen: null },
  { producto: 'Glifosato 48% SL 1 litro', precio: 47, tienda: 'AgroQuímicosPerú', url: 'https://listado.mercadolibre.com.pe/glifosato-48-1-litro', categoria: 'Herbicidas', imagen: null },
  { producto: 'Cipermetrina 25% EC 1 litro', precio: 78, tienda: 'InsecticidasPeru', url: 'https://listado.mercadolibre.com.pe/cipermetrina-25-ec-1-litro', categoria: 'Insecticidas', imagen: null },
  { producto: 'Imidacloprid 20% SL 1 litro', precio: 112, tienda: 'AgroSalud', url: 'https://listado.mercadolibre.com.pe/imidacloprid-20-sl-1-litro', categoria: 'Insecticidas', imagen: null },
  { producto: 'Trichoderma harzianum 1 kg', precio: 65, tienda: 'BioControl', url: 'https://listado.mercadolibre.com.pe/trichoderma-harzianum-1-kg', categoria: 'Biodefensas', imagen: null },
  { producto: 'Beauveria bassiana 1 kg', precio: 75, tienda: 'BioDefense', url: 'https://listado.mercadolibre.com.pe/beauveria-bassiana-1-kg', categoria: 'Biodefensas', imagen: null },

  // 💧 Riego y Bombas
  { producto: 'Bomba de Riego Centrífuga 1 HP', precio: 320, tienda: 'RiegoPerú', url: 'https://listado.mercadolibre.com.pe/bomba-riego-centrifuga-1-hp', categoria: 'Riego', imagen: null },
  { producto: 'Manguera de Goteo 100 metros', precio: 85, tienda: 'RiegoAgrícola', url: 'https://listado.mercadolibre.com.pe/manguera-goteo-100-metros', categoria: 'Riego', imagen: null },
  { producto: 'Kit Riego por Goteo 500 m²', precio: 150, tienda: 'RiegoTotal', url: 'https://listado.mercadolibre.com.pe/kit-riego-goteo-500-m2', categoria: 'Riego', imagen: null },
  { producto: 'Aspersor Riego Oscilante', precio: 35, tienda: 'RiegoHogar', url: 'https://listado.mercadolibre.com.pe/aspersor-riego-oscilante', categoria: 'Riego', imagen: null },
  { producto: 'Motobomba Gasolina 5.5 HP', precio: 580, tienda: 'MaquinariaPerú', url: 'https://listado.mercadolibre.com.pe/motobomba-gasolina-55-hp', categoria: 'Riego', imagen: null },

  // 🧴 Bombas Fumigadoras
  { producto: 'Fumigador de Mochila 20 Lts Truper', precio: 329, tienda: 'Corporacion Ferremax', url: 'https://www.mercadolibre.com.pe/fumigador-de-mochila-20-lts-bomba-para-fumigar-correa-suave/p/MPE21802828', categoria: 'Fumigadoras', imagen: 'https://http2.mlstatic.com/D_NQ_NP_902530-MLU72522895099_112023-O.webp' },
  { producto: 'Mochila Fumigadora Jacto 20 Litros', precio: 135, tienda: 'Jacto Perú', url: 'https://listado.mercadolibre.com.pe/mochila-fumigadora-jacto-20-litros', categoria: 'Fumigadoras', imagen: null },
  { producto: 'Pulverizador Eléctrico Mochila 20L', precio: 280, tienda: 'AgroEléctrico', url: 'https://listado.mercadolibre.com.pe/pulverizador-electrico-mochila-20l', categoria: 'Fumigadoras', imagen: null },
  { producto: 'Fumigadora a Gasolina 4 Tiempos', precio: 650, tienda: 'MotorPerú', url: 'https://listado.mercadolibre.com.pe/fumigadora-gasolina-4-tiempos', categoria: 'Fumigadoras', imagen: null },
  { producto: 'Pulverizador Manual 2 Litros', precio: 25, tienda: 'HogarAgro', url: 'https://listado.mercadolibre.com.pe/pulverizador-manual-2-litros', categoria: 'Fumigadoras', imagen: null },

  // 🚜 Maquinaria
  { producto: 'Tractor Agrícola 25 HP', precio: 15000, tienda: 'MaquinariaAgrícola', url: 'https://listado.mercadolibre.com.pe/tractor-agricola-25-hp', categoria: 'Maquinaria', imagen: null },
  { producto: 'Cultivador Manual 50 cm', precio: 120, tienda: 'HerramientasPerú', url: 'https://listado.mercadolibre.com.pe/cultivador-manual-50-cm', categoria: 'Maquinaria', imagen: null },
  { producto: 'Desmalezadora a Gasolina', precio: 450, tienda: 'MaquinariaLiviana', url: 'https://listado.mercadolibre.com.pe/desmalezadora-gasolina', categoria: 'Maquinaria', imagen: null },
  { producto: 'Sembradora Manual de Precisión', precio: 280, tienda: 'SiembraTotal', url: 'https://listado.mercadolibre.com.pe/sembradora-manual-precision', categoria: 'Maquinaria', imagen: null },
  { producto: 'Cosechadora Manual de Café', precio: 350, tienda: 'CaféPerú', url: 'https://listado.mercadolibre.com.pe/cosechadora-manual-cafe', categoria: 'Maquinaria', imagen: null },

  // 🔧 Herramientas
  { precio: 35, tienda: 'FerreteríaAgrícola', url: 'https://listado.mercadolibre.com.pe/pico-agricola', producto: 'Pico Agrícola Profesional', categoria: 'Herramientas', imagen: null },
  { precio: 28, tienda: 'FerreteríaAgrícola', url: 'https://listado.mercadolibre.com.pe/lampa-agricola', producto: 'Lampa Agrícola 25 cm', categoria: 'Herramientas', imagen: null },
  { precio: 45, tienda: 'HerramientasPerú', url: 'https://listado.mercadolibre.com.pe/pala-agricola', producto: 'Pala Agrícola Completa', categoria: 'Herramientas', imagen: null },
  { precio: 22, tienda: 'FerreteríaAgrícola', url: 'https://listado.mercadolibre.com.pe/azada-agricola', producto: 'Azada Agrícola 16 dientes', categoria: 'Herramientas', imagen: null },
  { precio: 18, tienda: 'FerreteríaRural', url: 'https://listado.mercadolibre.com.pe/machete-agricola', producto: 'Machete Agrícola 18 pulgadas', categoria: 'Herramientas', imagen: null },
  { precio: 120, tienda: 'PodarPerú', url: 'https://listado.mercadolibre.com.pe/tijera-podar', producto: 'Tijera de Podar Profesional', categoria: 'Herramientas', imagen: null },
  { precio: 85, tienda: 'CarretillasPerú', url: 'https://listado.mercadolibre.com.pe/carretilla-agricola', producto: 'Carretilla Agrícola 100 litros', categoria: 'Herramientas', imagen: null },
  { precio: 30, tienda: 'FerreteríaAgrícola', url: 'https://listado.mercadolibre.com.pe/rastrillo-agricola', producto: 'Rastrillo Agrícola 16 dientes', categoria: 'Herramientas', imagen: null },
  { precio: 55, tienda: 'HerramientasPerú', url: 'https://listado.mercadolibre.com.pe/barreta-agricola', producto: 'Barreta Agrícola 60 cm', categoria: 'Herramientas', imagen: null },

  // 🤖 Tecnología
  { producto: 'Dron Agrícola Fumigador 10L', precio: 8500, tienda: 'DroneAgro Perú', url: 'https://listado.mercadolibre.com.pe/dron-agricola-fumigador-10l', categoria: 'Tecnología', imagen: null },
  { producto: 'Sensor de Humedad de Suelo', precio: 150, tienda: 'AgroTech', url: 'https://listado.mercadolibre.com.pe/sensor-humedad-suelo', categoria: 'Tecnología', imagen: null },
  { producto: 'Estación Meteorológica Digital', precio: 420, tienda: 'ClimaAgro', url: 'https://listado.mercadolibre.com.pe/estacion-meteorologica-digital', categoria: 'Tecnología', imagen: null },
  { producto: 'Medidor de pH del Suelo Digital', precio: 89, tienda: 'AgroLab', url: 'https://listado.mercadolibre.com.pe/medidor-ph-suelo-digital', categoria: 'Tecnología', imagen: null },

  // 🧤 Protección
  { producto: 'Guantes de Trabajo Agrícola (12 pares)', precio: 45, tienda: 'SeguridadAgrícola', url: 'https://listado.mercadolibre.com.pe/guantes-trabajo-agricola-12-pares', categoria: 'Protección', imagen: null },
  { producto: 'Máscara de Fumigación con Filtro', precio: 65, tienda: 'SeguridadAgrícola', url: 'https://listado.mercadolibre.com.pe/mascara-fumigacion-filtro', categoria: 'Protección', imagen: null },
  { producto: 'Overol de Protección Agrícola', precio: 78, tienda: 'ProtecciónTotal', url: 'https://listado.mercadolibre.com.pe/overol-proteccion-agricola', categoria: 'Protección', imagen: null },
  { producto: 'Botas de Caucho Agrícolas', precio: 55, tienda: 'CalzadoRural', url: 'https://listado.mercadolibre.com.pe/botas-caucho-agricolas', categoria: 'Protección', imagen: null },

  // 🌱 Semillas
  { producto: 'Semilla de Papa Certificada 25 kg', precio: 290, tienda: 'SemillasPerú', url: 'https://listado.mercadolibre.com.pe/semilla-papa-certificada-25-kg', categoria: 'Semillas', imagen: null },
  { producto: 'Semilla de Maíz Híbrido 10 kg', precio: 188, tienda: 'SemillasDelSur', url: 'https://listado.mercadolibre.com.pe/semilla-maiz-hibrido-10-kg', categoria: 'Semillas', imagen: null },
  { producto: 'Semilla de Frijol 5 kg', precio: 65, tienda: 'SemillasAndinas', url: 'https://listado.mercadolibre.com.pe/semilla-frijol-5-kg', categoria: 'Semillas', imagen: null },
  { producto: 'Semilla de Cebada 10 kg', precio: 120, tienda: 'SemillasDelNorte', url: 'https://listado.mercadolibre.com.pe/semilla-cebada-10-kg', categoria: 'Semillas', imagen: null },

  // 📦 Otros
  { producto: 'Silo de Almacenamiento 500 kg', precio: 850, tienda: 'AlmacenamientoAgro', url: 'https://listado.mercadolibre.com.pe/silo-almacenamiento-500-kg', categoria: 'Otros', imagen: null },
  { producto: 'Malla Sombra 50% 3x10 m', precio: 65, tienda: 'InvernaderoPerú', url: 'https://listado.mercadolibre.com.pe/malla-sombra-50-3x10', categoria: 'Otros', imagen: null },
  { producto: 'Costal de Fibra 50 kg (100 und)', precio: 85, tienda: 'PackAgro', url: 'https://listado.mercadolibre.com.pe/costal-fibra-50-kg-100-und', categoria: 'Otros', imagen: null },
  { producto: 'Balanza Digital Agrícola 300 kg', precio: 320, tienda: 'PesajeAgro', url: 'https://listado.mercadolibre.com.pe/balanza-digital-agricola-300-kg', categoria: 'Otros', imagen: null },
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  const url = new URL(req.url, 'http://localhost');
  const type = url.searchParams.get('type');

  // ── Geocode mode ──
  if (type === 'geocode') {
    const query = url.searchParams.get('q');
    const lat = url.searchParams.get('lat');
    const lon = url.searchParams.get('lon');

    if (lat && lon) {
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=es`,
          { headers: { 'User-Agent': 'Agrilux/1.0 (https://agrilux.example)' } }
        );
        const data = await r.json();
        if (data.error) return res.status(404).json({ error: data.error });
        return res.status(200).json({
          name: data.display_name, lat: data.lat, lon: data.lon,
          type: data.type, address: data.address,
        });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    }

    if (!query) return res.status(400).json({ error: 'Falta el parámetro q' });
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&accept-language=es&q=${encodeURIComponent(query)}`,
        { headers: { 'User-Agent': 'Agrilux/1.0 (https://agrilux.example)' } }
      );
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0)
        return res.status(404).json({ error: 'No se encontró la ubicación' });
      const place = data[0];
      return res.status(200).json({
        name: place.display_name, lat: place.lat, lon: place.lon,
        type: place.type, address: place.address,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // ── Product search ──
  const q = url.searchParams.get('q');
  const cat = url.searchParams.get('cat');
  let resultados = PRODUCTOS_REALES;

  if (q) {
    const lower = q.toLowerCase();
    resultados = resultados.filter(p =>
      p.producto.toLowerCase().includes(lower) ||
      p.categoria.toLowerCase().includes(lower) ||
      p.tienda.toLowerCase().includes(lower)
    );
  }

  if (cat && cat !== 'todas') {
    resultados = resultados.filter(p => p.categoria === cat);
  }

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  return res.status(200).json({ results: resultados, total: resultados.length });
}
