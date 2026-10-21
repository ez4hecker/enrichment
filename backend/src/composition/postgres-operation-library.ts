import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

import type {
  CustomOperationDefinition,
} from "../operation-library/custom-operation-definition.js";
import type {
  OperationLibrary,
} from "../operation-library/operation-library.js";

type CustomOperationDefinitionRow = {
  id: string;
  owner_id: string;
  name: string;
  prompt_template: string;
  expected_output_type: CustomOperationDefinition["expectedOutputType"];
  generation_model: string | null;
  version: number;
};

export type PostgresOperationLibraryOptions = {
  pool: Pick<Pool, "query">;
};

export function createPostgresOperationLibrary(
  options: PostgresOperationLibraryOptions,
): OperationLibrary {
  return {
    async createCustomOperation(input) {
      const id = randomUUID();
      const result = await options.pool.query<CustomOperationDefinitionRow>(
        `INSERT INTO custom_operation_definitions (
           id, owner_id, name, prompt_template, expected_output_type, generation_model, version, retired
         ) VALUES ($1, $2, $3, $4, $5, $6, 1, FALSE)
         RETURNING id, owner_id, name, prompt_template, expected_output_type, generation_model, version`,
        [
          id,
          input.ownerId,
          input.name,
          input.promptTemplate,
          input.expectedOutputType,
          input.generationModel ?? null,
        ],
      );

      return toCustomOperationDefinition(requiredRow(result.rows[0]));
    },
    async reviseCustomOperation(input) {
      const result = await options.pool.query<CustomOperationDefinitionRow>(
        `UPDATE custom_operation_definitions
         SET name = $3,
             prompt_template = $4,
             expected_output_type = $5,
             generation_model = $6,
             version = version + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
           AND owner_id = $2
           AND retired = FALSE
         RETURNING id, owner_id, name, prompt_template, expected_output_type, generation_model, version`,
        [
          input.id,
          input.ownerId,
          input.name,
          input.promptTemplate,
          input.expectedOutputType,
          input.generationModel ?? null,
        ],
      );

      if (result.rows[0] === undefined) {
        throw new Error("Custom Operation Definition is unavailable");
      }

      return toCustomOperationDefinition(result.rows[0]);
    },
    async listCustomOperations(ownerId) {
      const result = await options.pool.query<CustomOperationDefinitionRow>(
        `SELECT id, owner_id, name, prompt_template, expected_output_type, generation_model, version
         FROM custom_operation_definitions
         WHERE owner_id = $1 AND retired = FALSE
         ORDER BY created_at ASC`,
        [ownerId],
      );

      return result.rows.map(toCustomOperationDefinition);
    },
    async retireCustomOperation(input) {
      const result = await options.pool.query(
        `UPDATE custom_operation_definitions
         SET retired = TRUE, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
           AND owner_id = $2
           AND retired = FALSE`,
        [input.id, input.ownerId],
      );

      if (result.rowCount === 0) {
        throw new Error("Custom Operation Definition is unavailable");
      }
    },
  };
}

function toCustomOperationDefinition(
  row: CustomOperationDefinitionRow,
): CustomOperationDefinition {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    promptTemplate: row.prompt_template,
    expectedOutputType: row.expected_output_type,
    ...(row.generation_model === null ? {} : { generationModel: row.generation_model }),
    version: row.version,
  };
}

function requiredRow<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("Custom Operation Definition could not be stored");
  }

  return value;
}
