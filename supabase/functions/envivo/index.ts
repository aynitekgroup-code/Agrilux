// supabase/functions/envivo/index.ts
// Envío Zonar → Agrilux cada 5 minutos, SIN ninguna PC encendida.
//
// Reutiliza el MISMO código del agente local (mismo parse, mismo source_key,
// mismo dedup) — la paridad está garantizada porque importa los archivos
// directamente desde agentes/zonar/:
//   - src/zonar.js     cliente HTTP de Zonar (login, locator, historial)
//   - lib/parse.js     conversión a filas de agrotrack_posiciones
//   - lib/localizador.js  normalización del GetUnitsLocator
//
// Flujo (presupuesto de 135 s, límite del plan gratuito = 150 s):
//   1) Login en Zonar.
//   2) GetUnitsLocator (foto de las 44 unidades, 1 llamada) → upsert.
//   3) GetUnitsHistory de HOY por unidad hasta agotar el presupuesto → upsert.
//      Si el tiempo se acaba, lo que se alcanzó queda subido y la próxima
//      vuelta (5 min después) continúa; el dedup por source_key evita duplicos.
//   4) Latido 'envivo' en agrotrack_zonar_latidos (la web lo muestra en verde).
//
// Credenciales: secrets del proyecto (ZONAR_USER, ZONAR_PASSWORD, ZONAR_APPID,
// EMPRESA_ID, AGRI_EMAIL, AGRI_PASSWORD). SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase.
import { createClient } from "npm:@supabase/supabase-js@2";
// @ts-ignore — módulos JS del agente (JS puro: fetch/Date, portables a Deno)
import { loginZonar, crudoUnidades, listarUnidades, historialUnidad, hoyPeru, restarDias } from "../../../agentes/zonar/src/zonar.js";
// @ts-ignore
import { filasDesdeLocalizador } from "../../../agentes/zonar/lib/localizador.js";
// @ts-ignore
import { armarFilaZonar } from "../../../agentes/zonar/lib/parse.js";

const EMPRESA_ID = Deno.env.get("EMPRESA_ID") ?? "";
const FECHA_MODO = "auto";
const DELAY_MS = 200; // cortesía con Zonar entre unidades
const LIMITE_MS = 135_000; // presupuesto total (el plan gratuito corta a 150 s)
const HIST_MIN_MS = 35_000; // deja al menos esto para subir + latido

const INICIO = Date.now();
const queda = () => LIMITE_MS - (Date.now() - INICIO);

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
// Cliente de la corrida actual: arranca como service role (por si el login de
// usuario falla) y se reemplaza por el de usuario en Deno.serve.
let sb = admin;

/**
 * Sesión como el usuario de Agrilux: el latido (agrotrack_registrar_latido)
 * valida la membresía con auth.uid(), que con la service role key no existe
 * ("No perteneces a esta empresa"). Se firma al inicio de cada corrida; el
 * mismo usuario que usa el agente local, así el RLS ve lo mismo.
 */
async function clienteUsuario() {
  const { data, error } = await admin.auth.signInWithPassword({
    email: Deno.env.get("AGRI_EMAIL")!,
    password: Deno.env.get("AGRI_PASSWORD")!,
  });
  if (error || !data?.session) {
    throw new Error(`Agrilux: ${error?.message ?? "sin sesión de usuario"}`);
  }
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${data.session.access_token}` } }, auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function cfgZonar() {
  return {
    base: "https://app.tsomobile.com",
    usuario: Deno.env.get("ZONAR_USER")!,
    password: Deno.env.get("ZONAR_PASSWORD")!,
    appid: Number(Deno.env.get("ZONAR_APPID") ?? 38),
    lang: "es",
  };
}

/** Upsert deduplicado por (empresa_id, source_key) — igual que el agente. */
async function subirPosiciones(filas: Record<string, unknown>[]): Promise<number> {
  let nuevas = 0;
  for (let i = 0; i < filas.length; i += 1000) {
    const lote = filas.slice(i, i + 1000);
    const { data, error } = await sb
      .from("agrotrack_posiciones")
      .upsert(lote, { onConflict: "empresa_id,source_key", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(`Agrilux: ${error.message}`);
    nuevas += data?.length ?? 0;
  }
  return nuevas;
}

/** Latido para la web ("Zonar leído hace N min"). */
async function latido(ok: boolean, unidades: number | null, nuevas: number | null, mensaje: string | null) {
  const { error } = await sb.rpc("agrotrack_registrar_latido", {
    p_empresa_id: EMPRESA_ID,
    p_modo: "envivo",
    p_ok: ok,
    p_unidades: unidades,
    p_nuevas: nuevas,
    p_mensaje: mensaje ? mensaje.slice(0, 500) : null,
  });
  // Si el SQL aún no se ejecutó, no rompe la corrida (mismo criterio que el agente).
  if (error && !/could not find|schema cache/i.test(error.message || "")) {
    console.error("latido:", error.message);
  }
}

/**
 * Visitas a geocercas pendientes de (ayer, hoy), de a una placa por llamada
 * (límite de 8 s de Supabase) hasta agotar el presupuesto; la próxima vuelta
 * continúa con las que falten.
 */
async function visitasConPresupuesto(hoy: string): Promise<number> {
  if (queda() < 25_000) return 0;
  const { data: pendientes, error } = await sb.rpc("agrotrack_visitas_dia_pendientes", {
    p_empresa_id: EMPRESA_ID,
    p_desde_dia: restarDias(hoy, 1),
    p_hasta_dia: hoy,
  });
  if (error) {
    if (/could not find|schema cache/i.test(error.message || "")) return 0;
    throw new Error(`visitas pendientes: ${error.message}`);
  }
  let hechas = 0;
  for (const p of pendientes || []) {
    if (queda() < 12_000) break;
    const { error: e2 } = await sb.rpc("agrotrack_calcular_visitas_dia", {
      p_empresa_id: EMPRESA_ID,
      p_dia: p.dia,
      p_placa: p.placa,
    });
    if (e2) console.warn(`visitas ${p.placa} ${p.dia}: ${e2.message}`);
    else hechas += 1;
  }
  return hechas;
}

Deno.serve(async (req) => {
  // Solo el cron autorizado puede invocarla (la URL es conocible desde la web).
  const secreto = Deno.env.get("CRON_SECRET");
  if (secreto && req.headers.get("x-cron-secret") !== secreto) {
    return json({ ok: false, error: "no autorizado" }, 401);
  }
  if (!EMPRESA_ID) {
    return json({ ok: false, error: "Falta el secret EMPRESA_ID" }, 500);
  }

  const z = cfgZonar();
  let unidadesLeidas = 0;
  let nuevas = 0;

  try {
    // 0) Sesión de Agrilux como usuario (RLS + membresía del latido).
    sb = await clienteUsuario();

    // 1) Sesión de Zonar.
    const sesion = await loginZonar(z);
    console.log(`Zonar: sesión iniciada (${sesion.fullname || z.usuario}).`);

    // 2) Foto de todas las unidades (1 llamada) → posiciones actuales.
    let marcas;
    try {
      marcas = await crudoUnidades(z, sesion.token);
    } catch {
      const otra = await loginZonar(z); // token vencido: un reintento
      marcas = await crudoUnidades(z, otra.token);
    }
    unidadesLeidas = marcas.length;
    const { filas } = filasDesdeLocalizador(marcas, EMPRESA_ID, null, { fechaModo: FECHA_MODO });
    if (filas.length) nuevas += await subirPosiciones(filas);
    console.log(`Locator: ${marcas.length} unidades · ${filas.length} posiciones · ${nuevas} nuevas.`);

    // 3) Historial de HOY por unidad, hasta agotar el presupuesto.
    const hoy = hoyPeru();
    const unidades = await listarUnidades(z, sesion.token);
    const filasHist: Record<string, unknown>[] = [];
    let unidadesHist = 0;
    for (const u of unidades) {
      if (queda() < HIST_MIN_MS) break; // la próxima vuelta sigue (dedup evita duplicos)
      try {
        const hist = await historialUnidad(z, sesion.token, { unitId: u.unitId, desde: hoy, hasta: hoy });
        for (const m of hist) {
          const { row } = armarFilaZonar(m, EMPRESA_ID, null, { fechaModo: FECHA_MODO });
          if (row) filasHist.push(row);
        }
        unidadesHist += 1;
      } catch (e) {
        console.warn(`historial de ${u.nombre}: ${e}`);
      }
      if (DELAY_MS > 0) await new Promise((r) => setTimeout(r, DELAY_MS));
    }
    const unicas = [...new Map(filasHist.map((f) => [f["source_key"], f])).values()];
    if (unicas.length) nuevas += await subirPosiciones(unicas);
    console.log(`Historial de hoy: ${unidadesHist}/${unidades.length} unidades · ${unicas.length} puntos · total nuevas ${nuevas}.`);

    // 4) Visitas a geocercas pendientes (si queda tiempo).
    let visitas = 0;
    try {
      visitas = await visitasConPresupuesto(hoy);
    } catch (e) {
      console.warn("visitas:", e instanceof Error ? e.message : e);
    }

    // 5) Latido verde.
    await latido(true, unidadesLeidas, nuevas, null);
    return json({ ok: true, unidades: unidadesLeidas, nuevas, historial_unidades: unidadesHist, visitas, ms: Date.now() - INICIO });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("envivo:", msg);
    await latido(false, unidadesLeidas, nuevas, msg).catch(() => {});
    return json({ ok: false, error: msg, ms: Date.now() - INICIO }, 500);
  }
});

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
