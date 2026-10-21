import type {
  CustomOperationProvider,
} from "../job-execution/execute-enrichment-job.js";
import type {
  ExpectedOutputType,
} from "../operation-library/custom-operation-definition.js";
import { findGenerationModel } from "../operation-library/generation-models.js";

type OpenAiFetch = (
  url: string,
  init: RequestInit,
) => Promise<Response>;

type ResponsesPayload = {
  output?: Array<{
    type?: unknown;
    content?: Array<{
      type?: unknown;
      text?: unknown;
    }>;
  }>;
};

export type OpenAiCustomOperationProviderOptions = {
  apiKey: string;
  /** Research model; a Generation request names its own model from the Generation Model catalog. */
  model: string;
  fetch?: OpenAiFetch;
  apiBaseUrl?: string;
  timeoutMilliseconds?: number;
  maximumAttempts?: number;
  retryDelayMilliseconds?: number;
  maximumConcurrentRequests?: number;
  /** Research `reasoning.effort` when set; omitted means the model's own default. */
  reasoningEffort?: string;
  /** Pass one cache to several providers so they share answers; each provider otherwise keeps its own. */
  answerCache?: CustomOperationAnswerCache;
  now?: () => Date;
};

type CustomOperationAnswer = string | number | boolean;

export type CustomOperationAnswerCache = {
  answer(
    key: string,
    compute: () => Promise<CustomOperationAnswer>,
  ): Promise<CustomOperationAnswer>;
};

/**
 * Contact lists repeat the same company across many rows. Identical prompts share one web
 * search: concurrent duplicates join the request in flight, later ones reuse its answer until
 * it expires. Failures are never kept, so the next identical prompt tries again.
 */
export function createCustomOperationAnswerCache(
  options: {
    timeToLiveMilliseconds?: number;
    maximumEntries?: number;
    now?: () => number;
  } = {},
): CustomOperationAnswerCache {
  const timeToLiveMilliseconds = options.timeToLiveMilliseconds ?? 24 * 60 * 60 * 1000;
  const maximumEntries = options.maximumEntries ?? 50_000;
  const now = options.now ?? Date.now;
  const entries = new Map<string, {
    answer: Promise<CustomOperationAnswer>;
    expiresAt: number;
  }>();

  return {
    answer(key, compute) {
      const existing = entries.get(key);

      if (existing !== undefined && existing.expiresAt > now()) {
        // Re-insert so the Map's insertion order tracks recent use for eviction.
        entries.delete(key);
        entries.set(key, existing);
        return existing.answer;
      }

      const entry = {
        answer: compute(),
        expiresAt: Number.POSITIVE_INFINITY,
      };

      entries.delete(key);
      entries.set(key, entry);
      entry.answer.then(
        () => {
          entry.expiresAt = now() + timeToLiveMilliseconds;
        },
        () => {
          if (entries.get(key) === entry) {
            entries.delete(key);
          }
        },
      );

      while (entries.size > maximumEntries) {
        const oldestKey = entries.keys().next().value;

        if (oldestKey === undefined) {
          break;
        }

        entries.delete(oldestKey);
      }

      return entry.answer;
    },
  };
}

export function createOpenAiCustomOperationProvider(
  options: OpenAiCustomOperationProviderOptions,
): CustomOperationProvider {
  if (options.apiKey.length === 0 || options.model.length === 0) {
    throw new Error("OpenAI API key and model are required");
  }

  const apiBaseUrl = options.apiBaseUrl ?? "https://api.openai.com/v1";
  const timeoutMilliseconds = options.timeoutMilliseconds ?? 30_000;
  const maximumAttempts = options.maximumAttempts ?? 3;
  const retryDelayMilliseconds = options.retryDelayMilliseconds ?? 500;
  const maximumConcurrentRequests = options.maximumConcurrentRequests ?? 5;
  const request = options.fetch ?? ((url, init) => globalThis.fetch(url, init));

  if (
    timeoutMilliseconds <= 0 ||
    maximumAttempts < 1 ||
    !Number.isInteger(maximumAttempts) ||
    retryDelayMilliseconds < 0 ||
    maximumConcurrentRequests < 1 ||
    !Number.isInteger(maximumConcurrentRequests)
  ) {
    throw new Error("OpenAI provider retry and timeout settings are invalid");
  }

  const concurrencyGate = createConcurrencyGate(maximumConcurrentRequests);
  const answerCache = options.answerCache ?? createCustomOperationAnswerCache();
  const now = options.now ?? (() => new Date());

  return {
    async execute(requestInput) {
      const generationModel = requestInput.generationModel === undefined
        ? undefined
        : findGenerationModel(requestInput.generationModel);

      if (requestInput.generationModel !== undefined && generationModel === undefined) {
        throw new Error("Generation Model is not available");
      }

      // Deduplicate before the concurrency gate so repeated rows never hold a request slot.
      // Research and each Generation Model answer the same prompt differently, so they never share.
      return answerCache.answer(
        `${generationModel?.id ?? "research"}\n${requestInput.expectedOutputType}\n${requestInput.prompt}`,
        () => concurrencyGate.run(async () => {
          for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
            try {
              const text = await requestResponseText({
                request,
                apiBaseUrl,
                apiKey: options.apiKey,
                model: generationModel?.id ?? options.model,
                reasoningEffort: generationModel?.reasoningEffort ?? options.reasoningEffort,
                webSearch: generationModel === undefined,
                prompt: requestInput.prompt,
                expectedOutputType: requestInput.expectedOutputType,
                today: now().toISOString().slice(0, 10),
                timeoutMilliseconds,
              });

              return normalizeOutput(text, requestInput.expectedOutputType);
            } catch (error) {
              if (!(error instanceof RetryableOpenAiRequestError) || attempt === maximumAttempts) {
                throw error;
              }

              // A rate-limited response says how long to back off; retrying sooner fails again.
              await wait(Math.max(
                retryDelayMilliseconds * attempt,
                Math.min(error.retryAfterMilliseconds ?? 0, maximumRetryAfterMilliseconds),
              ));
            }
          }

          throw new Error("OpenAI request could not be completed");
        }),
      );
    },
  };
}

const maximumRetryAfterMilliseconds = 60_000;

async function requestResponseText(input: {
  request: OpenAiFetch;
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  reasoningEffort: string | undefined;
  webSearch: boolean;
  prompt: string;
  expectedOutputType: ExpectedOutputType;
  today: string;
  timeoutMilliseconds: number;
}): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMilliseconds);

  try {
    let response: Response;

    try {
      response = await input.request(`${input.apiBaseUrl}/responses`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${input.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: input.model,
          input: input.prompt,
          instructions: input.webSearch
            ? `Today's date is ${input.today}. ${researchInstruction} ${outputInstruction(input.expectedOutputType)}`
            : `${generationInstruction} ${generationOutputInstruction(input.expectedOutputType)}`,
          // Research requires web search: without it the model answers from training
          // memory, which is stale or invented for facts such as funding rounds.
          // Generation writes only from the row's own details, so a search would be wasted spend.
          ...(input.webSearch
            ? { tools: [{ type: "web_search" }], tool_choice: "required" }
            : {}),
          store: false,
          ...(input.reasoningEffort === undefined
            ? {}
            : { reasoning: { effort: input.reasoningEffort } }),
        }),
        signal: controller.signal,
      });
    } catch {
      throw new RetryableOpenAiRequestError();
    }

    if (!response.ok) {
      if (isTransientStatus(response.status)) {
        throw new RetryableOpenAiRequestError(retryAfterMilliseconds(response.headers));
      }

      throw new Error("OpenAI request was rejected");
    }

    let payload: ResponsesPayload;

    try {
      payload = await response.json() as ResponsesPayload;
    } catch {
      throw new Error("OpenAI response was invalid");
    }

    const text = outputText(payload);

    if (text === undefined) {
      throw new Error("OpenAI response contained no text");
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

const researchInstruction =
  "You enrich one row of a contact list. Search the web for current information about the subject named in the input before answering, and prefer the most recent reliable source. Several organizations can share a name: use any website, domain, or other detail given in the input to research the right one, and ignore results about a different organization with the same name.";

const generationInstruction =
  "You write for one row of a contact list, using only the details given in the input. Do not invent facts about the person or company, such as news, funding, or achievements, that the input does not state.";

function generationOutputInstruction(expectedOutputType: ExpectedOutputType): string {
  return expectedOutputType === "Text"
    ? "Return only the requested text, with no preamble, surrounding quotes, labels, or markdown."
    : outputInstruction(expectedOutputType);
}

function outputInstruction(expectedOutputType: ExpectedOutputType): string {
  switch (expectedOutputType) {
    case "Text":
      return 'Answer with only the requested facts in as few words as possible (at most 15 words), for example "Series B, $25M, March 2024". No sentences, explanations, citations, links, or formatting. If the answer cannot be found, reply exactly [Not Found].';
    case "Number":
      return "Return only one finite number. Do not include commentary or formatting.";
    case "Boolean":
      return "Return only true or false. Do not include commentary or formatting.";
  }
}

function outputText(payload: ResponsesPayload): string | undefined {
  const text = payload.output?.flatMap((item) =>
    item.type === "message"
      ? (item.content ?? []).flatMap((content) =>
          content.type === "output_text" && typeof content.text === "string"
            ? [content.text]
            : [],
        )
      : [],
  ).join("");
  const answer = text === undefined ? undefined : withoutCitations(text);

  return answer === undefined || answer === "" ? undefined : answer;
}

/** Web search answers carry inline markdown citations; an Enriched List cell wants only the answer. */
function withoutCitations(text: string): string {
  return text
    .replace(/\s*\(\s*\[[^\]]*\]\([^)]*\)\s*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeOutput(
  text: string,
  expectedOutputType: ExpectedOutputType,
): string | number | boolean {
  if (expectedOutputType === "Text") {
    return text;
  }

  if (expectedOutputType === "Number") {
    const normalized = Number(text.trim());

    return text.trim() !== "" && Number.isFinite(normalized) ? normalized : text;
  }

  const normalized = text.trim().toLowerCase();

  return normalized === "true" ? true : normalized === "false" ? false : text;
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function retryAfterMilliseconds(headers: Headers): number | undefined {
  const milliseconds = Number(headers.get("retry-after-ms"));

  if (Number.isFinite(milliseconds) && milliseconds > 0) {
    return milliseconds;
  }

  const seconds = Number(headers.get("retry-after"));

  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function createConcurrencyGate(maximumConcurrentRequests: number): {
  run<T>(work: () => Promise<T>): Promise<T>;
} {
  let activeRequestCount = 0;
  const waiting: Array<() => void> = [];

  return {
    async run<T>(work: () => Promise<T>): Promise<T> {
      if (activeRequestCount >= maximumConcurrentRequests) {
        await new Promise<void>((resolve) => waiting.push(resolve));
      }

      activeRequestCount += 1;

      try {
        return await work();
      } finally {
        activeRequestCount -= 1;
        waiting.shift()?.();
      }
    },
  };
}

class RetryableOpenAiRequestError extends Error {
  constructor(readonly retryAfterMilliseconds?: number) {
    super("OpenAI request can be retried");
  }
}
