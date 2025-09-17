/** Compatibility shim for partner APIs */

export class IntegrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntegrationError';
  }
}

type RequestOptions = RequestInit & { timeoutMs?: number };

const DEFAULT_TIMEOUT_MS = Number(process.env.PARTNER_API_TIMEOUT_MS ?? '8000');

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new IntegrationError(`${name} not configured`);
  }
  return value;
}

function ensureFetch(): typeof fetch {
  if (typeof fetch !== 'function') {
    throw new IntegrationError('Global fetch API is unavailable in this runtime');
  }
  return fetch;
}

function normalizeBase(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

async function fetchWithTimeout(resource: string, options: RequestOptions = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const fetchFn = ensureFetch();
    const response = await fetchFn(resource, { ...options, signal: controller.signal });
    return response;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new IntegrationError(`Request to ${resource} timed out after ${timeout}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(resource: string, options: RequestOptions = {}): Promise<any> {
  const response = await fetchWithTimeout(resource, options);
  const payload = await response.text();
  if (!response.ok) {
    const detail = payload ? `: ${payload}` : '';
    throw new IntegrationError(`Request failed (${response.status} ${response.statusText})${detail}`);
  }
  if (!payload) {
    return {};
  }
  try {
    return JSON.parse(payload);
  } catch (error) {
    throw new IntegrationError(`Invalid JSON response from ${resource}`);
  }
}

export async function openaiChat(prompt: string): Promise<string> {
  const apiKey = requireEnv('OPENAI_API_KEY');
  const baseUrl = normalizeBase(process.env.OPENAI_API_BASE ?? 'https://api.openai.com/v1');
  const model = process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini';
  const maxTokens = Number(process.env.OPENAI_MAX_TOKENS ?? '256');

  const data = await fetchJson(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: maxTokens,
    }),
  });

  const message = data?.choices?.[0]?.message?.content;
  if (!message) {
    throw new IntegrationError('OpenAI chat returned no content');
  }
  return message;
}

export async function ns3Quiz(user: string): Promise<{ score: number }> {
  const apiKey = requireEnv('NS3_API_KEY');
  const baseUrl = normalizeBase(requireEnv('NS3_API_BASE'));
  const data = await fetchJson(`${baseUrl}/quiz`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ user }),
  });
  if (typeof data?.score !== 'number') {
    throw new IntegrationError('NS3 quiz response missing score');
  }
  return { score: data.score };
}

export async function worldcoinVerify(user: string, worldId: string): Promise<boolean> {
  const apiKey = requireEnv('WORLDCOIN_API_KEY');
  const baseUrl = normalizeBase(requireEnv('WORLDCOIN_API_BASE'));
  const data = await fetchJson(`${baseUrl}/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ user, worldId }),
  });
  if (typeof data?.verified !== 'boolean') {
    throw new IntegrationError('Worldcoin response missing verified flag');
  }
  return data.verified;
}
