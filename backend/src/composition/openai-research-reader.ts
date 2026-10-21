import type { ResearchReader } from "../research/research-chain.js";
import { questionText } from "./gemini-grounded-search.js";
import { createConcurrencyGate } from "./openai-custom-operation-provider.js";
import { researchAnswerInstruction } from "./research-answer-format.js";

type OpenAiFetch = (url: string, init: RequestInit) => Promise<Response>;

type ResponsesPayload = {
  output?: Array<{ type?: unknown; content?: Array<{ type?: unknown; text?: unknown }> }>;
  usage?: { input_tokens?: unknown; output_tokens?: unknown };
};

export type OpenAiResearchReaderOptions = {
  apiKey: string;
  /** The cheapest OpenAI model: gpt-5-nano at $0.05 / $0.40 per 1M tokens (checked 2026-10-07). */
  model?: string;
  inputDollarsPerMillionTokens?: number;
  outputDollarsPerMillionTokens?: number;
  reasoningEffort?: string;
  fetch?: OpenAiFetch;
  apiBaseUrl?: string;
  timeoutMilliseconds?: number;
  maximumAttempts?: number;
  maximumConcurrentRequests?: number;
};

/**
 * Reads search snippets, a fetched page, or a Company Dossier and answers from that material
 * alone. It never searches, so its only cost is a few thousand tokens on the cheapest model.
 */
export function createOpenAiResearchReader(options: OpenAiResearchReaderOptions): ResearchReader {
  const model = options.model ?? "gpt-5-nano";
  const inputPrice = options.inputDollarsPerMillionTokens ?? 0.05;
  const outputPrice = options.outputDollarsPerMillionTokens ?? 0.4;
  const reasoningEffort = options.reasoningEffort ?? "minimal";
  const apiBaseUrl = options.apiBaseUrl ?? "https://api.openai.com/v1";
  const timeoutMilliseconds = options.timeoutMilliseconds ?? 30_000;
  const maximumAttempts = options.maximumAttempts ?? 3;
  const request = options.fetch ?? ((url, init) => globalThis.fetch(url, init));
  const gate = createConcurrencyGate(options.maximumConcurrentRequests ?? 20);

  return ({ question, material }) => gate.run(async () => {
    const body = JSON.stringify({
      model,
      instructions: `You answer one question about one company using only the numbered research material provided. Several organizations can share a name: ignore material about a different organization than the one whose website is given. Do not use your own knowledge. ${researchAnswerInstruction(question.expectedOutputType)}`,
      input: `${questionText(question)}\n\nResearch material:\n${material
        .map((piece, index) => `[${index + 1}] ${piece.title ?? ""}${piece.url ? ` (${piece.url})` : ""}\n${piece.text}`)
        .join("\n\n")}`,
      store: false,
      ...(reasoningEffort === "default" ? {} : { reasoning: { effort: reasoningEffort } }),
    });

    for (let attempt = 1; ; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);
      let response: Response | undefined;

      try {
        response = await request(`${apiBaseUrl}/responses`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${options.apiKey}`,
            "content-type": "application/json",
          },
          body,
          signal: controller.signal,
        });
      } catch {
        response = undefined;
      } finally {
        clearTimeout(timeout);
      }

      if (response?.ok === true) {
        const payload = await response.json() as ResponsesPayload;
        const answer = (payload.output ?? [])
          .flatMap((item) => item.type === "message" ? item.content ?? [] : [])
          .flatMap((content) => content.type === "output_text" && typeof content.text === "string" ? [content.text] : [])
          .join("")
          .replace(/\s+/g, " ")
          .trim();

        return {
          answer: answer === "" ? "[Not Found]" : answer,
          dollars: (tokens(payload.usage?.input_tokens) * inputPrice + tokens(payload.usage?.output_tokens) * outputPrice) / 1_000_000,
        };
      }

      const retryable = response === undefined || response.status === 408 || response.status === 409 ||
        response.status === 429 || response.status >= 500;

      if (!retryable || attempt >= maximumAttempts) {
        throw new Error("OpenAI research reader request failed");
      }

      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  });
}

function tokens(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
