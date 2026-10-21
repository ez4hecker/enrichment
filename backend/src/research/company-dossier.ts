/** One piece of research already performed about a company, kept to answer later questions. */
export type DossierMaterial = {
  kind: "gemini-answer" | "search-result" | "page-extract";
  text: string;
  url?: string;
  title?: string;
  /** The question being researched when this was found; it helps the reader judge relevance. */
  question?: string;
  gatheredAt: string;
};

/**
 * Durable storage of Company Dossiers, one record per domain. Reads are batched by the
 * Company Dossier, so a store answers many domains in one round trip.
 */
export type CompanyDossierStore = {
  readMany(domains: ReadonlyArray<string>): Promise<Map<string, Array<DossierMaterial>>>;
  write(domain: string, material: ReadonlyArray<DossierMaterial>, expiresAt: Date): Promise<void>;
  deleteExpired(now: Date): Promise<number>;
};

export type CompanyDossier = {
  read(domain: string): Promise<Array<DossierMaterial>>;
  add(domain: string, material: ReadonlyArray<Omit<DossierMaterial, "gatheredAt">>): Promise<void>;
};

export type CompanyDossierOptions = {
  store: CompanyDossierStore;
  now?: () => Date;
  retentionDays?: number;
  /** Newest pieces kept per company; older ones make way so the reader's input stays small. */
  maximumEntries?: number;
  maximumCharacters?: number;
  /** Companies held in memory; a list repeats companies, so most reads never reach the store. */
  maximumCachedCompanies?: number;
  /** Domains per store query. */
  maximumBatchSize?: number;
};

/**
 * Company Dossiers keyed by domain. Lookups from rows researched at the same moment (a job
 * starts thousands of rows together) are collected for one tick and read with a single query
 * per batch, then held in a bounded in-memory map, so a 6,000-row list costs a handful of
 * database round trips rather than 6,000.
 */
export function createCompanyDossier(options: CompanyDossierOptions): CompanyDossier {
  const now = options.now ?? (() => new Date());
  const retentionMilliseconds = (options.retentionDays ?? 90) * 24 * 60 * 60 * 1000;
  const maximumEntries = options.maximumEntries ?? 24;
  const maximumCharacters = options.maximumCharacters ?? 8_000;
  const maximumCachedCompanies = options.maximumCachedCompanies ?? 20_000;
  const maximumBatchSize = options.maximumBatchSize ?? 1_000;
  const cached = new Map<string, Promise<Array<DossierMaterial>>>();
  let pending = new Map<string, {
    resolve(material: Array<DossierMaterial>): void;
    reject(error: unknown): void;
  }>();
  let flushScheduled = false;

  function remember(domain: string, material: Promise<Array<DossierMaterial>>): void {
    cached.delete(domain);
    cached.set(domain, material);

    while (cached.size > maximumCachedCompanies) {
      const oldest = cached.keys().next().value;

      if (oldest === undefined) {
        break;
      }

      cached.delete(oldest);
    }
  }

  async function flush(): Promise<void> {
    flushScheduled = false;
    const batch = pending;
    pending = new Map();
    const domains = [...batch.keys()];

    for (let start = 0; start < domains.length; start += maximumBatchSize) {
      const chunk = domains.slice(start, start + maximumBatchSize);

      try {
        const found = await options.store.readMany(chunk);

        for (const domain of chunk) {
          batch.get(domain)?.resolve(found.get(domain) ?? []);
        }
      } catch (error) {
        for (const domain of chunk) {
          batch.get(domain)?.reject(error);
        }
      }
    }
  }

  function current(material: ReadonlyArray<DossierMaterial>): Array<DossierMaterial> {
    const oldestKept = now().getTime() - retentionMilliseconds;

    return material.filter((piece) => Date.parse(piece.gatheredAt) >= oldestKept);
  }

  return {
    read(domain) {
      const known = cached.get(domain);

      if (known !== undefined) {
        remember(domain, known);
        return known.then(current);
      }

      const material = new Promise<Array<DossierMaterial>>((resolve, reject) => {
        pending.set(domain, { resolve, reject });
      });

      // A failed read is not remembered, so the next row asks the store again.
      material.catch(() => {
        if (cached.get(domain) === material) {
          cached.delete(domain);
        }
      });
      remember(domain, material);

      if (!flushScheduled) {
        flushScheduled = true;
        setImmediate(() => void flush());
      }

      return material.then(current);
    },
    async add(domain, additions) {
      if (additions.length === 0) {
        return;
      }

      let existing: Array<DossierMaterial>;

      try {
        existing = await this.read(domain);
      } catch {
        existing = [];
      }

      const gatheredAt = now().toISOString();
      const merged = keepNewest(
        [...additions.map((piece) => ({ ...piece, gatheredAt })), ...existing],
        maximumEntries,
        maximumCharacters,
      );

      remember(domain, Promise.resolve(merged));
      await options.store.write(
        domain,
        merged,
        new Date(now().getTime() + retentionMilliseconds),
      );
    },
  };
}

/** Newest first, without repeats, within the entry and character limits. */
function keepNewest(
  material: ReadonlyArray<DossierMaterial>,
  maximumEntries: number,
  maximumCharacters: number,
): Array<DossierMaterial> {
  const seen = new Set<string>();
  const kept: Array<DossierMaterial> = [];
  let characters = 0;

  for (const piece of material) {
    const identity = `${piece.url ?? ""}\n${piece.text}`;

    if (seen.has(identity)) {
      continue;
    }

    if (kept.length >= maximumEntries || characters + piece.text.length > maximumCharacters) {
      break;
    }

    seen.add(identity);
    kept.push(piece);
    characters += piece.text.length;
  }

  return kept;
}
