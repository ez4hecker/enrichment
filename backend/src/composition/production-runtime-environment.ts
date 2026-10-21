import type { ProductionRuntimeOptions } from "./create-production-runtime.js";

export type DeploymentEnvironment = Record<string, string | undefined>;

/**
 * Translates deployment-owned environment values into the production runtime's
 * small configuration interface. Authentication remains an explicit argument:
 * its resolver must come from the host's verified identity integration.
 */
export function productionRuntimeOptionsFromEnvironment(
  environment: DeploymentEnvironment,
): ProductionRuntimeOptions {
  return {
    databaseUrl: required(environment, "DATABASE_URL"),
    redisUrl: required(environment, "REDIS_URL"),
    outputArtifactDirectory: required(environment, "OUTPUT_ARTIFACT_DIRECTORY"),
    ...(optional(environment, "HOST") === undefined
      ? {}
      : { host: optional(environment, "HOST") }),
    ...(optionalInteger(environment, "PORT", 1) === undefined
      ? {}
      : { port: optionalInteger(environment, "PORT", 1) }),
    ...(optionalInteger(environment, "WORKER_CONCURRENCY", 1) === undefined
      ? {}
      : { workerConcurrency: optionalInteger(environment, "WORKER_CONCURRENCY", 1) }),
    ...(optionalInteger(environment, "LEASE_DURATION_MILLISECONDS", 1) === undefined
      ? {}
      : {
        leaseDurationMilliseconds: optionalInteger(
          environment,
          "LEASE_DURATION_MILLISECONDS",
          1,
        ),
      }),
    ...(optionalInteger(
      environment,
      "DISPATCH_RECONCILIATION_INTERVAL_MILLISECONDS",
      1,
    ) === undefined
      ? {}
      : {
        dispatchReconciliationIntervalMilliseconds: optionalInteger(
          environment,
          "DISPATCH_RECONCILIATION_INTERVAL_MILLISECONDS",
          1,
        ),
      }),
    ...(optionalInteger(environment, "SESSION_DURATION_MILLISECONDS", 1) === undefined
      ? {}
      : {
        sessionDurationMilliseconds: optionalInteger(
          environment,
          "SESSION_DURATION_MILLISECONDS",
          1,
        ),
      }),
    ...(optionalBoolean(environment, "SESSION_COOKIE_SECURE") === undefined
      ? {}
      : { sessionCookieSecure: optionalBoolean(environment, "SESSION_COOKIE_SECURE") }),
    ...(optionalInteger(environment, "OPENAI_PREVIEW_MAXIMUM_CONCURRENT_REQUESTS", 1) === undefined
      ? {}
      : {
        previewMaximumConcurrentRequests: optionalInteger(
          environment,
          "OPENAI_PREVIEW_MAXIMUM_CONCURRENT_REQUESTS",
          1,
        ),
      }),
    openAi: {
      apiKey: required(environment, "OPENAI_API_KEY"),
      model: required(environment, "OPENAI_MODEL"),
      // Measured on web-search research: low effort matched medium's answers with fewer
      // reasoning tokens and a shorter slowest response. "default" keeps the model's own.
      ...(optional(environment, "OPENAI_REASONING_EFFORT") === "default"
        ? {}
        : { reasoningEffort: optional(environment, "OPENAI_REASONING_EFFORT") ?? "low" }),
      ...(optional(environment, "OPENAI_API_BASE_URL") === undefined
        ? {}
        : { apiBaseUrl: optional(environment, "OPENAI_API_BASE_URL") }),
      ...(optionalInteger(environment, "OPENAI_TIMEOUT_MILLISECONDS", 1) === undefined
        ? {}
        : {
          timeoutMilliseconds: optionalInteger(
            environment,
            "OPENAI_TIMEOUT_MILLISECONDS",
            1,
          ),
        }),
      ...(optionalInteger(environment, "OPENAI_MAXIMUM_ATTEMPTS", 1) === undefined
        ? {}
        : {
          maximumAttempts: optionalInteger(
            environment,
            "OPENAI_MAXIMUM_ATTEMPTS",
            1,
          ),
        }),
      ...(optionalInteger(environment, "OPENAI_RETRY_DELAY_MILLISECONDS", 0) === undefined
        ? {}
        : {
          retryDelayMilliseconds: optionalInteger(
            environment,
            "OPENAI_RETRY_DELAY_MILLISECONDS",
            0,
          ),
        }),
      ...(optionalInteger(
        environment,
        "OPENAI_MAXIMUM_CONCURRENT_REQUESTS",
        1,
      ) === undefined
        ? {}
        : {
          maximumConcurrentRequests: optionalInteger(
            environment,
            "OPENAI_MAXIMUM_CONCURRENT_REQUESTS",
            1,
          ),
        }),
    },
    research: definedFields({
      serperApiKey: optional(environment, "SERPER_API_KEY"),
      serperDollarsPerThousandSearches: optionalNumber(environment, "SERPER_DOLLARS_PER_THOUSAND_SEARCHES"),
      readerModel: optional(environment, "RESEARCH_READER_MODEL"),
      readerReasoningEffort: optional(environment, "RESEARCH_READER_REASONING_EFFORT"),
      readerInputDollarsPerMillionTokens: optionalNumber(environment, "RESEARCH_READER_INPUT_DOLLARS_PER_MILLION_TOKENS"),
      readerOutputDollarsPerMillionTokens: optionalNumber(environment, "RESEARCH_READER_OUTPUT_DOLLARS_PER_MILLION_TOKENS"),
      spendLimitDollars: optionalNumber(environment, "RESEARCH_SPEND_LIMIT_DOLLARS"),
      poolDeadlineMinutes: optionalInteger(environment, "RESEARCH_POOL_DEADLINE_MINUTES", 0),
      keyEncryptionSecret: optional(environment, "RESEARCH_KEY_ENCRYPTION_SECRET"),
      billedGeminiApiKey: optional(environment, "GEMINI_BILLED_API_KEY"),
      billedGeminiDailySearchLimit: optionalInteger(environment, "GEMINI_BILLED_DAILY_SEARCH_LIMIT", 0),
      poolKeyDailySearchLimit: optionalInteger(environment, "GEMINI_POOL_KEY_DAILY_SEARCH_LIMIT", 0),
      poolKeyRequestsPerMinute: optionalInteger(environment, "GEMINI_POOL_KEY_REQUESTS_PER_MINUTE", 1),
      geminiModel: optional(environment, "GEMINI_RESEARCH_MODEL"),
      geminiBillingProbeModel: optional(environment, "GEMINI_BILLING_PROBE_MODEL"),
      dossierRetentionDays: optionalInteger(environment, "COMPANY_DOSSIER_RETENTION_DAYS", 1),
    }),
    leadLookup: definedFields({
      leadOceanApiKey: optional(environment, "LEADOCEAN_API_KEY"),
      candidateLimit: optionalInteger(environment, "LEADOCEAN_SEARCH_CANDIDATES", 1),
      minimumConfidence: optionalNumber(environment, "LEADOCEAN_MINIMUM_MATCH_CONFIDENCE"),
      deepCandidateLimit: optionalInteger(environment, "LEADOCEAN_DEEP_SEARCH_CANDIDATES", 1),
      maximumConcurrentRequests: optionalInteger(environment, "LEADOCEAN_MAXIMUM_CONCURRENT_REQUESTS", 1),
    }),
  };
}

function definedFields<T extends Record<string, unknown>>(fields: T): {
  [Name in keyof T]?: Exclude<T[Name], undefined>;
} {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as { [Name in keyof T]?: Exclude<T[Name], undefined> };
}

function optionalNumber(
  environment: DeploymentEnvironment,
  name: string,
): number | undefined {
  const value = optional(environment, name);

  if (value === undefined) {
    return undefined;
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${name} must be a number greater than or equal to 0`);
  }

  return number;
}

function required(environment: DeploymentEnvironment, name: string): string {
  const value = optional(environment, name);

  if (value === undefined) {
    throw new Error(`${name} must be configured`);
  }

  return value;
}

function optional(
  environment: DeploymentEnvironment,
  name: string,
): string | undefined {
  const value = environment[name]?.trim();

  return value === undefined || value === "" ? undefined : value;
}

function optionalInteger(
  environment: DeploymentEnvironment,
  name: string,
  minimum: number,
): number | undefined {
  const value = optional(environment, name);

  if (value === undefined) {
    return undefined;
  }

  const number = Number(value);

  if (!Number.isInteger(number) || number < minimum) {
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}`);
  }

  return number;
}

function optionalBoolean(
  environment: DeploymentEnvironment,
  name: string,
): boolean | undefined {
  const value = optional(environment, name);

  if (value === undefined) {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`${name} must be true or false`);
}
