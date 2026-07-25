export const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
export const GITHUB_URL = 'https://models.inference.ai.azure.com/chat/completions';
export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export const MODELS = {
  OPENROUTER_VISION: 'google/gemini-2.5-flash',
  DEEPSEEK_FAST: 'deepseek-chat',
  GITHUB_VISION: 'Phi-4-multimodal-instruct',
};

export function resolveOpenRouterKey(env) {
  return env.OPENROUTER_API_KEY || env.VITE_OPENROUTER_API_KEY || '';
}

export function resolveDeepSeekKey(env) {
  return (
    env.DEEPSEEK_API_KEY ||
    env.VITE_DEEPSEEK_API_KEY ||
    env.OPENAI_API_KEY ||
    env.VITE_OPENAI_API_KEY ||
    ''
  );
}

export function resolveGitHubKey(env) {
  return env.GITHUB_TOKEN || '';
}

function schemaHint(schema) {
  if (!schema?.properties) return '';
  return Object.entries(schema.properties)
    .map(([key, value]) => {
      if (value.enum) return `${key}(${value.enum.join('|')})`;
      if (value.type === 'array') return `${key}[]`;
      return key;
    })
    .join(', ');
}

function buildMessages({
  prompt,
  file_urls = [],
  response_json_schema = null,
  systemPrompt = null,
}) {
  const imageUrls = file_urls.filter((url) => url?.startsWith('data:'));
  const useJson = Boolean(response_json_schema);
  const imageDetail = imageUrls.length > 1 ? 'low' : 'high';

  const jsonSuffix = useJson
    ? ` Responde únicamente con JSON válido. Campos: ${schemaHint(response_json_schema)}. Sin markdown.`
    : '';
  const system =
    (systemPrompt || 'Agrónomo experto en cultivos del Perú. Respuestas breves, prácticas y en español.') +
    jsonSuffix;

  let userText = prompt;
  if (useJson) {
    userText += '\n\nResponde en json siguiendo exactamente esos campos.';
  }

  const userContent = imageUrls.length
    ? [
        { type: 'text', text: userText },
        ...imageUrls.map((url) => ({
          type: 'image_url',
          image_url: { url, detail: imageDetail },
        })),
      ]
    : userText;

  return { imageUrls, useJson, messages: [
    { role: 'system', content: system },
    { role: 'user', content: userContent },
  ] };
}

function buildBody({ messages, useJson, model }) {
  const body = {
    model,
    messages,
    max_tokens: useJson ? 1536 : 768,
    temperature: useJson ? 0.2 : 0.5,
  };

  if (useJson) {
    body.response_format = { type: 'json_object' };
  }

  return body;
}

/**
 * Resuelve qué proveedor LLM usar.
 * OpenRouter (Gemini 2.5 Flash) → DeepSeek (barato) → GitHub (gratis)
 */
export function resolveLlmRequest(env, options) {
  const { imageUrls, useJson, messages } = buildMessages(options);

  // ── OpenRouter: primer opción (mejor calidad, soporta imágenes + texto) ──
  const openrouterKey = resolveOpenRouterKey(env);
  if (openrouterKey) {
    return {
      provider: 'openrouter',
      url: OPENROUTER_URL,
      apiKey: openrouterKey,
      body: buildBody({ messages, useJson, model: MODELS.OPENROUTER_VISION }),
      headers: {
        'HTTP-Referer': 'https://www.vitalfarmbright.store',
        'X-Title': 'Agrilux',
      },
    };
  }

  // ── DeepSeek: fallback barato (solo texto) ──
  const deepseekKey = resolveDeepSeekKey(env);
  if (deepseekKey) {
    return {
      provider: 'deepseek',
      url: DEEPSEEK_URL,
      apiKey: deepseekKey,
      body: buildBody({ messages, useJson, model: MODELS.DEEPSEEK_FAST }),
    };
  }

  // ── GitHub: último recurso (gratis) ──
  const githubKey = resolveGitHubKey(env);
  if (githubKey) {
    return {
      provider: 'github',
      url: GITHUB_URL,
      apiKey: githubKey,
      body: buildBody({ messages, useJson, model: MODELS.GITHUB_VISION }),
    };
  }

  throw new Error('Configura OPENROUTER_API_KEY en Vercel.');
}

export async function callChatCompletions({ url, apiKey, body, headers = {} }) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const message =
      errData.error?.message || errData.message || `Error LLM ${res.status}`;
    throw new Error(message);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}
