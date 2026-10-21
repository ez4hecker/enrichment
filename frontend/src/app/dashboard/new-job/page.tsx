"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Skeleton } from "../../components/skeleton";
import { csvLine, parseCsvText } from "../../../lib/csv";
import { ArrowRight, X, Briefcase, Building2, Mail, User, CircleSlash, Phone, Globe, Link as LinkIcon, MapPin, Factory, Users, DollarSign, LayoutGrid, Sparkles, Search, Plus } from "lucide-react";

const AI_RESEARCH = "ai-research";

// The backend only sees the row value through a bound {company} variable; a prompt
// without one gets the same text for every row and cannot know which company is meant.
// Only the chosen column's value is sent, so each row costs exactly one search.
function aiResearchOperation(question: string, inputField: string, generatedField: string) {
  return {
    kind: "custom-operation",
    name: "AI Research",
    promptTemplate: `Company: {company}\nQuestion: ${question.trim()}`,
    expectedOutputType: "Text",
    inputBindings: [{ variable: "company", input: { kind: "source-field", field: inputField } }],
    generatedField,
  };
}

const AI_WRITING = "ai-writing";

type GenerationModel = {
  id: string;
  label: string;
  description: string;
  inputDollarsPerMillionTokens: number;
  outputDollarsPerMillionTokens: number;
  estimatedOutputTokensPerRow: number;
};

// Every {Column} in the instruction is bound to that column, so the writer sees each row's own values.
function promptColumns(instruction: string) {
  return [...new Set([...instruction.matchAll(/\{([^{}]+)\}/g)].map(match => match[1]))];
}

// Writes from the row's own columns with the chosen model; no web search, so no search cost.
function aiWritingOperation(instruction: string, generationModel: string, generatedField: string) {
  return {
    kind: "custom-operation",
    name: "AI Writing",
    promptTemplate: instruction.trim(),
    expectedOutputType: "Text",
    generationModel,
    inputBindings: promptColumns(instruction).map(column => ({ variable: column, input: { kind: "source-field", field: column } })),
    generatedField,
  };
}

// The backend adds about this many characters of writing instructions to every prompt.
const WRITING_INSTRUCTION_CHARACTERS = 330;

function estimatedWritingDollarsPerRow(model: GenerationModel, instruction: string, headers: string[], sampleRows: string[][]) {
  const rows = sampleRows.length > 0 ? sampleRows : [[]];
  const averagePromptCharacters = rows.reduce((total, row) => total + instruction.replace(/\{([^{}]+)\}/g, (_, column) => row[headers.indexOf(column)] ?? "").length, 0) / rows.length;
  // About four characters per token for English text.
  const inputTokens = (WRITING_INSTRUCTION_CHARACTERS + averagePromptCharacters) / 4;
  return (inputTokens * model.inputDollarsPerMillionTokens + model.estimatedOutputTokensPerRow * model.outputDollarsPerMillionTokens) / 1_000_000;
}

const LEAD_LOOKUP = "lead-lookup";

type LookupSubject = "person" | "company";
type LookupBinding = { role: string; column: string };

const LOOKUP_ROLE_LABELS: Record<string, string> = {
  "full-name": "Full name",
  "first-name": "First name",
  "last-name": "Last name",
  "company-name": "Company name",
  "company-domain": "Company website",
  "job-title": "Job title",
  "location": "Location",
  "linkedin-url": "LinkedIn URL",
  "company-linkedin-url": "Company LinkedIn URL",
  "email": "Email",
  "phone": "Phone",
};

type LookupField = { id: string; label: string; group: string; isDefault: boolean };
type LookupCatalogue = { available: boolean; candidateLimit: number; deepCandidateLimit?: number; minimumConfidence?: number } & Record<LookupSubject, { inputRoles: string[]; fields: LookupField[] }>;

// Which lookup input each mapped property feeds, so the inputs start filled in from the mapping step.
const LOOKUP_ROLE_FOR_PROPERTY: Record<LookupSubject, Record<string, string>> = {
  person: {
    "first-name": "first-name",
    "last-name": "last-name",
    "company-name": "company-name",
    "website": "company-domain",
    "job-title": "job-title",
    "email-address": "email",
    "phone-number": "phone",
    "linkedin": "linkedin-url",
    "country": "location",
  },
  company: {
    "company-name": "company-name",
    "website": "company-domain",
    "linkedin": "company-linkedin-url",
    "country": "location",
  },
};

// Inputs that name exactly one record, so the row costs one LeadOcean record instead of a search.
const EXACT_LOOKUP_ROLES: Record<LookupSubject, string[]> = {
  person: ["linkedin-url", "email", "phone"],
  company: ["company-domain", "company-linkedin-url"],
};

// Fields a person search row lacks; asking for any of them costs one enrichment per row.
const SEARCH_ROW_PERSON_FIELDS = ["match-confidence", "full-name", "first-name", "last-name", "headline", "linkedin-url", "picture-url", "person-id", "has-email", "has-phone", "job-title", "seniority", "role-start-date", "company-name", "company-domain", "company-industry", "company-employees", "company-size", "location", "city", "state", "country", "continent"];

type MatchStrictness = "loose" | "balanced" | "strict";

// How sure the lookup must be before it trusts the closest candidate. Balanced uses the server's default.
const MATCH_STRICTNESS: Array<{ id: MatchStrictness; label: string; confidence?: number; effect: string }> = [
  {
    id: "loose",
    label: "Loose",
    confidence: 0.35,
    effect: "Fills more rows, but some will be the wrong person: a colleague with the same last name, or a namesake at a similar company. Usually cheaper, since the search stops at the first passable candidate. Check the Match Confidence column before using the results.",
  },
  {
    id: "balanced",
    label: "Balanced",
    effect: "Recommended. The name has to match well and the company has to agree. In testing it found 17 of 20 people with no wrong matches.",
  },
  {
    id: "strict",
    label: "Strict",
    confidence: 0.75,
    effect: "Only keeps near-certain matches, so you get more [Not Found] rows (nicknames, typos or a changed company can miss) but almost no wrong people. Can cost a little more, since rows are searched more deeply before giving up.",
  },
];

const POLL_MILLISECONDS = 1000;

// One operation per returned field; the backend runs one search per row for all of them.
function leadLookupOperations(subject: LookupSubject, bindings: LookupBinding[], fields: string[], generatedFields: string[], minimumConfidence: number) {
  return fields.map((outputField, index) => ({
    kind: LEAD_LOOKUP,
    subject,
    inputBindings: bindings.map(binding => ({ role: binding.role, input: { kind: "source-field", field: binding.column } })),
    outputField,
    minimumConfidence,
    generatedField: generatedFields[index],
  }));
}

const ROWS_PER_PAGE = 100;
// The backend previews at most this many rows; more selected rows run as a job.
const MAX_PREVIEW_ROWS = 10;

function formatDollars(amount: number) {
  if (amount === 0) return "$0";
  if (amount < 0.01) return "<$0.01";
  return `$${amount.toFixed(2)}`;
}


async function responseError(res: Response) {
  let errorMessage = res.statusText;
  try {
    const data = JSON.parse(await res.text());
    errorMessage = data.message || data.errors?.[0]?.message || data.errors?.[0]?.code || data.code || JSON.stringify(data);
  } catch {
    // Keep default status text if not JSON
  }
  return errorMessage;
}

const PROPERTY_OPTIONS = [
  { id: "do-not-import", label: "Do not import", icon: <CircleSlash className="w-4 h-4 text-red-500" /> },
  { id: "first-name", label: "First name", icon: <User className="w-4 h-4 text-orange-500" /> },
  { id: "last-name", label: "Last name", icon: <User className="w-4 h-4 text-orange-500" /> },
  { id: "job-title", label: "Job title", icon: <Briefcase className="w-4 h-4 text-yellow-500" /> },
  { id: "company-name", label: "Company name", icon: <Building2 className="w-4 h-4 text-emerald-500" /> },
  { id: "email-address", label: "Email address", icon: <Mail className="w-4 h-4 text-blue-500" /> },
  { id: "phone-number", label: "Phone number", icon: <Phone className="w-4 h-4 text-purple-500" /> },
  { id: "website", label: "Website", icon: <Globe className="w-4 h-4 text-indigo-500" /> },
  { id: "linkedin", label: "LinkedIn", icon: <LinkIcon className="w-4 h-4 text-cyan-600" /> },
  { id: "country", label: "Country", icon: <MapPin className="w-4 h-4 text-rose-500" /> },
  { id: "industry", label: "Industry", icon: <Factory className="w-4 h-4 text-gray-500" /> },
  { id: "employees", label: "Employees", icon: <Users className="w-4 h-4 text-teal-500" /> },
  { id: "funding", label: "Funding", icon: <DollarSign className="w-4 h-4 text-green-600" /> },
];

export default function NewJobPage() {
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState("");
  const [csvContent, setCsvContent] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [allData, setAllData] = useState<string[][]>([]);
  const [sampleData, setSampleData] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  
  const [operations, setOperations] = useState<any[]>([]);
  const [opKind, setOpKind] = useState("clean-company-name");
  const [opInput, setOpInput] = useState("");
  const [opOutput, setOpOutput] = useState("");
  const [question, setQuestion] = useState("");
  // Indexes into allData of the rows ticked in the table; previews and "Start Processing" use them.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectionAnchor, setSelectionAnchor] = useState<number | null>(null);
  const [runScope, setRunScope] = useState<"all" | "selected">("all");
  const [rowFilter, setRowFilter] = useState("");
  const [tablePage, setTablePage] = useState(0);
  const [previewing, setPreviewing] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<Array<{ company: string; answer: string; row: string[] }>>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [generationModels, setGenerationModels] = useState<GenerationModel[]>([]);
  const [writingModel, setWritingModel] = useState("");
  const [lookupSubject, setLookupSubject] = useState<LookupSubject>("person");
  const [lookupBindings, setLookupBindings] = useState<LookupBinding[]>([]);
  const [lookupMode, setLookupMode] = useState<"default" | "custom">("default");
  const [customLookupFields, setCustomLookupFields] = useState<string[]>([]);
  const [fieldPickerOpen, setFieldPickerOpen] = useState(false);
  const [matchStrictness, setMatchStrictness] = useState<MatchStrictness>("balanced");
  const [lookupInfo, setLookupInfo] = useState<LookupCatalogue | null>(null);
  // A running lookup job, polled until its results can be appended to the table.
  const [lookupRun, setLookupRun] = useState<{ jobId: string; completed: number; total: number; rows: number } | null>(null);
  // Columns appended by finished lookups, and each source row's values for them (keyed by index into allData).
  const [resultColumns, setResultColumns] = useState<string[]>([]);
  const [resultsByRow, setResultsByRow] = useState<Record<number, string[]>>({});
  // The latest run's first new column and first looked-up row, scrolled into view and briefly highlighted.
  const [freshRun, setFreshRun] = useState<{ columnStart: number; firstRow: number } | null>(null);
  const [highlightFresh, setHighlightFresh] = useState(false);
  const freshCellRef = useRef<HTMLTableCellElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // The dashboard scrolls inside <main>, not the window, so each step would otherwise keep the previous scroll position.
  useEffect(() => {
    document.getElementById("dashboard-scroll")?.scrollTo({ top: 0 });
  }, [step]);

  useEffect(() => {
    fetch("/api/generation-models")
      .then(res => res.ok ? res.json() : { generationModels: [] })
      .then(data => {
        setGenerationModels(data.generationModels ?? []);
        setWritingModel(current => current || data.generationModels?.[0]?.id || "");
      })
      .catch(() => setGenerationModels([]));
  }, []);

  useEffect(() => {
    fetch("/api/lead-lookup")
      .then(res => res.ok ? res.json() : null)
      .then(data => setLookupInfo(data))
      .catch(() => setLookupInfo(null));
  }, []);

  // New or cleared answers have not been saved yet.
  useEffect(() => setSaveStatus("idle"), [previewAnswers]);

  // Keep opInput defaulted to the first mapped field
  useEffect(() => {
    const mapped = headers.filter(h => mappings[h] && mappings[h] !== 'do-not-import');
    if (mapped.length > 0 && (!opInput || !mapped.includes(opInput))) {
      setOpInput(mapped[0]);
    }
  }, [headers, mappings]);

  const parseCsvPreview = (csv: string) => {
    const rows = parseCsvText(csv);

    const parsedAll = rows.filter(r => r.some(f => f.trim() !== ""));

    if (parsedAll.length > 0) {
      const parsedHeaders = parsedAll[0];
      setHeaders(parsedHeaders);
      
      const parsedSample = parsedAll.length > 1 ? parsedAll[1] : [];
      setSampleData(parsedSample);
      // Every row is kept so any of them can be picked; the table shows one page at a time.
      setAllData(parsedAll.slice(1));
      setResultColumns([]);
      setResultsByRow({});
      setSelected(new Set());
      setSelectionAnchor(null);
      setRunScope("all");
      setRowFilter("");
      setTablePage(0);
      
      const initialMappings: Record<string, string> = {};
      parsedHeaders.forEach(h => {
        const lower = h.toLowerCase().trim();
        if (lower.includes('first') && lower.includes('name')) initialMappings[h] = 'first-name';
        else if (lower.includes('last') && lower.includes('name')) initialMappings[h] = 'last-name';
        else if (lower.includes('title') || lower.includes('role')) initialMappings[h] = 'job-title';
        else if (lower.includes('company') && lower.includes('name')) initialMappings[h] = 'company-name';
        else if (lower === 'company') initialMappings[h] = 'company-name';
        else if (lower.includes('email') && !lower.includes('status') && !lower.includes('open') && !lower.includes('bounce')) initialMappings[h] = 'email-address';
        else if (lower.includes('phone')) initialMappings[h] = 'phone-number';
        else if (lower.includes('website')) initialMappings[h] = 'website';
        else if (lower.includes('linkedin')) initialMappings[h] = 'linkedin';
        else if (lower.includes('country')) initialMappings[h] = 'country';
        else if (lower.includes('industry')) initialMappings[h] = 'industry';
        else if (lower.includes('employees')) initialMappings[h] = 'employees';
        else if (lower.includes('funding')) initialMappings[h] = 'funding';
        else initialMappings[h] = 'do-not-import';
      });
      setMappings(initialMappings);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
      parseCsvPreview(content);
      setStep(2);
    };
    reader.readAsText(file);
  };

  const handleMappingChange = (header: string, propertyId: string) => {
    setMappings(prev => ({ ...prev, [header]: propertyId }));
  };

  const handleContinue = () => {
    setStep(3);
  };

  const isAiOperation = opKind === AI_RESEARCH || opKind === AI_WRITING;

  // Starts the lookup's inputs from the columns mapped in step 2.
  const defaultLookupBindings = (subject: LookupSubject) => {
    const bindings: LookupBinding[] = [];
    for (const header of headers) {
      const role = LOOKUP_ROLE_FOR_PROPERTY[subject][mappings[header]];
      if (role && !bindings.some(binding => binding.role === role)) bindings.push({ role, column: header });
    }
    return bindings;
  };

  const chooseLookupSubject = (subject: LookupSubject) => {
    setLookupSubject(subject);
    setLookupBindings(defaultLookupBindings(subject));
    setLookupMode("default");
    setCustomLookupFields([]);
  };

  const chooseOperationKind = (kind: string) => {
    setOpKind(kind);
    setPreviewAnswers([]);
    if (kind === LEAD_LOOKUP && lookupBindings.length === 0) setLookupBindings(defaultLookupBindings(lookupSubject));
  };

  const lookupRoles = lookupInfo?.[lookupSubject].inputRoles ?? Object.keys(LOOKUP_ROLE_LABELS);
  const lookupCatalogue = lookupInfo?.[lookupSubject].fields ?? [];
  const lookupCandidateLimit = lookupInfo?.candidateLimit ?? 3;
  const defaultMatchConfidence = lookupInfo?.minimumConfidence ?? 0.5;
  const minimumMatchConfidence = MATCH_STRICTNESS.find(option => option.id === matchStrictness)?.confidence ?? defaultMatchConfidence;
  const defaultLookupFields = lookupCatalogue.filter(field => field.isDefault).map(field => field.id);
  const lookupFields = lookupMode === "custom" ? customLookupFields : defaultLookupFields;
  const fieldLabel = (subject: LookupSubject, id: string) => lookupInfo?.[subject].fields.find(field => field.id === id)?.label ?? id;

  const updateLookupBinding = (index: number, change: Partial<LookupBinding>) => {
    setLookupBindings(bindings => bindings.map((binding, i) => i === index ? { ...binding, ...change } : binding));
  };

  const addLookupBinding = () => {
    const role = lookupRoles.find(candidate => !lookupBindings.some(binding => binding.role === candidate));
    if (role) setLookupBindings(bindings => [...bindings, { role, column: headers[0] ?? "" }]);
  };

  // Returns why the lookup cannot run yet, or "" when it can. The backend checks the same rules.
  const lookupProblem = () => {
    if (lookupBindings.length === 0) return "Add at least one column to match on.";
    const roles = lookupBindings.map(binding => binding.role);
    if (new Set(roles).size !== roles.length) return "Each input can be chosen once.";
    const identifying = lookupSubject === "person"
      ? ["full-name", "first-name", "last-name", "linkedin-url", "email", "phone"]
      : ["company-name", "company-domain", "company-linkedin-url"];
    if (!roles.some(role => identifying.includes(role))) {
      return lookupSubject === "person"
        ? "Match on at least a name, LinkedIn URL, email or phone column."
        : "Match on at least a company name, website or LinkedIn URL column.";
    }
    if (lookupFields.length === 0) return lookupInfo ? "Tick at least one field to return." : "Fields could not be loaded. Is the backend running?";
    return "";
  };

  // Field labels become column names; a clash with the file or an earlier lookup gets a suffix.
  const lookupGeneratedFields = (fields: string[], taken: string[]) => {
    const used = new Set(taken);
    return fields.map(field => {
      const label = fieldLabel(lookupSubject, field);
      let name = used.has(label) ? `${label} (LeadOcean)` : label;
      for (let n = 2; used.has(name); n += 1) name = `${label} (LeadOcean ${n})`;
      used.add(name);
      return name;
    });
  };

  // An exact key costs one record. A searched person usually costs one page of candidates, plus one
  // enrichment when a ticked field is not on the search row; a row with no confident match climbs
  // through title, last-name and deeper searches before giving up.
  const lookupRecordsPerRow = () => {
    const roles = lookupBindings.map(binding => binding.role);
    const exact = roles.some(role => EXACT_LOOKUP_ROLES[lookupSubject].includes(role));
    const enrich = lookupSubject === "person" && lookupFields.some(field => !SEARCH_ROW_PERSON_FIELDS.includes(field)) ? 1 : 0;
    const companyFilters = roles.filter(role => role === "company-domain" || role === "company-name").length;
    const steps = lookupSubject === "company" || companyFilters === 0
      ? lookupCandidateLimit * (roles.includes("job-title") ? 2 : 1)
      : companyFilters * (lookupCandidateLimit * (roles.includes("job-title") ? 3 : 2) + (lookupInfo?.deepCandidateLimit ?? 10));
    return { exact, typical: exact ? 1 : lookupCandidateLimit + enrich, maximum: exact ? 1 : steps + enrich };
  };

  // Returns why the AI Writing instruction cannot run yet, or "" when it can.
  const writingProblem = () => {
    if (!question.trim()) return "Please type what to write for each row.";
    const columns = promptColumns(question);
    if (columns.length === 0) return "Insert at least one column, such as {First Name}, so each row gets its own text.";
    const unknown = columns.find(column => !headers.includes(column));
    if (unknown) return `{${unknown}} is not a column in this file.`;
    if (!writingModel) return "Choose a model.";
    return "";
  };

  const handleAddOperation = () => {
    if (opKind === AI_WRITING) {
      const problem = writingProblem() || (opOutput ? "" : "Please name the generated column.");
      if (problem) {
        setError(problem);
        return;
      }
    } else if (!opInput || !opOutput) {
      setError("Please specify an input field and a generated field name.");
      return;
    }
    if (opKind === AI_RESEARCH && !question.trim()) {
      setError("Please type the question to research for each company.");
      return;
    }
    setError("");
    setOperations(prev => [...prev, opKind === AI_RESEARCH
      ? aiResearchOperation(question, opInput, opOutput)
      : opKind === AI_WRITING
      ? aiWritingOperation(question, writingModel, opOutput)
      : {
          kind: opKind,
          input: { kind: 'source-field', field: opInput },
          generatedField: opOutput
        }]);
    setOpOutput("");
    setQuestion("");
    setPreviewAnswers([]);
  };

  const selectedIndexes = [...selected].sort((a, b) => a - b);
  const selectedRows = selectedIndexes.map(index => allData[index]);
  const isSelected = (rIdx: number) => selected.has(rIdx);
  const runOnSelected = runScope === "selected" && selected.size > 0;
  // Rows the job will process, which every cost estimate below is based on.
  const dataRowCount = runOnSelected ? selected.size : allData.length;
  // Estimates average the prompt over a sample; rendering all rows would be slow on big lists.
  const sampleRows = allData.slice(0, 50);

  const visibleColumns = headers.map((h, i) => ({ h, i })).filter(({ h }) => mappings[h] && mappings[h] !== 'do-not-import');
  const filterText = rowFilter.trim().toLowerCase();
  const filteredIndexes = allData
    .map((_, index) => index)
    .filter(index => !filterText || visibleColumns.some(({ i }) => (allData[index][i] ?? "").toLowerCase().includes(filterText)));
  const pageCount = Math.max(1, Math.ceil(filteredIndexes.length / ROWS_PER_PAGE));
  const currentPage = Math.min(tablePage, pageCount - 1);
  const pageIndexes = filteredIndexes.slice(currentPage * ROWS_PER_PAGE, (currentPage + 1) * ROWS_PER_PAGE);
  const allFilteredSelected = filteredIndexes.length > 0 && filteredIndexes.every(index => selected.has(index));

  const changeSelection = (next: Set<number>) => {
    setSelected(next);
    setRunScope(next.size > 0 ? "selected" : "all");
    setPreviewAnswers([]);
  };

  // Shift-click ticks every shown row between the last clicked row and this one.
  const toggleRow = (rIdx: number, shiftKey: boolean) => {
    const next = new Set(selected);
    if (shiftKey && selectionAnchor !== null) {
      const from = filteredIndexes.indexOf(selectionAnchor);
      const to = filteredIndexes.indexOf(rIdx);
      if (from >= 0 && to >= 0) {
        const select = !selected.has(rIdx);
        for (const index of filteredIndexes.slice(Math.min(from, to), Math.max(from, to) + 1)) {
          if (select) next.add(index); else next.delete(index);
        }
        setSelectionAnchor(rIdx);
        changeSelection(next);
        return;
      }
    }
    if (next.has(rIdx)) next.delete(rIdx); else next.add(rIdx);
    setSelectionAnchor(rIdx);
    changeSelection(next);
  };

  const toggleAllFiltered = () => {
    const next = new Set(selected);
    for (const index of filteredIndexes) {
      if (allFilteredSelected) next.delete(index); else next.add(index);
    }
    changeSelection(next);
  };
  const modelById = (id: string) => generationModels.find(model => model.id === id);
  // Which column names a previewed answer: the company for research, the first mapped column for writing.
  const previewLabelColumn = opKind === AI_WRITING
    ? headers.find(h => mappings[h] && mappings[h] !== 'do-not-import') ?? headers[0]
    : opInput;

  // Research identifies each company by the column mapped to Website, so mappings travel with previews too.
  const columnMappings = () => Object.entries(mappings)
    .filter(([_, prop]) => prop !== 'do-not-import')
    .map(([sourceField, canonicalDataType]) => ({ sourceField, canonicalDataType }));
  const hasWebsiteColumn = Object.values(mappings).includes("website");

  const handlePreview = async () => {
    if (opKind === AI_WRITING) {
      const problem = writingProblem();
      if (problem) {
        setError(problem);
        return;
      }
    } else if (!opInput || !question.trim()) {
      setError("Choose a company column and type a question first.");
      return;
    }
    if (selectedRows.length === 0) {
      setError("Tick at least one row in the table to preview.");
      return;
    }
    if (selectedRows.length > MAX_PREVIEW_ROWS) {
      setError(`Preview works on up to ${MAX_PREVIEW_ROWS} rows. Add the operation and use Start Processing to run it on all ${selectedRows.length} selected rows.`);
      return;
    }
    setError("");
    setPreviewAnswers([]);
    setPreviewing(true);
    try {
      const res = await fetch("/api/enrichment-jobs/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceList: { fileName, csv: `${csvLine(headers)}\n${selectedRows.map(csvLine).join("\n")}\n` },
          columnMappings: columnMappings(),
          configuredOperations: [opKind === AI_WRITING
            ? aiWritingOperation(question, writingModel, "answer")
            : aiResearchOperation(question, opInput, "answer")],
        }),
      });
      if (!res.ok) throw new Error(`Failed: ${await responseError(res)}`);
      const data = await res.json();
      const labelIndex = headers.indexOf(previewLabelColumn);
      setPreviewAnswers(selectedRows.map((row, i) => ({
        company: row[labelIndex] || "—",
        answer: data.rows?.[i]?.answer ?? "[Not Found]",
        row,
      })));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPreviewing(false);
    }
  };

  // Runs the lookup as a background job on just the matched columns, so History keeps only the
  // inputs and what LeadOcean returned; the results are then appended to this table.
  const handleRunLookup = async () => {
    const problem = lookupProblem();
    if (problem) {
      setError(problem);
      return;
    }
    const rowIndexes = runOnSelected ? selectedIndexes : allData.map((_, index) => index);
    if (rowIndexes.length === 0) {
      setError("The uploaded file contains no data rows.");
      return;
    }
    setError("");

    // "Row" ties each result back to its source row; it also keeps rows whose inputs are blank.
    const inputColumns = [...new Set(lookupBindings.map(binding => binding.column))];
    const rowColumn = inputColumns.includes("Row") ? "Source Row" : "Row";
    const jobHeaders = [rowColumn, ...inputColumns];
    const generatedFields = lookupGeneratedFields(lookupFields, [...jobHeaders, ...headers, ...resultColumns]);
    const csv = [
      csvLine(jobHeaders),
      ...rowIndexes.map(index => csvLine([String(index + 1), ...inputColumns.map(column => allData[index][headers.indexOf(column)] ?? "")])),
    ].join("\n") + "\n";
    const extensionIndex = fileName.lastIndexOf(".");
    const baseName = extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName;

    try {
      const res = await fetch("/api/enrichment-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceList: { fileName: `${baseName} - ${lookupSubject} lookup.csv`, csv },
          configuredOperations: leadLookupOperations(lookupSubject, lookupBindings, lookupFields, generatedFields, minimumMatchConfidence),
        }),
      });
      if (!res.ok) throw new Error(`Failed: ${await responseError(res)}`);
      const { jobId } = await res.json();
      setLookupRun({ jobId, completed: 0, total: rowIndexes.length * lookupFields.length, rows: rowIndexes.length });
      pollLookup(jobId, rowColumn, generatedFields);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const pollLookup = (jobId: string, rowColumn: string, generatedFields: string[]) => {
    const poll = async () => {
      try {
        const res = await fetch("/api/enrichment-jobs");
        const job = res.ok ? (await res.json()).jobs?.find((entry: any) => entry.id === jobId) : undefined;
        if (job?.status === "Failed") throw new Error("The lookup job failed. See History for details.");
        if (job?.status !== "Completed") {
          if (job?.progress) setLookupRun(run => run && { ...run, completed: job.progress.completed, total: job.progress.total });
          setTimeout(poll, POLL_MILLISECONDS);
          return;
        }
        const listRes = await fetch(`/api/enrichment-jobs/${encodeURIComponent(jobId)}/enriched-list`);
        if (!listRes.ok) throw new Error(`Failed to load results: ${await responseError(listRes)}`);
        const [enrichedHeaders, ...enrichedRows] = parseCsvText(await listRes.text());
        const rowIndex = enrichedHeaders.indexOf(rowColumn);
        const valueIndexes = generatedFields.map(field => enrichedHeaders.indexOf(field));
        const notesIndex = enrichedHeaders.indexOf("processing_errors");
        // Why a field came back [Not Found]; each run that has any gets its own notes column.
        let notesColumn = "Lookup Notes";
        for (let n = 2; [...headers, ...resultColumns, ...generatedFields].includes(notesColumn); n += 1) notesColumn = `Lookup Notes ${n}`;
        const appended = [...generatedFields, ...(notesIndex >= 0 ? [notesColumn] : [])];
        const previousCount = resultColumns.length;
        setResultsByRow(previous => {
          const next = { ...previous };
          for (const row of enrichedRows) {
            const sourceIndex = Number(row[rowIndex]) - 1;
            if (!Number.isInteger(sourceIndex) || sourceIndex < 0) continue;
            const existing = next[sourceIndex] ?? Array(previousCount).fill("");
            next[sourceIndex] = [...existing, ...valueIndexes.map(index => row[index] ?? ""), ...(notesIndex >= 0 ? [row[notesIndex] ?? ""] : [])];
          }
          return next;
        });
        setResultColumns(columns => [...columns, ...appended]);
        setLookupRun(null);
        const lookedUpRows = enrichedRows.map(row => Number(row[rowIndex]) - 1).filter(index => Number.isInteger(index) && index >= 0);
        if (lookedUpRows.length > 0) {
          const firstRow = Math.min(...lookedUpRows);
          // Show every row, on the page that holds the first result.
          setRowFilter("");
          setTablePage(Math.floor(firstRow / ROWS_PER_PAGE));
          setFreshRun({ columnStart: previousCount, firstRow });
        }
      } catch (err: any) {
        setError(err.message);
        setLookupRun(null);
      }
    };
    setTimeout(poll, POLL_MILLISECONDS);
  };

  const closeFieldPicker = useCallback(() => setFieldPickerOpen(false), []);

  // Bring the new results into view once they render, then let the highlight fade.
  useEffect(() => {
    if (!freshRun) return;
    setHighlightFresh(true);
    const frame = requestAnimationFrame(() =>
      freshCellRef.current?.scrollIntoView({ behavior: "smooth", block: "center", inline: "start" }));
    const timer = setTimeout(() => setHighlightFresh(false), 2500);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [freshRun]);

  const isFreshColumn = (column: number) => highlightFresh && freshRun !== null && column >= freshRun.columnStart;

  // The whole uploaded file with every appended lookup column; rows not looked up are left blank.
  const handleDownloadResults = () => {
    const csv = [
      csvLine([...headers, ...resultColumns]),
      ...allData.map((row, index) => csvLine([...row, ...resultColumns.map((_, column) => resultsByRow[index]?.[column] ?? "")])),
    ].join("\n") + "\n";
    const extensionIndex = fileName.lastIndexOf(".");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = extensionIndex > 0 ? `${fileName.slice(0, extensionIndex)}_enriched${fileName.slice(extensionIndex)}` : `${fileName}_enriched.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Saves the answers as a History entry named after the uploaded file; the question becomes the answer column.
  // A writing instruction is long and full of {Column}s, so its column uses the Generated Column name instead.
  const handleSavePreview = async () => {
    const answerName = opKind === AI_WRITING ? (opOutput.trim() || "AI Writing") : question.trim();
    const answerField = headers.includes(answerName) ? `${answerName} (AI)` : answerName;
    const csv = [
      csvLine([...headers, answerField]),
      ...previewAnswers.map(p => csvLine([...p.row, p.answer])),
    ].join("\n") + "\n";
    setError("");
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/enrichment-jobs/previews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, csv }),
      });
      if (!res.ok) throw new Error(`Failed to save: ${await responseError(res)}`);
      setSaveStatus("saved");
    } catch (err: any) {
      setError(err.message);
      setSaveStatus("idle");
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    const finalMappings = columnMappings();

    if (finalMappings.length === 0 && operations.length === 0) {
      setError("Please map at least one column or configure at least one operation to create a job.");
      setLoading(false);
      return;
    }

    if (allData.length === 0) {
      setError("The uploaded file contains no data rows.");
      setLoading(false);
      return;
    }

    // A job on selected rows gets a list of just those rows, in file order, named so History shows it.
    const extensionIndex = fileName.lastIndexOf(".");
    const jobFileName = !runOnSelected
      ? fileName
      : extensionIndex > 0
      ? `${fileName.slice(0, extensionIndex)} (${selected.size} selected rows)${fileName.slice(extensionIndex)}`
      : `${fileName} (${selected.size} selected rows)`;
    const jobCsv = runOnSelected
      ? `${csvLine(headers)}\n${selectedRows.map(csvLine).join("\n")}\n`
      : csvContent;

    try {
      const res = await fetch("/api/enrichment-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceList: {
            fileName: jobFileName,
            csv: jobCsv
          },
          columnMappings: finalMappings,
          configuredOperations: operations
        }),
      });
      
      if (!res.ok) {
        throw new Error(`Failed: ${(await responseError(res)) || "Failed to create job"}`);
      }

      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-white p-8 w-full">
      <FieldPickerModal
        open={fieldPickerOpen}
        subject={lookupSubject}
        fields={lookupCatalogue}
        initial={lookupMode === "custom" ? customLookupFields : defaultLookupFields}
        onApply={fields => { setCustomLookupFields(fields); setLookupMode("custom"); setFieldPickerOpen(false); }}
        onClose={closeFieldPicker}
      />
      {step === 1 && (
        <div className="max-w-2xl mx-auto w-full mt-10">
          <Link href="/dashboard" className="text-gray-500 hover:text-black text-sm flex items-center mb-6">
            &larr; Back to history
          </Link>
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload your list</h1>
            <p className="text-gray-500">Upload a CSV file containing your contacts or companies to enrich.</p>
          </div>

          <div className="border-2 border-dashed border-gray-200 rounded-xl p-16 flex flex-col items-center justify-center text-center hover:bg-gray-50 transition-colors cursor-pointer relative">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <ArrowRight className="w-8 h-8 text-gray-400 rotate-90" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Click to upload or drag and drop</h3>
            <p className="text-sm text-gray-500 mb-6">CSV file format only</p>
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleFileChange} 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <button className="bg-white border border-gray-200 text-gray-700 px-6 py-2 rounded-lg font-medium shadow-sm hover:bg-gray-50 pointer-events-none">
              Browse files
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="max-w-4xl mx-auto w-full">
          <div className="text-center mb-10 mt-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Map columns</h1>
            <p className="text-gray-500">Map columns from your file to workspace properties.</p>
          </div>

          {error && <div className="text-red-500 bg-red-50 p-4 rounded-lg text-sm mb-6 text-center font-medium border border-red-100">{error}</div>}

          <div className="grid grid-cols-[1fr_auto_1fr] gap-6 mb-4 px-4 items-center">
            <div className="font-semibold text-gray-900">Columns</div>
            <div className="w-12"></div>
            <div className="font-semibold text-gray-900">Properties</div>
          </div>

          <div className="flex flex-col gap-4">
            {headers.map((header, idx) => {
              const mapping = mappings[header] || 'do-not-import';
              const isIgnored = mapping === 'do-not-import';
              
              return (
                <div key={idx} className="grid grid-cols-[1fr_auto_1fr] gap-6 items-center px-4">
                  <div className="flex flex-col overflow-hidden">
                    <span className="font-bold text-gray-900 truncate">{header}</span>
                    <span className="text-sm text-gray-500 truncate" title={sampleData[idx] || "No data"}>
                      {sampleData[idx] || <span className="italic text-gray-400">Empty</span>}
                    </span>
                  </div>
                  <div className="flex justify-center w-12">
                    {isIgnored ? (
                      <div className="flex items-center gap-1">
                        <div className="h-[2px] w-4 bg-gray-300"></div>
                        <X className="w-5 h-5 text-gray-400 p-0.5 rounded-full border border-gray-300" />
                      </div>
                    ) : (
                      <ArrowRight className="w-6 h-6 text-emerald-500" />
                    )}
                  </div>
                  <div>
                    <div className="relative">
                      <select 
                        value={mapping}
                        onChange={(e) => handleMappingChange(header, e.target.value)}
                        className={`w-full appearance-none bg-white border ${isIgnored ? 'border-gray-200 text-gray-500' : 'border-gray-200 text-gray-900 shadow-sm'} rounded-xl py-3 pl-12 pr-10 outline-none focus:border-black focus:ring-1 focus:ring-black cursor-pointer font-medium`}
                      >
                        {PROPERTY_OPTIONS.map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                      </select>
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                        {PROPERTY_OPTIONS.find(o => o.id === mapping)?.icon}
                      </div>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                        <X className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-16 mb-8 flex justify-center gap-4">
            <button 
              onClick={() => setStep(1)}
              className="px-8 py-3 bg-white border border-gray-200 text-gray-900 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
            >
              Previous step
            </button>
            <button 
              onClick={handleContinue}
              className="px-8 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col flex-1 w-full">
          {/* Main Layout: Table on left, Sidebar on right */}
          <div className="flex gap-6 flex-1 min-h-[500px]">
             {/* Left Table */}
             <div className="flex-1 bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col shadow-sm">
                <div className="p-5 border-b border-gray-200 flex flex-wrap gap-3 justify-between items-center bg-gray-50/50">
                   <h2 className="font-bold text-gray-900 flex items-center gap-2">
                     <LayoutGrid className="w-5 h-5 text-gray-400" />
                     Contacts
                     <span className="text-gray-500 font-normal text-sm ml-1">{allData.length.toLocaleString()}</span>
                     {selected.size > 0 && (
                       <span className="ml-2 text-xs font-semibold bg-violet-100 text-violet-800 px-2 py-1 rounded-full flex items-center gap-1.5">
                         {selected.size.toLocaleString()} selected
                         <button type="button" onClick={() => changeSelection(new Set())} className="hover:text-violet-950" title="Clear selection">
                           <X className="w-3 h-3" />
                         </button>
                       </span>
                     )}
                   </h2>
                   <input
                     value={rowFilter}
                     onChange={e => { setRowFilter(e.target.value); setTablePage(0); }}
                     placeholder="Search rows..."
                     className="w-56 bg-white border border-gray-200 rounded-lg py-1.5 px-3 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black"
                   />
                </div>
                <div className="overflow-auto flex-1 p-0 relative">
                  <table className="w-full text-sm text-left whitespace-nowrap min-w-full">
                     <thead className="bg-white border-b border-gray-200 text-gray-600 font-medium sticky top-0 z-10 shadow-sm">
                        <tr>
                           <th className="p-4 w-10 text-center">
                              <input
                                type="checkbox"
                                checked={allFilteredSelected}
                                onChange={toggleAllFiltered}
                                title={filterText ? "Select all matching rows" : "Select all rows"}
                                className="cursor-pointer accent-violet-600"
                              />
                           </th>
                           <th className="p-4 w-12 text-center text-gray-400">#</th>
                           {visibleColumns.map(({ h, i }) => (
                              <th key={i} className="p-4 font-semibold text-gray-700 whitespace-nowrap">
                                 <div className="flex items-center gap-2">
                                    {PROPERTY_OPTIONS.find(o => o.id === mappings[h])?.icon}
                                    {PROPERTY_OPTIONS.find(o => o.id === mappings[h])?.label}
                                 </div>
                              </th>
                           ))}
                           {resultColumns.map((column, c) => (
                              <th key={`result-${column}`} className={`p-4 font-semibold text-emerald-800 whitespace-nowrap transition-colors duration-700 ${isFreshColumn(c) ? "bg-emerald-200" : "bg-emerald-50"}`}>
                                 <div className="flex items-center gap-2"><Search className="w-3.5 h-3.5" />{column}</div>
                              </th>
                           ))}
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100">
                        {pageIndexes.map(rIdx => (
                           <tr
                              key={rIdx}
                              onClick={e => toggleRow(rIdx, e.shiftKey)}
                              className={`cursor-pointer select-none transition-colors ${isSelected(rIdx) ? "bg-violet-50 hover:bg-violet-50" : "hover:bg-gray-50"}`}
                           >
                              <td className="p-4 text-center">
                                 <input type="checkbox" checked={isSelected(rIdx)} readOnly className="pointer-events-none accent-violet-600" />
                              </td>
                              <td className="p-4 text-center text-gray-400 text-xs">{rIdx + 1}</td>
                              {visibleColumns.map(({ i }) => (
                                 <td key={i} className="p-4 truncate max-w-[200px] text-gray-600" title={allData[rIdx][i]}>{allData[rIdx][i]}</td>
                              ))}
                              {resultColumns.map((column, c) => {
                                 const value = resultsByRow[rIdx]?.[c] ?? "";
                                 return (
                                   <td
                                     key={`result-${column}`}
                                     ref={freshRun && rIdx === freshRun.firstRow && c === freshRun.columnStart ? freshCellRef : undefined}
                                     className={`p-4 truncate max-w-[220px] transition-colors duration-700 ${isFreshColumn(c) && resultsByRow[rIdx] ? "bg-emerald-100" : "bg-emerald-50/40"} ${value === "[Not Found]" ? "text-gray-400" : "text-gray-900"}`}
                                     title={value}
                                   >{value}</td>
                                 );
                              })}
                           </tr>
                        ))}
                        {pageIndexes.length === 0 && (
                           <tr><td colSpan={visibleColumns.length + resultColumns.length + 2} className="p-8 text-center text-gray-400">No rows match "{rowFilter}".</td></tr>
                        )}
                     </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500">
                  <span>Click rows to select them · Shift-click to select a range</span>
                  {pageCount > 1 && (
                    <div className="flex items-center gap-2">
                      <button type="button" disabled={currentPage === 0} onClick={() => setTablePage(currentPage - 1)} className="px-2 py-1 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Previous</button>
                      <span>Page {currentPage + 1} of {pageCount}</span>
                      <button type="button" disabled={currentPage >= pageCount - 1} onClick={() => setTablePage(currentPage + 1)} className="px-2 py-1 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
                    </div>
                  )}
                </div>
             </div>

             {/* Right Sidebar */}
             <div className="w-[340px] bg-white border border-gray-200 rounded-2xl p-6 flex flex-col shadow-sm">
                <h3 className="font-bold text-gray-900 mb-6 text-lg">Processing Options</h3>
                
                {error && <div className="text-red-500 bg-red-50 p-3 rounded-lg text-sm mb-4 border border-red-100">{error}</div>}

                <div className="flex flex-col gap-5 flex-1 overflow-auto pr-2">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-gray-700">Operation</label>
                    <select
                      value={opKind}
                      onChange={e => chooseOperationKind(e.target.value)}
                      className="w-full appearance-none bg-white border border-gray-200 rounded-xl py-2.5 px-4 outline-none focus:border-black focus:ring-1 focus:ring-black cursor-pointer font-medium text-gray-900"
                    >
                       <option value={LEAD_LOOKUP}>Find Person / Company (LeadOcean)</option>
                       <option value={AI_RESEARCH}>AI Research (Google search)</option>
                       <option value={AI_WRITING}>AI Writing (from row data, e.g. ice breakers)</option>
                       <option value="clean-company-name">Clean Company Name</option>
                       <option value="clean-first-name">Clean First Name</option>
                       <option value="format-website">Format Website</option>
                       <option value="extract-domain-from-email">Extract Domain from Email</option>
                       <option value="capitalize-job-titles">Capitalize Job Titles</option>
                    </select>
                  </div>
                  {opKind === AI_RESEARCH && !hasWebsiteColumn && (
                    <div className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-3">
                      No column is mapped to <span className="font-semibold">Website</span>. Research works better with one: it tells companies with the same name apart and reuses earlier research about the same company.
                    </div>
                  )}
                  {opKind === LEAD_LOOKUP && (
                    <div className="flex flex-col gap-4">
                      {lookupInfo && !lookupInfo.available && (
                        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-3">
                          LeadOcean is not connected on the server. Set <span className="font-mono">LEADOCEAN_API_KEY</span> in the backend .env and restart it; until then every lookup returns [Not Found].
                        </div>
                      )}
                      <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-xl text-sm font-semibold">
                        {(["person", "company"] as const).map(subject => (
                          <button
                            key={subject}
                            type="button"
                            onClick={() => chooseLookupSubject(subject)}
                            className={`py-1.5 rounded-lg transition-colors ${lookupSubject === subject ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"}`}
                          >
                            {subject === "person" ? "Find a person" : "Find a company"}
                          </button>
                        ))}
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-gray-700">Match on these columns</label>
                        {lookupBindings.length === 0 && (
                          <div className="text-xs text-gray-500 italic">No columns yet. Add one, two or more: the more each row gives, the closer the match.</div>
                        )}
                        {lookupBindings.map((binding, index) => (
                          <div key={index} className="flex items-center gap-1.5">
                            <select
                              value={binding.role}
                              onChange={e => updateLookupBinding(index, { role: e.target.value })}
                              className="w-[42%] bg-white border border-gray-200 rounded-lg py-1.5 px-2 text-xs font-medium text-gray-900 outline-none focus:border-black"
                              title="What this column holds"
                            >
                              {lookupRoles.map(role => (
                                <option key={role} value={role} disabled={role !== binding.role && lookupBindings.some(other => other.role === role)}>
                                  {LOOKUP_ROLE_LABELS[role] ?? role}
                                </option>
                              ))}
                            </select>
                            <ArrowRight className="w-3 h-3 text-gray-300 rotate-180 shrink-0" />
                            <select
                              value={binding.column}
                              onChange={e => updateLookupBinding(index, { column: e.target.value })}
                              className="flex-1 min-w-0 bg-white border border-gray-200 rounded-lg py-1.5 px-2 text-xs font-medium text-gray-900 outline-none focus:border-black"
                              title="Column in your file"
                            >
                              {headers.map(header => <option key={header} value={header}>{header}</option>)}
                            </select>
                            <button
                              type="button"
                              onClick={() => setLookupBindings(bindings => bindings.filter((_, i) => i !== index))}
                              className="p-1 text-gray-400 hover:text-red-500 rounded"
                              title="Remove"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        {lookupBindings.length < lookupRoles.length && (
                          <button type="button" onClick={addLookupBinding} className="self-start flex items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-900">
                            <Plus className="w-3.5 h-3.5" /> Add column
                          </button>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-gray-700">Return these fields</label>
                        <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-xl text-sm font-semibold">
                          <button
                            type="button"
                            onClick={() => setLookupMode("default")}
                            className={`py-1.5 rounded-lg transition-colors ${lookupMode === "default" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"}`}
                          >
                            Default
                          </button>
                          <button
                            type="button"
                            onClick={() => setFieldPickerOpen(true)}
                            className={`py-1.5 rounded-lg transition-colors ${lookupMode === "custom" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"}`}
                          >
                            Custom{lookupMode === "custom" ? ` (${customLookupFields.length})` : ""}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {!lookupInfo && ["w-16", "w-20", "w-14", "w-24", "w-[4.5rem]"].map(width => <Skeleton key={width} className={`h-5 ${width}`} />)}
                          {lookupFields.map(field => (
                            <span key={field} className="text-[11px] bg-violet-50 text-violet-800 border border-violet-100 px-1.5 py-0.5 rounded-md">{fieldLabel(lookupSubject, field)}</span>
                          ))}
                          {lookupMode === "custom" && (
                            <button type="button" onClick={() => setFieldPickerOpen(true)} className="text-[11px] font-semibold text-violet-700 hover:text-violet-900 px-1">Edit</button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-gray-700">Match strictness</label>
                        <div className="grid grid-cols-3 p-1 bg-gray-100 rounded-xl text-sm font-semibold">
                          {MATCH_STRICTNESS.map(option => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setMatchStrictness(option.id)}
                              className={`py-1.5 rounded-lg transition-colors ${matchStrictness === option.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"}`}
                            >
                              {option.label}
                              <span className="ml-1 text-[11px] font-medium text-gray-400">{Math.round((option.confidence ?? defaultMatchConfidence) * 100)}%</span>
                            </button>
                          ))}
                        </div>
                        <div className="text-xs text-gray-500">
                          Rows whose closest match scores under <span className="font-semibold text-gray-700">{Math.round(minimumMatchConfidence * 100)}%</span> get [Not Found].{" "}
                          {MATCH_STRICTNESS.find(option => option.id === matchStrictness)?.effect}
                        </div>
                      </div>

                      {(() => {
                        const { exact, typical, maximum } = lookupRecordsPerRow();
                        return (
                          <div className="text-xs text-gray-500">
                            {exact
                              ? <>Rows with {lookupSubject === "person" ? "a LinkedIn URL, email or phone" : "a website or LinkedIn URL"} are looked up exactly: <span className="font-semibold text-gray-700">about 1 LeadOcean record</span> each.</>
                              : <>Each row is searched and the closest candidate is kept: <span className="font-semibold text-gray-700">about {typical} LeadOcean records</span> per row, up to {maximum} for rows that need a deeper search.</>}
                            {" "}Repeated rows are looked up once.
                          </div>
                        );
                      })()}

                      {lookupRun ? (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2 text-sm font-semibold text-violet-800">
                            <div className="w-3.5 h-3.5 border-2 border-violet-300 border-t-violet-700 rounded-full animate-spin"></div>
                            {lookupRun.completed === 0
                              ? "Starting lookup…"
                              : `Looked up ${Math.min(lookupRun.rows, Math.floor(lookupRun.completed / Math.max(1, lookupRun.total / lookupRun.rows)))} of ${lookupRun.rows.toLocaleString()} rows`}
                          </div>
                          <div className="h-1.5 bg-violet-100 rounded-full overflow-hidden">
                            <div className="h-full bg-violet-600 transition-all duration-500" style={{ width: `${lookupRun.total > 0 ? lookupRun.completed / lookupRun.total * 100 : 0}%` }} />
                          </div>
                          <div className="text-xs text-gray-500">Runs in the background; results appear in the table when it finishes.</div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleRunLookup}
                          className="flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
                        >
                          <Search className="w-4 h-4" />
                          {runOnSelected
                            ? `Find & append for ${selected.size.toLocaleString()} selected row${selected.size === 1 ? "" : "s"}`
                            : `Find & append for all ${allData.length.toLocaleString()} rows`}
                        </button>
                      )}
                      <div className="text-xs text-gray-500">
                        {selected.size === 0
                          ? <>Tick rows in the table to look up only those.</>
                          : <>Use “Run on” below to switch between selected and all rows.</>}
                      </div>

                      {resultColumns.length > 0 && (
                        <div className="flex flex-col gap-2 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                          <div className="text-xs text-emerald-900">
                            <span className="font-semibold">{resultColumns.length} column{resultColumns.length === 1 ? "" : "s"} appended</span> to the table.
                            Saved to <Link href="/dashboard" className="underline font-semibold">History</Link> with just your input columns and the results.
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => freshRun && setFreshRun({ ...freshRun })}
                              className="bg-white border border-emerald-200 hover:bg-emerald-100 text-emerald-900 rounded-lg py-2 text-sm font-semibold transition-colors"
                            >
                              Show results
                            </button>
                            <button
                              type="button"
                              onClick={handleDownloadResults}
                              className="bg-white border border-emerald-200 hover:bg-emerald-100 text-emerald-900 rounded-lg py-2 text-sm font-semibold transition-colors"
                            >
                              Download CSV
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {opKind !== AI_WRITING && opKind !== LEAD_LOOKUP && (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-gray-700">{opKind === AI_RESEARCH ? "Company Column" : "Input Column"}</label>
                    <select 
                      value={opInput}
                      onChange={e => setOpInput(e.target.value)}
                      className="w-full appearance-none bg-white border border-gray-200 rounded-xl py-2.5 px-4 outline-none focus:border-black focus:ring-1 focus:ring-black cursor-pointer font-medium text-gray-900"
                    >
                       {headers.map((h, i) => mappings[h] && mappings[h] !== 'do-not-import' && (
                          <option key={i} value={h}>{h}</option>
                       ))}
                    </select>
                  </div>
                  )}
                  {isAiOperation && (
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-semibold text-gray-700">{opKind === AI_WRITING ? "What to write" : "Question"}</label>
                      <textarea
                        value={question}
                        onChange={e => { setQuestion(e.target.value); setPreviewAnswers([]); }}
                        rows={opKind === AI_WRITING ? 4 : 2}
                        className="w-full bg-white border border-gray-200 rounded-xl py-2.5 px-4 outline-none focus:border-black focus:ring-1 focus:ring-black font-medium text-gray-900 resize-none"
                        placeholder={opKind === AI_WRITING
                          ? "e.g. Write a one-sentence cold email ice breaker for {First Name}, {Job Title} at {Company Name}."
                          : "e.g. What was the last funding they got?"}
                      />
                      {opKind === AI_WRITING && (
                        <>
                          <div className="flex flex-wrap gap-1.5">
                            {headers.filter(h => mappings[h] && mappings[h] !== 'do-not-import').map(h => (
                              <button
                                key={h}
                                type="button"
                                onClick={() => { setQuestion(q => `${q}${q && !q.endsWith(" ") ? " " : ""}{${h}}`); setPreviewAnswers([]); }}
                                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-lg font-medium"
                              >
                                {`{${h}}`}
                              </button>
                            ))}
                          </div>
                          <label className="text-sm font-semibold text-gray-700 mt-2">Model</label>
                          {generationModels.length === 0 ? (
                            <div className="text-xs text-red-500">Models could not be loaded. Is the backend running?</div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {generationModels.map(model => {
                                const perRow = estimatedWritingDollarsPerRow(model, question, headers, sampleRows);
                                const allRows = perRow * dataRowCount;
                                return (
                                  <button
                                    key={model.id}
                                    type="button"
                                    onClick={() => { setWritingModel(model.id); setPreviewAnswers([]); }}
                                    className={`text-left border rounded-xl p-3 transition-colors ${writingModel === model.id ? "border-violet-400 bg-violet-50" : "border-gray-200 hover:bg-gray-50"}`}
                                  >
                                    <div className="text-sm font-semibold text-gray-900">{model.label}</div>
                                    <div className="text-xs text-gray-600 mt-0.5">{model.description}</div>
                                    <div className="text-xs text-gray-500 mt-1.5">
                                      1 row {formatDollars(perRow)} · 10 rows {formatDollars(perRow * 10)} ·{" "}
                                      <span className={allRows > 4 ? "font-semibold text-amber-700" : "font-semibold text-gray-700"}>
                                        {runOnSelected ? "selected" : "all"} {dataRowCount.toLocaleString()} rows ≈ {formatDollars(allRows)}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                              <div className="text-xs text-gray-400">Estimates from OpenAI list prices; real cost depends on answer length.</div>
                            </div>
                          )}
                        </>
                      )}
                      <button
                        type="button"
                        onClick={handlePreview}
                        disabled={previewing || !question.trim() || (opKind === AI_RESEARCH && !opInput) || selectedRows.length === 0 || selectedRows.length > MAX_PREVIEW_ROWS}
                        className="flex items-center justify-center gap-2 border border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100 rounded-xl py-2 text-sm font-semibold transition-colors disabled:opacity-50"
                      >
                        {previewing ? (
                          <><div className="w-3.5 h-3.5 border-2 border-violet-300 border-t-violet-700 rounded-full animate-spin"></div>{opKind === AI_WRITING ? "Writing..." : "Researching..."}</>
                        ) : opKind === AI_WRITING ? (
                          <><Sparkles className="w-4 h-4" />{selectedRows.length > 1 ? `Write for selected ${selectedRows.length} rows` : "Write for selected row"}</>
                        ) : (
                          <><Sparkles className="w-4 h-4" />{selectedRows.length > 1 ? `Ask on selected ${selectedRows.length} rows` : "Ask on selected row"}</>
                        )}
                      </button>
                      <div className="text-xs text-gray-500">
                        {selectedRows.length === 0 ? (
                          <>Tick rows in the table to preview on them (up to {MAX_PREVIEW_ROWS}).</>
                        ) : selectedRows.length > MAX_PREVIEW_ROWS ? (
                          <>{selectedRows.length} rows selected. Preview takes up to {MAX_PREVIEW_ROWS}; add the operation and Start Processing runs it on all selected rows.</>
                        ) : selectedRows.length === 1 ? (
                          <>Row {selectedIndexes[0] + 1}: <span className="font-semibold text-gray-700">{selectedRows[0]?.[headers.indexOf(previewLabelColumn)] || "—"}</span></>
                        ) : (
                          <>Rows {selectedIndexes.slice(0, 6).map(index => index + 1).join(", ")}{selectedIndexes.length > 6 ? ", …" : ""}</>
                        )}
                      </div>
                      {previewAnswers.length > 0 && (
                        <div className="flex flex-col gap-2">
                          {previewAnswers.map((p, i) => (
                            <div key={i} className="text-sm bg-emerald-50 border border-emerald-100 text-emerald-900 rounded-xl p-3 font-medium">
                              {previewAnswers.length > 1 && <div className="text-xs font-semibold text-emerald-700 mb-1">{p.company}</div>}
                              {p.answer}
                            </div>
                          ))}
                          {saveStatus === "saved" ? (
                            <div className="flex items-center justify-center gap-1.5 text-sm font-semibold text-emerald-700 py-2">
                              Saved to History as {fileName}
                              <Link href="/dashboard" className="underline">View</Link>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={handleSavePreview}
                              disabled={saveStatus === "saving"}
                              className="border border-gray-200 bg-white hover:bg-gray-50 text-gray-900 rounded-xl py-2 text-sm font-semibold transition-colors disabled:opacity-50"
                            >
                              {saveStatus === "saving" ? "Saving..." : "Save results to History"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {opKind !== LEAD_LOOKUP && (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-gray-700">Generated Column</label>
                    <input 
                      type="text" 
                      value={opOutput}
                      onChange={e => setOpOutput(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl py-2.5 px-4 outline-none focus:border-black focus:ring-1 focus:ring-black font-medium text-gray-900" 
                      placeholder={opKind === AI_WRITING ? "e.g. Ice Breaker" : "e.g. Cleaned Name"}
                    />
                  </div>
                  )}
                  {opKind !== LEAD_LOOKUP && (
                  <button
                     className="bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-xl py-2.5 font-semibold transition-colors mt-2"
                     onClick={handleAddOperation}
                  >
                     Add Operation
                  </button>
                  )}

                  <hr className="my-4 border-gray-200" />
                  
                  <div className="flex flex-col gap-3">
                    <div className="font-semibold text-gray-900 flex justify-between items-center">
                      Configured Operations
                      <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">{operations.length}</span>
                    </div>
                    {operations.length === 0 && <div className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded-xl text-center border border-dashed border-gray-200">No operations added.</div>}
                    {operations.map((op, i) => (
                       <div key={i} className="text-sm bg-white border border-gray-200 p-3 rounded-xl flex justify-between items-start shadow-sm group">
                          <div className="flex flex-col gap-1 pr-2">
                            <span className="font-bold text-gray-900">{op.kind === "custom-operation" ? op.name : op.kind.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</span>
                            {op.kind === "custom-operation" && (
                              <span className="text-gray-600 text-xs">{op.generationModel ? op.promptTemplate : op.promptTemplate.split("\nQuestion: ")[1]}</span>
                            )}
                            {op.generationModel && (
                              <span className="text-violet-700 text-xs font-medium">
                                {modelById(op.generationModel)?.label ?? op.generationModel}
                              </span>
                            )}
                            <span className="text-gray-500 text-xs flex flex-wrap gap-1 items-center">
                              {(op.kind === "custom-operation" ? op.inputBindings.map((binding: any) => binding.input.field) : [op.input.field]).map((field: string) => (
                                <span key={field} className="bg-gray-100 px-1.5 py-0.5 rounded">{field}</span>
                              ))}
                              <ArrowRight className="w-3 h-3 text-gray-400" /> 
                              <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">{op.generatedField}</span>
                            </span>
                          </div>
                          <button 
                            onClick={() => setOperations(ops => ops.filter((_, idx) => idx !== i))}
                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <X className="w-4 h-4"/>
                          </button>
                       </div>
                    ))}
                  </div>
                </div>
                
                <div className="mt-6 pt-6 border-t border-gray-200">
                  {operations.some(op => op.kind === "custom-operation" && !op.generationModel) && (
                    <p className="text-xs text-gray-500 mb-3">
                      AI Research answers{" "}
                      <span className="font-semibold text-gray-700">
                        up to {(dataRowCount * operations.filter(op => op.kind === "custom-operation" && !op.generationModel).length).toLocaleString()} questions
                      </span>{" "}
                      from earlier research and free pool searches first, then paid search (about $0.001 each). A job never spends more than $3.50; rows past that get [Not Found]. Repeated companies are researched once.{" "}
                      <Link href="/dashboard/research-keys" className="underline">Research Keys</Link>
                    </p>
                  )}
                  {operations.some(op => op.kind === LEAD_LOOKUP) && (
                    <p className="text-xs text-gray-500 mb-3">
                      Lookups use LeadOcean records, not dollars. One search per row serves every field of the same lookup; rows whose closest match is too far from the input get [Not Found] with the reason.
                    </p>
                  )}
                  {operations.some(op => op.generationModel) && (() => {
                    const writingTotal = operations
                      .filter(op => op.generationModel)
                      .reduce((total, op) => {
                        const model = modelById(op.generationModel);
                        return model ? total + estimatedWritingDollarsPerRow(model, op.promptTemplate, headers, sampleRows) * dataRowCount : total;
                      }, 0);
                    return (
                      <p className="text-xs text-gray-500 mb-3">
                        AI Writing on {runOnSelected ? "the selected" : "all"} {dataRowCount.toLocaleString()} rows:{" "}
                        <span className={writingTotal > 4 ? "font-semibold text-amber-700" : "font-semibold text-gray-700"}>
                          about {formatDollars(writingTotal)}
                        </span>. No web searches.
                      </p>
                    );
                  })()}
                  {selected.size > 0 && (
                    <div className="mb-3">
                      <div className="text-xs font-semibold text-gray-700 mb-1.5">Run on</div>
                      <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-xl text-sm font-semibold">
                        {(["selected", "all"] as const).map(scope => (
                          <button
                            key={scope}
                            type="button"
                            onClick={() => setRunScope(scope)}
                            className={`py-1.5 rounded-lg transition-colors ${runScope === scope ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"}`}
                          >
                            {scope === "selected" ? `Selected (${selected.size.toLocaleString()})` : `All (${allData.length.toLocaleString()})`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => setStep(2)}
                    disabled={loading}
                    className="w-full mb-3 bg-white border border-gray-200 text-gray-900 rounded-xl py-3 font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Back to mapping
                  </button>
                  <button 
                     onClick={handleSubmit}
                     disabled={loading}
                     className="w-full bg-black hover:bg-gray-900 text-white rounded-xl py-3 font-semibold transition-colors shadow-lg shadow-black/10 disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                     {loading ? (
                       <>
                         <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                         Creating Job...
                       </>
                     ) : runOnSelected ? (
                       `Start Processing on ${selected.size.toLocaleString()} selected row${selected.size === 1 ? "" : "s"}`
                     ) : (
                       "Start Processing"
                     )}
                  </button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Every field LeadOcean can return, grouped, with a tick box each. Fades and scales in; on close
// it plays the same transition backwards before unmounting.
function FieldPickerModal({ open, subject, fields, initial, onApply, onClose }: {
  open: boolean;
  subject: LookupSubject;
  fields: LookupField[];
  initial: string[];
  onApply: (fields: string[]) => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState<string[]>(initial);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (open) {
      setMounted(true);
      setDraft(initial);
      setFilter("");
      const frame = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(frame);
    }
    setVisible(false);
    const timer = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  const filterText = filter.trim().toLowerCase();
  const shown = fields.filter(field => !filterText || field.label.toLowerCase().includes(filterText) || field.group.toLowerCase().includes(filterText));
  const groups = [...new Set(shown.map(field => field.group))];
  const toggle = (id: string) => setDraft(current => current.includes(id) ? current.filter(f => f !== id) : [...current, id]);
  // Kept in catalogue order, so columns come out grouped the same way the list shows them.
  const ordered = (ids: string[]) => fields.map(field => field.id).filter(id => ids.includes(id));

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-colors duration-200 ${visible ? "bg-black/40 backdrop-blur-[2px]" : "bg-black/0"}`}
      onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose fields"
        className={`bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col transition-all duration-200 ease-out ${visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-2"}`}
      >
        <div className="p-5 border-b border-gray-200 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Choose {subject === "person" ? "person" : "company"} fields</h3>
            <p className="text-sm text-gray-500">Each ticked field becomes a new column next to your data.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 pt-4 flex flex-wrap items-center gap-2">
          <input
            value={filter}
            onChange={event => setFilter(event.target.value)}
            placeholder="Search fields..."
            className="flex-1 min-w-[12rem] bg-white border border-gray-200 rounded-lg py-1.5 px-3 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black"
          />
          <button type="button" onClick={() => setDraft(fields.map(field => field.id))} className="text-xs font-semibold text-violet-700 hover:text-violet-900 px-2">Select all</button>
          <button type="button" onClick={() => setDraft(fields.filter(field => field.isDefault).map(field => field.id))} className="text-xs font-semibold text-violet-700 hover:text-violet-900 px-2">Defaults</button>
          <button type="button" onClick={() => setDraft([])} className="text-xs font-semibold text-gray-500 hover:text-gray-900 px-2">Clear</button>
        </div>
        <div className="overflow-auto p-5 grid gap-5 sm:grid-cols-2">
          {groups.map(group => {
            const groupFields = shown.filter(field => field.group === group);
            const allTicked = groupFields.every(field => draft.includes(field.id));
            return (
              <div key={group} className="border border-gray-200 rounded-xl p-3">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allTicked}
                    onChange={() => setDraft(current => allTicked
                      ? current.filter(id => !groupFields.some(field => field.id === id))
                      : [...new Set([...current, ...groupFields.map(field => field.id)])])}
                    className="accent-violet-600"
                  />
                  {group}
                </label>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {groupFields.map(field => (
                    <label key={field.id} className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={draft.includes(field.id)} onChange={() => toggle(field.id)} className="accent-violet-600" />
                      {field.label}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
          {groups.length === 0 && <div className="text-sm text-gray-400">No fields match "{filter}".</div>}
        </div>
        <div className="p-5 border-t border-gray-200 flex items-center justify-between gap-3">
          <span className="text-sm text-gray-500">{draft.length} field{draft.length === 1 ? "" : "s"} selected</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-200 text-gray-900 rounded-xl text-sm font-semibold hover:bg-gray-50">Cancel</button>
            <button
              type="button"
              disabled={draft.length === 0}
              onClick={() => onApply(ordered(draft))}
              className="px-4 py-2 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-40"
            >
              Use {draft.length} field{draft.length === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
