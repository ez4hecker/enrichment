import pg from "pg";

import { createFileOutputArtifactStore } from "./file-output-artifact-store.js";
import {
  createCustomOperationAnswerCache,
  createOpenAiCustomOperationProvider,
  type OpenAiCustomOperationProviderOptions,
} from "./openai-custom-operation-provider.js";
import { createPostgresJobStore } from "./postgres-job-store.js";
import { createPostgresOperationLibrary } from "./postgres-operation-library.js";
import { createPostgresUserCredentialStore } from "./postgres-user-credential-store.js";
import {
  createHttpServer,
  ownerIdForRequestFromSession,
} from "../delivery/http-server.js";
import { dispatchPendingEnrichmentJobs } from "../job-intake/submit-enrichment-job.js";
import { createUserAuthentication } from "../user-authentication/user-authentication.js";
import { executeQueuedEnrichmentJob } from "../job-execution/execute-queued-enrichment-job.js";
import { createCompanyDossier } from "../research/company-dossier.js";
import { createGeminiKeyPool, type PoolKey } from "../research/gemini-key-pool.js";
import { createResearchChain, type ResearchChainOptions } from "../research/research-chain.js";
import { createResearchKeyRegistry } from "../research/research-key-registry.js";
import { createGeminiGroundedSearch } from "./gemini-grounded-search.js";
import { createGeminiKeyCheck } from "./gemini-key-check.js";
import { createOpenAiResearchReader } from "./openai-research-reader.js";
import { createPageFetcher } from "./page-fetcher.js";
import { createPostgresCompanyDossierStore } from "./postgres-company-dossier-store.js";
import { createPostgresResearchKeyStore } from "./postgres-research-key-store.js";
import { createResearchKeyCipher, type ResearchKeyCipher } from "./research-key-cipher.js";
import { createResearchOperationProvider } from "./research-operation-provider.js";
import { createSerperWebSearch } from "./serper-web-search.js";
import { createLeadOceanDirectory } from "./leadocean-directory.js";
import { createLeadLookup } from "../lead-lookup/lead-lookup.js";

const { Pool } = pg;

export type ProductionRuntimeOptions = {
  databaseUrl: string;
  redisUrl: string; // Ignored in in-memory bypass
  outputArtifactDirectory: string;
  port?: number;
  host?: string;
  workerConcurrency?: number;
  leaseDurationMilliseconds?: number;
  dispatchReconciliationIntervalMilliseconds?: number;
  sessionDurationMilliseconds?: number;
  sessionCookieSecure?: boolean;
  openAi: Omit<OpenAiCustomOperationProviderOptions, "fetch" | "answerCache" | "now">;
  /** Request slots reserved for interactive previews, separate from queued jobs. Defaults to 10. */
  previewMaximumConcurrentRequests?: number;
  research?: ResearchOptions;
  leadLookup?: LeadLookupOptions;
};

/** How Lead Lookup operations reach LeadOcean; without an API key they get [Not Found]. */
export type LeadLookupOptions = {
  leadOceanApiKey?: string;
  /** Candidates fetched per searched row, each one LeadOcean record. Defaults to 3. */
  candidateLimit?: number;
  /** Closest candidates below this confidence (0–1) are not trusted. Defaults to 0.5. */
  minimumConfidence?: number;
  /** Candidates on the deeper search tried when nothing earlier was confident. Defaults to 10. */
  deepCandidateLimit?: number;
  maximumConcurrentRequests?: number;
};

/** How Research Custom Operations are answered; see research/research-chain.ts. */
export type ResearchOptions = {
  /** Without it the chain has no paid search: rows the Dossier and pool cannot answer get [Not Found]. */
  serperApiKey?: string;
  serperDollarsPerThousandSearches?: number;
  readerModel?: string;
  readerReasoningEffort?: string;
  readerInputDollarsPerMillionTokens?: number;
  readerOutputDollarsPerMillionTokens?: number;
  spendLimitDollars?: number;
  poolDeadlineMinutes?: number;
  /** Encrypts keys added to the pool; without it no keys can be added. */
  keyEncryptionSecret?: string;
  /** The company's own billed key, used only within its free daily grounded-search allowance. */
  billedGeminiApiKey?: string;
  billedGeminiDailySearchLimit?: number;
  poolKeyDailySearchLimit?: number;
  poolKeyRequestsPerMinute?: number;
  geminiModel?: string;
  geminiBillingProbeModel?: string;
  dossierRetentionDays?: number;
};

export type ProductionRuntime = {
  reconcilePendingDispatches(): Promise<{ dispatchedJobIds: Array<string> }>;
  start(): Promise<string>;
  close(): Promise<void>;
};

export function createProductionRuntime(
  options: ProductionRuntimeOptions,
): ProductionRuntime {
  const pool = new Pool({ connectionString: options.databaseUrl });
  const jobStore = createPostgresJobStore({
    pool,
    leaseDurationMilliseconds: options.leaseDurationMilliseconds,
  });
  const outputArtifactStore = createFileOutputArtifactStore({
    directory: options.outputArtifactDirectory,
  });
  const operationLibrary = createPostgresOperationLibrary({ pool });
  const userAuthentication = createUserAuthentication({
    credentialStore: createPostgresUserCredentialStore({ pool }),
    sessionDurationMilliseconds: options.sessionDurationMilliseconds,
  });
  // Previews get their own request slots so a large queued job cannot delay them; both share
  // answers so rows answered in a preview are not searched again when the job runs.
  const answerCache = createCustomOperationAnswerCache();
  const generationProvider = createOpenAiCustomOperationProvider({
    ...options.openAi,
    answerCache,
  });
  const previewGenerationProvider = createOpenAiCustomOperationProvider({
    ...options.openAi,
    maximumConcurrentRequests: options.previewMaximumConcurrentRequests ?? 10,
    answerCache,
  });
  const research = createResearch(pool, options);
  // One lookup serves jobs and previews, so rows looked up in a preview are not paid for again.
  const leadLookup = options.leadLookup?.leadOceanApiKey === undefined
    ? undefined
    : createLeadLookup({
        directory: createLeadOceanDirectory({
          apiKey: options.leadLookup.leadOceanApiKey,
          maximumConcurrentRequests: options.leadLookup.maximumConcurrentRequests,
        }),
        candidateLimit: options.leadLookup.candidateLimit,
        minimumConfidence: options.leadLookup.minimumConfidence,
        deepCandidateLimit: options.leadLookup.deepCandidateLimit,
      });
  const customOperationProvider = createResearchOperationProvider({
    generation: generationProvider,
    research: research.jobChain,
    answerCache,
  });
  const previewOperationProvider = createResearchOperationProvider({
    generation: previewGenerationProvider,
    research: research.previewChain,
    answerCache,
  });

  const pendingJobs = new Set<string>();
  const jobDispatcher = {
    async dispatch(jobId: string) {
      pendingJobs.add(jobId);
      // Start now rather than on the next timer tick; the request that submitted it is not held up.
      setImmediate(() => workerLoop());
    }
  };

  const server = createHttpServer({
    ownerIdForRequest: ownerIdForRequestFromSession(userAuthentication),
    jobIntakeDependencies: {
      jobSnapshotStore: jobStore,
      jobDispatchIntentStore: jobStore,
      jobDispatcher,
    },
    jobHistoryDependencies: { jobHistoryStore: jobStore },
    requestEnrichedListDependencies: {
      jobHistoryStore: jobStore,
      outputArtifactStore,
    },
    saveEnrichmentPreviewDependencies: {
      savedPreviewStore: jobStore,
      outputArtifactStore,
    },
    operationLibrary,
    customOperationProvider: previewOperationProvider,
    leadLookup,
    leadLookupCandidateLimit: options.leadLookup?.candidateLimit,
    leadLookupDeepCandidateLimit: options.leadLookup?.deepCandidateLimit,
    leadLookupMinimumConfidence: options.leadLookup?.minimumConfidence,
    researchKeyRegistry: research.keyRegistry,
    userAuthentication,
    sessionCookieSecure: options.sessionCookieSecure,
  });

  const dispatchReconciliationIntervalMilliseconds =
    options.dispatchReconciliationIntervalMilliseconds ?? 30_000;
  let reconciliationTimer: NodeJS.Timeout | undefined;
  let dossierCleanupTimer: NodeJS.Timeout | undefined;
  let workerTimer: NodeJS.Timeout | undefined;
  const runningJobs = new Set<string>();
  // Several jobs run side by side, so a short lookup is not stuck behind a long research job.
  const workerConcurrency = options.workerConcurrency ?? 4;

  async function reconcilePendingDispatches(): Promise<{
    dispatchedJobIds: Array<string>;
  }> {
    return dispatchPendingEnrichmentJobs({
      jobDispatchIntentStore: jobStore,
      jobDispatcher,
    });
  }

  function workerLoop(): void {
    for (const jobId of Array.from(pendingJobs)) {
      if (runningJobs.size >= workerConcurrency) {
        return;
      }

      pendingJobs.delete(jobId);

      if (runningJobs.has(jobId)) {
        continue;
      }

      runningJobs.add(jobId);
      void executeQueuedEnrichmentJob(
        { jobId },
        {
          jobExecutionStore: jobStore,
          outputArtifactStore,
          customOperationProvider,
          leadLookup,
        },
      )
        .catch((e) => console.error("Worker error for job", jobId, e))
        .finally(() => {
          runningJobs.delete(jobId);
          workerLoop();
        });
    }
  }

  return {
    reconcilePendingDispatches,
    async start() {
      await reconcilePendingDispatches();
      const address = await server.listen({
        port: options.port ?? 3000,
        host: options.host ?? "0.0.0.0",
      });

      reconciliationTimer = setInterval(() => {
        void reconcilePendingDispatches();
      }, dispatchReconciliationIntervalMilliseconds);

      workerTimer = setInterval(() => {
        void workerLoop();
      }, 2000);

      // Kick off initial worker run
      void workerLoop();

      dossierCleanupTimer = setInterval(() => {
        void research.deleteExpiredDossiers().catch(() => undefined);
      }, 6 * 60 * 60 * 1000);
      void research.deleteExpiredDossiers().catch(() => undefined);

      return address;
    },
    async close() {
      if (reconciliationTimer !== undefined) {
        clearInterval(reconciliationTimer);
      }
      if (workerTimer !== undefined) {
        clearInterval(workerTimer);
      }
      if (dossierCleanupTimer !== undefined) {
        clearInterval(dossierCleanupTimer);
      }

      await Promise.all([
        server.close(),
        pool.end(),
      ]);
    },
  };
}

/**
 * One Dossier and one key pool serve both jobs and previews, so free searches are counted once
 * and research done in a preview is reused by the job. A preview waits at most a few seconds
 * for a free search; a job waits up to the pool deadline.
 */
function createResearch(
  pool: InstanceType<typeof Pool>,
  options: ProductionRuntimeOptions,
) {
  const research = options.research ?? {};
  const cipher: ResearchKeyCipher = research.keyEncryptionSecret === undefined
    ? unconfiguredCipher
    : createResearchKeyCipher(research.keyEncryptionSecret);
  const keyStore = createPostgresResearchKeyStore({
    pool,
    cipher,
    dailySearchLimitPerKey: research.poolKeyDailySearchLimit,
    requestsPerMinutePerKey: research.poolKeyRequestsPerMinute,
  });
  const configuredKeys: Array<PoolKey> = research.billedGeminiApiKey === undefined
    ? []
    : [{
        id: "company-billed-key",
        apiKey: research.billedGeminiApiKey,
        // Google allows 1,500 free grounded prompts a day on a billed project, then $35 per 1,000.
        dailySearchLimit: research.billedGeminiDailySearchLimit ?? 1_400,
        requestsPerMinute: 60,
        billed: true,
      }];
  const keyPool = createGeminiKeyPool({ store: keyStore, configuredKeys });
  const dossierStore = createPostgresCompanyDossierStore({ pool });
  const shared: ResearchChainOptions = {
    dossier: createCompanyDossier({ store: dossierStore, retentionDays: research.dossierRetentionDays }),
    keyPool,
    geminiSearch: createGeminiGroundedSearch({ model: research.geminiModel }),
    ...(research.serperApiKey === undefined
      ? {}
      : { webSearch: createSerperWebSearch({ apiKey: research.serperApiKey }) }),
    webSearchDollarsPerSearch: (research.serperDollarsPerThousandSearches ?? 1) / 1000,
    reader: createOpenAiResearchReader({
      apiKey: options.openAi.apiKey,
      apiBaseUrl: options.openAi.apiBaseUrl,
      model: research.readerModel,
      reasoningEffort: research.readerReasoningEffort,
      inputDollarsPerMillionTokens: research.readerInputDollarsPerMillionTokens,
      outputDollarsPerMillionTokens: research.readerOutputDollarsPerMillionTokens,
    }),
    fetchPage: createPageFetcher(),
    spendLimitDollars: research.spendLimitDollars,
  };

  return {
    jobChain: createResearchChain({
      ...shared,
      poolDeadlineMilliseconds: (research.poolDeadlineMinutes ?? 60) * 60 * 1000,
    }),
    previewChain: createResearchChain({ ...shared, poolDeadlineMilliseconds: 15_000 }),
    keyRegistry: research.keyEncryptionSecret === undefined
      ? undefined
      : createResearchKeyRegistry({
          store: keyStore,
          checkKey: createGeminiKeyCheck({ billingProbeModel: research.geminiBillingProbeModel }),
          pool: keyPool,
        }),
    deleteExpiredDossiers: () => dossierStore.deleteExpired(new Date()),
  };
}

/** Without a secret no key can be stored or read, so the pool holds only configured keys. */
const unconfiguredCipher: ResearchKeyCipher = {
  encrypt() {
    throw new Error("RESEARCH_KEY_ENCRYPTION_SECRET is not configured");
  },
  decrypt() {
    throw new Error("RESEARCH_KEY_ENCRYPTION_SECRET is not configured");
  },
  fingerprint() {
    throw new Error("RESEARCH_KEY_ENCRYPTION_SECRET is not configured");
  },
};
