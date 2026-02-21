/**
 * SSE Streaming Chat Client for the web app.
 * Connects to /api/chat/stream and streams tokens word-by-word.
 */

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
  try {
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, memories }),
      signal,
    });

    if (!response.ok) {
      onError(`Server error: ${response.status}`);
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
              onError(json.error);
              return;
            }
            if (json.token) {
              fullText += json.token;
              onToken(json.token);
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
