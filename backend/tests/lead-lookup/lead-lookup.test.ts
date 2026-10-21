import { describe, expect, it } from "vitest";

import {
  createLeadLookup,
  LeadDirectoryUnavailableError,
  type CompanyRecord,
  type LeadDirectory,
  type PersonRecord,
} from "../../src/lead-lookup/lead-lookup.js";
import { companyRecord, personRecord } from "../../src/lead-lookup/leadocean-records.js";

type DirectoryCall = { method: string; argument: unknown };

function fakeDirectory(answers: {
  enrichPerson?: (key: Record<string, string>) => PersonRecord | undefined;
  searchPeople?: (filters: Record<string, unknown>) => Array<PersonRecord>;
  enrichCompany?: (key: Record<string, string>) => CompanyRecord | undefined;
  searchCompanies?: (filters: Record<string, unknown>) => Array<CompanyRecord>;
}): LeadDirectory & { calls: Array<DirectoryCall> } {
  const calls: Array<DirectoryCall> = [];

  return {
    calls,
    async enrichPerson(key) {
      calls.push({ method: "enrichPerson", argument: key });
      return answers.enrichPerson?.(key as Record<string, string>);
    },
    async searchPeople(filters) {
      calls.push({ method: "searchPeople", argument: filters });
      return answers.searchPeople?.(filters) ?? [];
    },
    async enrichCompany(key) {
      calls.push({ method: "enrichCompany", argument: key });
      return answers.enrichCompany?.(key as Record<string, string>);
    },
    async searchCompanies(filters) {
      calls.push({ method: "searchCompanies", argument: filters });
      return answers.searchCompanies?.(filters) ?? [];
    },
  };
}

/** A leadocean.person.v1 record; `contact` makes it an enrichment with contact points. */
function person(details: {
  id: string;
  name: string;
  title: string;
  company: string;
  domain: string;
  city?: string;
  country?: string;
  contact?: { emails?: Array<Record<string, unknown>>; phones?: Array<Record<string, unknown>> };
}): PersonRecord {
  const [first, ...rest] = details.name.split(" ");

  return personRecord({
    profile_data: {
      profile_full_name: details.name,
      profile_first_name: first,
      profile_last_name: rest.join(" "),
      profile_url: `https://www.linkedin.com/in/${details.id}`,
      profile_address: { city: details.city, country_code: details.country },
    },
    contact_data: {
      contact_current_experiences: [{ job_title: details.title, company_name: details.company, company_domain: details.domain }],
      ...(details.contact === undefined
        ? {}
        : { contact_emails: details.contact.emails ?? [], contact_phones: details.contact.phones ?? [] }),
    },
    meta: { source_ids: { person_id: details.id } },
  }, details.contact !== undefined);
}

function company(details: { name: string; domain?: string; city?: string; employees?: number; profiles?: number }): CompanyRecord {
  return companyRecord({
    company_data: {
      company_name: details.name,
      company_domain: details.domain,
      company_primary_address: { city: details.city },
      ...(details.employees === undefined ? {} : { company_employees: { number_of_employees: details.employees } }),
      ...(details.profiles === undefined ? {} : { company_number_of_profiles: details.profiles }),
    },
  });
}

const ceo = { id: "1", name: "patrick collison", title: "chief executive officer", company: "Stripe", domain: "stripe.com", city: "san francisco", country: "US" };
const namesake = { ...ceo, id: "2", title: "social media marketing manager", city: "dublin", country: "IE" };

describe("Lead Lookup", () => {
  it("keeps the candidate closest to every value the row gives, from one search for all fields", async () => {
    const directory = fakeDirectory({ searchPeople: () => [person(namesake), person(ceo)] });
    const lookup = createLeadLookup({ directory });
    const inputs = {
      "full-name": "Patrick Collison",
      "company-domain": "https://www.stripe.com/",
      "job-title": "Chief Executive Officer",
      location: "San Francisco",
    };

    await expect(lookup.lookUpField({ subject: "person", inputs, outputField: "job-title" }))
      .resolves.toEqual({ status: "Found", value: "Chief Executive Officer" });
    await expect(lookup.lookUpField({ subject: "person", inputs, outputField: "location" }))
      .resolves.toEqual({ status: "Found", value: "San Francisco, US" });
    await expect(lookup.lookUpField({ subject: "person", inputs, outputField: "match-confidence" }))
      .resolves.toEqual({ status: "Found", value: "100%" });
    expect(directory.calls).toEqual([
      { method: "searchPeople", argument: { name: "Patrick Collison", domain: "stripe.com", limit: 3 } },
    ]);
  });

  it("enriches a searched match once, by its id, for every field the search row lacks", async () => {
    const directory = fakeDirectory({
      searchPeople: () => [person(ceo)],
      enrichPerson: (key) => key.personId === "1"
        ? person({
            ...ceo,
            contact: {
              // LeadOcean's own priority puts the untested address first; the checked one is the one to send to.
              emails: [
                { email: "p@old.example", type: "work", status: "untested", priority: 1 },
                { email: "patrick@stripe.com", type: "work", status: "catch_all", priority: 2 },
                { email: "pat@gmail.com", type: "personal", status: "verified", priority: 3 },
              ],
            },
          })
        : undefined,
    });
    const lookup = createLeadLookup({ directory });
    const inputs = { "first-name": "Patrick", "last-name": "Collison", "company-name": "Stripe, Inc." };

    const [email, status, personal, phone] = await Promise.all([
      lookup.lookUpField({ subject: "person", inputs, outputField: "email" }),
      lookup.lookUpField({ subject: "person", inputs, outputField: "email-status" }),
      lookup.lookUpField({ subject: "person", inputs, outputField: "personal-email" }),
      lookup.lookUpField({ subject: "person", inputs, outputField: "phone" }),
    ]);

    expect(email).toEqual({ status: "Found", value: "patrick@stripe.com" });
    expect(status).toEqual({ status: "Found", value: "catch_all" });
    expect(personal).toEqual({ status: "Found", value: "pat@gmail.com" });
    expect(phone).toEqual({ status: "NotFound", reason: "Match has no phone on file" });
    expect(directory.calls.map((call) => call.method)).toEqual(["searchPeople", "enrichPerson"]);
  });

  it("looks a person up by an exact key before searching, and does not search when it is found", async () => {
    const directory = fakeDirectory({
      enrichPerson: (key) => key.email === "ada@acme.com"
        ? person({ ...ceo, name: "Ada Lovelace", contact: { emails: [{ email: "ada@acme.com", type: "work", status: "verified" }] } })
        : undefined,
    });
    const lookup = createLeadLookup({ directory });

    await expect(lookup.lookUpField({
      subject: "person",
      inputs: { email: " Ada@Acme.com ", "full-name": "Ada Lovelace" },
      outputField: "email",
    })).resolves.toEqual({ status: "Found", value: "ada@acme.com" });
    expect(directory.calls).toEqual([{ method: "enrichPerson", argument: { email: "ada@acme.com" } }]);
  });

  it("tries the company name when nobody is found at the domain", async () => {
    const directory = fakeDirectory({
      searchPeople: (filters) => filters.companyName === "Acme" ? [person({ ...ceo, name: "Ada Lovelace", company: "Acme" })] : [],
    });
    const lookup = createLeadLookup({ directory });

    await expect(lookup.lookUpField({
      subject: "person",
      inputs: { "full-name": "Ada Lovelace", "company-domain": "acme.io", "company-name": "Acme" },
      outputField: "full-name",
    })).resolves.toEqual({ status: "Found", value: "Ada Lovelace" });
    expect(directory.calls.map((call) => call.argument)).toEqual([
      { name: "Ada Lovelace", domain: "acme.io", limit: 3 },
      { name: "Ada Lovelace", companyName: "Acme", limit: 3 },
    ]);
  });

  it("searches by last name within the company when a nickname finds nobody, and scores the short form as a match", async () => {
    const directory = fakeDirectory({
      searchPeople: (filters) => filters.name === "Lutke"
        ? [person({ ...ceo, name: "Tobias Lütke", title: "CEO", company: "Shopify", domain: "shopify.com" })]
        : [],
    });
    const lookup = createLeadLookup({ directory });

    await expect(lookup.lookUpField({
      subject: "person",
      inputs: { "first-name": "Tobi", "last-name": "Lutke", "company-name": "Shopify" },
      outputField: "full-name",
    })).resolves.toEqual({ status: "Found", value: "Tobias Lütke" });
    expect(directory.calls.map((call) => call.argument)).toEqual([
      { name: "Tobi Lutke", companyName: "Shopify", limit: 3 },
      { name: "Lutke", companyName: "Shopify", limit: 3 },
    ]);
  });

  it("climbs to a deeper search when colleagues who mention the person fill the first page", async () => {
    const colleague = (id: string, name: string) => person({ ...ceo, id, name, title: "Engineer", company: "Nvidia", domain: "nvidia.com" });
    const firstPage = [colleague("11", "Max Baker"), colleague("12", "Alex Taylor"), colleague("13", "Guilin Liu")];
    const directory = fakeDirectory({
      searchPeople: (filters) => filters.limit === 10
        ? [...firstPage, colleague("14", "Paul Velasquez"), person({ ...ceo, id: "15", name: "Jensen Huang", title: "Founder and CEO", company: "Nvidia", domain: "nvidia.com" })]
        : filters.name === "Jensen Huang" ? firstPage : [],
    });
    const lookup = createLeadLookup({ directory });

    await expect(lookup.lookUpField({
      subject: "person",
      inputs: { "full-name": "Jensen Huang", "company-name": "NVIDIA" },
      outputField: "job-title",
    })).resolves.toEqual({ status: "Found", value: "Founder and CEO" });
    expect(directory.calls.map((call) => call.argument)).toEqual([
      { name: "Jensen Huang", companyName: "NVIDIA", limit: 3 },
      { name: "Huang", companyName: "NVIDIA", limit: 3 },
      { name: "Jensen Huang", companyName: "NVIDIA", limit: 10 },
    ]);
  });

  it("does not let the company carry a weak name match", async () => {
    const directory = fakeDirectory({
      searchPeople: () => [person({ ...ceo, name: "Ryan Nadel", title: "Technical Advisor to the CEO", company: "Microsoft", domain: "microsoft.com" })],
    });
    const lookup = createLeadLookup({ directory });

    await expect(lookup.lookUpField({
      subject: "person",
      inputs: { "full-name": "Satya Nadella", "company-name": "Microsoft" },
      outputField: "job-title",
    })).resolves.toMatchObject({ status: "NotFound", reason: expect.stringMatching(/^Closest person matched only \d+%$/) });
  });

  it("does not accept someone who only shares the last name, and keeps climbing past them", async () => {
    const directory = fakeDirectory({
      searchPeople: (filters) => filters.name === "Thorne"
        ? [person({ ...ceo, id: "21", name: "Margaret Thorne", title: "VP Sales", company: "Datadog", domain: "datadoghq.com" })]
        : [],
    });
    const lookup = createLeadLookup({ directory });

    await expect(lookup.lookUpField({
      subject: "person",
      inputs: { "full-name": "Cassius Thorne", "company-name": "Datadog" },
      outputField: "job-title",
    })).resolves.toMatchObject({ status: "NotFound", reason: "Closest person matched only 40%" });
  });

  it("filters by the row's job title before searching more broadly", async () => {
    const directory = fakeDirectory({
      searchPeople: (filters) => filters.title === "CEO" ? [person({ ...ceo, name: "Tim Cook", title: "CEO", company: "Apple", domain: "apple.com" })] : [],
    });
    const lookup = createLeadLookup({ directory });

    await expect(lookup.lookUpField({
      subject: "person",
      inputs: { "full-name": "Tim Cook", "company-domain": "apple.com", "job-title": "CEO" },
      outputField: "full-name",
    })).resolves.toEqual({ status: "Found", value: "Tim Cook" });
    expect(directory.calls.map((call) => call.argument)).toEqual([
      { name: "Tim Cook", domain: "apple.com", limit: 3 },
      { name: "Tim Cook", domain: "apple.com", title: "CEO", limit: 3 },
    ]);
  });

  it("does not trust a closest candidate below the minimum confidence", async () => {
    const directory = fakeDirectory({
      searchPeople: () => [person({ ...ceo, name: "Jane Smythe", company: "Globex", domain: "globex.com" })],
    });
    const lookup = createLeadLookup({ directory, minimumConfidence: 0.6 });

    await expect(lookup.lookUpField({
      subject: "person",
      inputs: { "full-name": "John Smith", "company-name": "Acme" },
      outputField: "job-title",
    })).resolves.toMatchObject({ status: "NotFound", reason: expect.stringMatching(/^Closest person matched only \d+%$/) });
  });

  it("lets each lookup set its own minimum confidence", async () => {
    // Same name, but "Acme Robotics" only half matches "Acme": about 81%.
    const directory = fakeDirectory({
      searchPeople: () => [person({ ...ceo, name: "John Smith", company: "Acme Robotics", domain: "acmerobotics.com" })],
    });
    const lookup = createLeadLookup({ directory });
    const request = { subject: "person" as const, inputs: { "full-name": "John Smith", "company-name": "Acme" }, outputField: "full-name" };

    await expect(lookup.lookUpField(request)).resolves.toEqual({ status: "Found", value: "John Smith" });
    await expect(lookup.lookUpField({ ...request, minimumConfidence: 0.9 }))
      .resolves.toEqual({ status: "NotFound", reason: "Closest person matched only 81%" });
  });

  it("prefers a real company over a namesake shell with no website or people on file", async () => {
    const shell = company({ name: "Acme", profiles: 0 });
    const real = company({ name: "Acme Inc.", domain: "acme.com", profiles: 120 });
    const request = { subject: "company" as const, inputs: { "company-name": "Acme" }, outputField: "domain" };

    await expect(createLeadLookup({ directory: fakeDirectory({ searchCompanies: () => [shell, real] }) }).lookUpField(request))
      .resolves.toEqual({ status: "Found", value: "acme.com" });
    // A shell alone is too thin to trust at the default threshold.
    await expect(createLeadLookup({ directory: fakeDirectory({ searchCompanies: () => [shell] }) }).lookUpField({ ...request, outputField: "name" }))
      .resolves.toEqual({ status: "NotFound", reason: "Closest company matched only 36%" });
  });

  it("cases job titles whatever case the directory stores them in", async () => {
    const titles = {
      "vp of sales and marketing": "VP of Sales and Marketing",
      "HEAD OF THE PRODUCT TEAM": "Head of the Product Team",
      "Director Of Engineering For Ai": "Director of Engineering for AI",
      "Of Counsel": "Of Counsel",
      "Senior DevOps Engineer": "Senior DevOps Engineer",
    };

    for (const [stored, shown] of Object.entries(titles)) {
      const lookup = createLeadLookup({ directory: fakeDirectory({ searchPeople: () => [person({ ...ceo, title: stored })] }) });

      await expect(lookup.lookUpField({ subject: "person", inputs: { "full-name": "Patrick Collison", "company-domain": "stripe.com" }, outputField: "job-title" }))
        .resolves.toEqual({ status: "Found", value: shown });
    }
  });

  it("finds a company by its website exactly, or by the closest name", async () => {
    const directory = fakeDirectory({
      enrichCompany: (key) => key.domain === "stripe.com" ? company({ name: "Stripe", domain: "stripe.com", employees: 12443 }) : undefined,
      searchCompanies: () => [
        company({ name: "Acme Robotics", domain: "acmerobotics.com" }),
        company({ name: "Acme Inc.", domain: "acme.com", city: "Austin" }),
      ],
    });
    const lookup = createLeadLookup({ directory });

    await expect(lookup.lookUpField({ subject: "company", inputs: { "company-domain": "www.stripe.com" }, outputField: "employees" }))
      .resolves.toEqual({ status: "Found", value: "12443" });
    await expect(lookup.lookUpField({ subject: "company", inputs: { "company-name": "ACME", location: "Austin, TX" }, outputField: "domain" }))
      .resolves.toEqual({ status: "Found", value: "acme.com" });
  });

  it("lets a directory that cannot answer fail the lookup, and asks again next time", async () => {
    let fail = true;
    const directory = fakeDirectory({
      enrichCompany: () => {
        if (fail) {
          throw new LeadDirectoryUnavailableError("LeadOcean records are used up");
        }
        return company({ name: "Stripe", domain: "stripe.com" });
      },
    });
    const lookup = createLeadLookup({ directory });
    const request = { subject: "company" as const, inputs: { "company-domain": "stripe.com" }, outputField: "company-name" };

    await expect(lookup.lookUpField(request)).rejects.toThrow("LeadOcean records are used up");
    fail = false;
    await expect(lookup.lookUpField(request)).resolves.toEqual({ status: "Found", value: "Stripe" });
  });
});
