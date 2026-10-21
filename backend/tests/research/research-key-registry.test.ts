import { afterEach, describe, expect, it } from "vitest";

import { createInMemoryJobStore } from "../../src/composition/in-memory-job-store.js";
import { createInMemoryOutputArtifactStore } from "../../src/composition/in-memory-output-artifact-store.js";
import { createHttpServer } from "../../src/delivery/http-server.js";
import { createOperationLibrary } from "../../src/operation-library/operation-library.js";
import type { GeminiKeyPool } from "../../src/research/gemini-key-pool.js";
import {
  createResearchKeyRegistry,
  type ContributedKey,
  type GeminiKeyCheck,
  type ResearchKeyStore,
} from "../../src/research/research-key-registry.js";

const validKey = `AIza${"x".repeat(35)}`;

function memoryKeyStore() {
  const keys: Array<ContributedKey & { contributorId: string; apiKey: string }> = [];
  const store: ResearchKeyStore = {
    async add(input) {
      if (keys.some((key) => key.apiKey === input.apiKey)) {
        return { status: "Duplicate" };
      }

      const key = {
        id: `key-${keys.length + 1}`,
        label: input.label,
        lastFour: input.apiKey.slice(-4),
        status: "Active" as const,
        addedAt: "2026-10-07T00:00:00.000Z",
        searchesToday: 0,
        dailySearchLimit: 450,
      };
      keys.push({ ...key, contributorId: input.contributorId, apiKey: input.apiKey });

      return { status: "Added", key };
    },
    async listForContributor(contributorId) {
      return keys
        .filter((key) => key.contributorId === contributorId)
        .map(({ contributorId: _contributor, apiKey: _key, ...key }) => key);
    },
    async remove(input) {
      const index = keys.findIndex((key) => key.id === input.id && key.contributorId === input.contributorId);

      if (index < 0) {
        return false;
      }

      keys.splice(index, 1);
      return true;
    },
  };

  return { store, keys };
}

function countingPool() {
  let refreshes = 0;
  const pool: GeminiKeyPool = {
    async acquire() {
      return undefined;
    },
    async refresh() {
      refreshes += 1;
    },
    async status() {
      return { activeKeys: 3, searchesLeftToday: 1200 };
    },
  };

  return { pool, refreshes: () => refreshes };
}

describe("Research key registry over HTTP", () => {
  const servers: Array<ReturnType<typeof createHttpServer>> = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
  });

  function serverWith(checkKey: GeminiKeyCheck) {
    const { store, keys } = memoryKeyStore();
    const { pool, refreshes } = countingPool();
    const jobStore = createInMemoryJobStore();
    const server = createHttpServer({
      ownerIdForRequest(request) {
        const ownerId = request.headers["x-owner-id"];
        return typeof ownerId === "string" ? ownerId : undefined;
      },
      jobIntakeDependencies: { jobSnapshotStore: jobStore },
      jobHistoryDependencies: { jobHistoryStore: jobStore },
      requestEnrichedListDependencies: { jobHistoryStore: jobStore, outputArtifactStore: createInMemoryOutputArtifactStore() },
      operationLibrary: createOperationLibrary(),
      researchKeyRegistry: createResearchKeyRegistry({ store, checkKey, pool }),
    });
    servers.push(server);

    return { server, keys, refreshes };
  }

  it("adds a checked key to the pool, lists it without the key, and lets only its contributor remove it", async () => {
    const { server, keys, refreshes } = serverWith(async () => ({ status: "Accepted" }));

    const added = await server.inject({
      method: "POST",
      url: "/research-keys",
      headers: { "x-owner-id": "ada" },
      payload: { apiKey: ` ${validKey} `, label: "Ada's key", acknowledgedRisk: true },
    });

    expect(added.statusCode).toBe(201);
    expect(added.json().key).toMatchObject({ label: "Ada's key", lastFour: "xxxx", status: "Active" });
    expect(keys[0].apiKey).toBe(validKey);
    expect(refreshes()).toBe(1);

    const listed = await server.inject({ method: "GET", url: "/research-keys", headers: { "x-owner-id": "ada" } });
    expect(listed.json()).toEqual({
      keys: [expect.objectContaining({ label: "Ada's key" })],
      pool: { activeKeys: 3, searchesLeftToday: 1200 },
    });
    expect(listed.body).not.toContain(validKey);

    const others = await server.inject({ method: "GET", url: "/research-keys", headers: { "x-owner-id": "bob" } });
    expect(others.json().keys).toEqual([]);

    const removedByOther = await server.inject({ method: "DELETE", url: `/research-keys/${keys[0].id}`, headers: { "x-owner-id": "bob" } });
    expect(removedByOther.statusCode).toBe(404);

    const removed = await server.inject({ method: "DELETE", url: `/research-keys/${keys[0].id}`, headers: { "x-owner-id": "ada" } });
    expect(removed.statusCode).toBe(204);
    expect(keys).toEqual([]);
  });

  it("refuses unacknowledged, malformed, billed and duplicate keys", async () => {
    const { server } = serverWith(async (apiKey) =>
      apiKey.endsWith("b".repeat(35))
        ? { status: "Rejected", code: "KEY_BILLED", message: "billing on" }
        : { status: "Accepted" });
    const post = (payload: object) => server.inject({ method: "POST", url: "/research-keys", headers: { "x-owner-id": "ada" }, payload });

    expect((await post({ apiKey: validKey })).statusCode).toBe(400);
    expect((await post({ apiKey: "sk-not-gemini", acknowledgedRisk: true })).json()).toMatchObject({ code: "KEY_FORMAT" });
    expect((await post({ apiKey: `AIza${"b".repeat(35)}`, acknowledgedRisk: true })).json()).toMatchObject({ code: "KEY_BILLED" });
    expect((await post({ apiKey: validKey, acknowledgedRisk: true })).statusCode).toBe(201);

    const duplicate = await post({ apiKey: validKey, acknowledgedRisk: true });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json()).toMatchObject({ code: "KEY_DUPLICATE" });
  });

  it("requires a signed-in user", async () => {
    const { server } = serverWith(async () => ({ status: "Accepted" }));

    expect((await server.inject({ method: "GET", url: "/research-keys" })).statusCode).toBe(401);
  });
});
