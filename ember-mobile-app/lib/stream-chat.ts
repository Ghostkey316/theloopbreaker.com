/**
 * SSE Streaming Chat Client
 * Reads server-sent events and calls onToken for each word/token received
 */

import Constants from "expo-constants";

function getApiBaseUrl(): string {
  // In development, use the server URL
  const devServerUrl = Constants.expoConfig?.extra?.apiUrl;
  if (devServerUrl) return devServerUrl;

  // Fallback: same origin for web, localhost for native
  if (typeof window !== "undefined" && window.location) {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:3000`;
  }
  return "http://127.0.0.1:3000";
}

export interface StreamChatParams {
  messages: Array<{ role: string; content: string }>;
  memories?: string[];
  onToken: (token: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: string) => void;
}

export async function streamChat({
  messages,
  memories,
  onToken,
  onDone,
  onError,
}: StreamChatParams): Promise<void> {
  const baseUrl = getApiBaseUrl();
  let fullText = "";

  try {
    const response = await fetch(`${baseUrl}/api/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages, memories }),
    });

    if (!response.ok) {
      onError(`Server error: ${response.status}`);
      return;
    }

    if (!response.body) {
      // Fallback: read the entire response as text (non-streaming)
      const text = await response.text();
      onToken(text);
      onDone(text);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE lines
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed === "data: [DONE]") {
          onDone(fullText);
          return;
        }

        if (trimmed.startsWith("data: ")) {
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

    // If we get here without [DONE], still call onDone
    if (fullText) {
      onDone(fullText);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Stream connection failed";
    onError(msg);
  }
}
