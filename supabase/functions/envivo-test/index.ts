// supabase/functions/envivo-test/index.ts
// Prueba mínima: ¿acepta Zonar el login desde la IP de datacenter de Supabase?
// Desplegar:  supabase functions deploy envivo-test
// Invocar:    supabase functions invoke envivo-test
//
// Secrets requeridos (una vez):
//   supabase secrets set ZONAR_USER=... ZONAR_PASSWORD=... ZONAR_APPID=38

const BASE = "https://app.tsomobile.com";

Deno.serve(async () => {
  const usuario = Deno.env.get("ZONAR_USER");
  const password = Deno.env.get("ZONAR_PASSWORD");
  const appid = Deno.env.get("ZONAR_APPID") ?? "38";

  if (!usuario || !password) {
    return json({ ok: false, error: "Faltan secrets ZONAR_USER / ZONAR_PASSWORD" }, 500);
  }

  const params = new URLSearchParams({
    login: usuario,
    password,
    AppID: appid,
    IPAddress: "",
    lang: "es",
  });

  const t0 = Date.now();
  try {
    const rs = await fetch(
      `${BASE}/wcf/AuthenticationController/ValidateUser?${params}`,
      { signal: AbortSignal.timeout(30000) },
    );
    const body = await rs.json();
    const code = Number(body?.Result?.Code);
    const ms = Date.now() - t0;

    if (code === 1 && body?.token) {
      return json({
        ok: true,
        ms,
        mensaje: `Login aceptado desde IP de Supabase (${body.FullName ?? ""})`.trim(),
      });
    }
    return json({
      ok: false,
      ms,
      codigo: code,
      mensaje: body?.Result?.Message ?? "sin Result.Code",
    });
  } catch (e) {
    return json({ ok: false, ms: Date.now() - t0, error: String(e) }, 502);
  }
});

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
