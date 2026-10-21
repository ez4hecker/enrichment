/** A Gemini API key the pool may use for free grounded searches. */
export type PoolKey = {
  id: string;
  apiKey: string;
  /** Searches allowed per Pacific day, kept under Google's free allowance as a safety margin. */
  dailySearchLimit: number;
  requestsPerMinute: number;
  /** True for a key whose project has billing on: its searches are free but its tokens are charged. */
  billed?: boolean;
};

export type GeminiKeyPoolStore = {
  /** Active contributed keys, decrypted. */
  listActiveKeys(): Promise<Array<PoolKey>>;
  /** Searches already counted per key on one Pacific date (YYYY-MM-DD). */
  readUsage(date: string): Promise<Map<string, number>>;
  recordSearch(keyId: string, date: string): Promise<void>;
  /** Google refused more searches today; count the key as used up for the date. */
  markExhausted(keyId: string, date: string, searches: number): Promise<void>;
  disableKey(keyId: string, reason: string): Promise<void>;
};

export type GeminiSearchOutcome = "answered" | "rate-limited" | "key-rejected" | "failed";

export type GeminiKeyLease = {
  apiKey: string;
  billed: boolean;
  report(outcome: GeminiSearchOutcome, reason?: string): Promise<void>;
};

export type GeminiKeyPool = {
  /**
   * Reserves the earliest free search slot on any key that still has allowance today, and
   * waits for it. Returns nothing when no slot opens before the deadline, so the caller can
   * move on to a paid source instead of waiting.
   */
  acquire(deadline: Date): Promise<GeminiKeyLease | undefined>;
  /** Re-reads the keys, for example after one is added or removed. */
  refresh(): Promise<void>;
  status(): Promise<{ activeKeys: number; searchesLeftToday: number }>;
};

export type GeminiKeyPoolOptions = {
  store: GeminiKeyPoolStore;
  /** Keys from configuration rather than the store, such as the company's billed key. */
  configuredKeys?: ReadonlyArray<PoolKey>;
  now?: () => Date;
  wait?: (milliseconds: number) => Promise<void>;
  refreshIntervalMilliseconds?: number;
};

type KeyState = PoolKey & {
  searchesToday: number;
  nextSlotAt: number;
  unusable: boolean;
};

/**
 * Counts every key's searches itself, because Google does not report remaining free quota:
 * a search is counted when its slot is reserved, before the request, so a crash or a failed
 * request can only over-count. Counts are per Pacific day, matching Google's reset at midnight
 * Pacific, and are stored so a restart does not forget them.
 */
export function createGeminiKeyPool(options: GeminiKeyPoolOptions): GeminiKeyPool {
  const now = options.now ?? (() => new Date());
  const wait = options.wait ?? ((milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const refreshIntervalMilliseconds = options.refreshIntervalMilliseconds ?? 5 * 60 * 1000;
  let keys: Array<KeyState> = [];
  let loadedDate: string | undefined;
  let loadedAt = 0;
  let loading: Promise<void> | undefined;

  async function load(): Promise<void> {
    const date = pacificDate(now());
    const [storedKeys, usage] = await Promise.all([
      options.store.listActiveKeys(),
      options.store.readUsage(date),
    ]);
    const previous = new Map(keys.map((key) => [key.id, key]));

    keys = [...(options.configuredKeys ?? []), ...storedKeys].map((key) => {
      const known = previous.get(key.id);
      const sameDay = loadedDate === date;

      return {
        ...key,
        // Searches reserved in memory but not yet stored must not be forgotten on reload.
        searchesToday: Math.max(usage.get(key.id) ?? 0, sameDay ? known?.searchesToday ?? 0 : 0),
        nextSlotAt: known?.nextSlotAt ?? 0,
        unusable: sameDay ? known?.unusable ?? false : false,
      };
    });
    loadedDate = date;
    loadedAt = now().getTime();
  }

  function ensureLoaded(): Promise<void> {
    const stale = loadedDate !== pacificDate(now()) ||
      now().getTime() - loadedAt >= refreshIntervalMilliseconds;

    if (!stale) {
      return Promise.resolve();
    }

    loading ??= load().finally(() => {
      loading = undefined;
    });

    return loading;
  }

  return {
    async acquire(deadline) {
      try {
        await ensureLoaded();
      } catch {
        return undefined;
      }

      const date = loadedDate ?? pacificDate(now());
      const currentTime = now().getTime();
      let chosen: KeyState | undefined;
      let chosenSlot = Number.POSITIVE_INFINITY;

      for (const key of keys) {
        if (key.unusable || key.searchesToday >= key.dailySearchLimit) {
          continue;
        }

        const slot = Math.max(currentTime, key.nextSlotAt);

        if (slot < chosenSlot) {
          chosen = key;
          chosenSlot = slot;
        }
      }

      if (chosen === undefined || chosenSlot > deadline.getTime()) {
        return undefined;
      }

      const key = chosen;

      key.searchesToday += 1;
      key.nextSlotAt = chosenSlot + Math.ceil(60_000 / key.requestsPerMinute);

      try {
        await options.store.recordSearch(key.id, date);
      } catch {
        // Without a stored count a restart could exceed the free allowance; use another source.
        return undefined;
      }

      if (chosenSlot > currentTime) {
        await wait(chosenSlot - currentTime);
      }

      if (key.unusable) {
        return undefined;
      }

      return {
        apiKey: key.apiKey,
        billed: key.billed === true,
        async report(outcome, reason) {
          if (outcome === "rate-limited") {
            key.searchesToday = key.dailySearchLimit;
            await options.store.markExhausted(key.id, date, key.dailySearchLimit).catch(() => undefined);
          } else if (outcome === "key-rejected") {
            key.unusable = true;
            await options.store.disableKey(key.id, reason ?? "Rejected by Google").catch(() => undefined);
          }
        },
      };
    },
    async refresh() {
      loadedAt = 0;
      await ensureLoaded();
    },
    async status() {
      await ensureLoaded();
      const usable = keys.filter((key) => !key.unusable);

      return {
        activeKeys: usable.length,
        searchesLeftToday: usable.reduce(
          (total, key) => total + Math.max(0, key.dailySearchLimit - key.searchesToday),
          0,
        ),
      };
    },
  };
}

/** Google resets the free daily allowance at midnight Pacific time. */
export function pacificDate(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}
