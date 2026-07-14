export const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
export const GITHUB_URL = 'https://models.inference.ai.azure.com/chat/completions';

export const MODELS = {
  DEEPSEEK_FAST: 'deepseek-chat',
  DEEPSEEK_QUALITY: 'deepseek-chat',
  GITHUB_VISION: 'Phi-4-multimodal-instruct',
};

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

function buildBody({ messages, useJson, model, provider }) {
  const body = {
    model,
    messages,
    max_tokens: useJson ? 1536 : 768,
    temperature: useJson ? 0.2 : 0.5,
  };

  if (useJson) {
    body.response_format = { type: 'json_object' };
  }

  if (provider === 'deepseek') {
    body.thinking = { type: 'disabled' };
  }

  return body;
}

/**
 * Resuelve qué proveedor LLM usar.
 * Imágenes → GitHub Models Phi-4 (gratis, soporta vision)
 * Texto    → DeepSeek Chat (barato, $0.14/M tokens)
 */
export function resolveLlmRequest(env, options) {
  const { imageUrls, useJson, messages } = buildMessages(options);
  const hasImages = imageUrls.length > 0;

  // ── DeepSeek Chat: barato para texto ──
  const deepseekKey = resolveDeepSeekKey(env);
  if (deepseekKey && !hasImages) {
    const model = useJson
      ? MODELS.DEEPSEEK_QUALITY
      : MODELS.DEEPSEEK_FAST;

    return {
      provider: 'deepseek',
      url: DEEPSEEK_URL,
      apiKey: deepseekKey,
      body: buildBody({ messages, useJson, model, provider: 'deepseek' }),
    };
  }

  // ── GitHub Models: gratis, soporta imágenes y texto ──
  const githubKey = resolveGitHubKey(env);
  if (githubKey) {
    return {
      provider: 'github',
      url: GITHUB_URL,
      apiKey: githubKey,
      body: buildBody({
        messages,
        useJson,
        model: MODELS.GITHUB_VISION,
        provider: 'github',
      }),
    };
  }

  throw new Error(
    'Configura DEEPSEEK_API_KEY o GITHUB_TOKEN en Vercel. ' +
    'DeepSeek: $0.14/M tokens. GitHub: gratis.'
  );
}

export async function callChatCompletions({ url, apiKey, body }) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
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
