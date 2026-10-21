import { describe, expect, it } from "vitest";

import { executeEnrichmentJob } from "../../src/job-execution/execute-enrichment-job.js";

describe("Job Execution", () => {
  it("completes a valid CSV, ignores blank rows, and appends a cleaned company field", async () => {
    const result = await executeEnrichmentJob({
      jobId: "job-1",
      sourceList: {
        fileName: "contacts.csv",
        csv: "company_name,first_name\nAcme Inc.,Ada\n\nGlobex LLC,Bob\n",
      },
      configuredOperations: [
        {
          kind: "clean-company-name",
          input: { kind: "source-field", field: "company_name" },
          generatedField: "company_name_cleaned",
        },
      ],
    });

    expect(result).toEqual({
      jobId: "job-1",
      status: "Completed",
      output: {
        fileName: "contacts_enriched.csv",
        csv: [
          "company_name,first_name,company_name_cleaned",
          "Acme Inc.,Ada,Acme",
          "Globex LLC,Bob,Globex",
          "",
        ].join("\n"),
      },
      progress: {
        total: 2,
        completed: 2,
        failed: 0,
        remaining: 0,
      },
    });
  });

  it("cleans prefixes and middle initials from a first name", async () => {
    const result = await executeEnrichmentJob({
      jobId: "job-2",
      sourceList: {
        fileName: "contacts.csv",
        csv: "first_name\nDr. Ada B. Lovelace\n",
      },
      configuredOperations: [
        {
          kind: "clean-first-name",
          input: { kind: "source-field", field: "first_name" },
          generatedField: "first_name_cleaned",
        },
      ],
    });

    expect(result.output.csv).toBe(
      ["first_name,first_name_cleaned", "Dr. Ada B. Lovelace,Ada Lovelace", ""].join("\n"),
    );
  });

  it("adds https to a website that has no protocol", async () => {
    const result = await executeEnrichmentJob({
      jobId: "job-3",
      sourceList: {
        fileName: "contacts.csv",
        csv: "website\nacme.example\n",
      },
      configuredOperations: [
        {
          kind: "format-website",
          input: { kind: "source-field", field: "website" },
          generatedField: "website_formatted",
        },
      ],
    });

    expect(result.output.csv).toBe(
      ["website,website_formatted", "acme.example,https://acme.example", ""].join("\n"),
    );
  });

  it("extracts the domain from an email address", async () => {
    const result = await executeEnrichmentJob({
      jobId: "job-4",
      sourceList: {
        fileName: "contacts.csv",
        csv: "email\nada@acme.example\n",
      },
      configuredOperations: [
        {
          kind: "extract-domain-from-email",
          input: { kind: "source-field", field: "email" },
          generatedField: "email_domain",
        },
      ],
    });

    expect(result.output.csv).toBe(
      ["email,email_domain", "ada@acme.example,acme.example", ""].join("\n"),
    );
  });

  it("capitalizes job titles while preserving common acronyms", async () => {
    const result = await executeEnrichmentJob({
      jobId: "job-5",
      sourceList: {
        fileName: "contacts.csv",
        csv: "job_title\nsenior vp of sales\n",
      },
      configuredOperations: [
        {
          kind: "capitalize-job-titles",
          input: { kind: "source-field", field: "job_title" },
          generatedField: "job_title_capitalized",
        },
      ],
    });

    expect(result.output.csv).toBe(
      ["job_title,job_title_capitalized", "senior vp of sales,Senior VP of Sales", ""].join("\n"),
    );
  });

  it("uses a text Placeholder and records a Processing Error when an email has no domain", async () => {
    const result = await executeEnrichmentJob({
      jobId: "job-6",
      sourceList: {
        fileName: "contacts.csv",
        csv: "email\nnot-an-email\n",
      },
      configuredOperations: [
        {
          kind: "extract-domain-from-email",
          input: { kind: "source-field", field: "email" },
          generatedField: "email_domain",
        },
      ],
    });

    expect(result.output.csv).toBe(
      [
        "email,email_domain,processing_errors",
        "not-an-email,[Not Found],email_domain: Invalid email address",
        "",
      ].join("\n"),
    );
  });

  it("preserves quoted commas in Source Fields and writes a valid Enriched List", async () => {
    const result = await executeEnrichmentJob({
      jobId: "job-7",
      sourceList: {
        fileName: "contacts.csv",
        csv: 'company_name,first_name\n"Acme, Inc.",Ada\n',
      },
      configuredOperations: [
        {
          kind: "clean-company-name",
          input: { kind: "source-field", field: "company_name" },
          generatedField: "company_name_cleaned",
        },
      ],
    });

    expect(result.output.csv).toBe(
      [
        "company_name,first_name,company_name_cleaned",
        '"Acme, Inc.",Ada,Acme',
        "",
      ].join("\n"),
    );
  });

  it("uses an explicitly selected Generated Field as a chained operation input", async () => {
    const result = await executeEnrichmentJob({
      jobId: "job-8",
      sourceList: {
        fileName: "contacts.csv",
        csv: "email\nada@acme.example\n",
      },
      configuredOperations: [
        {
          kind: "extract-domain-from-email",
          input: { kind: "source-field", field: "email" },
          generatedField: "email_domain",
        },
        {
          kind: "format-website",
          input: { kind: "generated-field", field: "email_domain" },
          generatedField: "company_website",
        },
      ],
    });

    expect(result.output.csv).toBe(
      [
        "email,email_domain,company_website",
        "ada@acme.example,acme.example,https://acme.example",
        "",
      ].join("\n"),
    );
  });

  it("propagates an upstream Processing Error through a chained operation", async () => {
    const result = await executeEnrichmentJob({
      jobId: "job-9",
      sourceList: {
        fileName: "contacts.csv",
        csv: "email\nnot-an-email\n",
      },
      configuredOperations: [
        {
          kind: "extract-domain-from-email",
          input: { kind: "source-field", field: "email" },
          generatedField: "email_domain",
        },
        {
          kind: "format-website",
          input: { kind: "generated-field", field: "email_domain" },
          generatedField: "company_website",
        },
      ],
    });

    expect(result.output.csv).toBe(
      [
        "email,email_domain,company_website,processing_errors",
        "not-an-email,[Not Found],[Not Found],email_domain: Invalid email address; company_website: Unavailable generated field: email_domain",
        "",
      ].join("\n"),
    );
  });

  it("renders a Custom Operation Prompt Template from its selected inputs", async () => {
    const result = await executeEnrichmentJob(
      {
        jobId: "job-10",
        sourceList: {
          fileName: "contacts.csv",
          csv: "company_name\nAcme Inc.\n",
        },
        configuredOperations: [
          {
            kind: "custom-operation",
            name: "Company category",
            promptTemplate: "Classify {company_name} using one category.",
            expectedOutputType: "Text",
            inputBindings: [
              {
                variable: "company_name",
                input: { kind: "source-field", field: "company_name" },
              },
            ],
            generatedField: "company_category",
          },
        ],
      },
      {
        customOperationProvider: {
          async execute(request) {
            expect(request).toEqual({
              prompt: "Classify Acme Inc. using one category.",
              expectedOutputType: "Text",
              jobId: expect.any(String),
            });

            return "Technology";
          },
        },
      },
    );

    expect(result.output.csv).toBe(
      ["company_name,company_category", "Acme Inc.,Technology", ""].join("\n"),
    );
  });

  it("asks the provider to write a Generation Custom Operation with its chosen model", async () => {
    const result = await executeEnrichmentJob(
      {
        jobId: "job-generation",
        sourceList: {
          fileName: "contacts.csv",
          csv: "first_name,company_name\nJane,Acme Inc.\n",
        },
        configuredOperations: [
          {
            kind: "custom-operation",
            name: "Ice breaker",
            promptTemplate: "Write an ice breaker for {first_name} at {company_name}.",
            expectedOutputType: "Text",
            generationModel: "gpt-6-luna",
            inputBindings: [
              {
                variable: "first_name",
                input: { kind: "source-field", field: "first_name" },
              },
              {
                variable: "company_name",
                input: { kind: "source-field", field: "company_name" },
              },
            ],
            generatedField: "ice_breaker",
          },
        ],
      },
      {
        customOperationProvider: {
          async execute(request) {
            expect(request).toEqual({
              prompt: "Write an ice breaker for Jane at Acme Inc..",
              expectedOutputType: "Text",
              generationModel: "gpt-6-luna",
            });

            return "Hi Jane";
          },
        },
      },
    );

    expect(result.output.csv).toBe(
      ["first_name,company_name,ice_breaker", "Jane,Acme Inc.,Hi Jane", ""].join("\n"),
    );
  });

  it("uses the Boolean Placeholder when a Custom Operation returns an invalid Boolean", async () => {
    const result = await executeEnrichmentJob(
      {
        jobId: "job-11",
        sourceList: {
          fileName: "contacts.csv",
          csv: "company_name\nAcme Inc.\n",
        },
        configuredOperations: [
          {
            kind: "custom-operation",
            name: "Technology company",
            promptTemplate: "Is {company_name} a technology company?",
            expectedOutputType: "Boolean",
            inputBindings: [
              {
                variable: "company_name",
                input: { kind: "source-field", field: "company_name" },
              },
            ],
            generatedField: "is_technology_company",
          },
        ],
      },
      {
        customOperationProvider: {
          async execute() {
            return "perhaps";
          },
        },
      },
    );

    expect(result.output.csv).toBe(
      [
        "company_name,is_technology_company,processing_errors",
        "Acme Inc.,[Uncertain],is_technology_company: Custom Operation returned an invalid Boolean",
        "",
      ].join("\n"),
    );
  });

  it("writes a finite Number returned by a Custom Operation", async () => {
    const result = await executeEnrichmentJob(
      {
        jobId: "job-12",
        sourceList: {
          fileName: "contacts.csv",
          csv: "company_name\nAcme Inc.\n",
        },
        configuredOperations: [
          {
            kind: "custom-operation",
            name: "Employee estimate",
            promptTemplate: "Estimate the employee count for {company_name}.",
            expectedOutputType: "Number",
            inputBindings: [
              {
                variable: "company_name",
                input: { kind: "source-field", field: "company_name" },
              },
            ],
            generatedField: "employee_estimate",
          },
        ],
      },
      {
        customOperationProvider: {
          async execute() {
            return 250;
          },
        },
      },
    );

    expect(result.output.csv).toBe(
      ["company_name,employee_estimate", "Acme Inc.,250", ""].join("\n"),
    );
  });

  it("uses the Number Placeholder when a Custom Operation returns an invalid Number", async () => {
    const result = await executeEnrichmentJob(
      {
        jobId: "job-13",
        sourceList: {
          fileName: "contacts.csv",
          csv: "company_name\nAcme Inc.\n",
        },
        configuredOperations: [
          {
            kind: "custom-operation",
            name: "Employee estimate",
            promptTemplate: "Estimate the employee count for {company_name}.",
            expectedOutputType: "Number",
            inputBindings: [
              {
                variable: "company_name",
                input: { kind: "source-field", field: "company_name" },
              },
            ],
            generatedField: "employee_estimate",
          },
        ],
      },
      {
        customOperationProvider: {
          async execute() {
            return "many";
          },
        },
      },
    );

    expect(result.output.csv).toBe(
      [
        "company_name,employee_estimate,processing_errors",
        "Acme Inc.,[Not Found],employee_estimate: Custom Operation returned an invalid Number",
        "",
      ].join("\n"),
    );
  });

  it("uses the Text Placeholder when a Custom Operation returns an invalid Text value", async () => {
    const result = await executeEnrichmentJob(
      {
        jobId: "job-14",
        sourceList: {
          fileName: "contacts.csv",
          csv: "company_name\nAcme Inc.\n",
        },
        configuredOperations: [
          {
            kind: "custom-operation",
            name: "Company category",
            promptTemplate: "Classify {company_name} using one category.",
            expectedOutputType: "Text",
            inputBindings: [
              {
                variable: "company_name",
                input: { kind: "source-field", field: "company_name" },
              },
            ],
            generatedField: "company_category",
          },
        ],
      },
      {
        customOperationProvider: {
          async execute() {
            return true;
          },
        },
      },
    );

    expect(result.output.csv).toBe(
      [
        "company_name,company_category,processing_errors",
        "Acme Inc.,[Not Found],company_category: Custom Operation returned an invalid Text",
        "",
      ].join("\n"),
    );
  });

  it("records a safe Boolean failure when a Custom Operation provider rejects", async () => {
    const result = await executeEnrichmentJob(
      {
        jobId: "job-15",
        sourceList: {
          fileName: "contacts.csv",
          csv: "company_name\nAcme Inc.\n",
        },
        configuredOperations: [
          {
            kind: "custom-operation",
            name: "Technology company",
            promptTemplate: "Is {company_name} a technology company?",
            expectedOutputType: "Boolean",
            inputBindings: [
              {
                variable: "company_name",
                input: { kind: "source-field", field: "company_name" },
              },
            ],
            generatedField: "is_technology_company",
          },
        ],
      },
      {
        customOperationProvider: {
          async execute() {
            throw new Error("OpenAI request 9f3c failed: prompt contains Acme Inc.");
          },
        },
      },
    );

    expect(result.output.csv).toBe(
      [
        "company_name,is_technology_company,processing_errors",
        "Acme Inc.,[Uncertain],is_technology_company: Custom Operation could not be completed",
        "",
      ].join("\n"),
    );
  });

  it("uses the Boolean Placeholder when a Custom Operation provider is unavailable", async () => {
    const result = await executeEnrichmentJob({
      jobId: "job-16",
      sourceList: {
        fileName: "contacts.csv",
        csv: "company_name\nAcme Inc.\n",
      },
      configuredOperations: [
        {
          kind: "custom-operation",
          name: "Technology company",
          promptTemplate: "Is {company_name} a technology company?",
          expectedOutputType: "Boolean",
          inputBindings: [
            {
              variable: "company_name",
              input: { kind: "source-field", field: "company_name" },
            },
          ],
          generatedField: "is_technology_company",
        },
      ],
    });

    expect(result.output.csv).toBe(
      [
        "company_name,is_technology_company,processing_errors",
        "Acme Inc.,[Uncertain],is_technology_company: Custom Operation provider is unavailable",
        "",
      ].join("\n"),
    );
  });

  it("uses the Boolean Placeholder when a Custom Operation input is unavailable", async () => {
    const result = await executeEnrichmentJob(
      {
        jobId: "job-17",
        sourceList: {
          fileName: "contacts.csv",
          csv: "email\nnot-an-email\n",
        },
        configuredOperations: [
          {
            kind: "extract-domain-from-email",
            input: { kind: "source-field", field: "email" },
            generatedField: "email_domain",
          },
          {
            kind: "custom-operation",
            name: "Trusted domain",
            promptTemplate: "Is {email_domain} trusted?",
            expectedOutputType: "Boolean",
            inputBindings: [
              {
                variable: "email_domain",
                input: { kind: "generated-field", field: "email_domain" },
              },
            ],
            generatedField: "is_trusted_domain",
          },
        ],
      },
      {
        customOperationProvider: {
          async execute() {
            throw new Error("The provider must not be called for unavailable input");
          },
        },
      },
    );

    expect(result.output.csv).toBe(
      [
        "email,email_domain,is_trusted_domain,processing_errors",
        "not-an-email,[Not Found],[Uncertain],email_domain: Invalid email address; is_trusted_domain: Unavailable generated field: email_domain",
        "",
      ].join("\n"),
    );
  });
});
