/**
 * Chat Client for the web app.
 * Calls the OpenAI-compatible LLM API directly from the browser.
 * Uses non-streaming mode with simulated typing for smooth UX.
 * Uses text/plain Content-Type to avoid CORS preflight issues.
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

/**
 * Simulates streaming by revealing text word-by-word with a small delay.
 * Gives the ChatGPT-like typing effect even though the API response is non-streaming.
 */
async function simulateStreaming(
  text: string,
  onToken: (token: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const words = text.split(/(\s+)/);
  for (const word of words) {
    if (signal?.aborted) return;
    onToken(word);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

export async function streamChat({
  messages,
  memories,
  onToken,
  onDone,
  onError,
  signal,
}: StreamChatParams): Promise<void> {
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
        stream: false,
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      onError(`Chat service unavailable (${response.status}): ${errorText}`);
      return;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      onError('No response from Ember');
      return;
    }

    // Simulate streaming typing effect
    await simulateStreaming(content, onToken, signal);
    onDone(content);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return;
    const msg = error instanceof Error ? error.message : 'Connection failed';
    onError(msg);
  }
}
