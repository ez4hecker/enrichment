import type { WebSearch, WebSearchResult } from "../research/research-chain.js";
import { createConcurrencyGate } from "./openai-custom-operation-provider.js";

type SerperFetch = (url: string, init: RequestInit) => Promise<Response>;

type SerperPayload = {
  answerBox?: { title?: unknown; answer?: unknown; snippet?: unknown; link?: unknown };
  knowledgeGraph?: { title?: unknown; description?: unknown; descriptionLink?: unknown; website?: unknown };
  organic?: Array<{ title?: unknown; link?: unknown; snippet?: unknown; date?: unknown }>;
};

export type SerperWebSearchOptions = {
  apiKey: string;
  fetch?: SerperFetch;
  apiBaseUrl?: string;
  /** Results per search; Serper charges the same for up to 10. */
  resultsPerSearch?: number;
  timeoutMilliseconds?: number;
  maximumAttempts?: number;
  maximumConcurrentRequests?: number;
};

/** Google results through Serper (google.serper.dev): the answer box, knowledge panel and organic snippets. */
export function createSerperWebSearch(options: SerperWebSearchOptions): WebSearch {
  if (options.apiKey.length === 0) {
    throw new Error("Serper API key is required");
  }

  const apiBaseUrl = options.apiBaseUrl ?? "https://google.serper.dev";
  const resultsPerSearch = options.resultsPerSearch ?? 10;
  const timeoutMilliseconds = options.timeoutMilliseconds ?? 15_000;
  const maximumAttempts = options.maximumAttempts ?? 2;
  const request = options.fetch ?? ((url, init) => globalThis.fetch(url, init));
  const gate = createConcurrencyGate(options.maximumConcurrentRequests ?? 20);

  return (query) => gate.run(async () => {
    for (let attempt = 1; ; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);
      let response: Response | undefined;

      try {
        response = await request(`${apiBaseUrl}/search`, {
          method: "POST",
          headers: {
            "x-api-key": options.apiKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({ q: query, num: resultsPerSearch }),
          signal: controller.signal,
        });
      } catch {
        response = undefined;
      } finally {
        clearTimeout(timeout);
      }

      if (response?.ok === true) {
        return searchResults(await response.json() as SerperPayload);
      }

      const retryable = response === undefined || response.status === 429 || response.status >= 500;

      if (!retryable || attempt >= maximumAttempts) {
        throw new Error(`Serper search failed${response === undefined ? "" : ` (HTTP ${response.status})`}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  });
}

function searchResults(payload: SerperPayload): Array<WebSearchResult> {
  const results: Array<WebSearchResult> = [];
  const answerBox = payload.answerBox;
  const answerText = text(answerBox?.answer) ?? text(answerBox?.snippet);

  if (answerText !== undefined) {
    results.push({
      title: text(answerBox?.title) ?? "Answer",
      url: text(answerBox?.link) ?? "",
      snippet: answerText,
    });
  }

  const knowledgeGraph = payload.knowledgeGraph;
  const description = text(knowledgeGraph?.description);

  if (description !== undefined) {
    results.push({
      title: text(knowledgeGraph?.title) ?? "Knowledge panel",
      url: text(knowledgeGraph?.website) ?? text(knowledgeGraph?.descriptionLink) ?? "",
      snippet: description,
    });
  }

  for (const result of payload.organic ?? []) {
    const url = text(result.link);
    const snippet = text(result.snippet);

    if (url !== undefined && snippet !== undefined) {
      const date = text(result.date);

      results.push({
        title: text(result.title) ?? url,
        url,
        snippet: date === undefined ? snippet : `${date} — ${snippet}`,
      });
    }
  }

  return results;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}
