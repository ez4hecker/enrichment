import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

import type { GeminiKeyPoolStore, PoolKey } from "../research/gemini-key-pool.js";
import type { ContributedKey, ResearchKeyStore } from "../research/research-key-registry.js";
import type { ResearchKeyCipher } from "./research-key-cipher.js";

type ResearchPoolKeyRow = {
  id: string;
  label: string;
  last_four: string;
  status: "Active" | "Disabled";
  disabled_reason: string | null;
  created_at: Date;
  searches: number | null;
};

export type PostgresResearchKeyStoreOptions = {
  pool: Pick<Pool, "query">;
  cipher: ResearchKeyCipher;
  /** Searches per free-tier key per day, under Google's 500 so a miscount cannot hit the limit. */
  dailySearchLimitPerKey?: number;
  requestsPerMinutePerKey?: number;
};

export function createPostgresResearchKeyStore(
  options: PostgresResearchKeyStoreOptions,
): ResearchKeyStore & GeminiKeyPoolStore {
  const dailySearchLimit = options.dailySearchLimitPerKey ?? 450;
  const requestsPerMinute = options.requestsPerMinutePerKey ?? 10;

  return {
    async add(input) {
      const id = randomUUID();
      const result = await options.pool.query<ResearchPoolKeyRow>(
        `INSERT INTO research_pool_keys (
           id, contributor_id, label, encrypted_key, key_fingerprint, last_four
         ) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (key_fingerprint) DO NOTHING
         RETURNING id, label, last_four, status, disabled_reason, created_at, 0 AS searches`,
        [
          id,
          input.contributorId,
          input.label,
          options.cipher.encrypt(input.apiKey),
          options.cipher.fingerprint(input.apiKey),
          input.apiKey.slice(-4),
        ],
      );
      const row = result.rows[0];

      return row === undefined ? { status: "Duplicate" } : { status: "Added", key: toContributedKey(row, dailySearchLimit) };
    },
    async listForContributor(contributorId, date) {
      const result = await options.pool.query<ResearchPoolKeyRow>(
        `SELECT k.id, k.label, k.last_four, k.status, k.disabled_reason, k.created_at, u.searches
         FROM research_pool_keys k
         LEFT JOIN research_key_daily_usage u
           ON u.key_id = k.id::text AND u.usage_date = $2::date
         WHERE k.contributor_id = $1
         ORDER BY k.created_at`,
        [contributorId, date],
      );

      return result.rows.map((row) => toContributedKey(row, dailySearchLimit));
    },
    async remove(input) {
      const result = await options.pool.query(
        "DELETE FROM research_pool_keys WHERE id::text = $1 AND contributor_id = $2",
        [input.id, input.contributorId],
      );

      return (result.rowCount ?? 0) > 0;
    },
    async listActiveKeys() {
      const result = await options.pool.query<{ id: string; encrypted_key: string }>(
        "SELECT id, encrypted_key FROM research_pool_keys WHERE status = 'Active' ORDER BY created_at",
      );

      return result.rows.flatMap((row): Array<PoolKey> => {
        try {
          return [{
            id: row.id,
            apiKey: options.cipher.decrypt(row.encrypted_key),
            dailySearchLimit,
            requestsPerMinute,
          }];
        } catch {
          // Encrypted under a different secret: unusable until it is added again.
          return [];
        }
      });
    },
    async readUsage(date) {
      const result = await options.pool.query<{ key_id: string; searches: number }>(
        "SELECT key_id, searches FROM research_key_daily_usage WHERE usage_date = $1::date",
        [date],
      );

      return new Map(result.rows.map((row) => [row.key_id, row.searches]));
    },
    async recordSearch(keyId, date) {
      await options.pool.query(
        `INSERT INTO research_key_daily_usage (key_id, usage_date, searches)
         VALUES ($1, $2::date, 1)
         ON CONFLICT (key_id, usage_date) DO UPDATE
         SET searches = research_key_daily_usage.searches + 1`,
        [keyId, date],
      );
    },
    async markExhausted(keyId, date, searches) {
      await options.pool.query(
        `INSERT INTO research_key_daily_usage (key_id, usage_date, searches)
         VALUES ($1, $2::date, $3)
         ON CONFLICT (key_id, usage_date) DO UPDATE
         SET searches = GREATEST(research_key_daily_usage.searches, EXCLUDED.searches)`,
        [keyId, date, searches],
      );
    },
    async disableKey(keyId, reason) {
      await options.pool.query(
        "UPDATE research_pool_keys SET status = 'Disabled', disabled_reason = $2 WHERE id::text = $1",
        [keyId, reason],
      );
    },
  };
}

function toContributedKey(row: ResearchPoolKeyRow, dailySearchLimit: number): ContributedKey {
  return {
    id: row.id,
    label: row.label,
    lastFour: row.last_four,
    status: row.status,
    ...(row.disabled_reason === null ? {} : { disabledReason: row.disabled_reason }),
    addedAt: new Date(row.created_at).toISOString(),
    searchesToday: row.searches ?? 0,
    dailySearchLimit,
  };
}
