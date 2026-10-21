import { describe, expect, it } from "vitest";

import { createLeadOceanDirectory } from "../../src/composition/leadocean-directory.js";
import { LeadDirectoryUnavailableError } from "../../src/lead-lookup/lead-lookup.js";
import { findLookupField } from "../../src/lead-lookup/leadocean-records.js";

const read = (subject: "person" | "company", field: string, raw: Record<string, unknown>) =>
  findLookupField(subject, field)?.read(raw);

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

// Shaped like a real /v1/people/search row (2026-10-19).
const searchRow = {
  profile_data: {
    profile_url: null,
    profile_full_name: "patrick collison",
    profile_first_name: "patrick",
    profile_last_name: "collison",
    profile_address: { city: "san francisco", state: null, country_code: "US", continent: "North America" },
  },
  contact_data: {
    contact_current_experiences: [{
      company_name: "Stripe",
      company_domain: "stripe.com",
      job_title: "social media marketing manager",
      job_seniority: { job_level: "Manager", score: null },
      current: true,
    }],
    has_email: true,
    email_status: "catch_all",
  },
  meta: { source_ids: { person_id: "15090861", person_group_id: "15090861" } },
};

describe("LeadOcean directory", () => {
  it("searches people with the key header and reads the current role and location", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const directory = createLeadOceanDirectory({
      apiKey: "lo_live_test",
      fetch: async (url, init) => {
        requests.push({ url, init });
        return json({ success: true, data: [searchRow], meta: { count: 1 } });
      },
    });

    await expect(directory.searchPeople({ name: "Patrick Collison", domain: "stripe.com", limit: 3 })).resolves.toMatchObject([{
      personId: "15090861",
      fullName: "patrick collison",
      firstName: "patrick",
      lastName: "collison",
      jobTitle: "social media marketing manager",
      companyName: "Stripe",
      companyDomain: "stripe.com",
      city: "san francisco",
      country: "US",
      enriched: false,
    }]);
    expect(requests[0].url).toBe("https://api.leadocean.io/v1/people/search");
    expect(requests[0].init.headers).toMatchObject({ "x-api-key": "lo_live_test" });
    expect(JSON.parse(String(requests[0].init.body))).toEqual({
      q: "Patrick Collison",
      domain: ["stripe.com"],
      limit: 3,
    });
  });

  it("enriches with contact points revealed, prefers the work email, and treats 404 as nobody", async () => {
    const directory = createLeadOceanDirectory({
      apiKey: "k",
      fetch: async (_url, init) => JSON.parse(String(init.body)).person_id === "1"
        ? json({
            success: true,
            data: {
              ...searchRow,
              contact_data: {
                ...searchRow.contact_data,
                contact_emails: [
                  { email: "pat@gmail.com", type: "personal", status: "verified" },
                  { email: "pat@stripe.com", type: "work", status: "catch_all" },
                ],
                contact_phones: [{ phone: "+14155550133" }],
              },
            },
          })
        : json({ success: false, error: { message: "Not found" } }, 404),
    });

    const enriched = await directory.enrichPerson({ personId: "1" });

    expect(enriched?.enriched).toBe(true);
    expect(read("person", "email", enriched!.raw)).toBe("pat@stripe.com");
    expect(read("person", "personal-email", enriched!.raw)).toBe("pat@gmail.com");
    expect(read("person", "phone", enriched!.raw)).toBe("+14155550133");
    expect(read("person", "seniority", enriched!.raw)).toBe("Manager");
    await expect(directory.enrichPerson({ personId: "2" })).resolves.toBeUndefined();
  });

  it("reads a company record", async () => {
    const directory = createLeadOceanDirectory({
      apiKey: "k",
      fetch: async () => json({
        success: true,
        data: {
          company_data: {
            company_name: "Stripe",
            company_domain: "stripe.com",
            company_social_links: { linkedin: { url: "https://www.linkedin.com/company/stripe" } },
            company_employees: { number_of_employees: 12443, number_of_employees_code: "10001+" },
            company_revenue_in_usd: 550000000,
            company_funding: { total_raised_usd: 9000247725, last_round_type: "Secondary market" },
            company_industries: [{ name3: "Technology; Information and Internet" }],
            company_primary_address: { city: "South San Francisco", state: "California", country_code: "US" },
          },
        },
      }),
    });

    const stripe = await directory.enrichCompany({ domain: "stripe.com" });
    const fields = ["company-name", "linkedin-url", "industry", "employees", "employee-range", "revenue", "location", "total-funding", "last-funding-round"];

    expect(Object.fromEntries(fields.map((field) => [field, read("company", field, stripe!.raw)]))).toEqual({
      "company-name": "Stripe",
      "linkedin-url": "https://www.linkedin.com/company/stripe",
      industry: "Technology; Information and Internet",
      employees: "12443",
      "employee-range": "10001+",
      revenue: "550000000",
      location: "South San Francisco, California, US",
      "total-funding": "9000247725",
      "last-funding-round": "Secondary market",
    });
  });

  it("stops asking once records are used up or the account is paced, until the stated reset", async () => {
    let now = new Date("2026-10-19T00:00:00Z");
    let requestCount = 0;
    const directory = createLeadOceanDirectory({
      apiKey: "k",
      now: () => now,
      fetch: async () => {
        requestCount += 1;
        return requestCount === 1
          ? json({ success: true, data: [] }, 200, { "x-quota-state": "paced", "x-quota-reset": "2026-10-19T05:00:00Z" })
          : json({ success: true, data: [] });
      },
    });

    await expect(directory.searchCompanies({ name: "Acme", limit: 3 })).resolves.toEqual([]);
    await expect(directory.searchCompanies({ name: "Acme", limit: 3 })).rejects.toBeInstanceOf(LeadDirectoryUnavailableError);
    expect(requestCount).toBe(1);

    now = new Date("2026-10-19T05:00:01Z");
    await expect(directory.searchCompanies({ name: "Acme", limit: 3 })).resolves.toEqual([]);
    expect(requestCount).toBe(2);

    const spent = createLeadOceanDirectory({ apiKey: "k", fetch: async () => json({ success: false }, 402) });
    await expect(spent.enrichCompany({ domain: "acme.com" })).rejects.toThrow("LeadOcean records are used up");
  });
});
