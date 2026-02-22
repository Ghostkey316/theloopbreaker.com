import { NextRequest } from 'next/server';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
const GEMINI_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-2.0-flash';

async function callGemini(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  model: string,
  stream: boolean
) {
  return fetch(`${GEMINI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 8192,
      stream,
    }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: messages array is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Google API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Try primary model (gemini-2.5-flash), fall back to gemini-2.0-flash
    let response = await callGemini(apiKey, messages, GEMINI_MODEL, true);

    if (!response.ok) {
      console.warn(
        `Primary model ${GEMINI_MODEL} failed (${response.status}), trying fallback ${FALLBACK_MODEL}`
      );
      response = await callGemini(apiKey, messages, FALLBACK_MODEL, true);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return new Response(
        JSON.stringify({
          error: `Gemini API error (${response.status}): ${errorText}`,
        }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Stream the SSE response back to the client
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const readable = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }
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
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
