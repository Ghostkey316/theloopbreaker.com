/**
 * Next.js App Router API Route: POST /api/chat/stream
 * Streams Ember AI responses via Server-Sent Events.
 */
import { NextRequest } from 'next/server';
import { EMBER_SYSTEM_PROMPT } from '@/app/lib/contracts';

const FORGE_API_URL = process.env.FORGE_API_URL || 'https://forge.manus.im/v1/chat/completions';
const FORGE_API_KEY = process.env.FORGE_API_KEY || process.env.MANUS_FORGE_API_KEY || '';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { messages, memories } = await req.json() as {
      messages: Array<{ role: string; content: string }>;
      memories?: string[];
    };

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'messages array required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const memoryContext = memories && memories.length > 0
      ? `\n\nREMEMBERED CONTEXT FROM PREVIOUS CONVERSATIONS:\n${memories.join('\n')}`
      : '';

    const llmMessages = [
      { role: 'system', content: EMBER_SYSTEM_PROMPT + memoryContext },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: string) => {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        };

        try {
          const response = await fetch(FORGE_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${FORGE_API_KEY}`,
            },
            body: JSON.stringify({
              model: 'gemini-2.5-flash',
              messages: llmMessages,
              max_tokens: 32768,
              stream: true,
            }),
          });

          if (!response.ok || !response.body) {
            send(JSON.stringify({ error: `LLM error: ${response.status}` }));
            send('[DONE]');
            controller.close();
            return;
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              if (trimmed === 'data: [DONE]') {
                send('[DONE]');
                continue;
              }
              if (trimmed.startsWith('data: ')) {
                try {
                  const json = JSON.parse(trimmed.slice(6));
                  const delta = json.choices?.[0]?.delta;
                  if (delta?.content) {
                    send(JSON.stringify({ token: delta.content }));
                  }
                } catch {
                  // Skip malformed chunks
                }
              }
            }
          }

          send('[DONE]');
        } catch (error) {
          send(JSON.stringify({ error: 'Stream failed. Please try again.' }));
          send('[DONE]');
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
