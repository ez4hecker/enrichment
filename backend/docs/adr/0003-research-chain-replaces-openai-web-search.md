# Research chain replaces OpenAI web search

**Status:** Accepted (2026-10-07)

Research Custom Operations no longer use OpenAI's built-in web search, not even as a fallback. Each row is answered by the cheapest source that can: the company's Company Dossier, then a free grounded Gemini search from the Research Key Pool, then a paid Serper search read by `gpt-5-nano`, then the most relevant result page fetched and read, and otherwise `[Not Found]`. Every paid step is charged against the job's Spend Limit before it runs, so a list can never cost more than the limit. Background and cost comparison: [the proposal](../proposals/ai-research-cost-reduction.md).

## Consequences

- A company is identified by the domain of the Source Field mapped to Website. Column Mappings now affect processing: Website and Company Name are passed to research.
- Pool keys are added by users on the Research Keys page. Each key is checked with Google, refused if its project has billing on, and stored AES-256-GCM encrypted. Contributors confirm that they understand the risk to their own Google account, and only they can remove their keys. Calls are made from the server as they are; nothing hides that the keys are pooled.
- Free-tier grounded search exists only on Gemini 2.5 Flash and Flash-Lite (500 a day per project). Gemini 3 grounding needs billing, so the pool stays on 2.5 until Google changes that.
- Searches per key are counted by us, per Pacific day, and stored, because Google does not report remaining free quota.
- A job waits for free pool searches up to the pool deadline (60 minutes by default). Rows whose free slot would come later use paid search straight away.
- Spend is tracked in memory per job, so a job restarted after a crash starts its ledger again.

## Considered Options

- **Keep OpenAI web search:** about $66 per 6,000-company list, far over the $4 target.
- **One billed Gemini key with a higher limit:** no account risk, but about $4.35–5.90 per list.
- **Employee key pool plus Serper (chosen):** about $1.90 per list at 30 lists a month. The risk falls on contributors' accounts, and they accept it when adding a key.
