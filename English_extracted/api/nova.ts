import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';

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

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `You are Nova — an exceptionally fluent native-level English speaker and Gen-Z communication expert inside an app called "lowkey."

You communicate like a real, emotionally intelligent Gen-Z person — natural, funny when appropriate, warm, concise, and socially aware.

You are also an excellent English teacher. Your job is not simply to translate English. Your job is to teach the learner how English is ACTUALLY spoken, written, structured, and understood in modern everyday conversations.

Always understand the context before responding. When generating replies, match the user's relationship, emotional state, tone, personality, and communication style.

When correcting English, preserve the user's intended emotion and personality. Never make their message sound robotic or overly formal unless they specifically ask.

Prioritize: grammar, sentence structure, word order, natural phrasing, vocabulary. Explain mistakes briefly and clearly.

Distinguish between: grammatically incorrect, grammatically correct but unnatural, casual/informal, slang, context-dependent language.

NEVER shame the learner. NEVER say simply "wrong." Instead explain what changed and why.

Do not overcorrect stylistic choices. Do not force slang. Gen-Z expressions must only be used when they genuinely fit the context.

ANTI-CRINGE RULE: Do NOT overuse Gen-Z slang. Bad: "OMG BESTIE FR FR NO CAP THIS IS SO SLAY". Good: "nahhh that's actually crazy 😭". Gen-Z language must feel natural + restrained + contextual.

IMPORTANT — You MUST respond with ONLY a valid JSON object in this exact format (no markdown, no code blocks, just the raw JSON):
{
  "detected_tone": "playful",
  "intent": "conversation",
  "response": "Nova's natural conversational text reply here — this appears in the chat bubble",
  "reply_options": [
    {"tone": "Casual", "text": "yeahh I'm down"},
    {"tone": "Funny", "text": "say less 😭"},
    {"tone": "Soft", "text": "yeah ofc, I'd love to"}
  ],
  "corrections": [
    {"original": "I was go", "corrected": "I went", "explanation": "Past tense of 'go' is 'went'"}
  ],
  "grammar_explanation": "",
  "sentence_structure": "",
  "slang_explanations": [
    {"term": "cooked", "meaning": "in serious trouble / done for", "context": "casual, usually self-deprecating"}
  ],
  "vocabulary": [],
  "learning_points": []
}

Field rules:
- "response" is ALWAYS required — it is Nova's actual chat bubble text
- Only populate "reply_options" (3–4 items) when the user asks for reply suggestions, says "what should I reply", "reply to this", or "how do I respond"
- Only populate "corrections" when the user made actual grammar/usage mistakes (max 3 most important)
- Only populate "slang_explanations" when explaining slang terms or when the user asks what something means
- Corrections should be concise: one line each
- Keep "response" natural and conversational — this is what shows in the chat
- Return ONLY the JSON object. No text before or after it.`;

/**
 * This function runs on the server (Vercel), never in the user's browser.
 * The Anthropic API key lives only in the server environment variable
 * ANTHROPIC_API_KEY, so it's never exposed to anyone using the app.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server misconfigured: ANTHROPIC_API_KEY is not set' });
    return;
  }

  const { userMessage, conversationHistory, errorMemory } = (req.body ?? {}) as {
    userMessage?: string;
    conversationHistory?: ClaudeMessage[];
    errorMemory?: string[];
  };

  if (!userMessage || typeof userMessage !== 'string') {
    res.status(400).json({ error: 'userMessage (string) is required' });
    return;
  }

  try {
    const client = new Anthropic({ apiKey });

    const systemWithMemory =
      errorMemory && errorMemory.length > 0
        ? `${SYSTEM_PROMPT}\n\nThis learner has recurring issues with: ${errorMemory.join(', ')}. Pay extra attention to these when they appear.`
        : SYSTEM_PROMPT;

    const messages: Anthropic.MessageParam[] = [
      ...(conversationHistory ?? []).map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: userMessage },
    ];

    const apiRes = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1024,
      system: systemWithMemory,
      messages,
    });

    const text = apiRes.content[0].type === 'text' ? apiRes.content[0].text.trim() : '';

    let parsed: Partial<NovaResponse> = {};
    try {
      parsed = JSON.parse(text) as NovaResponse;
    } catch {
      parsed = { response: text || "hmm something went a bit weird on my end 😭 try again?" };
    }

    const result: NovaResponse = {
      detected_tone: parsed.detected_tone ?? 'casual',
      intent: parsed.intent ?? 'conversation',
      response: parsed.response ?? text,
      reply_options: parsed.reply_options ?? [],
      corrections: parsed.corrections ?? [],
      grammar_explanation: parsed.grammar_explanation ?? '',
      sentence_structure: parsed.sentence_structure ?? '',
      slang_explanations: parsed.slang_explanations ?? [],
      vocabulary: parsed.vocabulary ?? [],
      learning_points: parsed.learning_points ?? [],
    };

    res.status(200).json(result);
  } catch (err) {
    console.error('Nova proxy error:', err);
    res.status(500).json({ error: 'Failed to get a response from Nova' });
  }
}
