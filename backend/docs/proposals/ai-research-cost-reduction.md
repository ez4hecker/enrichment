# Proposal: Cutting AI Research cost below $4 per list

**Status:** Approved and implemented 2026-10-07 with the employee key pool (option 2a). See ADR 0003. History Cost column and 90-day list retention are not built yet.
**Date:** 2026-10-04
**Scope:** The "AI Research" Custom Operation (one free-text question answered per company with web search). Standard Operations are unaffected.

## 1. The ask

AI Research currently uses OpenAI's built-in web search on every unique company. For a list of 6,000 different companies that is **≈ $66 per question**. The target is **under $4 per list**, at **30–40 lists a month**, where every list asks its own unique question.

This document proposes a cheaper research chain, prices every option considered at month end (section 6), and lists the decisions the product owner needs to make (section 9).

**Planning assumption used throughout:** every list has **6,000 rows and 6,000 different companies**, and no company repeats across lists. This is the worst case; real lists with repeated companies cost less (section 6.5).

## 2. What we have actually spent

Source: OpenAI usage dashboard ("enrichment tool" project, last 30 days) cross-checked against the `enrichment_jobs` table.

| Date | Spend | Requests | Web searches | What it was |
| --- | --- | --- | --- | --- |
| Sep 16 | ≈ $0.39 | 5,819 | 0 | A Custom Operation with prompt `findout if they are recently funded company` and **no input binding**, so every row sent the identical question without naming a company. 5,819 useless answers. The backend now rejects such prompts (`PROMPT_REFERENCES_NO_INPUT`). |
| ≈ Sep 29 | ≈ $0.54 | 47 | 48 | AI Research as it works today: a 3-row job, a 10-row saved preview and ≈ 34 unsaved previews (previews are not recorded in the database). |
| **Total** | **$0.93** | 5,866 | 48 | |

**Observed unit cost:** ≈ **$0.011 per company per question**, of which ≈ 90% is the web-search fee rather than tokens. Reducing tokens or reasoning effort barely moves the bill; the search fee is what must go.

## 3. Reference list

`Techsommet - Next Gen Payments … 5.9K` (the only real list in the database) was used to check how real data behaves:

- 5,819 rows, **2,868 unique company names**, **2,751 unique website domains**. This list is about half repeats, so it is cheaper than the planning assumption.
- `Website` filled on 96% of rows; 242 rows (129 names) have none
- No website is shared by two names, but **8 names map to two different companies** (e.g. `Citizens Bank` → thecitizensbank.net / citizensbank24.com, `First Bank` → myfirstbank.com / first.bank). Deduplicating by name alone would mix them up.
- The Apollo `Total Funding` column exists but is empty in this export.

## 4. Options considered

| Option | Verdict | Why |
| --- | --- | --- |
| **OpenAI web search (today)** | ❌ Replace | $10–25 per 1,000 searches plus tokens. $4 buys ≈ 360 companies; a list has 6,000. |
| **Better dedup only** (exact name today → website domain) | Part of the plan | Helps lists with repeated companies; does nothing for 6,000 different companies. |
| **Serper** (Google results API) + cheap model reading snippets | ✅ Core | $0.75–1.00 per 1,000 searches at our volumes; Google-quality results; ≈ $0.0009–0.0011 per company including reading. |
| **Gemini "Grounding with Google Search"** | ✅ Free part only | Billed project: ≈ 1,500 free search prompts/day, then **$35 per 1,000** (worse than OpenAI). Free-tier key: ≈ 500/day, hard stop. Must never be used past the free allowance. |
| **Google AI Pro subscription** | ❌ Doesn't help | Consumer plan; benefits apply inside AI Studio, not to API keys. Includes ≈ $10/month Cloud credit with unreliable API applicability. |
| **Self-run Chromium scraping of Google** | ❌ Reject | Google blocks within tens–hundreds of queries; needs paid residential proxies + CAPTCHA solving (more than Serper); against Google ToS; HTML changes break the parser; 8–16 h per list. |
| **Crawlee** (open-source crawler) | ❌ for Google · 🔜 maybe later | Free library, but provides no proxies or CAPTCHA solving, so same problems as above. Useful later for crawling companies' own websites (no blocking, no ToS issue). |
| **deepscraper.dev** | ❌ Reject | Website-to-markdown tool, not a search API. No identifiable operator, docs, pricing or source repo; claims "free, no rate limits, forever". |
| **Exa** | 🔜 maybe later | $7 per 1,000 searches with page text, $5 per 1,000 answers. Far over budget as the main search; possible later as a misses-only step paid from its free $10/month. |
| **Brave / Tavily search APIs** | ❌ Reject | ≈ $5–8 per 1,000 searches; 5–8× Serper. |
| **Multiple Serper free accounts** | ❌ Reject | The 2,500 free queries are a **one-time** sign-up credit: 10 accounts = 25,000 searches once ≈ $19–25 saved, gone within days. |
| **Employee Gemini key pool** (7 free-tier keys) | ⚖️ PO decision | The only setup that stays under $4 with 6,000-company lists. Risks in section 8. |

### What competitors do

Sendr publishes nothing about its AI enrichment internals. Clay (the market leader) and others (Bitscale, Persana, Freckle, Origami) all describe the same pattern, which this proposal follows:

- **Waterfalls:** cheapest source first, fall back only when it returns nothing.
- **Web-research agents as the last step**; Clay advises using non-web AI wherever possible ("up to 90% cheaper").
- **Conditional runs** to skip rows that don't need research.
- **Dedup and fallback logic** is where the savings come from (a published Clay replacement: ≈ $18 per 10,000 research tasks with a cheap model on the Batch API).

Clay users pay ≈ $0.70–3.75 per enriched contact; our target is under $0.0007 per company.

## 5. Proposed design

### Research chain (per unique company, cheapest first)

1. **Company Dossier.** Reuse research already gathered about this company in earlier jobs (see below). Tried only when the next step would cost money.
2. **Employee Gemini key pool** *(only if the PO approves it)*. Free-tier keys, ≈ 450 searches per key per day.
3. **Company's billed Gemini key.** Only within its free allowance (stop at ≈ 1,400/day). Never paid Gemini searches.
4. **Serper search + OpenAI gpt-5-nano** reading the snippets, with reasoning effort at its lowest.
5. **Fetch the top result page ourselves**; nano reads the page text.
6. **`[Not Found]`**.

**OpenAI web search is removed entirely**, including as a fallback, so that no list can exceed the limit.

### Supporting decisions

| Area | Decision |
| --- | --- |
| **Company identity** | Website domain from the column mapped to **Website** (`https://www.toasttab.com/` → `toasttab.com`). Rows without a website: dedup within the list by exact name, never use or feed the Dossier. The website is also put into the search query to pick the right company. |
| **Company Dossier** | Built only as a by-product of searches already performed: Serper result text, Gemini answers and source links, kept ≈ 90 days. **No extra searches.** Switched off by setting if fewer than ~20% of Dossier attempts produce an answer. |
| **Spend Limit** | Estimate shown before "Start Processing". Hard stop at **$3.50** per job ($0.50 margin under $4). Rows that would exceed it get `[Not Found]` + Processing Error "Spend limit reached"; the job still completes. |
| **Gemini free-allowance counting** | Google does not expose remaining free quota, so the backend counts per key, stops early (≈ 1,400 billed / ≈ 450 free-tier), resets at midnight Pacific and includes preview searches. A miscount on a billed key would be charged at $35 per 1,000. |
| **Pool deadline** *(pool only)* | Free keys are slow (≈ 10–15 requests/min each). After a deadline, remaining companies go to Serper in parallel. The team chose **30 minutes**; with 6,000-company lists a **60-minute** deadline is cheaper (section 6.3). |
| **Preview** | Runs the same chain. Shows the answer, which step produced it, source link, quoted snippet and cost. Preview answers feed the Dossier. |
| **Enriched List** | Unchanged shape: one Generated Field per Configured Operation, `processing_errors` last. No source column. |
| **Job History** | New **Cost** column with breakdown (Dossier hits, Gemini free searches, Serper searches, pages fetched, nano tokens) and a "Spend limit reached: N rows not researched" marker. Compared against provider invoices monthly at first. |
| **Retention** | Source List and Enriched List files deleted after **90 days**; the History entry stays and shows "Expired". Today each 6K list stores ≈ 23 MB forever (≈ 0.7–0.9 GB/month at 30–40 lists). |
| **Quality** | Judged by the team from previews; no formal pass bar. |

### Considered but not adopted

- **Batch API for nano** (50% off, results in up to hours). Saves ≈ $10–15/month at 6,000-company lists; not worth the wait.
- **Dossier from 3 general searches per new company.** Triples first-sighting search cost; replaced by the by-product Dossier.
- **Gemini Flash-Lite as the reader.** One vendor fewer, but slightly more per token; the team prefers keeping OpenAI for reading.
- **Source column in the CSV.** Breaks the Enriched List shape; sources stay in the preview and Dossier.

## 6. Month-end cost of every option

### 6.1 Assumptions

- **Every list: 6,000 rows, 6,000 different companies, one question.** No company repeats across lists, so the Dossier saves nothing (worst case).
- **30 lists/month** = 1 list a day = **180,000 companies/month**.
- **40 lists/month** ≈ 1.3 lists a day = **240,000 companies/month**.
- One search per company; ≈ 10% of companies need a page-fetch second try.

| Unit price | Value | Notes |
| --- | --- | --- |
| OpenAI web search (today) | ≈ $0.011 per company | Observed on Sep 29, tokens included |
| Serper | $0.75 per 1,000 (500K pack, $375 upfront) – $1.00 per 1,000 ($50 / 50K pack) | Credits expire after 6 months; the 500K pack only pays off above ≈ 85K searches/month |
| gpt-5-nano reading snippets | ≈ $0.00014 per company | ≈ 2K input + 100 output tokens at ≈ $0.05 / $0.40 per 1M |
| Page-fetch second try | ≈ $0.0003 per company | ≈ 5K tokens read by nano |
| Gemini search tokens | ≈ $0.00004 per search | The search fee is free within the allowance; tokens are billed on the billed key, free on free-tier keys |
| Gemini free allowance | ≈ 1,400/day billed key, ≈ 450/day per free-tier key | Our safety margins under ≈ 1,500 / 500 |
| Gemini past the allowance | $35 per 1,000 searches | Never used in the proposed design |
| Exa | $7 per 1,000 searches with contents; $5 per 1,000 answers; $10/month free | |
| Brave / Tavily | ≈ $5 / $5–8 per 1,000 searches | |

### 6.2 Every option at month end

Sorted cheapest first. "Meets $4" means every list stays under $4 without the Spend Limit cutting rows.

| # | Option | 30 lists / month | 40 lists / month | Per list | Meets $4? |
| --- | --- | --- | --- | --- | --- |
| 1 | **Billed Gemini key + 7-key employee pool + Serper + nano** (60-min deadline) | **≈ $57** | **≈ $101–127** | ≈ $1.90 (30) · $2.55–3.20 (40) | ✅ |
| 2 | Same as #1 with the 30-min deadline | ≈ $62–93 | ≈ $115–150 | ≈ $2.05–3.10 (30) · $2.90–3.75 (40) | ✅ |
| 3 | **One billed Gemini key + Serper + nano** | **≈ $130–165** | **≈ $185–235** | ≈ $4.35–5.50 (30) · $4.65–5.90 (40) | ❌ |
| 4 | One free-tier Gemini key (no billing) + Serper + nano | ≈ $155–195 | ≈ $210–265 | ≈ $5.10–6.50 | ❌ |
| 5 | Serper + nano only (no Gemini) | ≈ $165–210 | ≈ $220–280 | ≈ $5.50–7.00 | ❌ |
| 6 | Self-run Chromium / Crawlee scraping Google + nano (very rough) | ≈ $200–350 + maintenance | ≈ $270–470 + maintenance | ≈ $7–12 | ❌ (and 8–16 h per list) |
| 7 | Exa Answer | ≈ $890 | ≈ $1,190 | ≈ $30 | ❌ |
| 8 | Brave search + nano | ≈ $925 | ≈ $1,235 | ≈ $31 | ❌ |
| 9 | Tavily search + nano | ≈ $930–1,470 | ≈ $1,240–1,960 | ≈ $31–49 | ❌ |
| 10 | Exa search with contents + nano | ≈ $1,305 | ≈ $1,740 | ≈ $43 | ❌ |
| 11 | **Today: OpenAI web search** | **≈ $1,980** | **≈ $2,640** | **≈ $66** | ❌ |
| 12 | Gemini only, paying past the free allowance | ≈ $4,840 | ≈ $6,940 | ≈ $160–175 | ❌ |

Not separately priced:

- **Multiple Serper free accounts:** one-time 25,000 free searches ≈ −$19–25 in the first month only.
- **Google AI Pro:** at most −$10/month, only if its Cloud credit applies to API billing.
- **deepscraper.dev:** not a search API, so it cannot fill this role.

Self-run scraping (#6) basis: residential proxies at ≈ $3–8/GB for ≈ 0.15 MB per results page, CAPTCHA solving on ≈ 20% of queries at ≈ $1–3 per 1,000, plus nano. Engineering and maintenance time is not included.

### 6.3 The two realistic setups, line by line

**30 lists/month (180,000 companies)**

| Line | One billed key | Billed key + 7-key pool (60-min deadline) |
| --- | --- | --- |
| Free Gemini searches | 42,000 | 136,500 (42,000 billed + 94,500 pool) |
| Serper searches | 138,000 | 43,500 |
| Serper cost | $103.50–138.00 | $43.50 (volume too low for the 500K pack) |
| nano reading Serper results | $19.30 | $6.10 |
| Page-fetch second tries | $5.40 | $5.40 |
| Gemini tokens (billed key) | $1.70 | $1.70 |
| **Month total** | **≈ $130–165** | **≈ $57** |
| **Per list** | **≈ $4.35–5.50** | **≈ $1.90** |

**40 lists/month (240,000 companies)**

| Line | One billed key | Billed key + 7-key pool (60-min deadline) |
| --- | --- | --- |
| Free Gemini searches | 42,000 | 136,500 |
| Serper searches | 198,000 | 103,500 |
| Serper cost | $148.50–198.00 | $77.60–103.50 |
| nano reading Serper results | $27.70 | $14.50 |
| Page-fetch second tries | $7.20 | $7.20 |
| Gemini tokens (billed key) | $1.70 | $1.70 |
| **Month total** | **≈ $185–235** | **≈ $101–127** |
| **Per list** | **≈ $4.65–5.90** | **≈ $2.55–3.20** |

**Effect of the pool deadline.** Free-tier keys handle roughly 70–100 searches a minute in total, so a 6,000-company list needs ≈ 45–65 minutes to use the pool fully. With the 30-minute deadline the pool covers only ≈ 2,100–3,000 companies per list before Serper takes over, adding ≈ $0.15–1.20 per list (option #2 vs #1).

### 6.4 What the Spend Limit does with one billed key

With one key, every 6,000-company list exceeds $3.50, so the Spend Limit stops it:

| | 30 lists/month | 40 lists/month |
| --- | --- | --- |
| Month total (capped) | ≈ $105 | ≈ $140 |
| Companies left `[Not Found]` per list ("Spend limit reached") | ≈ 940–1,740 (16–29%) | ≈ 1,260–2,070 (21–35%) |
| Limit needed to research every company | ≈ $5.50 per list | ≈ $6.00 per list |

### 6.5 If lists repeat companies like Techsommet (≈ 2,900 unique per 6,000 rows)

| Setup | Per list | 30 lists | 40 lists |
| --- | --- | --- | --- |
| Today: OpenAI web search with exact-match cache | ≈ $32 | ≈ $950 | ≈ $1,265 |
| One billed Gemini key | ≈ $1.50–1.85 | ≈ $45–56 | ≈ $70–90 |
| Billed key + pool | ≈ $0.20–0.30 | ≈ $6–9 | ≈ $10–20 |

The Company Dossier lowers every figure further once companies start repeating across lists. Overlap is unknown today; the History Cost column will show it.

### 6.6 Infrastructure (VPS)

| Item | Size |
| --- | --- |
| Company Dossier | ≈ 0.5–1 GB/month compressed at 180–240K companies; levels off at ≈ 1.5–3 GB with 90-day expiry; negligible CPU/RAM |
| Job storage today (no retention) | ≈ 23 MB per 6K list → ≈ 0.7–0.9 GB/month, ≈ 8–11 GB/year |
| Job storage with 90-day retention | Levels off at ≈ 2–2.7 GB |

## 7. Speed (one list of 6,000 different companies)

| Setup | Estimated time |
| --- | --- |
| Today (5 concurrent OpenAI web searches, ≈ 10 s each) | ≈ 3.3 h (no full AI Research job has ever completed, so unverified) |
| One billed Gemini key + Serper | ≈ 15–25 min |
| Billed key + pool, 30-min deadline | ≈ 35–40 min |
| Billed key + pool, 60-min deadline | ≈ 45–65 min |

Jobs still run one at a time. At 30–40 lists a month (1–2 a day) that is not a bottleneck.

## 8. Risks

| Risk | Mitigation |
| --- | --- |
| **Gemini cliff:** past the free allowance a billed key costs $35 per 1,000 searches | Own conservative counter; Gemini never used beyond it; History Cost column; provider spend alerts |
| **Lower answer quality** than OpenAI web search (snippets instead of browsing) | Website in the query; nano must quote a supporting snippet or answer `[Not Found]`; page-fetch second try; preview shows source and step so the team can judge |
| **Employee key pool** *(if adopted)* | Pooling keys for one company's workload goes against Google's terms on circumventing limits; enforcement would fall on **employees' personal accounts**. Free-tier data may be used by Google for training (team has accepted this). Only unbilled keys accepted; keys stored encrypted; any invalid or blocked key is skipped and the chain falls through to Serper, so nothing breaks. If the whole pool were blocked, cost reverts to option #3. Employees must volunteer knowing the risk. |
| **Estimate drift:** History cost is our estimate, not the invoice | Monthly reconciliation against Google, Serper and OpenAI bills at first |
| **Prices change** | All prices come from third-party pages; verify before building (section 10) |

## 9. Decisions for the product owner

1. **Approve the research chain** (section 5), replacing OpenAI web search.
2. **How to handle lists of 6,000 different companies.** One billed key alone cannot stay under $4. Choose one:
   - **a. Employee key pool:** ≈ $57/month at 30 lists, ≈ $101–127 at 40; every company researched; account and terms risk on volunteering employees; admin page for keys.
   - **b. One billed key, raise the limit to ≈ $6 per list:** ≈ $130–165/month at 30 lists, ≈ $185–235 at 40; every company researched; no account risk.
   - **c. One billed key, keep $3.50:** ≈ $105–140/month; 16–35% of companies per list left `[Not Found]`.
3. **Spend Limit value** ($3.50 proposed, or ≈ $6 with option 2b).
4. **Pool deadline** *(if 2a)*: 30 minutes (faster, ≈ $62–93 at 30 lists) or 60 minutes (cheaper, ≈ $57).
5. **90-day retention** of Source and Enriched Lists.

## 10. Facts to verify before building

- Gemini API: free grounded-search allowance on a billed project vs. free tier, which models share it, reset time, per-minute limits, and token billing for grounded calls.
- Current Serper pack prices and expiry; current gpt-5-nano pricing.
- That each pooled key's project has billing disabled.
- The real share of unique companies per list (the biggest driver of cost).

## 11. Unrelated finding

`.env.example` contains what appears to be a live OpenAI API key (`sk-proj-…`). Revoke it and replace it with a placeholder regardless of this proposal.

## Sources

- OpenAI web search pricing: [OpenAI community](https://community.openai.com/t/web-search-pricing-for-reasoning-models/1377274), [toolradar](https://toolradar.com/tools/openai-api/pricing)
- Serper / Brave / Tavily: [ColdIQ – Serper pricing](https://coldiq.com/blog/serper-pricing), [CostBench – Brave](https://costbench.com/software/ai-search-apis/brave-search-api/), [Tavily credits](https://docs.tavily.com/guides/api-credits)
- Gemini grounding: [Google AI Developers Forum](https://discuss.ai.google.dev/t/grounding-free-quota-clarifying-2026-rules-for-gemini-2-5-flash-paid-tier-1/144593), [aifreeapi – pricing and quotas](https://www.aifreeapi.com/en/posts/gemini-api-pricing-and-quotas), [pecollective](https://pecollective.com/tools/gemini-free-tier-guide/)
- Google AI Pro and the API: [Google AI plans](https://ai.google.dev/gemini-api/docs/google-ai-plans), [forum thread](https://discuss.ai.google.dev/t/misleading-quota-system-devalued-ai-pro-subscription-for-developers/109197)
- Exa: [Exa pricing update](https://exa.ai/docs/changelog/pricing-update), [fastcrw](https://fastcrw.com/blog/exa-pricing-explained), [CostBench – Exa](https://www.costbench.com/software/web-scraping/exa/)
- Competitors: [Clay University – maximize credits](https://www.clay.com/university/lesson/best-practices-to-maximize-your-credits), [Clay AI pricing](https://university.clay.com/docs/ai-pricing), [gravity.fast – Claygent](https://gravity.fast/blog/clay-ai-agent/), [findymail – Clay](https://www.findymail.com/blog/clay-data-enrichment/), [dev.to – Clay alternative cost math](https://dev.to/dan_bbddf989101dbe6f23c77/claycom-alternative-custom-enrichment-agent-cost-math-1kil), [daveswift – Sendr review](https://daveswift.com/sendr/)
