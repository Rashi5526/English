export interface NovaResponse {
  detected_tone: string;
  intent: 'conversation' | 'reply_generation' | 'correction' | 'slang_explanation' | 'tone_translation';
  response: string;
  reply_options: { tone: string; text: string }[];
  corrections: { original: string; corrected: string; explanation: string }[];
  grammar_explanation: string;
  sentence_structure: string;
  slang_explanations: { term: string; meaning: string; context: string }[];
  vocabulary: string[];
  learning_points: string[];
}

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Calls our own backend proxy at /api/nova instead of the Anthropic API
 * directly. The Anthropic API key never touches the browser — it lives
 * only in the server's ANTHROPIC_API_KEY environment variable (see
 * api/nova.ts). This keeps the key safe when the app is shared with
 * other people.
 */
export async function callNova(
  userMessage: string,
  conversationHistory: ClaudeMessage[],
  errorMemory: string[],
): Promise<NovaResponse> {
  const res = await fetch('/api/nova', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userMessage, conversationHistory, errorMemory }),
  });

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody?.error) message = errBody.error;
    } catch {
      // ignore, use default message
    }
    throw new Error(message);
  }

  return (await res.json()) as NovaResponse;
}
