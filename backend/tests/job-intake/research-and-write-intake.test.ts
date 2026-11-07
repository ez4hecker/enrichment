import { describe, expect, it } from "vitest";

import { submitEnrichmentJob } from "../../src/job-intake/submit-enrichment-job.js";

const sourceList = {
  fileName: "contacts.csv",
  csv: "First Name,Company Name,Website\nJane,Acme Inc.,acme.com\n",
};

function researchAndWrite(generationModel: string) {
  return {
    kind: "research-and-write" as const,
    // {Signal} has no column: the writer fills it from the research, so intake must allow it.
    promptTemplate: "Write an opener for {First Name} at {Company Name}. Signal: {Signal}",
    generationModel,
    inputBindings: ["First Name", "Company Name"].map((column) => ({
      variable: column,
      input: { kind: "source-field" as const, field: column },
    })),
    generatedField: "Opener",
  };
}

describe("Job Intake for Research & Write", () => {
  it("rejects a Research & Write operation whose model is not in the Generation Model catalog", async () => {
    const result = await submitEnrichmentJob({
      ownerId: "owner-1",
      sourceList,
      columnMappings: [{ sourceField: "Website", canonicalDataType: "website" }],
      configuredOperations: [researchAndWrite("gpt-5.5-pro")],
    });

    expect(result).toEqual({
      status: "Rejected",
      errors: [
        {
          code: "UNKNOWN_GENERATION_MODEL",
          generatedField: "Opener",
          generationModel: "gpt-5.5-pro",
        },
      ],
    });
  });

  it("rejects a Research & Write operation when no column is mapped to Website or Company Name", async () => {
    const result = await submitEnrichmentJob({
      ownerId: "owner-1",
      sourceList,
      columnMappings: [{ sourceField: "First Name", canonicalDataType: "first-name" }],
      configuredOperations: [researchAndWrite("gpt-6-luna")],
    });

    expect(result).toEqual({
      status: "Rejected",
      errors: [
        {
          code: "NO_COMPANY_TO_RESEARCH",
          generatedField: "Opener",
          message: expect.stringContaining("Website or Company Name"),
        },
      ],
    });
  });

  it("accepts a pasted prompt whose placeholders without a column are left for the writer", async () => {
    const result = await submitEnrichmentJob({
      ownerId: "owner-1",
      sourceList,
      columnMappings: [{ sourceField: "Company Name", canonicalDataType: "company-name" }],
      configuredOperations: [researchAndWrite("gpt-6-luna")],
    });

    expect(result).toMatchObject({
      status: "Accepted",
      job: { configuredOperations: [researchAndWrite("gpt-6-luna")] },
    });
  });
});

