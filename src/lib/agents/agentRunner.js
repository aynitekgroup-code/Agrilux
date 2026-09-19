import { buscarOfertasAgricolas } from './precioAgricolaAgent';
import { supabase } from '../supabase';

const ESTADO_KEY = 'agrilux_agentes_estado';
const OFERTAS_KEY = 'agrilux_ofertas_agentes';

let running = false;
let listeners = [];

export function onAgentUpdate(callback) {
  listeners.push(callback);
  return () => { listeners = listeners.filter(l => l !== callback); };
}

function notify(status) {
  listeners.forEach(l => l(status));
}

function guardarEstado(estado) {
  localStorage.setItem(ESTADO_KEY, JSON.stringify(estado));
  notify(estado);
}

function guardarOfertasLocal(ofertas) {
  try {
    localStorage.setItem(OFERTAS_KEY, JSON.stringify({
      ofertas,
      timestamp: Date.now()
    }));
  } catch (e) {}
}

export async function ejecutarAgentes(busqueda = null) {
  if (running) return { ok: false, msg: 'Ya están ejecutándose agentes' };
  running = true;

  const estado = {
    ejecutando: true,
    inicio: new Date().toISOString(),
    agentes: {},
    ofertasEncontradas: 0,
  };
  guardarEstado(estado);

  try {
    // Buscar productos reales de MercadoLibre
    estado.agentes.productos = { estado: 'ejecutando', inicio: Date.now() };
    guardarEstado(estado);

    const ofertas = await buscarOfertasAgricolas(busqueda);

    estado.agentes.productos = {
      estado: 'completado',
      ofertas: ofertas.length,
      duracion: Date.now() - estado.agentes.productos.inicio
    };
    guardarEstado(estado);

    // Guardar en localStorage
    guardarOfertasLocal(ofertas);

    // Intentar guardar en Supabase (opcional)
    try {
      if (ofertas.length > 0) {
        const registros = ofertas.slice(0, 20).map(o => ({
          producto: o.producto,
          precio: o.precio,
          tienda: o.tienda,
          fuente: o.fuente || 'MercadoLibre',
          url: o.url,
          ubicacion: o.ubicacion || 'Perú',
          tipo: 'oferta_ml',
          metadata: JSON.stringify({
            descuento: o.descuento,
            envio_gratis: o.envio_gratis,
            imagen: o.imagen,
            categoria: o.categoria,
          })
        }));

        await supabase.from('ofertas_agentes').insert(registros);
      }
    } catch (e) {
      // Supabase opcional
    }

    estado.ejecutando = false;
    estado.fin = new Date().toISOString();
    estado.ofertasEncontradas = ofertas.length;
    estado.todasLasOfertas = ofertas;
    guardarEstado(estado);

    running = false;
    return { ok: true, ofertas, estadisticas: { productos: ofertas.length } };

  } catch (e) {
    estado.ejecutando = false;
    estado.error = e.message;
    guardarEstado(estado);
    running = false;
    return { ok: false, msg: e.message };
  }
}

export async function cargarOfertasAgentesLocal() {
  try {
    const local = JSON.parse(localStorage.getItem(OFERTAS_KEY));
    if (local?.ofertas && local.ofertas.length > 0) {
      if (Date.now() - local.timestamp < 3600000) {
        return local.ofertas;
      }
    }
  } catch (e) {}
  return [];
}
