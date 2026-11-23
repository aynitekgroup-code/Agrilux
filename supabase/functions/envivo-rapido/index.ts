// supabase/functions/envivo-rapido/index.ts
// Foto de Zonar cada 1 MINUTO — versión ligera de `envivo`.
//
// Por qué dos funciones:
//   - envivo        (cada 5 min): historial de HOY por unidad + visitas → pesado
//                   (60-125 s, ~10k filas). Saturaba si corriera cada minuto.
//   - envivo-rapido (cada 1 min): SOLO GetUnitsLocator (1 llamada a Zonar) →
//                   ~44 posiciones actuales → el trigger actualiza
//                   agrotrack_estado_vivo → Realtime → la web se mueve sola.
//                   Tarda ~3-5 s y sube apenas unas pocas filas nuevas
//                   (dedup por source_key: las unidades detenidas no generan
//                   fila nueva porque su LastEventDate no cambia).
//
// El latido 'envivo' también lo escribe (sesión de usuario cacheada en el
// isolate: 1 login/hora como mucho) para que el chip "Zonar leído hace X min"
// de la web muestre frescura de ≤1 min. Si el login falla, degrada sin
// romper: la foto igual se sube con service role.
//
// Credenciales: mismos secrets que `envivo` (ZONAR_*, EMPRESA_ID, AGRI_*,
// CRON_SECRET). La paridad de parseo está garantizada: importa los mismos
// archivos de agentes/zonar/.
import { createClient } from "npm:@supabase/supabase-js@2";
// @ts-ignore — módulos JS del agente (JS puro: fetch/Date, portables a Deno)
import { loginZonar, crudoUnidades } from "../../../agentes/zonar/src/zonar.js";
// @ts-ignore
import { filasDesdeLocalizador } from "../../../agentes/zonar/lib/localizador.js";

const EMPRESA_ID = Deno.env.get("EMPRESA_ID") ?? "";
const LIMITE_MS = 45_000; // presupuesto: el cron vuelve en 60 s

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// Sesión de usuario cacheada en el isolate (Supabase reutiliza el isolate
// entre invocaciones mientras está templado → ~1 login/hora, no 1/min).
let sesionCache: { token: string; exp: number } | null = null;

async function clienteUsuario() {
  const ahora = Date.now();
  if (sesionCache && sesionCache.exp > ahora + 60_000) {
    return createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: `Bearer ${sesionCache.token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  }
  const { data, error } = await admin.auth.signInWithPassword({
    email: Deno.env.get("AGRI_EMAIL")!,
    password: Deno.env.get("AGRI_PASSWORD")!,
  });
  if (error || !data?.session) {
    throw new Error(`Agrilux: ${error?.message ?? "sin sesión de usuario"}`);
  }
  sesionCache = {
    token: data.session.access_token,
    exp: data.session.expires_at ? data.session.expires_at * 1000 : ahora + 55 * 60_000,
  };
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: `Bearer ${sesionCache.token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

/** Latido para el chip de frescura de la web (degrada sin romper). */
async function latido(sb: ReturnType<typeof createClient>, ok: boolean, unidades: number | null, nuevas: number | null, mensaje: string | null) {
  const { error } = await sb.rpc("agrotrack_registrar_latido", {
    p_empresa_id: EMPRESA_ID,
    p_modo: "envivo",
    p_ok: ok,
    p_unidades: unidades,
    p_nuevas: nuevas,
    p_mensaje: mensaje ? mensaje.slice(0, 500) : null,
  });
  if (error) console.warn("latido:", error.message);
}

Deno.serve(async (req) => {
  const inicio = Date.now();
  const queda = () => LIMITE_MS - (Date.now() - inicio);
  const secreto = Deno.env.get("CRON_SECRET");
  if (secreto && req.headers.get("x-cron-secret") !== secreto) {
    return json({ ok: false, error: "no autorizado" }, 401);
  }
  if (!EMPRESA_ID) {
    return json({ ok: false, error: "Falta el secret EMPRESA_ID" }, 500);
  }

  // Sesión de usuario para el latido; la foto se sube con admin (RLS no aplica).
  let sb = admin;
  try {
    sb = await clienteUsuario();
  } catch (e) {
    console.warn("sesión de usuario:", e instanceof Error ? e.message : e);
  }

  try {
    // 1) Sesión de Zonar.
    const z = {
      base: "https://app.tsomobile.com",
      usuario: Deno.env.get("ZONAR_USER")!,
      password: Deno.env.get("ZONAR_PASSWORD")!,
      appid: Number(Deno.env.get("ZONAR_APPID") ?? 38),
      lang: "es",
    };
    const sesion = await loginZonar(z);

    // 2) Foto de las 44 unidades (1 llamada) → posiciones actuales.
    let marcas;
    try {
      marcas = await crudoUnidades(z, sesion.token);
    } catch {
      if (queda() < 10_000) throw new Error("token vencido y sin tiempo de reintento");
      const otra = await loginZonar(z);
      marcas = await crudoUnidades(z, otra.token);
    }
    const { filas } = filasDesdeLocalizador(marcas, EMPRESA_ID, null, { fechaModo: "auto" });

    // 3) Upsert deduplicado (misma clave que la completa y la manual → cero duplicos).
    let nuevas = 0;
    for (let i = 0; i < filas.length; i += 1000) {
      const lote = filas.slice(i, i + 1000);
      const { data, error } = await admin
        .from("agrotrack_posiciones")
        .upsert(lote, { onConflict: "empresa_id,source_key", ignoreDuplicates: true })
        .select("id");
      if (error) throw new Error(`Agrilux: ${error.message}`);
      nuevas += data?.length ?? 0;
    }

    // 4) Latido verde (≤1 min de frescura en el chip de la web).
    await latido(sb, true, marcas.length, nuevas, null);

    return json({
      ok: true,
      unidades: marcas.length,
      nuevas,
      ms: Date.now() - inicio,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("envivo-rapido:", msg);
    await latido(sb, false, null, null, msg).catch(() => {});
    return json({ ok: false, error: msg, ms: Date.now() - inicio }, 500);
  }
});

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
