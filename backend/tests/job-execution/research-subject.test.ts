import { describe, expect, it } from "vitest";

import {
  executeEnrichmentJob,
  SpendLimitReachedError,
  type CustomOperationProvider,
} from "../../src/job-execution/execute-enrichment-job.js";

const researchOperation = {
  kind: "custom-operation" as const,
  name: "AI Research",
  promptTemplate: "Company: {company}\nQuestion: Last funding?",
  expectedOutputType: "Text" as const,
  inputBindings: [{ variable: "company", input: { kind: "source-field" as const, field: "Company" } }],
  generatedField: "Funding",
};

describe("Job Execution research subject", () => {
  it("tells research which company a row is about from the Website and Company Name mappings", async () => {
    const requests: Array<Parameters<CustomOperationProvider["execute"]>[0]> = [];

    await executeEnrichmentJob(
      {
        jobId: "job-7",
        sourceList: {
          fileName: "list.csv",
          csv: "Company,Site\nToast,https://www.toasttab.com/\nNoSite Ltd,\n",
        },
        columnMappings: [
          { sourceField: "Company", canonicalDataType: "company-name" },
          { sourceField: "Site", canonicalDataType: "website" },
        ],
        configuredOperations: [researchOperation],
      },
      {
        customOperationProvider: {
          async execute(request) {
            requests.push(request);
            return "Series F";
          },
        },
      },
    );

    expect(requests).toEqual([
      {
        prompt: "Company: Toast\nQuestion: Last funding?",
        expectedOutputType: "Text",
        jobId: "job-7",
        companyName: "Toast",
        companyWebsite: "https://www.toasttab.com/",
      },
      {
        prompt: "Company: NoSite Ltd\nQuestion: Last funding?",
        expectedOutputType: "Text",
        jobId: "job-7",
        companyName: "NoSite Ltd",
      },
    ]);
  });

  it("records Spend limit reached as the Processing Error when research runs out of budget", async () => {
    const result = await executeEnrichmentJob(
      {
        jobId: "job-8",
        sourceList: { fileName: "list.csv", csv: "Company\nAcme\n" },
        configuredOperations: [researchOperation],
      },
      {
        customOperationProvider: {
          async execute() {
            throw new SpendLimitReachedError();
          },
        },
      },
    );

    expect(result.output.csv).toBe(
      "Company,Funding,processing_errors\nAcme,[Not Found],Funding: Spend limit reached\n",
    );
  });
});
