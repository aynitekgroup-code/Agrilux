/**
 * api/whatsapp-webhook.js
 * Webhook para WhatsApp Business API (Meta Cloud API)
 * 
 * Recibe mensajes de WhatsApp (texto + fotos) y responde con diagnóstico IA.
 * 
 * Configuración en Meta Business:
 *   1. Ve a https://developers.facebook.com
 *   2. Crea una app → WhatsApp → Product
 *   3. Configura el webhook URL: https://tudominio.com/api/whatsapp-webhook
 *   4. Subscribe a: messages, message_media
 * 
 * Variables de entorno en Vercel:
 *   WHATSAPP_TOKEN        → Token de acceso de Meta Business
 *   WHATSAPP_PHONE_ID     → ID del número de teléfono Business
 *   WHATSAPP_VERIFY_TOKEN → Token de verificación ( tú lo defines )
 */

const WHATSAPP_API = 'https://graph.facebook.com/v19.0';

// Responder por WhatsApp
async function enviarWhatsApp(to, message) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  if (!token || !phoneId) {
    console.error('WHATSAPP_TOKEN o WHATSAPP_PHONE_ID no configurados');
    return;
  }

  await fetch(`${WHATSAPP_API}/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: message },
    }),
  });
}

// Descargar imagen de WhatsApp
async function descargarMedia(mediaId) {
  const token = process.env.WHATSAPP_TOKEN;

  // Obtener URL de la imagen
  const metaRes = await fetch(`${WHATSAPP_API}/${mediaId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const meta = await metaRes.json();

  if (!meta.url) return null;

  // Descargar imagen
  const imgRes = await fetch(meta.url, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const buffer = await imgRes.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const contentType = meta.mime_type || 'image/jpeg';

  return `data:${contentType};base64,${base64}`;
}

// Diagnóstico IA (usa la misma lógica que analizar-imagen.js)
async function diagnosticarConIA(imagenBase64, texto, telefono) {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

  const systemPrompt = `Eres un agrónomo experto de la sierra del Perú. Un agricultor te envió una foto de su cultivo por WhatsApp.

REGLAS:
- Responde en español, tono cercano y sencillo.
- Si hay imagen: analiza la planta, identifica plagas/enfermedades, da recomendaciones concretas.
- Si es solo texto: responde como agrónomo experto.
- Máximo 200 palabras.
- Incluye: qué tiene, qué hacer, qué productos aplicar.
- Si es urgente (plaga grave), advise buscar ayuda técnica.
- NO inventes datos que no veas en la foto.`;

  const userContent = imagenBase64
    ? [
        { type: 'text', text: texto || 'Analiza esta imagen de mi cultivo y dime qué tiene y qué hago.' },
        { type: 'image_url', image_url: { url: imagenBase64 } },
      ]
    : texto || 'Hola, necesito ayuda con mi cultivo.';

  // Intentar con OpenRouter primero
  if (OPENROUTER_API_KEY) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://www.vitalfarmbright.store',
          'X-Title': 'Agrilux WhatsApp',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
          max_tokens: 800,
          temperature: 0.3,
        }),
      });
      const data = await res.json();
      if (res.ok && data.choices?.[0]?.message?.content) {
        return data.choices[0].message.content;
      }
    } catch (e) { console.warn('OpenRouter WhatsApp error:', e.message); }
  }

  // Fallback: DeepSeek (solo texto)
  if (DEEPSEEK_API_KEY && !imagenBase64) {
    try {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: typeof userContent === 'string' ? userContent : texto },
          ],
          max_tokens: 800,
          temperature: 0.3,
        }),
      });
      const data = await res.json();
      if (res.ok && data.choices?.[0]?.message?.content) {
        return data.choices[0].message.content;
      }
    } catch (e) { console.warn('DeepSeek WhatsApp error:', e.message); }
  }

  return 'Lo siento, no pude analizar tu mensaje en este momento. Intenta de nuevo más tarde o escribe al +51 935 211 605 para atención personalizada.';
}

// ── Handler principal ──────────────────────────────────────────────────────
export default async function handler(req, res) {
  // ── GET: Verificación del webhook ──────────────────────────────────────
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log('Webhook verificado');
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Token de verificación incorrecto');
  }

  // ── POST: Mensaje recibido ────────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const body = req.body;

      // Verificar que es un mensaje de WhatsApp
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const messages = changes?.value?.messages;

      if (!messages || messages.length === 0) {
        return res.status(200).send('OK');
      }

      const message = messages[0];
      const from = message.from; // Número del agricultor
      let texto = '';
      let imagenBase64 = null;

      // Texto
      if (message.type === 'text') {
        texto = message.text?.body || '';
      }

      // Imagen
      if (message.type === 'image') {
        const mediaId = message.image?.id;
        if (mediaId) {
          imagenBase64 = await descargarMedia(mediaId);
        }
        texto = message.image?.caption || 'Analiza esta imagen de mi cultivo.';
      }

      // Ignorar mensajes de sistema
      if (message.type === 'system' || message.type === 'reaction') {
        return res.status(200).send('OK');
      }

      console.log(`WhatsApp de ${from}: ${texto.substring(0, 50)}...`);

      // Responder que estamos procesando
      await enviarWhatsApp(from, '🔍 Analizando tu mensaje... Un momento por favor.');

      // Diagnosticar con IA
      const respuesta = await diagnosticarConIA(imagenBase64, texto, from);

      // Enviar respuesta
      await enviarWhatsApp(from, respuesta);

      return res.status(200).send('OK');
    } catch (error) {
      console.error('WhatsApp webhook error:', error);
      return res.status(200).send('OK'); // Siempre 200 para WhatsApp
    }
  }

  return res.status(405).send('Method not allowed');
}
