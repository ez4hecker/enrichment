import { describe, expect, it } from "vitest";

import {
  createCustomOperationAnswerCache,
  createOpenAiCustomOperationProvider,
} from "../../src/composition/openai-custom-operation-provider.js";

describe("OpenAI Custom Operation Provider", () => {
  it("sends a Custom Operation prompt to Responses and normalizes its configured output type", async () => {
    const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
    const provider = createOpenAiCustomOperationProvider({
      apiKey: "test-api-key",
      model: "configured-model",
      fetch: async (url, init) => {
        requests.push({ url: String(url), init });

        return jsonResponse({
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: "42" }],
            },
          ],
        });
      },
    });

    await expect(
      provider.execute({
        prompt: "Estimate Acme's employee count.",
        expectedOutputType: "Number",
      }),
    ).resolves.toBe(42);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      url: "https://api.openai.com/v1/responses",
      init: {
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer test-api-key",
        }),
      },
    });
    expect(JSON.parse(String(requests[0].init?.body))).toEqual({
      model: "configured-model",
      input: "Estimate Acme's employee count.",
      instructions: expect.stringContaining(
        "Return only one finite number. Do not include commentary or formatting.",
      ),
      tools: [{ type: "web_search" }],
      tool_choice: "required",
      store: false,
    });
  });

  it("researches Text answers on the web and returns only the concise answer without citations", async () => {
    const requests: Array<RequestInit | undefined> = [];
    const provider = createOpenAiCustomOperationProvider({
      apiKey: "test-api-key",
      model: "configured-model",
      fetch: async (_url, init) => {
        requests.push(init);

        return jsonResponse({
          output: [
            { type: "web_search_call", status: "completed" },
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: "**Series F, $400M, Feb 2021** ([techcrunch.com](https://techcrunch.com/toast?utm_source=openai))\n",
                },
              ],
            },
          ],
        });
      },
    });

    await expect(
      provider.execute({
        prompt: "Company: Toast\nQuestion: What was the last funding they got?",
        expectedOutputType: "Text",
      }),
    ).resolves.toBe("Series F, $400M, Feb 2021");

    const body = JSON.parse(String(requests[0]?.body));

    expect(body.tools).toEqual([{ type: "web_search" }]);
    expect(body.instructions).toContain("as few words as possible");
  });

  it("retries a transient OpenAI response before returning a Boolean value", async () => {
    let attempt = 0;
    const provider = createOpenAiCustomOperationProvider({
      apiKey: "test-api-key",
      model: "configured-model",
      maximumAttempts: 2,
      retryDelayMilliseconds: 0,
      fetch: async () => {
        attempt += 1;

        return attempt === 1
          ? jsonResponse({ error: { message: "Rate limit" } }, 429)
          : jsonResponse({
              output: [
                {
                  type: "message",
                  content: [{ type: "output_text", text: "TRUE" }],
                },
              ],
            });
      },
    });

    await expect(
      provider.execute({
        prompt: "Is Acme a technology company?",
        expectedOutputType: "Boolean",
      }),
    ).resolves.toBe(true);
    expect(attempt).toBe(2);
  });

  it("shares its configured concurrency limit across Custom Operation calls", async () => {
    let activeRequestCount = 0;
    let maximumActiveRequestCount = 0;
    let releaseFirstRequest: () => void = () => undefined;
    let notifyFirstRequestStarted: () => void = () => undefined;
    const firstRequestStarted = new Promise<void>((resolve) => {
      notifyFirstRequestStarted = resolve;
    });
    const firstRequest = new Promise<void>((resolve) => {
      releaseFirstRequest = resolve;
    });
    const provider = createOpenAiCustomOperationProvider({
      apiKey: "test-api-key",
      model: "configured-model",
      maximumConcurrentRequests: 1,
      fetch: async () => {
        activeRequestCount += 1;
        maximumActiveRequestCount = Math.max(
          maximumActiveRequestCount,
          activeRequestCount,
        );

        if (activeRequestCount === 1) {
          notifyFirstRequestStarted();
          await firstRequest;
        }

        activeRequestCount -= 1;

        return jsonResponse({
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: "Technology" }],
            },
          ],
        });
      },
    });

    const first = provider.execute({
      prompt: "Classify Acme.",
      expectedOutputType: "Text",
    });
    await firstRequestStarted;
    const second = provider.execute({
      prompt: "Classify Globex.",
      expectedOutputType: "Text",
    });
    await Promise.resolve();

    expect(maximumActiveRequestCount).toBe(1);

    releaseFirstRequest();

    await expect(Promise.all([first, second])).resolves.toEqual([
      "Technology",
      "Technology",
    ]);
    expect(maximumActiveRequestCount).toBe(1);
  });

  it("searches once for identical prompts, whether they arrive together or later", async () => {
    let requestCount = 0;
    const provider = createOpenAiCustomOperationProvider({
      apiKey: "test-api-key",
      model: "configured-model",
      fetch: async () => {
        requestCount += 1;

        return jsonResponse({
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: `Answer ${requestCount}` }],
            },
          ],
        });
      },
    });
    const toast = { prompt: "Company: Toast\nQuestion: Last funding?", expectedOutputType: "Text" as const };

    await expect(
      Promise.all([provider.execute(toast), provider.execute(toast), provider.execute(toast)]),
    ).resolves.toEqual(["Answer 1", "Answer 1", "Answer 1"]);
    await expect(provider.execute(toast)).resolves.toBe("Answer 1");
    await expect(
      provider.execute({ ...toast, prompt: "Company: Ramp\nQuestion: Last funding?" }),
    ).resolves.toBe("Answer 2");
    expect(requestCount).toBe(2);
  });

  it("shares answers between providers given the same cache but does not keep failures", async () => {
    let requestCount = 0;
    const answerCache = createCustomOperationAnswerCache();
    const options = {
      apiKey: "test-api-key",
      model: "configured-model",
      maximumAttempts: 1,
      answerCache,
      fetch: async () => {
        requestCount += 1;

        return requestCount === 1
          ? jsonResponse({ error: { message: "Bad request" } }, 400)
          : jsonResponse({
              output: [
                {
                  type: "message",
                  content: [{ type: "output_text", text: "Series B" }],
                },
              ],
            });
      },
    };
    const previewProvider = createOpenAiCustomOperationProvider(options);
    const jobProvider = createOpenAiCustomOperationProvider(options);
    const acme = { prompt: "Company: Acme\nQuestion: Last funding?", expectedOutputType: "Text" as const };

    await expect(previewProvider.execute(acme)).rejects.toThrow();
    await expect(previewProvider.execute(acme)).resolves.toBe("Series B");
    await expect(jobProvider.execute(acme)).resolves.toBe("Series B");
    expect(requestCount).toBe(2);
  });

  it("expires cached answers after their time to live", async () => {
    let currentTime = 0;
    let requestCount = 0;
    const provider = createOpenAiCustomOperationProvider({
      apiKey: "test-api-key",
      model: "configured-model",
      answerCache: createCustomOperationAnswerCache({
        timeToLiveMilliseconds: 1000,
        now: () => currentTime,
      }),
      fetch: async () => {
        requestCount += 1;

        return jsonResponse({
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: `Answer ${requestCount}` }],
            },
          ],
        });
      },
    });
    const acme = { prompt: "Company: Acme\nQuestion: Last funding?", expectedOutputType: "Text" as const };

    await expect(provider.execute(acme)).resolves.toBe("Answer 1");
    currentTime = 999;
    await expect(provider.execute(acme)).resolves.toBe("Answer 1");
    currentTime = 1000;
    await expect(provider.execute(acme)).resolves.toBe("Answer 2");
  });

  it("sends the configured reasoning effort and today's date", async () => {
    const requests: Array<RequestInit | undefined> = [];
    const provider = createOpenAiCustomOperationProvider({
      apiKey: "test-api-key",
      model: "configured-model",
      reasoningEffort: "low",
      now: () => new Date("2026-09-29T12:00:00Z"),
      fetch: async (_url, init) => {
        requests.push(init);

        return jsonResponse({
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: "Series B" }],
            },
          ],
        });
      },
    });

    await provider.execute({
      prompt: "Company: Acme\nWebsite: acme.com\nQuestion: Last funding?",
      expectedOutputType: "Text",
    });

    const body = JSON.parse(String(requests[0]?.body));

    expect(body.reasoning).toEqual({ effort: "low" });
    expect(body.instructions).toContain("Today's date is 2026-09-29.");
    expect(body.instructions).toContain("use any website");
  });

  it("waits as long as a rate-limited response asks before retrying", async () => {
    const attemptTimes: Array<number> = [];
    const provider = createOpenAiCustomOperationProvider({
      apiKey: "test-api-key",
      model: "configured-model",
      maximumAttempts: 2,
      retryDelayMilliseconds: 0,
      fetch: async () => {
        attemptTimes.push(Date.now());

        return attemptTimes.length === 1
          ? new Response(JSON.stringify({ error: { message: "Rate limit" } }), {
              status: 429,
              headers: { "content-type": "application/json", "retry-after-ms": "60" },
            })
          : jsonResponse({
              output: [
                {
                  type: "message",
                  content: [{ type: "output_text", text: "Series B" }],
                },
              ],
            });
      },
    });

    await expect(
      provider.execute({ prompt: "Company: Acme\nQuestion: Last funding?", expectedOutputType: "Text" }),
    ).resolves.toBe("Series B");
    expect(attemptTimes[1] - attemptTimes[0]).toBeGreaterThanOrEqual(55);
  });

  it("writes Generation answers with the chosen model and no web search", async () => {
    const requests: Array<RequestInit | undefined> = [];
    const provider = createOpenAiCustomOperationProvider({
      apiKey: "test-api-key",
      model: "configured-model",
      reasoningEffort: "low",
      fetch: async (_url, init) => {
        requests.push(init);

        return jsonResponse({
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: "Loved Acme's move into Europe, Jane." }],
            },
          ],
        });
      },
    });

    await expect(
      provider.execute({
        prompt: "Write an ice breaker for Jane, CEO of Acme.",
        expectedOutputType: "Text",
        generationModel: "gpt-6-luna",
      }),
    ).resolves.toBe("Loved Acme's move into Europe, Jane.");

    const body = JSON.parse(String(requests[0]?.body));

    expect(body.model).toBe("gpt-6-luna");
    expect(body.tools).toBeUndefined();
    expect(body.tool_choice).toBeUndefined();
    expect(body.reasoning).toEqual({ effort: "none" });
    expect(body.instructions).toContain("only the details given in the input");
    expect(body.instructions).not.toContain("at most 15 words");
  });

  it("does not share answers between Research and Generation or between models", async () => {
    let requestCount = 0;
    const provider = createOpenAiCustomOperationProvider({
      apiKey: "test-api-key",
      model: "configured-model",
      fetch: async () => {
        requestCount += 1;

        return jsonResponse({
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: `answer ${requestCount}` }],
            },
          ],
        });
      },
    });
    const prompt = "Write an ice breaker for Jane, CEO of Acme.";

    await provider.execute({ prompt, expectedOutputType: "Text" });
    await provider.execute({ prompt, expectedOutputType: "Text", generationModel: "gpt-6-luna" });
    await provider.execute({ prompt, expectedOutputType: "Text", generationModel: "gpt-6-astra" });
    await provider.execute({ prompt, expectedOutputType: "Text", generationModel: "gpt-6-luna" });

    expect(requestCount).toBe(3);
  });

  it("refuses a Generation model outside the Generation Model catalog", async () => {
    let requestCount = 0;
    const provider = createOpenAiCustomOperationProvider({
      apiKey: "test-api-key",
      model: "configured-model",
      fetch: async () => {
        requestCount += 1;
        return jsonResponse({});
      },
    });

    await expect(
      provider.execute({
        prompt: "Write an ice breaker for Jane.",
        expectedOutputType: "Text",
        generationModel: "gpt-5.5-pro",
      }),
    ).rejects.toThrow();
    expect(requestCount).toBe(0);
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
