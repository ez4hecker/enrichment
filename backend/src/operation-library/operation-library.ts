import { randomUUID } from "node:crypto";

import type {
  CustomOperationDefinition,
  ExpectedOutputType,
} from "./custom-operation-definition.js";

export type CreateCustomOperationInput = {
  ownerId: string;
  name: string;
  promptTemplate: string;
  expectedOutputType: ExpectedOutputType;
  generationModel?: string;
};

export type ReviseCustomOperationInput = CreateCustomOperationInput & {
  id: string;
};

export type RetireCustomOperationInput = {
  id: string;
  ownerId: string;
};

export type OperationLibrary = {
  createCustomOperation(
    input: CreateCustomOperationInput,
  ): Promise<CustomOperationDefinition>;
  reviseCustomOperation(
    input: ReviseCustomOperationInput,
  ): Promise<CustomOperationDefinition>;
  listCustomOperations(ownerId: string): Promise<Array<CustomOperationDefinition>>;
  retireCustomOperation(input: RetireCustomOperationInput): Promise<void>;
};

export function createOperationLibrary(): OperationLibrary {
  const currentDefinitions = new Map<string, StoredCustomOperationDefinition>();

  return {
    async createCustomOperation(input) {
      const definition: CustomOperationDefinition = {
        id: randomUUID(),
        ...input,
        version: 1,
      };

      currentDefinitions.set(definition.id, { definition, retired: false });
      return copyDefinition(definition);
    },
    async reviseCustomOperation(input) {
      const current = currentDefinitions.get(input.id);

      if (
        current === undefined ||
        current.retired ||
        current.definition.ownerId !== input.ownerId
      ) {
        throw new Error("Custom Operation Definition is unavailable");
      }

      const revisedDefinition: CustomOperationDefinition = {
        ...input,
        version: current.definition.version + 1,
      };

      currentDefinitions.set(revisedDefinition.id, {
        definition: revisedDefinition,
        retired: false,
      });
      return copyDefinition(revisedDefinition);
    },
    async listCustomOperations(ownerId) {
      return [...currentDefinitions.values()].flatMap((current) =>
        current.retired || current.definition.ownerId !== ownerId
          ? []
          : [copyDefinition(current.definition)],
      );
    },
    async retireCustomOperation(input) {
      const current = currentDefinitions.get(input.id);

      if (
        current === undefined ||
        current.retired ||
        current.definition.ownerId !== input.ownerId
      ) {
        throw new Error("Custom Operation Definition is unavailable");
      }

      current.retired = true;
    },
  };
}

type StoredCustomOperationDefinition = {
  definition: CustomOperationDefinition;
  retired: boolean;
};

function copyDefinition(
  definition: CustomOperationDefinition,
): CustomOperationDefinition {
  return { ...definition };
}
