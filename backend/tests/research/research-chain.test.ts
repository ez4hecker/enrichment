import { describe, expect, it } from "vitest";

import { SpendLimitReachedError } from "../../src/job-execution/execute-enrichment-job.js";
import { companyDomain } from "../../src/research/company-domain.js";
import { createCompanyDossier, type CompanyDossierStore, type DossierMaterial } from "../../src/research/company-dossier.js";
import type { GeminiKeyPool, GeminiSearchOutcome } from "../../src/research/gemini-key-pool.js";
import {
  createResearchChain,
  searchQuery,
  type GeminiGroundedSearch,
  type ResearchReader,
  type WebSearch,
} from "../../src/research/research-chain.js";

function memoryDossierStore(initial: Record<string, Array<DossierMaterial>> = {}) {
  const records = new Map(Object.entries(initial));
  const queries: Array<ReadonlyArray<string>> = [];
  const store: CompanyDossierStore = {
    async readMany(domains) {
      queries.push(domains);
      return new Map(domains.flatMap((domain) => records.has(domain) ? [[domain, records.get(domain)!]] : []));
    },
    async write(domain, material) {
      records.set(domain, [...material]);
    },
    async deleteExpired() {
      return 0;
    },
  };

  return { store, records, queries };
}

function poolWith(available: boolean) {
  const reports: Array<GeminiSearchOutcome> = [];
  const pool: GeminiKeyPool = {
    async acquire() {
      return available
        ? { apiKey: "AIza-pool", billed: false, async report(outcome) { reports.push(outcome); } }
        : undefined;
    },
    async refresh() {},
    async status() {
      return { activeKeys: available ? 1 : 0, searchesLeftToday: available ? 1 : 0 };
    },
  };

  return { pool, reports };
}

const toastRow = {
  jobId: "job-1",
  prompt: "Company: Toast\nQuestion: Last funding round?",
  expectedOutputType: "Text" as const,
  companyName: "Toast",
  companyWebsite: "https://www.toasttab.com/",
};

describe("Research chain", () => {
  it("answers from a free pool search first and keeps the answer in the company's Dossier", async () => {
    const dossier = memoryDossierStore();
    const { pool, reports } = poolWith(true);
    const geminiQuestions: Array<unknown> = [];
    const chain = createResearchChain({
      dossier: createCompanyDossier({ store: dossier.store }),
      keyPool: pool,
      geminiSearch: async ({ question }) => {
        geminiQuestions.push(question);
        return { outcome: "answered", answer: "Series F, $400M, Feb 2021", sources: [{ url: "https://techcrunch.com/toast" }], dollars: 0 };
      },
      webSearch: async () => {
        throw new Error("paid search must not run");
      },
      reader: async () => ({ answer: "[Not Found]", dollars: 0 }),
    });

    await expect(chain.research(toastRow)).resolves.toBe("Series F, $400M, Feb 2021");
    expect(geminiQuestions).toEqual([{
      prompt: toastRow.prompt,
      expectedOutputType: "Text",
      companyName: "Toast",
      domain: "toasttab.com",
    }]);
    expect(reports).toEqual(["answered"]);
    expect(dossier.records.get("toasttab.com")).toEqual([
      expect.objectContaining({ kind: "gemini-answer", text: "Series F, $400M, Feb 2021", url: "https://techcrunch.com/toast" }),
    ]);
    expect(chain.spentDollars("job-1")).toBe(0);
  });

  it("answers a later question from the Dossier without searching again", async () => {
    const dossier = memoryDossierStore({
      "toasttab.com": [{ kind: "search-result", text: "Toast raised a $400M Series F in 2021.", url: "https://x.com/a", gatheredAt: new Date().toISOString() }],
    });
    const readerInputs: Array<Parameters<ResearchReader>[0]> = [];
    const chain = createResearchChain({
      dossier: createCompanyDossier({ store: dossier.store }),
      keyPool: poolWith(true).pool,
      geminiSearch: async () => {
        throw new Error("pool must not be used");
      },
      reader: async (input) => {
        readerInputs.push(input);
        return { answer: "Series F, $400M, 2021", dollars: 0.0001 };
      },
    });

    await expect(chain.research(toastRow)).resolves.toBe("Series F, $400M, 2021");
    expect(readerInputs[0].material).toEqual([
      { text: "Toast raised a $400M Series F in 2021.", url: "https://x.com/a", title: undefined },
    ]);
    expect(chain.spentDollars("job-1")).toBeCloseTo(0.0001);
  });

  it("falls back to a paid search read by the reader when the pool has no slot", async () => {
    const dossier = memoryDossierStore();
    const queries: Array<string> = [];
    const webSearch: WebSearch = async (query) => {
      queries.push(query);
      return [{ title: "Toast funding", url: "https://news.example/toast", snippet: "Toast raised $400M Series F" }];
    };
    const chain = createResearchChain({
      dossier: createCompanyDossier({ store: dossier.store }),
      keyPool: poolWith(false).pool,
      geminiSearch: async () => ({ outcome: "failed" }),
      webSearch,
      webSearchDollarsPerSearch: 0.001,
      reader: async () => ({ answer: "Series F, $400M", dollars: 0.0002 }),
    });

    await expect(chain.research(toastRow)).resolves.toBe("Series F, $400M");
    expect(queries).toEqual(["Toast Last funding round? toasttab.com"]);
    expect(dossier.records.get("toasttab.com")).toEqual([
      expect.objectContaining({ kind: "search-result", text: "Toast raised $400M Series F", url: "https://news.example/toast" }),
    ]);
    expect(chain.spentDollars("job-1")).toBeCloseTo(0.0012);
  });

  it("reads the company's own page when snippets do not answer", async () => {
    const fetched: Array<string> = [];
    let reads = 0;
    const chain = createResearchChain({
      webSearch: async () => [
        { title: "Other", url: "https://news.example/a", snippet: "unrelated" },
        { title: "Toast about", url: "https://pos.toasttab.com/about", snippet: "About Toast" },
      ],
      reader: async () => {
        reads += 1;
        return { answer: reads === 1 ? "[Not Found]" : "Series F", dollars: 0 };
      },
      fetchPage: async (url) => {
        fetched.push(url);
        return "Toast closed its Series F.";
      },
    });

    await expect(chain.research(toastRow)).resolves.toBe("Series F");
    expect(fetched).toEqual(["https://pos.toasttab.com/about"]);
  });

  it("stops paid research at the Spend Limit but still uses free pool searches", async () => {
    const chain = createResearchChain({
      webSearch: async () => [{ title: "t", url: "https://e.com", snippet: "s" }],
      webSearchDollarsPerSearch: 0.6,
      reader: async () => ({ answer: "answer", dollars: 0.3 }),
      estimatedReaderDollars: 0.3,
      spendLimitDollars: 1,
    });

    await expect(chain.research(toastRow)).resolves.toBe("answer");
    await expect(chain.research({ ...toastRow, prompt: "second" })).rejects.toBeInstanceOf(SpendLimitReachedError);
    expect(chain.spentDollars("job-1")).toBeCloseTo(0.9);

    const withPool = createResearchChain({
      keyPool: poolWith(true).pool,
      geminiSearch: async () => ({ outcome: "answered", answer: "free answer", sources: [], dollars: 0 }),
      spendLimitDollars: 0,
    });

    await expect(withPool.research(toastRow)).resolves.toBe("free answer");
  });

  it("reports a rejected pool key and moves on to the paid search", async () => {
    const { pool, reports } = poolWith(true);
    const failing: GeminiGroundedSearch = async () => ({ outcome: "key-rejected", reason: "revoked" });
    const chain = createResearchChain({
      keyPool: pool,
      geminiSearch: failing,
      webSearch: async () => [{ title: "t", url: "https://e.com", snippet: "s" }],
      reader: async () => ({ answer: "paid answer", dollars: 0 }),
    });

    await expect(chain.research(toastRow)).resolves.toBe("paid answer");
    expect(reports).toEqual(["key-rejected"]);
  });

  it("never reads or feeds a Dossier for a row without a website", async () => {
    const dossier = memoryDossierStore();
    const chain = createResearchChain({
      dossier: createCompanyDossier({ store: dossier.store }),
      webSearch: async () => [{ title: "t", url: "https://e.com", snippet: "s" }],
      reader: async () => ({ answer: "answer", dollars: 0 }),
    });

    await chain.research({ ...toastRow, companyWebsite: undefined });
    expect(dossier.queries).toEqual([]);
    expect(dossier.records.size).toBe(0);
  });

  it("answers [Not Found] when no source can, and normalizes Number and Boolean answers", async () => {
    await expect(createResearchChain({}).research(toastRow)).resolves.toBe("[Not Found]");

    const reader = (answer: string): ResearchReader => async () => ({ answer, dollars: 0 });
    const search: WebSearch = async () => [{ title: "t", url: "https://e.com", snippet: "s" }];

    await expect(createResearchChain({ webSearch: search, reader: reader("1,200") })
      .research({ ...toastRow, expectedOutputType: "Number" })).resolves.toBe(1200);
    await expect(createResearchChain({ webSearch: search, reader: reader("True") })
      .research({ ...toastRow, expectedOutputType: "Boolean" })).resolves.toBe(true);
  });
});

describe("Company identity", () => {
  it("identifies a company by its website domain", () => {
    expect(companyDomain("https://www.toasttab.com/about")).toBe("toasttab.com");
    expect(companyDomain("TOASTTAB.com")).toBe("toasttab.com");
    expect(companyDomain("http://www2.first.bank")).toBe("first.bank");
    expect(companyDomain("acme")).toBeUndefined();
    expect(companyDomain("10.0.0.1")).toBeUndefined();
    expect(companyDomain("")).toBeUndefined();
  });

  it("builds a short search query from the prompt and the domain", () => {
    expect(searchQuery({ prompt: "Company: Acme\nQuestion: Who is the CEO?", expectedOutputType: "Text", domain: "acme.com" }))
      .toBe("Acme Who is the CEO? acme.com");
  });
});
