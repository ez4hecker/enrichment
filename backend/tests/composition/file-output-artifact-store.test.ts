import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createFileOutputArtifactStore } from "../../src/composition/file-output-artifact-store.js";

describe("file Output Artifact Store", () => {
  const directories: Array<string> = [];

  afterEach(async () => {
    await Promise.all(
      directories.splice(0).map((directory) =>
        rm(directory, { recursive: true, force: true }),
      ),
    );
  });

  it("persists and later reads a complete Enriched List", async () => {
    const directory = await mkdtemp(join(tmpdir(), "csv-enrichment-artifacts-"));
    directories.push(directory);
    const store = createFileOutputArtifactStore({ directory });

    const outputArtifactId = await store.store({
      fileName: "contacts_enriched.csv",
      csv: "company_name,company_name_cleaned\nAcme Inc.,Acme\n",
    });

    await expect(store.read(outputArtifactId)).resolves.toEqual({
      fileName: "contacts_enriched.csv",
      csv: "company_name,company_name_cleaned\nAcme Inc.,Acme\n",
    });
  });

  it("does not expose an unknown Output Artifact", async () => {
    const directory = await mkdtemp(join(tmpdir(), "csv-enrichment-artifacts-"));
    directories.push(directory);
    const store = createFileOutputArtifactStore({ directory });

    await expect(store.read("missing-artifact")).resolves.toBeUndefined();
  });
});
