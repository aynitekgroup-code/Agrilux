/**
 * agentes/zonar/src/envivo.js
 * Modo EN VIVO (14/11/2026): Agrilux conectado a Zonar casi en tiempo real.
 *
 *   cada 10 min → GetUnitsLocator (posición actual de TODAS las unidades,
 *                 una sola llamada) → agrotrack_posiciones → el trigger
 *                 actualiza agrotrack_estado_vivo → Realtime avisa a la web.
 *   cada 10 min → GetUnitsHistory de HOY por unidad (los puntos de cada
 *                 2 minutos entre lectura y lectura, igual que la descarga
 *                 diaria; lo repetido se descarta por source_key) y luego
 *                 se calculan las visitas a geocercas pendientes de hoy.
 *
 * Todo sale por la IP de esta PC, con el mismo usuario de Zonar del agente
 * diario. Se detiene con Ctrl+C. Si algo falla, espera y reintenta solo.
 */
import { loginZonar, crudoUnidades, listarUnidades, historialUnidad, hoyPeru, restarDias, dormir } from './zonar.js';
import { conectarAgrilux, subirPosiciones, registrarLatido, calcularVisitasPendientes } from './agrilux.js';
import { filasDesdeLocalizador } from '../lib/localizador.js';
import { armarFilaZonar } from '../lib/parse.js';

const RELOGIN_MS = 4 * 3600 * 1000; // el token de Zonar se renueva cada 4 h

export async function ejecutarEnVivo(cfg, opts, log) {
  const intervaloMs = Math.max(60, Number(opts.intervaloSeg || cfg.envivo.intervalo_seg)) * 1000;
  const historialMs = Math.max(5, Number(opts.historialMin || cfg.envivo.historial_min)) * 60 * 1000;
  const unaVez = Boolean(opts.unaVez);

  log.info(`Modo EN VIVO · posiciones cada ${intervaloMs / 1000} s · historial de hoy cada ${historialMs / 60000} min${unaVez ? ' · una sola vuelta' : ''}.`);

  let agrilux = await conectarAgrilux(cfg.agrilux);
  log.info(`Agrilux: sesión iniciada · empresa ${agrilux.empresaId}.`);

  let sesion = null;
  let sesionEn = 0;
  let ultimoHistorial = 0;
  let fallosSeguidos = 0;
  let detener = false;
  process.on('SIGINT', () => { detener = true; log.info('Deteniendo el modo en vivo…'); });

  const asegurarSesion = async (forzar = false) => {
    if (!sesion || forzar || Date.now() - sesionEn > RELOGIN_MS) {
      sesion = await loginZonar(cfg.zonar);
      sesionEn = Date.now();
      log.info(`Zonar: sesión iniciada (${sesion.fullname || cfg.zonar.usuario}).`);
    }
    return sesion;
  };

  while (!detener) {
    const t0 = Date.now();
    try {
      await asegurarSesion();

      // 1) Foto de todas las unidades (una llamada).
      let marcas;
      try {
        marcas = await crudoUnidades(cfg.zonar, sesion.token);
      } catch (e) {
        // token vencido: un re-login y un reintento
        await asegurarSesion(true);
        marcas = await crudoUnidades(cfg.zonar, sesion.token);
      }
      const { filas, invalidas, ejemplos } = filasDesdeLocalizador(marcas, agrilux.empresaId, agrilux.userId, {
        fechaModo: cfg.corrida.fecha_modo,
      });
      if (invalidas && fallosSeguidos === 0) ejemplos.forEach((x) => log.aviso(`  marcador sin datos completos: ${x}`));
      let nuevas = 0;
      try {
        nuevas = filas.length ? await subirPosiciones(agrilux.supabase, filas) : 0;
      } catch (e) {
        // la sesión de Supabase dura ~1 h: se renueva y se reintenta una vez
        agrilux = await conectarAgrilux(cfg.agrilux);
        nuevas = filas.length ? await subirPosiciones(agrilux.supabase, filas) : 0;
      }
      log.info(`En vivo: ${marcas.length} unidades leídas · ${filas.length} posiciones válidas · ${nuevas} nuevas.`);

      // 2) Historial de hoy (cada historial_min) + visitas pendientes.
      if (Date.now() - ultimoHistorial >= historialMs) {
        ultimoHistorial = Date.now();
        const hoy = hoyPeru();
        const unidades = await listarUnidades(cfg.zonar, sesion.token);
        const filasHist = [];
        for (const u of unidades) {
          try {
            const hist = await historialUnidad(cfg.zonar, sesion.token, { unitId: u.unitId, desde: hoy, hasta: hoy });
            for (const m of hist) {
              const { row } = armarFilaZonar(m, agrilux.empresaId, agrilux.userId, { fechaModo: cfg.corrida.fecha_modo });
              if (row) filasHist.push(row);
            }
          } catch (e) {
            log.aviso(`  historial de ${u.nombre}: ${e.message}`);
          }
          if (cfg.corrida.delay_ms > 0) await dormir(cfg.corrida.delay_ms);
        }
        const unicas = [...new Map(filasHist.map((f) => [f.source_key, f])).values()];
        const nuevasHist = unicas.length ? await subirPosiciones(agrilux.supabase, unicas) : 0;
        nuevas += nuevasHist;
        log.info(`Historial de hoy: ${unicas.length} puntos · ${nuevasHist} nuevos.`);
        try {
          const n = await calcularVisitasPendientes(agrilux, restarDias(hoy, 1), hoy);
          if (n) log.info(`Visitas a geocercas recalculadas: ${n} (día, placa).`);
        } catch (e) {
          log.aviso(`Visitas a geocercas: ${e.message}`);
        }
      }

      await registrarLatido(agrilux, 'envivo', { ok: true, unidades: marcas.length, nuevas });
      fallosSeguidos = 0;
    } catch (e) {
      fallosSeguidos += 1;
      log.error(`En vivo (intento ${fallosSeguidos}): ${e.message}`);
      try {
        await registrarLatido(agrilux, 'envivo', { ok: false, mensaje: e.message });
      } catch {
        /* sin conexión a Agrilux: se reintenta en la próxima vuelta */
      }
      sesion = null; // fuerza un login nuevo
    }

    if (unaVez) break;
    // Espera hasta la próxima vuelta (más larga si viene fallando).
    const espera = Math.min(intervaloMs * Math.max(1, fallosSeguidos), 15 * 60 * 1000) - (Date.now() - t0);
    const fin = Date.now() + Math.max(espera, 5000);
    while (!detener && Date.now() < fin) await dormir(1000);
  }
  log.info('Modo en vivo detenido.');
}
