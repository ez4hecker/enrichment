import {
  LeadDirectoryUnavailableError,
  type LeadDirectory,
} from "../lead-lookup/lead-lookup.js";
import { companyRecord, personRecord } from "../lead-lookup/leadocean-records.js";
import { createConcurrencyGate } from "./openai-custom-operation-provider.js";

type LeadOceanFetch = (url: string, init: RequestInit) => Promise<Response>;
type JsonRecord = Record<string, unknown>;

export type LeadOceanDirectoryOptions = {
  apiKey: string;
  fetch?: LeadOceanFetch;
  apiBaseUrl?: string;
  timeoutMilliseconds?: number;
  maximumAttempts?: number;
  /** The free plan allows 5 requests a second; paid plans far more. */
  maximumConcurrentRequests?: number;
  now?: () => Date;
};

/**
 * LeadOcean (api.leadocean.io) as a Lead Directory. Every person or company returned costs one
 * record; a 404 costs nothing. Once LeadOcean says the account is paced or past its records, it
 * would answer one request a minute, so no further request is sent until the stated reset and
 * each lookup fails at once instead of stalling the job.
 */
export function createLeadOceanDirectory(options: LeadOceanDirectoryOptions): LeadDirectory {
  if (options.apiKey.length === 0) {
    throw new Error("LeadOcean API key is required");
  }

  const apiBaseUrl = options.apiBaseUrl ?? "https://api.leadocean.io";
  const timeoutMilliseconds = options.timeoutMilliseconds ?? 30_000;
  const maximumAttempts = options.maximumAttempts ?? 3;
  const request = options.fetch ?? ((url, init) => globalThis.fetch(url, init));
  const now = options.now ?? (() => new Date());
  const gate = createConcurrencyGate(options.maximumConcurrentRequests ?? 4);
  let unavailable: { message: string; until?: Date } | undefined;

  async function post(path: string, body: JsonRecord): Promise<JsonRecord | undefined> {
    return gate.run(async () => {
      for (let attempt = 1; ; attempt += 1) {
        if (unavailable !== undefined) {
          if (unavailable.until !== undefined && unavailable.until <= now()) {
            unavailable = undefined;
          } else {
            throw new LeadDirectoryUnavailableError(unavailable.message);
          }
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);
        let response: Response | undefined;

        try {
          response = await request(`${apiBaseUrl}${path}`, {
            method: "POST",
            headers: { "x-api-key": options.apiKey, "content-type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
        } catch {
          response = undefined;
        } finally {
          clearTimeout(timeout);
        }

        const quotaState = response?.headers.get("x-quota-state");

        if (quotaState === "paced" || quotaState === "over-limit") {
          const resetsAt = response?.headers.get("x-quota-reset");
          const until = resetsAt === null || resetsAt === undefined || resetsAt === "never" ? undefined : new Date(resetsAt);

          unavailable = {
            message: `LeadOcean records allowance reached${until === undefined || Number.isNaN(until.getTime()) ? "" : ` until ${until.toISOString()}`}`,
            ...(until === undefined || Number.isNaN(until.getTime()) ? {} : { until }),
          };
        }

        if (response?.ok === true) {
          return await response.json() as JsonRecord;
        }

        if (response?.status === 404) {
          return undefined;
        }

        if (response?.status === 401 || response?.status === 403) {
          unavailable = { message: "LeadOcean rejected the API key" };
          throw new LeadDirectoryUnavailableError(unavailable.message);
        }

        if (response?.status === 402) {
          unavailable = { message: "LeadOcean records are used up" };
          throw new LeadDirectoryUnavailableError(unavailable.message);
        }

        if (response?.status === 400) {
          throw new Error("LeadOcean refused the lookup (HTTP 400)");
        }

        if (unavailable !== undefined || attempt >= maximumAttempts) {
          throw new Error(`LeadOcean lookup failed${response === undefined ? "" : ` (HTTP ${response.status})`}`);
        }

        const retryAfterSeconds = Number(response?.headers.get("retry-after"));

        await new Promise((resolve) => setTimeout(
          resolve,
          Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 && retryAfterSeconds <= 10
            ? retryAfterSeconds * 1000
            : 500 * attempt,
        ));
      }
    });
  }

  return {
    async enrichPerson(key) {
      const payload = await post("/v1/people/enrich", {
        ...(key.linkedinUrl === undefined ? {} : { linkedin_url: key.linkedinUrl }),
        ...(key.email === undefined ? {} : { email: key.email }),
        ...(key.phone === undefined ? {} : { phone: key.phone }),
        ...(key.personId === undefined ? {} : { person_id: key.personId }),
        // Revealing costs nothing extra, and an enriched person is always one record.
        reveal_email: true,
      });

      return isRecord(payload?.data) ? personRecord(payload.data, true) : undefined;
    },
    async searchPeople(filters) {
      const payload = await post("/v1/people/search", {
        q: filters.name,
        ...(filters.domain === undefined ? {} : { domain: [filters.domain] }),
        ...(filters.companyName === undefined ? {} : { companyName: [filters.companyName] }),
        ...(filters.title === undefined ? {} : { title: [filters.title] }),
        limit: filters.limit,
      });

      return records(payload?.data).map((record) => personRecord(record, false));
    },
    async enrichCompany(key) {
      const payload = await post("/v1/companies/enrich", {
        ...(key.domain === undefined ? {} : { domain: key.domain }),
        ...(key.linkedinUrl === undefined ? {} : { linkedin_url: key.linkedinUrl }),
      });

      return isRecord(payload?.data) ? companyRecord(payload.data) : undefined;
    },
    async searchCompanies(filters) {
      const payload = await post("/v1/companies/search", {
        name: [filters.name],
        limit: filters.limit,
      });

      // Unslimmed, a searched company is the full record, so every company field reads from it.
      return records(payload?.data).map((record) => companyRecord(record));
    },
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function records(value: unknown): Array<JsonRecord> {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}
