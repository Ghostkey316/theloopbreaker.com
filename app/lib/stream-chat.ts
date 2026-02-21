/**
 * SSE Streaming Chat Client for the web app.
 * Calls the OpenAI-compatible LLM API directly from the browser.
 * Uses text/plain Content-Type to avoid CORS preflight issues.
 * Works on static hosting (GitHub Pages, Vercel static, etc.)
 */
import { EMBER_SYSTEM_PROMPT } from './contracts';

const API_URL = 'https://api.manus.im/api/llm-proxy/v1/chat/completions';
const API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || 'sk-ADn9FUEGSQtAJYdaQiEjYF';

export interface StreamChatParams {
  messages: Array<{ role: string; content: string }>;
  memories?: string[];
  onToken: (token: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: string) => void;
  signal?: AbortSignal;
}

export async function streamChat({
  messages,
  memories,
  onToken,
  onDone,
  onError,
  signal,
}: StreamChatParams): Promise<void> {
  let fullText = '';

  const memoryContext =
    memories && memories.length > 0
      ? `\n\nREMEMBERED CONTEXT FROM PREVIOUS CONVERSATIONS:\n${memories.join('\n')}`
      : '';

  const llmMessages = [
    { role: 'system', content: EMBER_SYSTEM_PROMPT + memoryContext },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: llmMessages,
        max_tokens: 32768,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      onError(`Chat service unavailable (${response.status}): ${errorText}`);
      return;
    }

    if (!response.body) {
      const text = await response.text();
      onToken(text);
      onDone(text);
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
          onDone(fullText);
          return;
        }
        if (trimmed.startsWith('data: ')) {
          try {
            const json = JSON.parse(trimmed.slice(6));
            if (json.error) {
              onError(json.error?.message || json.error);
              return;
            }
            const delta = json.choices?.[0]?.delta;
            if (delta?.content) {
              fullText += delta.content;
              onToken(delta.content);
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }

    if (fullText) onDone(fullText);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return;
    const msg = error instanceof Error ? error.message : 'Stream connection failed';
    onError(msg);
  }
}
