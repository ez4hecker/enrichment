import type {
  GeminiGroundedSearch,
  ResearchQuestion,
} from "../research/research-chain.js";
import { researchAnswerInstruction } from "./research-answer-format.js";

type GeminiFetch = (url: string, init: RequestInit) => Promise<Response>;

type GenerateContentPayload = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: unknown }> };
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: { uri?: unknown; title?: unknown } }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: unknown;
    candidatesTokenCount?: unknown;
    thoughtsTokenCount?: unknown;
  };
};

export type GeminiGroundedSearchOptions = {
  /**
   * Google's free tier allows grounded search only on the Gemini 2.5 Flash models (500 a day per
   * project, shared between them; 1,500 a day on a billed project). Gemini 3 grounding is not on
   * the free tier, so the pool must stay on 2.5 (ai.google.dev/gemini-api/docs/pricing, 2026-10-07).
   */
  model?: string;
  fetch?: GeminiFetch;
  apiBaseUrl?: string;
  timeoutMilliseconds?: number;
  /** Token prices for a billed key; free-tier keys are never charged. */
  billedInputDollarsPerMillionTokens?: number;
  billedOutputDollarsPerMillionTokens?: number;
  now?: () => Date;
};

export function createGeminiGroundedSearch(
  options: GeminiGroundedSearchOptions = {},
): GeminiGroundedSearch {
  const model = options.model ?? "gemini-2.5-flash-lite";
  const apiBaseUrl = options.apiBaseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
  const timeoutMilliseconds = options.timeoutMilliseconds ?? 30_000;
  const request = options.fetch ?? ((url, init) => globalThis.fetch(url, init));
  const inputPrice = options.billedInputDollarsPerMillionTokens ?? 0.1;
  const outputPrice = options.billedOutputDollarsPerMillionTokens ?? 0.4;
  const now = options.now ?? (() => new Date());

  return async ({ apiKey, billed, question }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);
    let response: Response;

    try {
      response = await request(`${apiBaseUrl}/models/${model}:generateContent`, {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: `Today's date is ${now().toISOString().slice(0, 10)}. Search Google for current information about the company named in the input before answering, and prefer the most recent reliable source. Several organizations can share a name: use the website given to research the right one. ${researchAnswerInstruction(question.expectedOutputType)}`,
            }],
          },
          contents: [{ role: "user", parts: [{ text: questionText(question) }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0 },
        }),
        signal: controller.signal,
      });
    } catch {
      return { outcome: "failed", reason: "Gemini could not be reached" };
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");

      return failureFor(response.status, body);
    }

    let payload: GenerateContentPayload;

    try {
      payload = await response.json() as GenerateContentPayload;
    } catch {
      return { outcome: "failed", reason: "Gemini response was invalid" };
    }

    const candidate = payload.candidates?.[0];
    const answer = (candidate?.content?.parts ?? [])
      .flatMap((part) => typeof part.text === "string" ? [part.text] : [])
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    const sources = (candidate?.groundingMetadata?.groundingChunks ?? []).flatMap((chunk) =>
      typeof chunk.web?.uri === "string"
        ? [{
            url: chunk.web.uri,
            ...(typeof chunk.web.title === "string" ? { title: chunk.web.title } : {}),
          }]
        : [],
    );
    const usage = payload.usageMetadata;
    const dollars = billed
      ? (numberOrZero(usage?.promptTokenCount) * inputPrice +
          (numberOrZero(usage?.candidatesTokenCount) + numberOrZero(usage?.thoughtsTokenCount)) * outputPrice) /
        1_000_000
      : 0;

    return { outcome: "answered", answer: answer === "" ? "[Not Found]" : answer, sources, dollars };
  };
}

export function questionText(question: ResearchQuestion): string {
  return [
    question.companyName === undefined ? undefined : `Company name: ${question.companyName}`,
    question.domain === undefined ? undefined : `Company website: ${question.domain}`,
    question.prompt,
  ].filter((line) => line !== undefined).join("\n");
}

/**
 * A daily quota refusal means the key is used up until midnight Pacific; a per-minute one only
 * means this request was too soon. A bad, revoked, or blocked key is taken out of the pool.
 */
function failureFor(
  status: number,
  body: string,
): { outcome: "rate-limited" | "key-rejected" | "failed"; reason: string } {
  if (status === 429) {
    return /PerDay|per day|daily/i.test(body)
      ? { outcome: "rate-limited", reason: "Daily free allowance used" }
      : { outcome: "failed", reason: "Rate limited for this minute" };
  }

  if (status === 401 || status === 403 || /API_KEY_INVALID|API key not valid|API_KEY_EXPIRED/i.test(body)) {
    return { outcome: "key-rejected", reason: `Google rejected the key (HTTP ${status})` };
  }

  return { outcome: "failed", reason: `Gemini request failed (HTTP ${status})` };
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
