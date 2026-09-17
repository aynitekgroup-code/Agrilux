import { buscarOfertasAgricolas } from './precioAgricolaAgent';
import { buscarOfertasPublicas, calcularMejoresOfertas } from './ofertasPublicasAgent';
import { buscarTiendasCercanas } from './tiendasCercanasAgent';
import { supabase } from '../supabase';

const ESTADO_KEY = 'agrilux_agentes_estado';

let running = false;
let listeners = [];

export function onAgentUpdate(callback) {
  listeners.push(callback);
  return () => { listeners = listeners.filter(l => l !== callback); };
}

function notify(status) {
  listeners.forEach(l => l(status));
}

export function getEstadoAgentes() {
  try {
    return JSON.parse(localStorage.getItem(ESTADO_KEY)) || {};
  } catch { return {}; }
}

function guardarEstado(estado) {
  localStorage.setItem(ESTADO_KEY, JSON.stringify(estado));
  notify(estado);
}

export async function ejecutarAgentes(busqueda = null) {
  if (running) return { ok: false, msg: 'Ya están ejecutándose agentes' };
  running = true;

  const estado = {
    ejecutando: true,
    inicio: new Date().toISOString(),
    agentes: {},
    ofertasEncontradas: 0,
    tiendasEncontradas: 0
  };
  guardarEstado(estado);

  try {
    // 1. Agente de precios agrícolas
    estado.agentes.precios = { estado: 'ejecutando', inicio: Date.now() };
    guardarEstado(estado);
    const ofertasPrecios = await buscarOfertasAgricolas(busqueda);
    estado.agentes.precios = { estado: 'completado', ofertas: ofertasPrecios.length, duracion: Date.now() - estado.agentes.precios.inicio };
    guardarEstado(estado);

    // 2. Agente de ofertas públicas
    estado.agentes.ofertas = { estado: 'ejecutando', inicio: Date.now() };
    guardarEstado(estado);
    const ofertasPublicas = await buscarOfertasPublicas(busqueda);
    const mejoresOfertas = calcularMejoresOfertas(ofertasPublicas);
    estado.agentes.ofertas = { estado: 'completado', ofertas: ofertasPublicas.length, duracion: Date.now() - estado.agentes.ofertas.inicio };
    guardarEstado(estado);

    // 3. Agente de tiendas cercanas
    estado.agentes.tiendas = { estado: 'ejecutando', inicio: Date.now() };
    guardarEstado(estado);
    const tiendas = await buscarTiendasCercanas();
    estado.agentes.tiendas = { estado: 'completado', tiendas: tiendas.length, duracion: Date.now() - estado.agentes.tiendas.inicio };
    guardarEstado(estado);

    // Combinar todas las ofertas
    const todasLasOfertas = [
      ...ofertasPrecios.map(o => ({ ...o, tipo: 'precio_agricola' })),
      ...mejoresOfertas.slice(0, 20).map(o => ({ ...o, tipo: 'oferta_publica' }))
    ];

    // Guardar en Supabase
    if (todasLasOfertas.length > 0) {
      const registros = todasLasOfertas.map(o => ({
        producto: o.producto,
        precio: o.precio,
        tienda: o.tienda,
        fuente: o.fuente,
        url: o.url,
        ubicacion: o.ubicacion,
        tipo: o.tipo,
        metadata: JSON.stringify({
          descuento: o.descuento,
          envio_gratis: o.envio_gratis,
          imagen: o.imagen
        })
      }));

      const { error } = await supabase
        .from('ofertas_agentes')
        .insert(registros);

      if (error) {
        console.warn('[AgentRunner] Error guardando en Supabase:', error.message);
      }
    }

    estado.ejecutando = false;
    estado.fin = new Date().toISOString();
    estado.ofertasEncontradas = todasLasOfertas.length;
    estado.tiendasEncontradas = tiendas.length;
    estado.todasLasOfertas = todasLasOfertas;
    estado.tiendas = tiendas;
    guardarEstado(estado);

    running = false;
    return {
      ok: true,
      ofertas: todasLasOfertas,
      tiendas,
      estadisticas: {
        precios: ofertasPrecios.length,
        ofertasPublicas: ofertasPublicas.length,
        tiendasEncontradas: tiendas.length
      }
    };

  } catch (e) {
    estado.ejecutando = false;
    estado.error = e.message;
    guardarEstado(estado);
    running = false;
    return { ok: false, msg: e.message };
  }
}

export async function cargarOfertasGuardadas() {
  try {
    const { data, error } = await supabase
      .from('ofertas_agentes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn('[AgentRunner] Error cargando ofertas guardadas:', e.message);
    return [];
  }
}
