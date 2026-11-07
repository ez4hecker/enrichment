import { describe, expect, it } from "vitest";

import {
  executeEnrichmentJob,
  type CustomOperationProvider,
} from "../../src/job-execution/execute-enrichment-job.js";
import type { LeadLookup } from "../../src/lead-lookup/lead-lookup.js";

const csv = "First Name,Company Name,Website\nJane,Acme Inc.,https://acme.com\n";
const columnMappings = [
  { sourceField: "First Name", canonicalDataType: "first-name" },
  { sourceField: "Company Name", canonicalDataType: "company-name" },
  { sourceField: "Website", canonicalDataType: "website" },
];

function researchAndWrite(promptTemplate: string, boundColumns: Array<string>) {
  return {
    kind: "research-and-write" as const,
    promptTemplate,
    generationModel: "gpt-6-luna",
    inputBindings: boundColumns.map((column) => ({
      variable: column,
      input: { kind: "source-field" as const, field: column },
    })),
    generatedField: "Opener",
  };
}

describe("Research & Write", () => {
  it("writes the line from the row, the company's LeadOcean profile and its web signals", async () => {
    const lookups: Array<unknown> = [];
    const leadLookup: LeadLookup = {
      async lookUpField(request) {
        lookups.push(request);
        const profile: Record<string, string> = {
          description: "Acme builds payroll software for clinics.",
          industry: "Software Development",
          technologies: "Azure, .NET, SQL Server",
        };
        const value = profile[request.outputField];

        return value === undefined
          ? { status: "NotFound", reason: "Field not on file" }
          : { status: "Found", value };
      },
    };
    const researchRequests: Array<unknown> = [];
    const writerPrompts: Array<string> = [];
    const customOperationProvider: CustomOperationProvider = {
      async execute(request) {
        if (request.generationModel === undefined) {
          researchRequests.push(request);

          return 'Senior SRE job post mentions an "eventual migration from Azure to AWS".';
        }

        expect(request.generationModel).toBe("gpt-6-luna");
        writerPrompts.push(request.prompt);

        return "Your SRE post mentions an eventual move from Azure to AWS.";
      },
    };

    const result = await executeEnrichmentJob(
      {
        jobId: "job-raw",
        sourceList: { fileName: "contacts.csv", csv },
        columnMappings,
        configuredOperations: [
          researchAndWrite("Write an opener for {First Name} at {Company Name}. Signal: {Signal}", ["First Name", "Company Name"]),
        ],
      },
      { customOperationProvider, leadLookup },
    );

    expect(result.output.csv).toBe(
      [
        "First Name,Company Name,Website,Opener",
        "Jane,Acme Inc.,https://acme.com,Your SRE post mentions an eventual move from Azure to AWS.",
        "",
      ].join("\n"),
    );
    expect(lookups).toContainEqual(expect.objectContaining({
      subject: "company",
      inputs: { "company-domain": "https://acme.com", "company-name": "Acme Inc." },
    }));
    expect(researchRequests).toEqual([
      expect.objectContaining({
        expectedOutputType: "Text",
        jobId: "job-raw",
        companyWebsite: "https://acme.com",
        companyName: "Acme Inc.",
      }),
    ]);
    expect(writerPrompts).toHaveLength(1);
    const prompt = writerPrompts[0]!;
    // Columns are filled from the row; a placeholder with no column is left for the writer to fill.
    expect(prompt).toContain("Write an opener for Jane at Acme Inc.. Signal: {Signal}");
    expect(prompt).toContain("Acme builds payroll software for clinics.");
    expect(prompt).toContain("Software Development");
    expect(prompt).toContain("Azure, .NET, SQL Server");
    expect(prompt).toContain('"eventual migration from Azure to AWS"');
  });

  it("still writes the line when LeadOcean and the web search find nothing", async () => {
    const writerPrompts: Array<string> = [];
    const result = await executeEnrichmentJob(
      {
        jobId: "job-nothing-found",
        sourceList: { fileName: "contacts.csv", csv },
        columnMappings,
        configuredOperations: [researchAndWrite("Write an opener for {Company Name}.", ["Company Name"])],
      },
      {
        leadLookup: {
          async lookUpField() {
            throw new Error("LeadOcean records used up");
          },
        },
        customOperationProvider: {
          async execute(request) {
            if (request.generationModel === undefined) {
              return "[Not Found]";
            }

            writerPrompts.push(request.prompt);

            return "Acme's payroll product must see a busy January.";
          },
        },
      },
    );

    expect(result.output.csv).toBe(
      [
        "First Name,Company Name,Website,Opener",
        "Jane,Acme Inc.,https://acme.com,Acme's payroll product must see a busy January.",
        "",
      ].join("\n"),
    );
    expect(result.progress).toMatchObject({ total: 1, completed: 1, failed: 0 });
    expect(writerPrompts[0]).toContain("Write an opener for Acme Inc..");
    expect(writerPrompts[0]).not.toContain("[Not Found]");
  });

  it("records a failed row with [Not Found] when the writer cannot write", async () => {
    const result = await executeEnrichmentJob(
      {
        jobId: "job-writer-down",
        sourceList: { fileName: "contacts.csv", csv },
        columnMappings,
        configuredOperations: [researchAndWrite("Write an opener for {Company Name}.", ["Company Name"])],
      },
      {
        customOperationProvider: {
          async execute(request) {
            if (request.generationModel === undefined) {
              return "No signals.";
            }

            throw new Error("OpenAI request was rejected");
          },
        },
      },
    );

    expect(result.output.csv.split("\n")[1]).toBe(
      "Jane,Acme Inc.,https://acme.com,[Not Found],Opener: Research & Write could not be completed",
    );
    expect(result.progress).toMatchObject({ total: 1, completed: 1, failed: 1 });
  });
});
