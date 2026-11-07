import type { LeadLookup, LookupInputRole } from "../lead-lookup/lead-lookup.js";
import type { CustomOperationProvider } from "./execute-enrichment-job.js";

/** The company a row is about, from the columns mapped to Website and Company Name. */
export type ResearchAndWriteSubject = {
  jobId?: string;
  companyWebsite?: string;
  companyName?: string;
};

/**
 * The one web research question asked about every company. It looks for the facts a cold
 * opener to an engineering leader can stand on, and asks for short quotes so the writer can
 * reuse distinctive phrases from a job post.
 */
export const signalResearchQuestion = [
  "Find recent, specific facts about this company's engineering platform. Look for:",
  "1. Open infrastructure, platform, SRE, DevOps, cloud or data engineering job posts: give the job title and quote short distinctive phrases, especially any naming Azure, Google Cloud, GCP, AWS, on-prem, data centers, VMware, migration, consolidation or cutover.",
  "2. A new CTO, CIO, VP or Head of Engineering appointed in the last year.",
  "3. An acquisition or merger that may have left them with two platforms.",
  "4. Engineering blog posts or talks about infrastructure, scaling or reliability.",
  "5. Growth, new regions or new products that put weight on the platform, and compliance they work under (HIPAA, SOC 2, PCI, FedRAMP).",
  "List each fact found on its own line, with the source page. Only include facts found on the web; leave out anything not found.",
].join("\n");

/** LeadOcean company fields given to the writer, in this order, with the label it sees. */
const profileFields: ReadonlyArray<{ id: string; label: string }> = [
  { id: "description", label: "Description" },
  { id: "industry", label: "Industry" },
  { id: "specialties", label: "Specialties" },
  { id: "employees", label: "Employees" },
  { id: "hq-country", label: "HQ country" },
  { id: "technologies", label: "Technologies" },
  { id: "total-funding", label: "Total funding (USD)" },
  { id: "last-funding-round", label: "Last funding round" },
  { id: "last-funding-date", label: "Last funding date" },
];

/**
 * Gathers the company's profile and web signals, then asks the Generation Model to write from
 * the rendered instruction plus what was gathered. Missing research never stops the writing:
 * the instruction is still written from whatever was found.
 */
export async function researchAndWrite(input: {
  /** The pasted instruction with column placeholders already filled from the row. */
  instruction: string;
  generationModel: string;
  subject: ResearchAndWriteSubject;
  provider: CustomOperationProvider;
  leadLookup?: LeadLookup;
}): Promise<string | number | boolean> {
  const [profile, signals] = await Promise.all([
    companyProfile(input.subject, input.leadLookup),
    webSignals(input.subject, input.provider),
  ]);

  return input.provider.execute({
    prompt: writerPrompt(input.instruction, profile, signals),
    expectedOutputType: "Text",
    generationModel: input.generationModel,
  });
}

async function companyProfile(
  subject: ResearchAndWriteSubject,
  leadLookup: LeadLookup | undefined,
): Promise<Array<string>> {
  const inputs: Partial<Record<LookupInputRole, string>> = {
    ...(subject.companyWebsite === undefined ? {} : { "company-domain": subject.companyWebsite }),
    ...(subject.companyName === undefined ? {} : { "company-name": subject.companyName }),
  };

  if (leadLookup === undefined || Object.keys(inputs).length === 0) {
    return [];
  }

  // The lookup matches the company once per row and serves every field from that match.
  const lines = await Promise.all(profileFields.map(async (field) => {
    try {
      const result = await leadLookup.lookUpField({ subject: "company", inputs, outputField: field.id });

      return result.status === "Found" && result.value.trim() !== ""
        ? `${field.label}: ${result.value}`
        : undefined;
    } catch {
      return undefined;
    }
  }));

  return lines.filter((line): line is string => line !== undefined);
}

async function webSignals(
  subject: ResearchAndWriteSubject,
  provider: CustomOperationProvider,
): Promise<string | undefined> {
  if (subject.companyWebsite === undefined && subject.companyName === undefined) {
    return undefined;
  }

  try {
    const answer = String(await provider.execute({
      prompt: `Company: ${subject.companyName ?? subject.companyWebsite}\nQuestion: ${signalResearchQuestion}`,
      expectedOutputType: "Text",
      ...subject,
    })).trim();

    return answer === "" || answer.startsWith("[Not Found]") ? undefined : answer;
  } catch {
    return undefined;
  }
}

function writerPrompt(
  instruction: string,
  profile: Array<string>,
  signals: string | undefined,
): string {
  return [
    instruction,
    "",
    "---",
    "Research gathered about this company. Use only these facts and the details above.",
    "Any {placeholder} left in the instruction above has no column: fill it from this research, or treat it as unknown if the research does not cover it.",
    "",
    "Company profile (LeadOcean):",
    profile.length > 0 ? profile.join("\n") : "Not found.",
    "",
    "Hiring, platform and leadership signals (web search):",
    signals ?? "None found.",
  ].join("\n");
}
