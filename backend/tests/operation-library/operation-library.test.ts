import { describe, expect, it } from "vitest";

import { submitEnrichmentJob } from "../../src/job-intake/submit-enrichment-job.js";
import { createOperationLibrary } from "../../src/operation-library/operation-library.js";

describe("Operation Library", () => {
  it("uses a Custom Operation revision only in Job Snapshots submitted after the revision", async () => {
    const operationLibrary = createOperationLibrary();
    const originalDefinition = await operationLibrary.createCustomOperation({
      ownerId: "user-1",
      name: "Company category",
      promptTemplate: "Classify {company_name} using one category.",
      expectedOutputType: "Text",
    });
    const firstSubmission = await submitEnrichmentJob({
      ownerId: "user-1",
      sourceList: {
        fileName: "contacts.csv",
        csv: "company_name\nAcme Inc.\n",
      },
      configuredOperations: [
        {
          kind: "custom-operation",
          definition: originalDefinition,
          inputBindings: [
            {
              variable: "company_name",
              input: { kind: "source-field", field: "company_name" },
            },
          ],
          generatedField: "company_category",
        },
      ],
    });
    const revisedDefinition = await operationLibrary.reviseCustomOperation({
      id: originalDefinition.id,
      ownerId: "user-1",
      name: "Industry category",
      promptTemplate: "Classify {company_name} using its industry.",
      expectedOutputType: "Text",
    });
    const secondSubmission = await submitEnrichmentJob({
      ownerId: "user-1",
      sourceList: {
        fileName: "contacts.csv",
        csv: "company_name\nGlobex LLC\n",
      },
      configuredOperations: [
        {
          kind: "custom-operation",
          definition: revisedDefinition,
          inputBindings: [
            {
              variable: "company_name",
              input: { kind: "source-field", field: "company_name" },
            },
          ],
          generatedField: "company_category",
        },
      ],
    });

    expect(firstSubmission).toMatchObject({
      status: "Accepted",
      job: {
        configuredOperations: [
          {
            definition: {
              id: originalDefinition.id,
              version: 1,
              name: "Company category",
              promptTemplate: "Classify {company_name} using one category.",
            },
          },
        ],
      },
    });
    expect(secondSubmission).toMatchObject({
      status: "Accepted",
      job: {
        configuredOperations: [
          {
            definition: {
              id: originalDefinition.id,
              version: 2,
              name: "Industry category",
              promptTemplate: "Classify {company_name} using its industry.",
            },
          },
        ],
      },
    });
  });

  it("lists only active Custom Operations owned by the requester", async () => {
    const operationLibrary = createOperationLibrary();
    const retiringOwnerDefinition = await operationLibrary.createCustomOperation({
      ownerId: "owner-1",
      name: "Company category",
      promptTemplate: "Classify {company_name} using one category.",
      expectedOutputType: "Text",
    });
    const activeOwnerDefinition = await operationLibrary.createCustomOperation({
      ownerId: "owner-1",
      name: "Employee estimate",
      promptTemplate: "Estimate employee count for {company_name}.",
      expectedOutputType: "Number",
    });
    await operationLibrary.createCustomOperation({
      ownerId: "owner-2",
      name: "Technology company",
      promptTemplate: "Is {company_name} a technology company?",
      expectedOutputType: "Boolean",
    });

    await operationLibrary.retireCustomOperation({
      id: retiringOwnerDefinition.id,
      ownerId: "owner-1",
    });

    await expect(operationLibrary.listCustomOperations("owner-1")).resolves.toEqual([
      activeOwnerDefinition,
    ]);
    await expect(operationLibrary.listCustomOperations("owner-2")).resolves.toEqual([
      expect.objectContaining({
        name: "Technology company",
        expectedOutputType: "Boolean",
      }),
    ]);
  });
});
