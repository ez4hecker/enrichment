import { describe, expect, it } from "vitest";

import { createGeminiGroundedSearch } from "../../src/composition/gemini-grounded-search.js";
import { createGeminiKeyCheck } from "../../src/composition/gemini-key-check.js";
import { createCustomOperationAnswerCache } from "../../src/composition/openai-custom-operation-provider.js";
import { createOpenAiResearchReader } from "../../src/composition/openai-research-reader.js";
import { createPageFetcher, isPublicWebUrl } from "../../src/composition/page-fetcher.js";
import { createResearchKeyCipher } from "../../src/composition/research-key-cipher.js";
import { createResearchOperationProvider } from "../../src/composition/research-operation-provider.js";
import { createSerperWebSearch } from "../../src/composition/serper-web-search.js";

const question = {
  prompt: "Company: Toast\nQuestion: Last funding?",
  expectedOutputType: "Text" as const,
  companyName: "Toast",
  domain: "toasttab.com",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("Gemini grounded search", () => {
  it("asks Gemini 2.5 Flash-Lite with Google Search and returns the answer and its sources", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const search = createGeminiGroundedSearch({
      fetch: async (url, init) => {
        requests.push({ url, init });
        return json({
          candidates: [{
            content: { parts: [{ text: "Series F, $400M, " }, { text: "Feb 2021" }] },
            groundingMetadata: { groundingChunks: [{ web: { uri: "https://redirect/1", title: "techcrunch.com" } }] },
          }],
          usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 100 },
        });
      },
    });

    await expect(search({ apiKey: "AIza-free", billed: false, question })).resolves.toEqual({
      outcome: "answered",
      answer: "Series F, $400M, Feb 2021",
      sources: [{ url: "https://redirect/1", title: "techcrunch.com" }],
      dollars: 0,
    });
    expect(requests[0].url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent");
    expect(requests[0].init.headers).toMatchObject({ "x-goog-api-key": "AIza-free" });
    const body = JSON.parse(String(requests[0].init.body));
    expect(body.tools).toEqual([{ google_search: {} }]);
    expect(body.contents[0].parts[0].text).toBe("Company name: Toast\nCompany website: toasttab.com\nCompany: Toast\nQuestion: Last funding?");

    const billed = await search({ apiKey: "AIza-billed", billed: true, question });
    expect(billed.outcome === "answered" && billed.dollars).toBeCloseTo((1000 * 0.1 + 100 * 0.4) / 1_000_000);
  });

  it("tells a daily quota refusal, a per-minute one and a rejected key apart", async () => {
    const respond = (status: number, body: string) =>
      createGeminiGroundedSearch({ fetch: async () => new Response(body, { status }) });

    await expect(respond(429, '{"error":{"details":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}}')({ apiKey: "k", billed: false, question }))
      .resolves.toMatchObject({ outcome: "rate-limited" });
    await expect(respond(429, '{"quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier"}')({ apiKey: "k", billed: false, question }))
      .resolves.toMatchObject({ outcome: "failed" });
    await expect(respond(400, '{"error":{"status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}')({ apiKey: "k", billed: false, question }))
      .resolves.toMatchObject({ outcome: "key-rejected" });
    await expect(respond(503, "")({ apiKey: "k", billed: false, question }))
      .resolves.toMatchObject({ outcome: "failed" });
  });
});

describe("Serper web search", () => {
  it("returns the answer box, knowledge panel and organic snippets", async () => {
    let sent: RequestInit | undefined;
    const search = createSerperWebSearch({
      apiKey: "serper-key",
      fetch: async (_url, init) => {
        sent = init;
        return json({
          answerBox: { answer: "$400M", title: "Toast funding", link: "https://a" },
          knowledgeGraph: { title: "Toast", description: "Restaurant POS company", website: "https://toasttab.com" },
          organic: [{ title: "Toast raises", link: "https://b", snippet: "Series F", date: "Feb 2021" }, { title: "No snippet", link: "https://c" }],
        });
      },
    });

    await expect(search("Toast funding toasttab.com")).resolves.toEqual([
      { title: "Toast funding", url: "https://a", snippet: "$400M" },
      { title: "Toast", url: "https://toasttab.com", snippet: "Restaurant POS company" },
      { title: "Toast raises", url: "https://b", snippet: "Feb 2021 — Series F" },
    ]);
    expect(sent?.headers).toMatchObject({ "x-api-key": "serper-key" });
    expect(JSON.parse(String(sent?.body))).toEqual({ q: "Toast funding toasttab.com", num: 10 });
  });
});

describe("OpenAI research reader", () => {
  it("answers from the material with gpt-5-nano at minimal effort and prices the tokens", async () => {
    let body: Record<string, unknown> = {};
    const reader = createOpenAiResearchReader({
      apiKey: "sk-test",
      fetch: async (_url, init) => {
        body = JSON.parse(String(init.body));
        return json({
          output: [{ type: "message", content: [{ type: "output_text", text: " Series F " }] }],
          usage: { input_tokens: 2000, output_tokens: 100 },
        });
      },
    });

    await expect(reader({ question, material: [{ text: "Toast raised a Series F", url: "https://b", title: "News" }] }))
      .resolves.toEqual({ answer: "Series F", dollars: (2000 * 0.05 + 100 * 0.4) / 1_000_000 });
    expect(body).toMatchObject({ model: "gpt-5-nano", reasoning: { effort: "minimal" }, store: false });
    expect(body.input).toContain("[1] News (https://b)\nToast raised a Series F");
    expect(body).not.toHaveProperty("tools");
  });
});

describe("Gemini key check", () => {
  it("accepts a working key whose project cannot use billed-only search", async () => {
    const models: Array<string> = [];
    const check = createGeminiKeyCheck({
      fetch: async (url) => {
        models.push(url.split("/models/")[1]);
        return url.includes("gemini-3") ? new Response("{}", { status: 400 }) : json({});
      },
    });

    await expect(check("AIza-key")).resolves.toEqual({ status: "Accepted" });
    expect(models).toEqual(["gemini-2.5-flash-lite:generateContent", "gemini-3.1-flash-lite:generateContent"]);
  });

  it("rejects a billed key, a broken key, and says so when Google is unreachable", async () => {
    await expect(createGeminiKeyCheck({ fetch: async () => json({}) })("k")).resolves.toMatchObject({ code: "KEY_BILLED" });
    await expect(createGeminiKeyCheck({ fetch: async () => new Response("", { status: 400 }) })("k")).resolves.toMatchObject({ code: "KEY_INVALID" });
    await expect(createGeminiKeyCheck({ fetch: async () => { throw new Error("offline"); } })("k")).resolves.toMatchObject({ code: "CHECK_FAILED" });
  });
});

describe("Research key cipher", () => {
  it("round-trips a key, never stores it in clear, and fingerprints it stably", () => {
    const cipher = createResearchKeyCipher("a-server-secret-of-at-least-32-characters");
    const encrypted = cipher.encrypt("AIzaSecretKey");

    expect(encrypted).not.toContain("AIzaSecretKey");
    expect(cipher.decrypt(encrypted)).toBe("AIzaSecretKey");
    expect(cipher.fingerprint("AIzaSecretKey")).toBe(cipher.fingerprint("AIzaSecretKey"));
    expect(() => createResearchKeyCipher("a-server-secret-of-at-least-32-characters-2").decrypt(encrypted)).toThrow();
    expect(() => createResearchKeyCipher("short")).toThrow();
  });
});

describe("Page fetcher", () => {
  it("fetches public pages only and returns their readable text", async () => {
    expect(isPublicWebUrl("https://toasttab.com/about")).toBe(true);
    expect(isPublicWebUrl("http://localhost:3000")).toBe(false);
    expect(isPublicWebUrl("http://127.0.0.1/")).toBe(false);
    expect(isPublicWebUrl("http://169.254.169.254/latest")).toBe(false);
    expect(isPublicWebUrl("http://192.168.1.5/")).toBe(false);
    expect(isPublicWebUrl("file:///etc/passwd")).toBe(false);

    const fetchPage = createPageFetcher({
      fetch: async (url) => url === "https://a.com/"
        ? new Response(null, { status: 301, headers: { location: "http://127.0.0.1/admin" } })
        : new Response("<html><script>x()</script><p>Toast &amp; friends</p></html>", { headers: { "content-type": "text/html" } }),
    });

    await expect(fetchPage("https://b.com/")).resolves.toBe("Toast & friends");
    await expect(fetchPage("https://a.com/")).resolves.toBeUndefined();
  });
});

describe("Research operation provider", () => {
  it("sends Generation to the writer and Research to the chain once per company and question", async () => {
    const researched: Array<string> = [];
    const provider = createResearchOperationProvider({
      generation: { async execute() { return "written"; } },
      research: {
        async research(request) {
          researched.push(request.prompt);
          return "researched";
        },
        spentDollars: () => 0,
      },
      answerCache: createCustomOperationAnswerCache(),
    });

    await expect(provider.execute({ prompt: "p", expectedOutputType: "Text", generationModel: "gpt-6-luna" })).resolves.toBe("written");
    await Promise.all([
      provider.execute({ prompt: "q", expectedOutputType: "Text", companyWebsite: "a.com" }),
      provider.execute({ prompt: "q", expectedOutputType: "Text", companyWebsite: "a.com" }),
      provider.execute({ prompt: "q", expectedOutputType: "Text", companyWebsite: "b.com" }),
    ]);
    expect(researched).toEqual(["q", "q"]);
  });
});
