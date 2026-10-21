# Lead Lookup through LeadOcean

**Status:** Accepted (2026-10-19)

A Lead Lookup finds the person or company in LeadOcean (api.leadocean.io) that best matches the values a row supplies, and writes chosen fields of that match as Generated Fields. The user binds one or more Source Fields to input roles (full name, company website, job title, email, …) and ticks the fields to return. Each ticked field is one Configured Operation of kind `lead-lookup`, so the rule "one Configured Operation, one Generated Field, one Row-Operation Result per row" holds, and Job Progress counts lookups like any other operation.

## How a row is matched

- An exact key is tried first: LinkedIn URL, email or phone for a person, and website domain or LinkedIn URL for a company. One record, and no search.
- Otherwise the directory is searched by name, filtered by the company's domain, or by its name when the domain finds nobody, which costs nothing. Up to `LEADOCEAN_SEARCH_CANDIDATES` candidates (3) come back. Each is scored against every value the row gave: name 0.5, company 0.3, job title 0.1, location 0.1, over the values present. The closest is kept.
- A closest candidate under `LEADOCEAN_MINIMUM_MATCH_CONFIDENCE` (0.5) is not trusted. The row gets `[Not Found]` with a Processing Error naming its score. The **Match Confidence** field lets users filter on the score themselves. A lookup operation may carry its own `minimumConfidence` (0–1). The UI offers Loose 35% / Balanced (server default) / Strict 75%. Because the threshold also decides when the search ladder stops, cached outcomes are keyed by threshold.
- A company found by name search is discounted ×0.6 if it has no domain, and ×0.6 more if `company_number_of_profiles` is 0. This stops namesake shell records from tying with or beating the real company. A shell with both signs missing scores at most 36%. Companies reached by website or LinkedIn URL are not discounted.
- Job titles: all-caps and all-lowercase titles are re-cased. Every word is compared lower-cased against the acronym list (upper-cased) and the joining-word list (lower-cased, except as the first word). Mixed-case words such as "DevOps" are kept.
- Search rows carry no contact points. Email, email status and phone are revealed with one more enrichment, by the matched record's `person_id`, and only when one of those fields was asked for.

Why scoring is needed: on 2026-10-19, a search for "Patrick Collison" at stripe.com returned a social media marketing manager of the same name as the only result. A search alone is not a match.

## Consequences

- All fields of one row's lookup share one search, and identical rows share it across the job and with previews. The cache lives in process memory (10,000 lookups), like the research answer cache.
- LeadOcean bills records, not requests. A search page of 3 costs 3, an enrichment costs 1, and a 404 costs nothing. The UI shows the worst case per row before the job runs. The free plan has 1,000 records in total.
- Once LeadOcean reports the account as paced or over its records (`X-Quota-State`, 402), it answers one request a minute. The adapter sends nothing more until `X-Quota-Reset`, and the remaining rows fail at once with the reason instead of stalling the job.
- The key is the company's (`LEADOCEAN_API_KEY` in the backend environment). Without one, lookups return `[Not Found]` and the New Job page says so.

## Considered Options

- **One operation returning many columns:** fewer list entries, but it breaks the one-operation-one-field rule that intake, progress and chains rely on.
- **Trust LeadOcean's first search result:** cheapest (1 record per row), but wrong on common names, as the example above shows.
- **Score a few candidates (chosen):** up to 3 records per searched row. Rows that carry a LinkedIn URL, email or website still cost 1.

## Revision (2026-10-19): field catalogue and run-and-append

- The fields a lookup can return are a catalogue in `src/lead-lookup/leadocean-records.ts`: about 45 person and 35 company fields, read from LeadOcean's own records. Person fields missing from a search row (contacts, job function, history, skills) cost one enrichment of the matched record, which all such fields of that row share. Searched companies come back unslimmed, so every company field is free once matched.
- The best email is chosen by deliverability (verified, then catch_all_valid, catch_all, untested), then by LeadOcean's priority. LeadOcean's own priority had put an untested address ahead of a catch_all one.
- When the full name finds nobody inside the given company, the last name is tried alone, and short forms count as name matches ("Tobi" for "Tobias"). A company identified by name alone can still match a namesake shell record ("Notion Labs" has a 7-person record with no website), so a website column is the reliable input for companies.
- On the New Job page a lookup runs straight away as its own Enrichment Job on a Row number plus the matched columns only. History keeps just those inputs and the results, and the page appends the results to its table and offers the full CSV for download.

## Revision (2026-10-19): search ladder and name gate

LeadOcean's `q` is free text over the whole profile, so colleagues whose profiles mention a well-known person can fill the first page (searching "Jensen Huang" at NVIDIA put him 7th). A person search now climbs and stops at the first confident match: full name within each company filter (3), then the same filtered by the row's job title, then the last name alone, then one deeper page (`LEADOCEAN_DEEP_SEARCH_CANDIDATES`, 10) where the first page was full. Candidates from every step compete. A name score under 0.7 caps the confidence at 0.8 × the name score, so a shared company and last name cannot carry a different person ("Ryan Nadel" for "Satya Nadella", "Margaret Thorne" for "Cassius Thorne").

Measured live on 20 well-known CEOs plus 5 invented people: 17 of 20 found and 0 wrong matches, with all 5 invented people rejected (before: 13 of 20 found, 1 wrong match, and 2 invented people matched). The 3 misses are data, not matching: one record lists a different current employer, one person is not held, and one person has left the company. Cost: 103 records for the 25 rows; confident rows stay at 3–4 and rows with no confident match pay for the deeper steps.
