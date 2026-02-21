/**
 * SSE Streaming Chat Client for the web app.
 * Calls the Forge/Manus LLM API directly from the browser.
 * Works on static hosting (GitHub Pages, Vercel static, etc.)
 */
import { EMBER_SYSTEM_PROMPT } from './contracts';

const FORGE_API_URL = 'https://forge.manus.im/v1/chat/completions';

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
    const response = await fetch(FORGE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: llmMessages,
        max_tokens: 32768,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      onError(`Chat service unavailable (${response.status})`);
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
