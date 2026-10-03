const CATEGORIAS = [
  'Fertilizantes', 'Fungicidas', 'Herbicidas', 'Insecticidas', 'Biodefensas',
  'Riego', 'Fumigadoras', 'Maquinaria', 'Herramientas', 'Tecnología',
  'Protección', 'Semillas', 'Otros'
];

export async function buscarOfertasAgricolas(producto = null) {
  try {
    const params = new URLSearchParams();
    if (producto) params.set('q', producto);
    const url = `/api/ml-proxy?${params.toString()}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map(p => ({
      ...p,
      fuente: 'MercadoLibre',
    }));
  } catch {
    return [];
  }
}

export async function buscarPorCategoria(categoria) {
  try {
    const url = `/api/ml-proxy?cat=${encodeURIComponent(categoria)}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map(p => ({
      ...p,
      fuente: 'MercadoLibre',
    }));
  } catch {
    return [];
  }
}

export function filtrarOfertasPorZona(ofertas, departamento) {
  if (!departamento) return ofertas;
  return ofertas.filter(o => o.ubicacion?.toLowerCase().includes(departamento.toLowerCase()));
}

export function ordenarPorPrecio(ofertas, asc = true) {
  return [...ofertas].sort((a, b) => (a.precio || 9999) - (b.precio || 9999));
}
