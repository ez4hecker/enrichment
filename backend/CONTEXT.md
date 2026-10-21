# CSV Enrichment

CSV Enrichment is the internal context for turning a contact list into an Enriched List through a configured set of reusable enrichments. Its language keeps a user's source data, enrichment intent, and generated data distinct.

## Lists and jobs

**Source List**:
The accepted CSV contact list supplied as the starting data for an Enrichment Job. Its fields and accepted rows remain the point of reference for non-chained enrichments.
_Avoid_: upload, input file, raw data

**Enriched List**:
The generated CSV containing the Source List plus the outputs of its Configured Operations.
_Avoid_: output file, result file, enriched CSV

**Output Artifact**:
The durable stored representation of an Enriched List for one completed Enrichment Job. It is kept for a limited retention period; afterwards the Enriched List is Expired, while the Enrichment Job itself remains in Job History.
_Avoid_: output file, result file

**Enrichment Job**:
One recorded request to produce an Enriched List from a Source List and a selected set of Configured Operations.
_Avoid_: job, run, task

**Job Snapshot**:
The fixed configuration of an Enrichment Job, including its mappings, Configured Operations, and their chosen inputs. It describes the job as submitted, not the reusable library as it may later change.
_Avoid_: job config, run configuration

**Job Status**:
The user-visible lifecycle state of an Enrichment Job: Queued, In Progress, Completed, or Failed.
_Avoid_: state, phase

**Job Progress**:
The persisted count of total, completed, failed, and remaining Row-Operation Results for an Enrichment Job. Failed results count as completed work.
_Avoid_: percentage, worker heartbeat

**Job History**:
The view of past and current Enrichment Jobs, their Job Status, and any available Enriched List.
_Avoid_: dashboard

## Ownership

**Owner**:
The authenticated internal user to whom a Source List, Enrichment Job, and its artifacts belong.
_Avoid_: account, tenant, creator

## Fields and enrichment

**Source Field**:
A named column supplied by the Source List.
_Avoid_: input column, raw column

**Column Mapping**:
The user's identification of a Source Field as a canonical contact-data role, such as Company Name or First Name.
_Avoid_: field mapping, header mapping

**Operation Definition**:
A reusable description of an enrichment that may be included in an Enrichment Job.
_Avoid_: operation, enrichment, transformation

**Standard Operation**:
A platform-supplied Operation Definition for a common, consistent enrichment.
_Avoid_: predefined enrichment, built-in transformation

**Custom Operation**:
A user-defined Operation Definition for reuse, including its Prompt Template and Expected Output Type.
_Avoid_: custom enrichment, custom prompt

**Configured Operation**:
One use of an Operation Definition in an Enrichment Job, with its selected Input References and Generated Field. It produces one Row-Operation Result for each accepted row.
_Avoid_: operation, enrichment step, configured enrichment

**Prompt Template**:
The authored instruction of a Custom Operation, with named variables resolved from the selected inputs for a row.
_Avoid_: prompt

**Research Custom Operation**:
A Custom Operation answered from current information found on the web for each row. Every Custom Operation is Research unless it names a Generation Model.
_Avoid_: AI research question, search operation

**Generation Custom Operation**:
A Custom Operation that writes its Row-Operation Result from the row's own inputs alone, with a chosen Generation Model and no web search; for example, an ice breaker built from first name, job title, and company. It must not state facts the inputs do not contain.
_Avoid_: AI writing, prompt-only operation

**Generation Model**:
One of the platform-approved language models a Generation Custom Operation may choose, each with a known price so a run's cost can be estimated before it starts.
_Avoid_: model tier, LLM

**Expected Output Type**:
The declared kind of value that a Custom Operation produces: Text, Number, or Boolean.
_Avoid_: result type, response format

**Generated Field**:
A column added to an Enriched List by a Configured Operation.
_Avoid_: output column, derived column

**Input Reference**:
A selected source of one Configured Operation input. It is either an Original-Field Input or an explicit reference to a Generated Field.
_Avoid_: variable, column reference

**Operation Chain**:
An explicitly selected dependency in which a Configured Operation uses a Generated Field from an earlier Configured Operation in the same Enrichment Job. It is never implied from matching names.
_Avoid_: automatic chain, inferred dependency

**Original-Field Input**:
An Input Reference selected from a Source Field. This is the default input type for a Configured Operation.
_Avoid_: unchained input, raw input

## Research

**Company Dossier**:
The retained research material about one company, gathered while answering earlier Custom Operations and reused to answer later ones about the same company. It holds only research already performed for some Row-Operation Result, never research gathered for its own sake. A company is identified by its website; a company known only by name has no Company Dossier, because a name alone can belong to many companies.
_Avoid_: cache, company profile, research memory

**Research Key Pool**:
The Gemini API keys users have added from their own unbilled Google projects, whose free daily grounded searches answer Research Custom Operations before any paid search. A key is counted against its daily allowance by the platform itself and leaves the pool when Google rejects it or its contributor removes it.
_Avoid_: key bank, shared keys, quota pool

**Spend Limit**:
The maximum external research spend allowed for one Enrichment Job. Row-Operation Results that could only be produced by exceeding it receive a Placeholder and a Processing Error instead; the Enrichment Job still completes.
_Avoid_: budget, cap, quota

## Lead Lookup

**Lead Lookup**:
A Configured Operation that finds the person or company in LeadOcean closest to the values a row supplies, and writes one field of that match. Lookups with the same subject and inputs share one search per row.
_Avoid_: enrichment API, people search, contact finder

**Lookup Input**:
A Source Field bound to the role it plays in a Lead Lookup, such as Full Name or Company Website. A lookup needs at least one input that can name someone: a name, LinkedIn URL, email or phone for a person, and a name, website or LinkedIn URL for a company.
_Avoid_: search field, match column

**Match Confidence**:
How closely the kept candidate agrees with the row's Lookup Inputs, from 0% to 100%. Below the minimum, the row gets a Placeholder instead of the candidate.
_Avoid_: score, accuracy

## Outcomes

**Row-Operation Result**:
The value or failure outcome produced when one Configured Operation is applied to one accepted row.
_Avoid_: cell result, enrichment result

**Processing Error**:
The recorded explanation for a Row-Operation Result that could not be produced normally.
_Avoid_: row error, failure message

**Placeholder**:
The defined value written for a failed Row-Operation Result: `[Not Found]` for Text or Number and `[Uncertain]` for Boolean.
_Avoid_: fallback, generic value
