import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";

import { createPostgresOperationLibrary } from "../../src/composition/postgres-operation-library.js";

const databaseUrl = process.env.CSV_ENRICHMENT_TEST_DATABASE_URL;
const integrationIt = databaseUrl === undefined ? it.skip : it;

describe("Postgres Operation Library", () => {
  integrationIt("persists, revises, lists, and retires an Owner's Custom Operation", async () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const ownerId = `integration-owner-${randomUUID()}`;
    const operationLibrary = createPostgresOperationLibrary({ pool });

    try {
      const created = await operationLibrary.createCustomOperation({
        ownerId,
        name: "Company category",
        promptTemplate: "Classify {company_name}.",
        expectedOutputType: "Text",
      });
      const revised = await operationLibrary.reviseCustomOperation({
        id: created.id,
        ownerId,
        name: "Industry category",
        promptTemplate: "Classify the industry of {company_name}.",
        expectedOutputType: "Text",
      });

      expect(revised).toMatchObject({
        id: created.id,
        ownerId,
        version: 2,
        name: "Industry category",
      });
      await expect(operationLibrary.listCustomOperations(ownerId)).resolves.toEqual([
        revised,
      ]);

      await operationLibrary.retireCustomOperation({
        id: created.id,
        ownerId,
      });

      await expect(operationLibrary.listCustomOperations(ownerId)).resolves.toEqual([]);
    } finally {
      await pool.query(
        "DELETE FROM custom_operation_definitions WHERE owner_id = $1",
        [ownerId],
      );
      await pool.end();
    }
  });
});
