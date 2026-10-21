import { describe, expect, it } from "vitest";

import {
  createGeminiKeyPool,
  pacificDate,
  type GeminiKeyPoolStore,
  type PoolKey,
} from "../../src/research/gemini-key-pool.js";

function memoryStore(keys: Array<PoolKey>, usage: Record<string, number> = {}) {
  const counts = new Map(Object.entries(usage));
  const disabled: Array<string> = [];
  const store: GeminiKeyPoolStore = {
    async listActiveKeys() {
      return keys.filter((key) => !disabled.includes(key.id));
    },
    async readUsage() {
      return new Map(counts);
    },
    async recordSearch(keyId) {
      counts.set(keyId, (counts.get(keyId) ?? 0) + 1);
    },
    async markExhausted(keyId, _date, searches) {
      counts.set(keyId, searches);
    },
    async disableKey(keyId) {
      disabled.push(keyId);
    },
  };

  return { store, counts, disabled };
}

function clock(start: number) {
  let current = start;

  return {
    now: () => new Date(current),
    wait: async (milliseconds: number) => {
      current += milliseconds;
    },
    advance(milliseconds: number) {
      current += milliseconds;
    },
  };
}

const key = (id: string, dailySearchLimit = 2, requestsPerMinute = 60): PoolKey => ({
  id,
  apiKey: `AIza-${id}`,
  dailySearchLimit,
  requestsPerMinute,
});

describe("Gemini key pool", () => {
  it("spreads searches across keys, pacing each key to its requests per minute", async () => {
    const time = clock(Date.UTC(2026, 9, 7, 12));
    const { store, counts } = memoryStore([key("a", 5, 60), key("b", 5, 60)]);
    const pool = createGeminiKeyPool({ store, now: time.now, wait: time.wait });
    const deadline = new Date(time.now().getTime() + 60_000);

    const leases = [];
    for (let index = 0; index < 4; index += 1) {
      leases.push(await pool.acquire(deadline));
    }

    expect(leases.map((lease) => lease?.apiKey)).toEqual(["AIza-a", "AIza-b", "AIza-a", "AIza-b"]);
    expect(Object.fromEntries(counts)).toEqual({ a: 2, b: 2 });
  });

  it("stops at each key's daily limit, counting searches already stored today", async () => {
    const time = clock(Date.UTC(2026, 9, 7, 12));
    const { store } = memoryStore([key("a", 3)], { a: 2 });
    const pool = createGeminiKeyPool({ store, now: time.now, wait: time.wait });
    const deadline = new Date(time.now().getTime() + 3_600_000);

    expect(await pool.acquire(deadline)).toBeDefined();
    expect(await pool.acquire(deadline)).toBeUndefined();
    await expect(pool.status()).resolves.toEqual({ activeKeys: 1, searchesLeftToday: 0 });
  });

  it("gives up rather than wait past the deadline", async () => {
    const time = clock(Date.UTC(2026, 9, 7, 12));
    const { store } = memoryStore([key("a", 100, 1)]);
    const pool = createGeminiKeyPool({ store, now: time.now, wait: time.wait });
    const deadline = new Date(time.now().getTime() + 30_000);

    expect(await pool.acquire(deadline)).toBeDefined();
    // The next slot on a 1-per-minute key is 60 s away, after the 30 s deadline.
    expect(await pool.acquire(deadline)).toBeUndefined();
  });

  it("treats a daily rate limit as used up and takes a rejected key out of the pool", async () => {
    const time = clock(Date.UTC(2026, 9, 7, 12));
    const { store, counts, disabled } = memoryStore([key("a", 10), key("b", 10)]);
    const pool = createGeminiKeyPool({ store, now: time.now, wait: time.wait });
    const deadline = new Date(time.now().getTime() + 3_600_000);

    await (await pool.acquire(deadline))?.report("rate-limited");
    await (await pool.acquire(deadline))?.report("key-rejected", "revoked");

    expect(counts.get("a")).toBe(10);
    expect(disabled).toEqual(["b"]);
    expect(await pool.acquire(deadline)).toBeUndefined();
  });

  it("starts a fresh allowance at midnight Pacific", async () => {
    // 06:59 UTC on Oct 8 is still Oct 7 in Los Angeles; 07:00 UTC is Oct 8.
    expect(pacificDate(new Date(Date.UTC(2026, 9, 8, 6, 59)))).toBe("2026-10-07");
    expect(pacificDate(new Date(Date.UTC(2026, 9, 8, 7, 0)))).toBe("2026-10-08");
  });

  it("uses configured keys, such as the company's billed key, alongside stored ones", async () => {
    const time = clock(Date.UTC(2026, 9, 7, 12));
    const { store } = memoryStore([]);
    const pool = createGeminiKeyPool({
      store,
      configuredKeys: [{ ...key("billed", 1400), billed: true }],
      now: time.now,
      wait: time.wait,
    });

    const lease = await pool.acquire(new Date(time.now().getTime() + 1000));

    expect(lease).toMatchObject({ apiKey: "AIza-billed", billed: true });
  });
});
