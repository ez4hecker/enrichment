/**
 * The fields a Lead Lookup can return, read from LeadOcean's own record shapes
 * (leadocean.person.v1 and leadocean.company.v1). A person found by search carries only the
 * thin projection; fields marked `requiresEnrichment` need one enrichment of the matched record,
 * which every such field of that row then shares. Company records are always complete.
 */

type JsonRecord = Record<string, unknown>;

export type LookupFieldDefinition = {
  id: string;
  label: string;
  group: string;
  /** Ticked in the Default field set. */
  isDefault?: boolean;
  requiresEnrichment?: boolean;
  read(record: JsonRecord): string | undefined;
};

/** The parts of a person record the matcher compares with the row. */
export type PersonRecord = {
  personId?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  linkedinUrl?: string;
  jobTitle?: string;
  companyName?: string;
  companyDomain?: string;
  city?: string;
  state?: string;
  country?: string;
  /** Whether `raw` is a full enrichment with contact points, or a search row. */
  enriched: boolean;
  raw: JsonRecord;
};

export type CompanyRecord = {
  name?: string;
  domain?: string;
  city?: string;
  state?: string;
  country?: string;
  /** People the directory holds at the company; 0 marks a likely shell record. */
  peopleOnFile?: number;
  raw: JsonRecord;
};

export function personRecord(raw: JsonRecord, enriched: boolean): PersonRecord {
  const profile = record(raw.profile_data);
  const address = record(profile.profile_address);
  const role = currentRole(raw);

  return definedOnly({
    personId: text(record(record(raw.meta).source_ids).person_id),
    fullName: text(profile.profile_full_name),
    firstName: text(profile.profile_first_name),
    lastName: text(profile.profile_last_name),
    linkedinUrl: text(profile.profile_url),
    jobTitle: text(role.job_title),
    companyName: text(role.company_name),
    companyDomain: text(role.company_domain),
    city: text(address.city),
    state: text(address.state),
    country: text(address.country_code) ?? text(address.country),
    enriched,
    raw,
  });
}

export function companyRecord(raw: JsonRecord): CompanyRecord {
  const company = record(raw.company_data);
  const address = record(company.company_primary_address);

  return definedOnly({
    name: text(company.company_name),
    domain: text(company.company_domain),
    city: text(address.city),
    state: text(address.state),
    country: text(address.country_code) ?? text(address.country),
    peopleOnFile: typeof company.company_number_of_profiles === "number" ? company.company_number_of_profiles : undefined,
    raw,
  });
}

const matchConfidence: LookupFieldDefinition = {
  id: "match-confidence",
  label: "Match Confidence",
  group: "Match",
  isDefault: true,
  // Written by the lookup from the match itself, not read from the record.
  read: () => undefined,
};

export const personFields: ReadonlyArray<LookupFieldDefinition> = [
  matchConfidence,

  { id: "full-name", label: "Full Name", group: "Identity", isDefault: true, read: (r) => nameCase(text(profile(r).profile_full_name)) },
  { id: "first-name", label: "First Name", group: "Identity", read: (r) => nameCase(text(profile(r).profile_first_name)) },
  { id: "last-name", label: "Last Name", group: "Identity", read: (r) => nameCase(text(profile(r).profile_last_name)) },
  { id: "headline", label: "Headline", group: "Identity", read: (r) => text(profile(r).profile_headline) },
  { id: "linkedin-url", label: "LinkedIn URL", group: "Identity", isDefault: true, read: (r) => text(profile(r).profile_url) },
  { id: "picture-url", label: "Picture URL", group: "Identity", read: (r) => text(record(profile(r).profile_picture).url) },
  { id: "person-id", label: "LeadOcean Person ID", group: "Identity", read: (r) => text(record(record(r.meta).source_ids).person_id) },

  { id: "email", label: "Email", group: "Contact", isDefault: true, requiresEnrichment: true, read: (r) => text(bestEmail(r, ["work"])?.email) ?? text(bestEmail(r)?.email) },
  { id: "email-status", label: "Email Status", group: "Contact", requiresEnrichment: true, read: (r) => text((bestEmail(r, ["work"]) ?? bestEmail(r))?.status) },
  { id: "email-type", label: "Email Type", group: "Contact", requiresEnrichment: true, read: (r) => text((bestEmail(r, ["work"]) ?? bestEmail(r))?.type) },
  { id: "personal-email", label: "Personal Email", group: "Contact", requiresEnrichment: true, read: (r) => text(bestEmail(r, ["personal"])?.email) },
  { id: "all-emails", label: "All Emails", group: "Contact", requiresEnrichment: true, read: (r) => joined(sortedEmails(r).map((email) => `${text(email.email)} (${[text(email.type), text(email.status)].filter(Boolean).join(", ")})`)) },
  { id: "phone", label: "Phone", group: "Contact", isDefault: true, requiresEnrichment: true, read: (r) => text(phones(r)[0]?.phone) },
  { id: "phone-type", label: "Phone Type", group: "Contact", requiresEnrichment: true, read: (r) => text(phones(r)[0]?.type) },
  { id: "mobile-phone", label: "Mobile Phone", group: "Contact", requiresEnrichment: true, read: (r) => text(phones(r).find((phone) => phone.type === "mobile")?.phone) },
  { id: "all-phones", label: "All Phones", group: "Contact", requiresEnrichment: true, read: (r) => joined(phones(r).map((phone) => `${text(phone.phone)}${text(phone.type) === undefined ? "" : ` (${text(phone.type)})`}`)) },
  { id: "has-email", label: "Has Email", group: "Contact", read: (r) => yesNo(contact(r).has_email) },
  { id: "has-phone", label: "Has Phone", group: "Contact", read: (r) => yesNo(contact(r).has_phone) },

  { id: "job-title", label: "Job Title", group: "Current Role", isDefault: true, read: (r) => jobTitleCase(text(currentRole(r).job_title)) },
  { id: "seniority", label: "Seniority", group: "Current Role", read: (r) => text(record(currentRole(r).job_seniority).job_level) },
  { id: "job-function", label: "Job Function", group: "Current Role", requiresEnrichment: true, read: (r) => joined(records(currentRole(r).job_functions).map((f) => text(record(f.level1).name))) },
  { id: "role-start-date", label: "Role Start Date", group: "Current Role", read: (r) => text(currentRole(r).start_date) },
  { id: "decision-maker", label: "Decision Maker", group: "Current Role", requiresEnrichment: true, read: (r) => yesNo(profile(r).profile_is_decision_maker) },
  { id: "company-name", label: "Company", group: "Current Role", isDefault: true, read: (r) => nameCase(text(currentRole(r).company_name)) },
  { id: "company-domain", label: "Company Domain", group: "Current Role", isDefault: true, read: (r) => text(currentRole(r).company_domain) },
  { id: "company-industry", label: "Company Industry", group: "Current Role", read: (r) => text(currentRole(r).company_industry) },
  { id: "company-employees", label: "Company Employees", group: "Current Role", read: (r) => number(record(currentRole(r).company_employees).number_of_employees) },
  { id: "company-size", label: "Company Size Range", group: "Current Role", read: (r) => text(record(currentRole(r).company_employees).number_of_employees_code) },
  { id: "company-linkedin-url", label: "Company LinkedIn URL", group: "Current Role", requiresEnrichment: true, read: (r) => text(record(record(currentRole(r).company_social_links).linkedin).url) },

  { id: "location", label: "Location", group: "Location", read: (r) => place([address(r).city, address(r).state, address(r).country_code]) },
  { id: "city", label: "City", group: "Location", read: (r) => nameCase(text(address(r).city)) },
  { id: "state", label: "State", group: "Location", read: (r) => text(address(r).state) },
  { id: "country", label: "Country", group: "Location", read: (r) => text(address(r).country_code) ?? text(address(r).country) },
  { id: "continent", label: "Continent", group: "Location", read: (r) => text(address(r).continent) },
  { id: "postal-code", label: "Postal Code", group: "Location", requiresEnrichment: true, read: (r) => text(address(r).postal_code) },

  { id: "summary", label: "Profile Summary", group: "Profile", requiresEnrichment: true, read: (r) => text(profile(r).profile_summary) },
  { id: "skills", label: "Skills", group: "Profile", requiresEnrichment: true, read: (r) => joined(strings(record(r.resume_data).r_skills ?? record(r.resume_data).skills)) },
  { id: "languages", label: "Languages", group: "Profile", requiresEnrichment: true, read: (r) => joined(listText(profile(r).profile_languages, ["name", "language"])) },
  { id: "connections", label: "LinkedIn Connections", group: "Profile", requiresEnrichment: true, read: (r) => number(record(profile(r).profile_metrics).connections_count) },

  { id: "past-roles", label: "Past Roles", group: "History", requiresEnrichment: true, read: (r) => joined(records(record(r.resume_data).experiences).map(roleSummary), " | ") },
  { id: "previous-company", label: "Previous Company", group: "History", requiresEnrichment: true, read: (r) => nameCase(text(records(record(r.resume_data).experiences)[0]?.company_name)) },
  { id: "education", label: "Education", group: "History", requiresEnrichment: true, read: (r) => joined(records(record(r.resume_data).educations).map(educationSummary), " | ") },
  { id: "certifications", label: "Certifications", group: "History", requiresEnrichment: true, read: (r) => joined(records(record(r.resume_data).certifications).map((c) => [text(c.name), text(c.authority)].filter(Boolean).join(" — "))) },
];

export const companyFields: ReadonlyArray<LookupFieldDefinition> = [
  matchConfidence,

  { id: "company-name", label: "Company Name", group: "Identity", isDefault: true, read: (r) => text(company(r).company_name) },
  { id: "domain", label: "Domain", group: "Identity", isDefault: true, read: (r) => text(company(r).company_domain) },
  { id: "website", label: "Website", group: "Identity", read: (r) => text(record(company(r).company_web_address).url) },
  { id: "linkedin-url", label: "LinkedIn URL", group: "Identity", isDefault: true, read: (r) => text(record(record(company(r).company_social_links).linkedin).url) },
  { id: "logo-url", label: "Logo URL", group: "Identity", read: (r) => text(company(r).company_logo_url) },
  { id: "company-type", label: "Company Type", group: "Identity", read: (r) => text(company(r).company_type) },
  { id: "founded", label: "Founded", group: "Identity", read: (r) => text(record(company(r).company_profile).date_founded) },
  { id: "publicly-traded", label: "Publicly Traded", group: "Identity", read: (r) => yesNo(record(company(r).company_profile).publicly_traded) },
  { id: "alternative-names", label: "Alternative Names", group: "Identity", read: (r) => joined(strings(company(r).company_alternative_names)) },

  { id: "description", label: "Description", group: "About", read: (r) => text(company(r).company_description) },
  { id: "industry", label: "Industry", group: "About", isDefault: true, read: (r) => text(records(company(r).company_industries)[0]?.name3) ?? text(records(company(r).company_industries)[0]?.name) },
  { id: "specialties", label: "Specialties", group: "About", read: (r) => joined(strings(company(r).company_specialties)) },
  { id: "tags", label: "Tags", group: "About", read: (r) => joined(strings(company(r).company_tags)) },
  { id: "naics", label: "NAICS Code", group: "About", read: (r) => text(company(r).naics_primary) },
  { id: "sic", label: "SIC Codes", group: "About", read: (r) => joined(strings(company(r).sic)) },

  { id: "employees", label: "Employees", group: "Size", isDefault: true, read: (r) => number(record(company(r).company_employees).number_of_employees) },
  { id: "employee-range", label: "Employee Range", group: "Size", read: (r) => text(record(company(r).company_employees).number_of_employees_code) },
  { id: "linkedin-followers", label: "LinkedIn Followers", group: "Size", read: (r) => number(company(r).company_linkedin_followers) },
  { id: "people-on-file", label: "People on File", group: "Size", read: (r) => number(company(r).company_number_of_profiles) },
  { id: "decision-makers", label: "Decision Makers on File", group: "Size", read: (r) => number(company(r).company_number_of_decision_makers) },

  { id: "revenue", label: "Revenue (USD)", group: "Money", read: (r) => number(company(r).company_revenue_in_usd) },
  { id: "total-funding", label: "Total Funding (USD)", group: "Money", read: (r) => number(record(company(r).company_funding).total_raised_usd) },
  { id: "last-funding-round", label: "Last Funding Round", group: "Money", read: (r) => text(record(company(r).company_funding).last_round_type) },
  { id: "last-funding-date", label: "Last Funding Date", group: "Money", read: (r) => text(record(company(r).company_funding).last_round_date) },
  { id: "investors", label: "Lead Investors", group: "Money", read: (r) => joined(listText(record(company(r).company_funding).lead_investors, ["name"])) },

  { id: "location", label: "HQ Location", group: "Location", isDefault: true, read: (r) => place([hq(r).city, hq(r).state, hq(r).country_code]) },
  { id: "hq-city", label: "HQ City", group: "Location", read: (r) => text(hq(r).city) },
  { id: "hq-state", label: "HQ State", group: "Location", read: (r) => text(hq(r).state) },
  { id: "hq-country", label: "HQ Country", group: "Location", read: (r) => text(hq(r).country_code) ?? text(hq(r).country) },
  { id: "hq-postal-code", label: "HQ Postal Code", group: "Location", read: (r) => text(hq(r).postal_code) },

  { id: "company-phone", label: "Company Phone", group: "Contact", read: (r) => joined(listText(company(r).company_phones, ["phone", "number"])) },
  { id: "company-email", label: "Company Email", group: "Contact", read: (r) => joined(listText(company(r).company_emails, ["email"])) },

  { id: "technologies", label: "Technologies", group: "Tech", read: (r) => joined(records(r.company_detected_technologies).map((t) => text(record(t.technology_product).name)).slice(0, 40)) },
  { id: "technology-count", label: "Technology Count", group: "Tech", read: (r) => number(company(r).company_number_of_detected_technologies) },
];

export function findLookupField(subject: "person" | "company", id: string): LookupFieldDefinition | undefined {
  return (subject === "person" ? personFields : companyFields).find((field) => field.id === id);
}

function profile(r: JsonRecord): JsonRecord {
  return record(r.profile_data);
}

function contact(r: JsonRecord): JsonRecord {
  return record(r.contact_data);
}

function address(r: JsonRecord): JsonRecord {
  return record(profile(r).profile_address);
}

function currentRole(r: JsonRecord): JsonRecord {
  return records(contact(r).contact_current_experiences)[0] ?? {};
}

function company(r: JsonRecord): JsonRecord {
  return record(r.company_data);
}

function hq(r: JsonRecord): JsonRecord {
  return record(company(r).company_primary_address);
}

// LeadOcean ranks addresses by its own priority, which can put an untested address ahead of a
// checked one; the address to write to is the most deliverable, then the highest priority.
const emailStatusRank = ["verified", "catch_all_valid", "catch_all", "untested", "unknown"];
const undeliverable = new Set(["invalid", "spam_trap", "abuse", "disposable"]);

function sortedEmails(r: JsonRecord): Array<JsonRecord> {
  const rank = (email: JsonRecord) => {
    const index = emailStatusRank.indexOf(text(email.status) ?? "unknown");
    return index === -1 ? emailStatusRank.length : index;
  };

  return records(contact(r).contact_emails)
    .filter((email) => text(email.email) !== undefined && !undeliverable.has(text(email.status) ?? ""))
    .sort((left, right) => rank(left) - rank(right) || priority(left) - priority(right));
}

function bestEmail(r: JsonRecord, types?: Array<string>): JsonRecord | undefined {
  return sortedEmails(r).find((email) => types === undefined || types.includes(text(email.type) ?? ""));
}

function phones(r: JsonRecord): Array<JsonRecord> {
  return records(contact(r).contact_phones)
    .filter((phone) => text(phone.phone) !== undefined)
    .sort((left, right) => priority(left) - priority(right));
}

function priority(value: JsonRecord): number {
  return typeof value.priority === "number" ? value.priority : Number.MAX_SAFE_INTEGER;
}

function roleSummary(role: JsonRecord): string {
  const title = jobTitleCase(text(role.job_title));
  const employer = nameCase(text(role.company_name));
  const dates = [text(role.start_date)?.slice(0, 4), text(role.end_date)?.slice(0, 4)].filter(Boolean).join("–");

  return [[title, employer].filter(Boolean).join(" at "), dates === "" ? undefined : `(${dates})`].filter(Boolean).join(" ");
}

function educationSummary(education: JsonRecord): string {
  return [text(education.educational_establishment), text(education.diploma), text(education.specialization)]
    .filter(Boolean)
    .join(", ");
}

/** Items of a list that may hold plain strings or objects naming the value under one of `keys`. */
function listText(value: unknown, keys: Array<string>): Array<string | undefined> {
  return Array.isArray(value)
    ? value.map((item) => typeof item === "string" ? text(item) : keys.map((key) => text(record(item)[key])).find(Boolean))
    : [];
}

function strings(value: unknown): Array<string | undefined> {
  return listText(value, ["name"]);
}

function joined(values: Array<string | undefined>, separator = "; "): string | undefined {
  const present = values.filter((value): value is string => value !== undefined && value.trim() !== "");

  return present.length === 0 ? undefined : present.join(separator);
}

function place(parts: Array<unknown>): string | undefined {
  return joined(parts.map((part) => {
    const value = text(part);
    return value === undefined || value.length <= 3 ? value : nameCase(value);
  }), ", ");
}

/** The directory stores some names lower-case ("patrick collison"); present them as names. */
function nameCase(value: string | undefined): string | undefined {
  return value === undefined || value !== value.toLowerCase()
    ? value
    : value.replace(/(^|[\s'-])([a-z])/g, (_, separator: string, letter: string) => `${separator}${letter.toUpperCase()}`);
}

const titleAcronyms = new Set(["ceo", "cto", "cfo", "coo", "cmo", "cio", "cro", "cpo", "vp", "svp", "evp", "hr", "it", "qa", "ui", "ux", "seo", "b2b", "b2c", "ai", "ml", "pr"]);

// Joining words stay lower-case inside a title ("Head of Sales"), but not as its first word ("Of Counsel").
const titleSmallWords = new Set(["a", "an", "and", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with"]);

/** Words are compared lower-cased, so "OF", "Of" and "of" all read the same. */
function jobTitleCase(value: string | undefined): string | undefined {
  // An all-capitals title carries no casing worth keeping, like an all-lower-case one.
  const cased = value === undefined || value !== value.toUpperCase() ? nameCase(value) : nameCase(value.toLowerCase());

  return cased?.replace(/\b[A-Za-z0-9]+\b/g, (word, offset: number) => {
    const lower = word.toLowerCase();

    return titleAcronyms.has(lower)
      ? word.toUpperCase()
      : offset > 0 && titleSmallWords.has(lower)
      ? lower
      : word;
  });
}

function yesNo(value: unknown): string | undefined {
  return typeof value === "boolean" ? (value ? "Yes" : "No") : undefined;
}

function record(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : {};
}

function records(value: unknown): Array<JsonRecord> {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => typeof item === "object" && item !== null && !Array.isArray(item))
    : [];
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function number(value: unknown): string | undefined {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : undefined;
}

function definedOnly<T extends Record<string, unknown>>(fields: T): T {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as T;
}
