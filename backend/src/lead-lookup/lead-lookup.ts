import { companyDomain } from "../research/company-domain.js";
import {
  companyFields,
  findLookupField,
  personFields,
  type CompanyRecord,
  type PersonRecord,
} from "./leadocean-records.js";

export type { CompanyRecord, PersonRecord };
export { companyFields, personFields };

/**
 * A Lead Lookup finds the one person or company in a B2B directory (LeadOcean) that best matches
 * the values a row supplies — any combination of name, company, website, title, location and
 * contact points — and answers one field of that match. Every field of one row's lookup is served
 * from a single search, so asking for title, email and confidence costs what asking for one does.
 */

export type LookupSubject = "person" | "company";

export const personInputRoles = [
  "full-name",
  "first-name",
  "last-name",
  "company-name",
  "company-domain",
  "job-title",
  "location",
  "linkedin-url",
  "email",
  "phone",
] as const;

export const companyInputRoles = [
  "company-name",
  "company-domain",
  "company-linkedin-url",
  "location",
] as const;

export type PersonInputRole = typeof personInputRoles[number];
export type CompanyInputRole = typeof companyInputRoles[number];
export type LookupInputRole = PersonInputRole | CompanyInputRole;

export function isInputRole(subject: LookupSubject, role: string): boolean {
  return (subject === "person" ? personInputRoles : companyInputRoles)
    .some((candidate) => candidate === role);
}

export function isOutputField(subject: LookupSubject, field: string): boolean {
  return findLookupField(subject, field) !== undefined;
}

/** Whether the roles a lookup was given can name anyone: a lone job title or location cannot. */
export function canIdentify(subject: LookupSubject, roles: ReadonlyArray<string>): boolean {
  const given = new Set(roles);

  return subject === "person"
    ? ["full-name", "first-name", "last-name", "linkedin-url", "email", "phone"].some((role) => given.has(role))
    : ["company-name", "company-domain", "company-linkedin-url"].some((role) => given.has(role));
}

/** The directory a Lead Lookup searches; composition/leadocean-directory.ts is the real one. */
export type LeadDirectory = {
  /** One person by an exact key, fully enriched with contact points; undefined when nobody holds it. */
  enrichPerson(key: { linkedinUrl?: string; email?: string; phone?: string; personId?: string }): Promise<PersonRecord | undefined>;
  searchPeople(filters: { name: string; domain?: string; companyName?: string; title?: string; limit: number }): Promise<Array<PersonRecord>>;
  enrichCompany(key: { domain?: string; linkedinUrl?: string }): Promise<CompanyRecord | undefined>;
  searchCompanies(filters: { name: string; limit: number }): Promise<Array<CompanyRecord>>;
};

/** Thrown by a directory that cannot answer at all (bad key, records used up), as opposed to finding nobody. */
export class LeadDirectoryUnavailableError extends Error {}

export type LookupFieldResult =
  | { status: "Found"; value: string }
  | { status: "NotFound"; reason: string };

export type LeadLookup = {
  lookUpField(request: {
    subject: LookupSubject;
    inputs: Partial<Record<LookupInputRole, string>>;
    outputField: string;
    /** This lookup's trust threshold, 0 to 1; overrides the configured one. */
    minimumConfidence?: number;
  }): Promise<LookupFieldResult>;
};

export type LeadLookupOptions = {
  directory: LeadDirectory;
  /** Candidates fetched per search; each is one directory record. Defaults to 3. */
  candidateLimit?: number;
  /** Below this a closest candidate is not trusted and the row gets [Not Found]. Defaults to 0.5. */
  minimumConfidence?: number;
  /** Candidates on the last, deeper search, tried only when nothing earlier was confident. Defaults to 10. */
  deepCandidateLimit?: number;
  /** Lookups remembered so repeated rows and previews reuse them. Defaults to 10,000. */
  maximumCachedLookups?: number;
};

type Match<T> = { record: T; confidence: number };

type MatchOutcome<T> =
  | { status: "Matched"; match: Match<T> }
  | { status: "NotFound"; reason: string };

export function createLeadLookup(options: LeadLookupOptions): LeadLookup {
  const candidateLimit = options.candidateLimit ?? 3;
  const defaultMinimumConfidence = options.minimumConfidence ?? 0.5;
  const deepCandidateLimit = options.deepCandidateLimit ?? 10;
  const cache = createPromiseCache(options.maximumCachedLookups ?? 10_000);

  async function matchPerson(inputs: PersonInputs, minimumConfidence: number): Promise<MatchOutcome<PersonRecord>> {
    const keys: Array<{ linkedinUrl?: string; email?: string; phone?: string }> = [
      ...(inputs.linkedinUrl === undefined ? [] : [{ linkedinUrl: inputs.linkedinUrl }]),
      ...(inputs.email === undefined ? [] : [{ email: inputs.email }]),
      ...(inputs.phone === undefined ? [] : [{ phone: inputs.phone }]),
    ];

    // An exact key names one record, so it is cheaper and surer than a search: try each in turn.
    for (const key of keys) {
      const record = await options.directory.enrichPerson(key);

      if (record !== undefined) {
        const confidence = personScore(inputs, record, true);

        return confidence >= minimumConfidence
          ? { status: "Matched", match: { record, confidence } }
          : { status: "NotFound", reason: `${keyName(key)} belongs to ${record.fullName ?? "someone else"}, who does not match the row` };
      }
    }

    const name = inputs.fullName ?? [inputs.firstName, inputs.lastName].filter(Boolean).join(" ");

    if (name === "") {
      return { status: "NotFound", reason: keys.length > 0 ? "No person holds that contact point" : "Row has no name to search for" };
    }

    // The directory's search is free text over the whole profile, so colleagues whose profiles
    // mention the person can outrank them. Searches climb from cheap to thorough and stop at the
    // first confident match; candidates from every step compete. An empty page costs nothing.
    const companyFilters: Array<{ domain?: string; companyName?: string }> = [
      ...(inputs.domain === undefined ? [] : [{ domain: inputs.domain }]),
      ...(inputs.companyName === undefined ? [] : [{ companyName: inputs.companyName }]),
    ];
    // A nickname ("Tobi" for "Tobias") finds nobody, since every word of the name must appear;
    // within a company the last name alone is narrow enough.
    const fullNameWords = inputs.fullName?.split(/\s+/) ?? [];
    const lastName = inputs.lastName ?? (fullNameWords.length > 1 ? fullNameWords.at(-1) : undefined);
    const steps = companyFilters.length === 0
      // A name with no company is too common to search deeply.
      ? [
          { name, limit: candidateLimit },
          ...(inputs.jobTitle === undefined ? [] : [{ name, title: inputs.jobTitle, limit: candidateLimit }]),
        ]
      : [
          ...companyFilters.map((filters) => ({ name, ...filters, limit: candidateLimit })),
          ...(inputs.jobTitle === undefined ? [] : companyFilters.map((filters) => ({ name, ...filters, title: inputs.jobTitle, limit: candidateLimit }))),
          ...(lastName === undefined || lastName === name ? [] : companyFilters.map((filters) => ({ name: lastName, ...filters, limit: candidateLimit }))),
          ...(deepCandidateLimit <= candidateLimit ? [] : companyFilters.map((filters) => ({ name, ...filters, limit: deepCandidateLimit, deep: true }))),
        ];
    const candidates = new Map<string, Match<PersonRecord>>();
    // A deeper page only helps where the first page was full.
    const fullFirstPages = new Set<string>();

    for (const { deep, ...search } of steps as Array<Parameters<LeadDirectory["searchPeople"]>[0] & { deep?: boolean }>) {
      const filterKey = `${search.domain ?? ""}|${search.companyName ?? ""}`;

      if (deep === true && !fullFirstPages.has(filterKey)) {
        continue;
      }

      const found = await options.directory.searchPeople(search);

      if (search.name === name && search.title === undefined && deep !== true && found.length >= candidateLimit) {
        fullFirstPages.add(filterKey);
      }

      for (const record of found) {
        const key = record.personId ?? `${record.fullName}|${record.companyDomain}|${record.jobTitle}`;
        candidates.set(key, { record, confidence: personScore(inputs, record, false) });
      }

      if ([...candidates.values()].some((candidate) => candidate.confidence >= minimumConfidence)) {
        break;
      }
    }

    return closest([...candidates.values()], minimumConfidence, "person");
  }

  async function matchCompany(inputs: CompanyInputs, minimumConfidence: number): Promise<MatchOutcome<CompanyRecord>> {
    for (const key of [
      ...(inputs.domain === undefined ? [] : [{ domain: inputs.domain }]),
      ...(inputs.linkedinUrl === undefined ? [] : [{ linkedinUrl: inputs.linkedinUrl }]),
    ]) {
      const record = await options.directory.enrichCompany(key);

      if (record !== undefined) {
        return { status: "Matched", match: { record, confidence: companyScore(inputs, record, true) } };
      }
    }

    if (inputs.name === undefined) {
      return { status: "NotFound", reason: "No company holds that website" };
    }

    const candidates = await options.directory.searchCompanies({ name: inputs.name, limit: candidateLimit });

    return closest(candidates.map((record) => ({ record, confidence: companyScore(inputs, record, false) })), minimumConfidence, "company");
  }

  return {
    async lookUpField(request) {
      // The threshold also decides when the search ladder stops, so outcomes are cached per threshold.
      const minimumConfidence = request.minimumConfidence ?? defaultMinimumConfidence;

      if (request.subject === "company") {
        const inputs = companyInputs(request.inputs);
        const outcome = await cache.get(`company:${minimumConfidence}:${JSON.stringify(inputs)}`, () => matchCompany(inputs, minimumConfidence));

        return outcome.status === "NotFound"
          ? outcome
          : fieldResult(outcome.match, request.subject, request.outputField);
      }

      const inputs = personInputs(request.inputs);
      const outcome = await cache.get(`person:${minimumConfidence}:${JSON.stringify(inputs)}`, () => matchPerson(inputs, minimumConfidence));

      if (outcome.status === "NotFound") {
        return outcome;
      }

      let record = outcome.match.record;

      // A searched match is the thin projection; enrich it once, for the first field that needs more.
      if (findLookupField("person", request.outputField)?.requiresEnrichment === true && !record.enriched) {
        const personId = record.personId;

        if (personId === undefined) {
          return { status: "NotFound", reason: "Matched person cannot be enriched" };
        }

        const thin = record;
        record = await cache.get(`enriched:${personId}`, async () =>
          await options.directory.enrichPerson({ personId }) ?? { ...thin, enriched: true },
        );
      }

      return fieldResult({ ...outcome.match, record }, request.subject, request.outputField);
    },
  };
}

type PersonInputs = {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  domain?: string;
  jobTitle?: string;
  location?: string;
  linkedinUrl?: string;
  email?: string;
  phone?: string;
};

type CompanyInputs = {
  name?: string;
  domain?: string;
  linkedinUrl?: string;
  location?: string;
};

function personInputs(values: Partial<Record<LookupInputRole, string>>): PersonInputs {
  const email = trimmed(values.email)?.toLowerCase();

  return definedOnly({
    fullName: trimmed(values["full-name"]),
    firstName: trimmed(values["first-name"]),
    lastName: trimmed(values["last-name"]),
    companyName: trimmed(values["company-name"]),
    domain: companyDomain(values["company-domain"]),
    jobTitle: trimmed(values["job-title"]),
    location: trimmed(values.location),
    linkedinUrl: trimmed(values["linkedin-url"]),
    email: email !== undefined && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : undefined,
    phone: trimmed(values.phone),
  });
}

function companyInputs(values: Partial<Record<LookupInputRole, string>>): CompanyInputs {
  return definedOnly({
    name: trimmed(values["company-name"]),
    domain: companyDomain(values["company-domain"]),
    linkedinUrl: trimmed(values["company-linkedin-url"]),
    location: trimmed(values.location),
  });
}

function closest<T>(
  candidates: Array<Match<T>>,
  minimumConfidence: number,
  noun: string,
): MatchOutcome<T> {
  const best = [...candidates].sort((left, right) => right.confidence - left.confidence)[0];

  if (best === undefined) {
    return { status: "NotFound", reason: `No ${noun} matches the row` };
  }

  return best.confidence >= minimumConfidence
    ? { status: "Matched", match: best }
    : { status: "NotFound", reason: `Closest ${noun} matched only ${percent(best.confidence)}` };
}

/**
 * How well a candidate fits the row, from 0 to 1: each value the row supplies is compared with
 * the candidate's and weighted by how much it tells people apart. A record reached by an exact
 * key (LinkedIn URL, email, phone) is the right record unless the row's name contradicts it.
 */
export function personScore(inputs: PersonInputs, record: PersonRecord, reachedByKey: boolean): number {
  const name = inputs.fullName ?? [inputs.firstName, inputs.lastName].filter(Boolean).join(" ");
  const nameScore = name === "" ? undefined : nameSimilarity(name, record.fullName ?? [record.firstName, record.lastName].filter(Boolean).join(" "));

  if (reachedByKey) {
    return nameScore === undefined ? 1 : 0.5 + nameScore / 2;
  }

  const companyScores = [
    ...(inputs.domain === undefined ? [] : [record.companyDomain === undefined ? 0 : Number(companyDomain(record.companyDomain) === inputs.domain)]),
    ...(inputs.companyName === undefined ? [] : [companyNameSimilarity(inputs.companyName, record.companyName ?? "")]),
  ];

  const score = weightedAverage([
    [0.5, nameScore],
    [0.3, companyScores.length === 0 ? undefined : Math.max(...companyScores)],
    [0.1, inputs.jobTitle === undefined ? undefined : tokenOverlap(inputs.jobTitle, record.jobTitle ?? "")],
    [0.1, inputs.location === undefined ? undefined : locationSimilarity(inputs.location, [record.city, record.state, record.country])],
  ]);

  // Everyone at the company matches the company, so a weak name match cannot be carried by it:
  // "Ryan Nadel" at Microsoft is not "Satya Nadella", nor is any other Thorne "Cassius Thorne".
  // A shared last name alone scores 0.5, so the cap keeps it under the default minimum.
  return nameScore !== undefined && nameScore < 0.7 ? Math.min(score, nameScore * 0.8) : score;
}

export function companyScore(inputs: CompanyInputs, record: CompanyRecord, reachedByKey: boolean): number {
  const nameScore = inputs.name === undefined ? undefined : companyNameSimilarity(inputs.name, record.name ?? "");

  if (reachedByKey) {
    return nameScore === undefined ? 1 : 0.5 + nameScore / 2;
  }

  const score = weightedAverage([
    [0.8, nameScore],
    [0.2, inputs.location === undefined ? undefined : locationSimilarity(inputs.location, [record.city, record.state, record.country])],
  ]);

  // Directories hold shells that share a real company's name but have no website or people:
  // each missing sign of substance discounts a name-only match, so the real company outranks them.
  return score * (record.domain === undefined ? 0.6 : 1) * (record.peopleOnFile === 0 ? 0.6 : 1);
}

function fieldResult(
  match: Match<PersonRecord> | Match<CompanyRecord>,
  subject: LookupSubject,
  outputField: string,
): LookupFieldResult {
  const field = findLookupField(subject, outputField);
  const value = field?.id === "match-confidence"
    ? percent(match.confidence)
    : field?.read(match.record.raw);

  return value === undefined || value.trim() === ""
    ? { status: "NotFound", reason: `Match has no ${(field?.label ?? outputField).toLowerCase()} on file` }
    : { status: "Found", value };
}

/** Name tokens match exactly, by initial ("J." for "John"), or with a typo or two. */
function nameSimilarity(expected: string, actual: string): number {
  const expectedTokens = tokens(expected);
  const actualTokens = tokens(actual);

  if (expectedTokens.length === 0 || actualTokens.length === 0) {
    return 0;
  }

  const remaining = [...actualTokens];
  let matched = 0;

  for (const token of expectedTokens) {
    const scores = remaining.map((candidate) => tokenSimilarity(token, candidate));
    const best = Math.max(...scores, 0);

    if (best > 0) {
      matched += best;
      remaining.splice(scores.indexOf(best), 1);
    }
  }

  // Missing middle names should not sink a match, so divide by the shorter name.
  return matched / Math.min(expectedTokens.length, actualTokens.length) *
    (Math.min(expectedTokens.length, actualTokens.length) / Math.max(expectedTokens.length, actualTokens.length)) ** 0.25;
}

function tokenSimilarity(left: string, right: string): number {
  if (left === right) {
    return 1;
  }

  if ((left.length === 1 && right.startsWith(left)) || (right.length === 1 && left.startsWith(right))) {
    return 0.8;
  }

  // A short form of the same name: "Tobi" and "Tobias", "Alex" and "Alexander".
  if (Math.min(left.length, right.length) >= 3 && (right.startsWith(left) || left.startsWith(right))) {
    return 0.85;
  }

  const longest = Math.max(left.length, right.length);
  const similarity = 1 - editDistance(left, right) / longest;

  return longest >= 4 && similarity >= 0.75 ? similarity * 0.9 : 0;
}

const companySuffixes = new Set([
  "inc", "incorporated", "llc", "ltd", "limited", "co", "corp", "corporation", "company", "gmbh",
  "ag", "sa", "sas", "bv", "plc", "pty", "pvt", "private", "group", "holdings", "the",
]);

function companyNameSimilarity(expected: string, actual: string): number {
  const significant = (value: string) => tokens(value).filter((token) => !companySuffixes.has(token));
  const expectedTokens = significant(expected);
  const actualTokens = significant(actual);

  if (expectedTokens.length === 0 || actualTokens.length === 0) {
    return 0;
  }

  if (expectedTokens.join("") === actualTokens.join("")) {
    return 1;
  }

  return tokenOverlap(expectedTokens.join(" "), actualTokens.join(" "));
}

/** Shared words over all distinct words, so "VP Sales" and "Vice President of Sales" partly agree. */
function tokenOverlap(left: string, right: string): number {
  const leftTokens = new Set(tokens(left));
  const rightTokens = new Set(tokens(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;

  return shared / new Set([...leftTokens, ...rightTokens]).size;
}

function locationSimilarity(expected: string, parts: Array<string | undefined>): number {
  const expectedTokens = tokens(expected);
  const actualTokens = new Set(parts.flatMap((part) => tokens(part ?? "")));

  if (expectedTokens.length === 0) {
    return 0;
  }

  return expectedTokens.filter((token) => actualTokens.has(token)).length / expectedTokens.length;
}

function weightedAverage(scores: Array<[number, number | undefined]>): number {
  const given = scores.filter((score): score is [number, number] => score[1] !== undefined);
  const totalWeight = given.reduce((total, [weight]) => total + weight, 0);

  return totalWeight === 0 ? 0 : given.reduce((total, [weight, score]) => total + weight * score, 0) / totalWeight;
}

function tokens(value: string): Array<string> {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token !== "");
}

function editDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }

    previous = current;
  }

  return previous[right.length];
}

function percent(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

function keyName(key: { linkedinUrl?: string; email?: string; phone?: string }): string {
  return key.linkedinUrl !== undefined ? "LinkedIn URL" : key.email !== undefined ? "Email" : "Phone";
}

function trimmed(value: string | undefined): string | undefined {
  const result = (value ?? "").trim();

  return result === "" ? undefined : result;
}

function definedOnly<T extends Record<string, unknown>>(fields: T): T {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as T;
}

/** Remembers each lookup's promise so concurrent rows asking the same thing share one search. Failures are forgotten. */
function createPromiseCache(maximumEntries: number) {
  const entries = new Map<string, Promise<unknown>>();

  return {
    get<T>(key: string, load: () => Promise<T>): Promise<T> {
      const existing = entries.get(key);

      if (existing !== undefined) {
        return existing as Promise<T>;
      }

      const loaded = load();

      entries.set(key, loaded);
      loaded.catch(() => entries.delete(key));

      if (entries.size > maximumEntries) {
        entries.delete(entries.keys().next().value as string);
      }

      return loaded;
    },
  };
}
