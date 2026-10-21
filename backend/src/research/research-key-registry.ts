import type { GeminiKeyPool } from "./gemini-key-pool.js";
import { pacificDate } from "./gemini-key-pool.js";

/** A Gemini key a user added to the research pool, as its contributor sees it. Never the key itself. */
export type ContributedKey = {
  id: string;
  label: string;
  lastFour: string;
  status: "Active" | "Disabled";
  disabledReason?: string;
  addedAt: string;
  searchesToday: number;
  dailySearchLimit: number;
};

export type ResearchKeyStore = {
  add(input: { contributorId: string; apiKey: string; label: string }): Promise<
    { status: "Added"; key: ContributedKey } | { status: "Duplicate" }
  >;
  listForContributor(contributorId: string, date: string): Promise<Array<ContributedKey>>;
  /** Only the contributor may take a key out; returns false when it is not theirs. */
  remove(input: { id: string; contributorId: string }): Promise<boolean>;
};

export type GeminiKeyCheckResult =
  | { status: "Accepted" }
  | { status: "Rejected"; code: "KEY_INVALID" | "KEY_BILLED" | "CHECK_FAILED"; message: string };

/** Asks Google whether a key works and whether its project has billing turned off. */
export type GeminiKeyCheck = (apiKey: string) => Promise<GeminiKeyCheckResult>;

export type ResearchKeyRegistry = {
  addKey(input: { contributorId: string; apiKey: string; label?: string }): Promise<
    | { status: "Added"; key: ContributedKey }
    | { status: "Rejected"; code: "KEY_FORMAT" | "KEY_DUPLICATE" | "KEY_INVALID" | "KEY_BILLED" | "CHECK_FAILED"; message: string }
  >;
  listKeys(contributorId: string): Promise<{
    keys: Array<ContributedKey>;
    pool: { activeKeys: number; searchesLeftToday: number };
  }>;
  removeKey(input: { id: string; contributorId: string }): Promise<boolean>;
};

export type ResearchKeyRegistryOptions = {
  store: ResearchKeyStore;
  checkKey: GeminiKeyCheck;
  pool: GeminiKeyPool;
  now?: () => Date;
};

/**
 * The research pool's intake. Only keys from projects with billing off are taken: a billed
 * key's searches past Google's free allowance cost $35 per 1,000, which the pool's counting
 * protects against for the company's own key but cannot guarantee for someone else's.
 */
export function createResearchKeyRegistry(options: ResearchKeyRegistryOptions): ResearchKeyRegistry {
  const now = options.now ?? (() => new Date());

  return {
    async addKey(input) {
      const apiKey = input.apiKey.trim();

      if (!/^AIza[0-9A-Za-z_-]{35}$/.test(apiKey)) {
        return {
          status: "Rejected",
          code: "KEY_FORMAT",
          message: "That doesn't look like a Gemini API key. Keys start with AIza and are 39 characters long.",
        };
      }

      const check = await options.checkKey(apiKey);

      if (check.status === "Rejected") {
        return check;
      }

      const result = await options.store.add({
        contributorId: input.contributorId,
        apiKey,
        label: (input.label ?? "").trim().slice(0, 60) || `Key ending ${apiKey.slice(-4)}`,
      });

      if (result.status === "Duplicate") {
        return { status: "Rejected", code: "KEY_DUPLICATE", message: "This key is already in the pool." };
      }

      await options.pool.refresh().catch(() => undefined);

      return result;
    },
    async listKeys(contributorId) {
      const [keys, pool] = await Promise.all([
        options.store.listForContributor(contributorId, pacificDate(now())),
        options.pool.status().catch(() => ({ activeKeys: 0, searchesLeftToday: 0 })),
      ]);

      return { keys, pool };
    },
    async removeKey(input) {
      const removed = await options.store.remove(input);

      if (removed) {
        await options.pool.refresh().catch(() => undefined);
      }

      return removed;
    },
  };
}
