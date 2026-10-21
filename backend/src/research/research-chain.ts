import type { ExpectedOutputType } from "../operation-library/custom-operation-definition.js";
import { SpendLimitReachedError } from "../job-execution/execute-enrichment-job.js";
import { companyDomain } from "./company-domain.js";
import type { CompanyDossier, DossierMaterial } from "./company-dossier.js";
import type { GeminiKeyPool, GeminiSearchOutcome } from "./gemini-key-pool.js";

export type ResearchRequest = {
  prompt: string;
  expectedOutputType: ExpectedOutputType;
  jobId?: string;
  companyWebsite?: string;
  companyName?: string;
};

/** What every source is told about the question: the rendered prompt and the company's identity. */
export type ResearchQuestion = {
  prompt: string;
  expectedOutputType: ExpectedOutputType;
  companyName?: string;
  domain?: string;
};

export type GeminiGroundedSearch = (input: {
  apiKey: string;
  billed: boolean;
  question: ResearchQuestion;
}) => Promise<
  | { outcome: "answered"; answer: string; sources: Array<{ url: string; title?: string }>; dollars: number }
  | { outcome: Exclude<GeminiSearchOutcome, "answered">; reason?: string }
>;

export type WebSearchResult = { title: string; url: string; snippet: string };

export type WebSearch = (query: string) => Promise<Array<WebSearchResult>>;

/** Reads gathered material and answers the question from it alone, or says [Not Found]. */
export type ResearchReader = (input: {
  question: ResearchQuestion;
  material: Array<{ text: string; url?: string; title?: string }>;
}) => Promise<{ answer: string; dollars: number }>;

/** Returns a page's readable text, or nothing when it cannot be fetched. */
export type PageFetcher = (url: string) => Promise<string | undefined>;

export type ResearchChainOptions = {
  dossier?: CompanyDossier;
  keyPool?: GeminiKeyPool;
  geminiSearch?: GeminiGroundedSearch;
  webSearch?: WebSearch;
  webSearchDollarsPerSearch?: number;
  reader?: ResearchReader;
  fetchPage?: PageFetcher;
  /** Highest external spend for one Enrichment Job. */
  spendLimitDollars?: number;
  /**
   * How long after a job's first research request free pool searches may still be waited
   * for. Rows whose free slot would come later go to the paid search straight away, so they
   * run alongside the pool rather than after it.
   */
  poolDeadlineMilliseconds?: number;
  /** Spend reserved before a reader call; the real cost replaces it when the call returns. */
  estimatedReaderDollars?: number;
  now?: () => Date;
};

export type ResearchChain = {
  research(request: ResearchRequest): Promise<string | number | boolean>;
  /** Spend counted so far for a job, in dollars. */
  spentDollars(jobId: string): number;
};

type JobLedger = {
  startedAt: number;
  spent: number;
  reserved: number;
  lastUsedAt: number;
};

const notFound = "[Not Found]";
const ledgerLifetimeMilliseconds = 48 * 60 * 60 * 1000;
const maximumPageCharacters = 12_000;
const maximumStoredPageCharacters = 1_500;

/**
 * Answers a Research Custom Operation from the cheapest source that can, in order:
 *
 * 1. the company's Dossier (research already done for earlier rows or jobs);
 * 2. a free grounded Gemini search on a pooled key, while a slot opens before the deadline;
 * 3. a paid web search, read by the cheap reader;
 * 4. the most relevant result page, fetched and read;
 * 5. [Not Found].
 *
 * Every search result is added to the company's Dossier; nothing is searched only to fill it.
 * Paid steps are charged to the job's Spend Limit before they run, so no job can pass it.
 */
export function createResearchChain(options: ResearchChainOptions): ResearchChain {
  const now = options.now ?? (() => new Date());
  const spendLimitDollars = options.spendLimitDollars ?? 3.5;
  const poolDeadlineMilliseconds = options.poolDeadlineMilliseconds ?? 60 * 60 * 1000;
  const webSearchDollars = options.webSearchDollarsPerSearch ?? 0.001;
  const estimatedReaderDollars = options.estimatedReaderDollars ?? 0.0003;
  const ledgers = new Map<string, JobLedger>();

  function ledgerFor(jobId: string | undefined): JobLedger {
    const currentTime = now().getTime();

    for (const [id, ledger] of ledgers) {
      if (currentTime - ledger.lastUsedAt > ledgerLifetimeMilliseconds) {
        ledgers.delete(id);
      }
    }

    if (jobId === undefined) {
      return { startedAt: currentTime, spent: 0, reserved: 0, lastUsedAt: currentTime };
    }

    let ledger = ledgers.get(jobId);

    if (ledger === undefined) {
      ledger = { startedAt: currentTime, spent: 0, reserved: 0, lastUsedAt: currentTime };
      ledgers.set(jobId, ledger);
    }

    ledger.lastUsedAt = currentTime;

    return ledger;
  }

  /** Runs a paid step only if its estimate still fits under the Spend Limit. */
  async function spend<T extends { dollars: number }>(
    ledger: JobLedger,
    estimate: number,
    work: () => Promise<T>,
  ): Promise<T> {
    if (ledger.spent + ledger.reserved + estimate > spendLimitDollars) {
      throw new SpendLimitReachedError();
    }

    ledger.reserved += estimate;
    let charged = estimate;

    try {
      const result = await work();
      charged = result.dollars;
      return result;
    } finally {
      ledger.reserved -= estimate;
      ledger.spent += charged;
    }
  }

  async function addToDossier(
    domain: string | undefined,
    material: Array<Omit<DossierMaterial, "gatheredAt">>,
  ): Promise<void> {
    if (domain === undefined || options.dossier === undefined) {
      return;
    }

    // Losing one piece of gathered research must never fail the row it answered.
    await options.dossier.add(domain, material).catch(() => undefined);
  }

  async function read(
    ledger: JobLedger,
    question: ResearchQuestion,
    material: Array<{ text: string; url?: string; title?: string }>,
  ): Promise<string | undefined> {
    if (options.reader === undefined || material.length === 0) {
      return undefined;
    }

    const reader = options.reader;
    const { answer } = await spend(ledger, estimatedReaderDollars, () => reader({ question, material }));

    return isNotFound(answer) ? undefined : answer;
  }

  async function answerFromDossier(
    ledger: JobLedger,
    question: ResearchQuestion,
  ): Promise<string | undefined> {
    if (question.domain === undefined || options.dossier === undefined) {
      return undefined;
    }

    let material: Array<DossierMaterial>;

    try {
      material = await options.dossier.read(question.domain);
    } catch {
      return undefined;
    }

    try {
      return await read(ledger, question, material.map((piece) => ({
        text: piece.question === undefined ? piece.text : `(Found while researching: ${piece.question}) ${piece.text}`,
        url: piece.url,
        title: piece.title,
      })));
    } catch (error) {
      // Out of budget for even a cheap read: a free pool search may still answer.
      if (error instanceof SpendLimitReachedError) {
        return undefined;
      }

      throw error;
    }
  }

  async function answerFromPool(
    ledger: JobLedger,
    question: ResearchQuestion,
  ): Promise<string | undefined> {
    if (options.keyPool === undefined || options.geminiSearch === undefined) {
      return undefined;
    }

    const lease = await options.keyPool.acquire(new Date(ledger.startedAt + poolDeadlineMilliseconds));

    if (lease === undefined) {
      return undefined;
    }

    let result: Awaited<ReturnType<GeminiGroundedSearch>>;

    try {
      result = await options.geminiSearch({ apiKey: lease.apiKey, billed: lease.billed, question });
    } catch {
      result = { outcome: "failed" };
    }

    await lease.report(result.outcome, result.outcome === "answered" ? undefined : result.reason);

    if (result.outcome !== "answered") {
      return undefined;
    }

    ledger.spent += result.dollars;

    if (isNotFound(result.answer)) {
      return undefined;
    }

    await addToDossier(question.domain, [{
      kind: "gemini-answer",
      question: question.prompt,
      text: result.answer,
      ...(result.sources[0] === undefined ? {} : { url: result.sources[0].url, title: result.sources[0].title }),
    }]);

    return result.answer;
  }

  async function answerFromWebSearch(
    ledger: JobLedger,
    question: ResearchQuestion,
  ): Promise<string | undefined> {
    if (options.webSearch === undefined || options.reader === undefined) {
      return undefined;
    }

    const webSearch = options.webSearch;
    const { results } = await spend(ledger, webSearchDollars, async () => ({
      results: await webSearch(searchQuery(question)),
      dollars: webSearchDollars,
    }));

    await addToDossier(question.domain, results.map((result) => ({
      kind: "search-result",
      question: question.prompt,
      text: result.snippet,
      url: result.url,
      title: result.title,
    })));

    const fromSnippets = await read(ledger, question, results.map((result) => ({
      text: result.snippet,
      url: result.url,
      title: result.title,
    })));

    if (fromSnippets !== undefined || options.fetchPage === undefined) {
      return fromSnippets;
    }

    // Snippets were not enough: read the most promising page itself, preferring the company's own site.
    const page = results.find((result) =>
      question.domain !== undefined && companyDomain(result.url)?.endsWith(question.domain),
    ) ?? results[0];

    if (page === undefined) {
      return undefined;
    }

    const text = await options.fetchPage(page.url).catch(() => undefined);

    if (text === undefined || text.trim() === "") {
      return undefined;
    }

    const pageText = text.slice(0, maximumPageCharacters);
    const answer = await read(ledger, question, [{ text: pageText, url: page.url, title: page.title }]);

    if (answer !== undefined) {
      await addToDossier(question.domain, [{
        kind: "page-extract",
        question: question.prompt,
        text: `${answer} — ${pageText.slice(0, maximumStoredPageCharacters)}`,
        url: page.url,
        title: page.title,
      }]);
    }

    return answer;
  }

  return {
    async research(request) {
      const ledger = ledgerFor(request.jobId);
      const domain = companyDomain(request.companyWebsite);
      const question: ResearchQuestion = {
        prompt: request.prompt,
        expectedOutputType: request.expectedOutputType,
        ...(request.companyName === undefined ? {} : { companyName: request.companyName }),
        ...(domain === undefined ? {} : { domain }),
      };
      const answer =
        await answerFromDossier(ledger, question) ??
        await answerFromPool(ledger, question) ??
        await answerFromWebSearch(ledger, question) ??
        notFound;

      return normalizeAnswer(answer, request.expectedOutputType);
    },
    spentDollars(jobId) {
      return ledgers.get(jobId)?.spent ?? 0;
    },
  };
}

function isNotFound(answer: string): boolean {
  return /^\[?\s*not found\s*\]?\.?$/i.test(answer.trim()) || answer.trim() === "";
}

/** A short Google query: the question without its labels, plus the company's domain. */
export function searchQuery(question: ResearchQuestion): string {
  const text = question.prompt
    .replace(/^\s*(company|question|website|domain)\s*:\s*/gim, "")
    .replace(/\s+/g, " ")
    .trim();
  const withDomain = question.domain === undefined || text.toLowerCase().includes(question.domain)
    ? text
    : `${text} ${question.domain}`;

  return withDomain.slice(0, 300);
}

function normalizeAnswer(
  answer: string,
  expectedOutputType: ExpectedOutputType,
): string | number | boolean {
  const text = answer.trim();

  if (expectedOutputType === "Text") {
    return text;
  }

  if (expectedOutputType === "Number") {
    const number = Number(text.replace(/,/g, ""));

    return text !== "" && Number.isFinite(number) ? number : text;
  }

  const lower = text.toLowerCase();

  return lower === "true" ? true : lower === "false" ? false : text;
}
