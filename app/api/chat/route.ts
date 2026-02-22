import { NextRequest } from 'next/server';

/**
 * Vaultfire Chat API — Multi-provider LLM proxy
 *
 * Provider priority:
 *   1. Gemini (GOOGLE_API_KEY) — primary
 *   2. OpenRouter (OPENROUTER_API_KEY) — fallback
 *
 * All errors are returned as clean, user-friendly messages.
 * Raw API errors are logged server-side only.
 */

// ── Provider configs ────────────────────────────────────────────────────────

interface ProviderConfig {
  name: string;
  baseUrl: string;
  models: string[];
  getHeaders: (apiKey: string) => Record<string, string>;
}

const PROVIDERS: ProviderConfig[] = [
  {
    name: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: ['gemini-2.5-flash', 'gemini-2.0-flash'],
    getHeaders: (apiKey) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    }),
  },
  {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: ['google/gemini-2.0-flash-exp:free', 'meta-llama/llama-3.3-70b-instruct:free'],
    getHeaders: (apiKey) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://theloopbreaker.com',
      'X-Title': 'Vaultfire Protocol',
    }),
  },
];

// ── Friendly error messages ─────────────────────────────────────────────────

const FRIENDLY_ERRORS: Record<string, string> = {
  rate_limit: 'Embris is taking a moment to think. Please try again shortly.',
  server_error: 'Embris is temporarily unavailable. Please try again in a moment.',
  no_api_key: 'Embris is not configured yet. Please contact the administrator.',
  invalid_request: 'Something went wrong with that request. Please try again.',
  default: 'Embris is taking a moment to think. Please try again shortly.',
};

function friendlyError(status: number): string {
  if (status === 429) return FRIENDLY_ERRORS.rate_limit;
  if (status >= 500) return FRIENDLY_ERRORS.server_error;
  return FRIENDLY_ERRORS.default;
}

// ── LLM call helper ─────────────────────────────────────────────────────────

async function callLLM(
  provider: ProviderConfig,
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  model: string,
  stream: boolean,
  maxTokens: number
): Promise<Response> {
  return fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: provider.getHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      stream,
    }),
  });
}

// ── Main handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, stream: wantStream, max_tokens: maxTokens } = body;

    const useStream = wantStream === true;
    const tokens = typeof maxTokens === 'number' ? maxTokens : 8192;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: FRIENDLY_ERRORS.invalid_request } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Collect available providers with their API keys
    const availableProviders: Array<{ provider: ProviderConfig; apiKey: string }> = [];

    const geminiKey = process.env.GOOGLE_API_KEY;
    if (geminiKey) {
      availableProviders.push({ provider: PROVIDERS[0], apiKey: geminiKey });
    }

    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (openRouterKey) {
      availableProviders.push({ provider: PROVIDERS[1], apiKey: openRouterKey });
    }

    if (availableProviders.length === 0) {
      console.error('No LLM API keys configured');
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: FRIENDLY_ERRORS.no_api_key } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Try each provider and each model until one works
    let lastStatus = 500;
    for (const { provider, apiKey } of availableProviders) {
      for (const model of provider.models) {
        try {
          const response = await callLLM(provider, apiKey, messages, model, useStream, tokens);

          if (response.ok) {
            // ── NON-STREAMING ──
            if (!useStream) {
              const data = await response.json();
              return new Response(JSON.stringify(data), {
                headers: { 'Content-Type': 'application/json' },
              });
            }

            // ── STREAMING ──
            const encoder = new TextEncoder();
            const decoder = new TextDecoder();

            const readable = new ReadableStream({
              async start(controller) {
                const reader = response.body?.getReader();
                if (!reader) { controller.close(); return; }
                try {
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n').filter((line) => line.trim() !== '');
                    for (const line of lines) {
                      if (line === 'data: [DONE]') {
                        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                        continue;
                      }
                      if (line.startsWith('data: ')) {
                        controller.enqueue(encoder.encode(line + '\n\n'));
                      }
                    }
                  }
                } catch (err) {
                  console.error('Stream read error:', err);
                } finally {
                  controller.close();
                  reader.releaseLock();
                }
              },
            });

            return new Response(readable, {
              headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
              },
            });
          }

          // Log failure and try next model/provider
          lastStatus = response.status;
          const errorText = await response.text().catch(() => '');
          console.warn(`[${provider.name}/${model}] failed (${response.status}): ${errorText.slice(0, 200)}`);
        } catch (err) {
          console.warn(`[${provider.name}/${model}] network error:`, err);
        }
      }
    }

    // All providers failed — return friendly error as a valid chat response
    // This ensures the client always gets a parseable response, never raw error JSON
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: friendlyError(lastStatus) } }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: FRIENDLY_ERRORS.default } }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
