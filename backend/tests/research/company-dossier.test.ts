import { describe, expect, it } from "vitest";

import {
  createCompanyDossier,
  type CompanyDossierStore,
  type DossierMaterial,
} from "../../src/research/company-dossier.js";

function countingStore(records: Map<string, Array<DossierMaterial>>) {
  const queries: Array<ReadonlyArray<string>> = [];
  const store: CompanyDossierStore = {
    async readMany(domains) {
      queries.push([...domains]);
      return new Map(domains.flatMap((domain) => records.has(domain) ? [[domain, records.get(domain)!]] : []));
    },
    async write(domain, material) {
      records.set(domain, [...material]);
    },
    async deleteExpired() {
      return 0;
    },
  };

  return { store, queries };
}

describe("Company Dossier", () => {
  it("reads a whole list's companies in batched queries and serves repeats from memory", async () => {
    const records = new Map<string, Array<DossierMaterial>>([
      ["acme.com", [{ kind: "search-result", text: "Acme fact", gatheredAt: new Date().toISOString() }]],
    ]);
    const { store, queries } = countingStore(records);
    const dossier = createCompanyDossier({ store, maximumBatchSize: 2 });
    const domains = ["acme.com", "globex.com", "initech.com", "acme.com", "globex.com"];

    const results = await Promise.all(domains.map((domain) => dossier.read(domain)));

    expect(results.map((material) => material.length)).toEqual([1, 0, 0, 1, 0]);
    expect(queries).toEqual([["acme.com", "globex.com"], ["initech.com"]]);

    await dossier.read("acme.com");
    expect(queries).toHaveLength(2);
  });

  it("keeps the newest pieces, without repeats, within its size limits", async () => {
    const records = new Map<string, Array<DossierMaterial>>();
    const { store } = countingStore(records);
    const dossier = createCompanyDossier({ store, maximumEntries: 2 });

    await dossier.add("acme.com", [{ kind: "search-result", text: "first", url: "https://a" }]);
    await dossier.add("acme.com", [{ kind: "search-result", text: "first", url: "https://a" }]);
    await dossier.add("acme.com", [{ kind: "search-result", text: "second" }, { kind: "search-result", text: "third" }]);

    expect(records.get("acme.com")?.map((piece) => piece.text)).toEqual(["second", "third"]);
    await expect(dossier.read("acme.com")).resolves.toHaveLength(2);
  });

  it("forgets research older than the retention period", async () => {
    const old = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString();
    const records = new Map<string, Array<DossierMaterial>>([
      ["acme.com", [{ kind: "search-result", text: "stale", gatheredAt: old }]],
    ]);
    const dossier = createCompanyDossier({ store: countingStore(records).store, retentionDays: 90 });

    await expect(dossier.read("acme.com")).resolves.toEqual([]);
  });
});
