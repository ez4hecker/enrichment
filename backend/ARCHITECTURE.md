# CSV Enrichment Platform Architecture

**Status:** Proposed  
**Source:** Requirements and ADR-001 supplied on 2026-09-14

## Problem Statement

Internal users need to enrich large CSV contact lists without leaving a browser tab open, losing their original data, or overwhelming the OpenAI API. They need clear configuration, trustworthy progress and downloads, predictable row-level error handling, and reusable Custom Operations.

ADR-001 correctly establishes asynchronous processing as the foundation. The remaining architectural work is to make submission durable, execution restartable, operation dependencies unambiguous, and outputs auditable.

## Solution

The platform accepts a validated CSV as an immutable input artifact, stores a complete snapshot of the Enrichment Job configuration, and submits a lightweight reference to a durable background queue. Workers load that snapshot, execute an explicit operation plan against every input row, create a new output artifact, and publish progress and completion state for Job History.

A Configured Operation uses values from the original CSV by default. Chaining is opt-in: a user must explicitly select the output of a prior Configured Operation as an input. The platform turns those explicit references into a directed dependency graph, rejects cycles and unavailable inputs before submission, and never infers a chain from matching labels or column names.

## Architectural Principles

- Preserve source data: input artifacts and input-row values are immutable after submission.
- Keep execution durable: browser state is never required for a submitted Enrichment Job to finish.
- Make intent explicit: dependency, mapping, output naming, type expectations, and configuration versions are persisted as part of the job snapshot.
- Fail locally where possible: a Row-Operation Result failure produces a typed Placeholder and structured error without failing the whole job.
- Retry safely: queue delivery and Configured Operation retries must not duplicate output columns or corrupt job state.
- Bound external work: Custom Operations share centrally enforced concurrency and rate-limit controls.
- Expose a small stable contract: clients see `Queued`, `In Progress`, `Completed`, or `Failed`; worker implementation phases remain internal.

## Domain Model

| Concept | Responsibility |
| --- | --- |
| Input Artifact | The validated, uploaded CSV retained unchanged with its header, original row order, and metadata. Empty rows are excluded from the accepted row set. |
| Column Mapping | Maps each source header to a canonical data type where the user has supplied one. A source header remains the authoritative reference for an original value. |
| Operation Definition | A reusable Standard Operation or saved Custom Operation. A Custom Operation has a name, prompt template, expected output type, and version. |
| Configured Operation | One use of an Operation Definition within an Enrichment Job, with explicit input references and one intended output column. |
| Job Snapshot | An immutable copy of the input-artifact reference, mappings, Configured Operations, output labels, prompt/definition versions, and dependency references used for one Enrichment Job. Editing a library operation later cannot change an existing job. |
| Operation Plan | The validated, topologically ordered graph compiled from the Job Snapshot. It identifies each Configured Operation's original-field inputs and any explicit upstream outputs. |
| Row-Operation Result | One typed result for a row and Configured Operation: a value or its required Placeholder, together with structured diagnostic data when it fails. |
| Processing Error | A machine-readable error code and safe human-readable description associated with a row and Configured Operation; these are aggregated into the final `processing_errors` column. |
| Output Artifact | The generated CSV with original columns preserved, one new column per Configured Operation, and `processing_errors` appended last when errors occurred. |

## System Boundaries

| Boundary | Contract and responsibility |
| --- | --- |
| Upload and configuration API | Validates CSV shape, stores the Input Artifact, validates mappings and Configured Operations, persists the Job Snapshot, and returns a durable Enrichment Job identity. |
| Job orchestration | Reliably transitions a persisted job to queueable work and ensures that every accepted job is eventually enqueued or visibly failed. A transactional outbox or equivalent recovery mechanism closes the database-to-queue gap. |
| Background queue | Schedules work independently of the browser and delivers only job identities, never a full CSV or secrets-bearing prompt payload. |
| Worker runtime | Acquires a job safely, compiles or loads its Operation Plan, processes rows, checkpoints progress, writes Output Artifacts, and performs guarded state transitions. |
| Standard-operation adapter | Applies deterministic rule-based transformations locally and returns a value or structured row-operation failure. |
| Custom-operation adapter | Resolves typed variables, invokes the OpenAI API through centrally managed limits, validates the response against the expected output type, and returns a value or structured row-operation failure. |
| Artifact storage | Holds input and output CSVs separately from job metadata; only authorized Job History/download paths issue access to the output. |
| Job History API | Returns an owner-scoped job summary, status, progress, safe failure message, and a download capability only for Completed jobs. |

## Execution Lifecycle

1. The upload boundary parses the CSV, rejects inconsistent column counts, and discards empty rows. It records the header and accepted row count before configuration begins.
2. The user maps source fields, selects Operation Definitions, and configures their Input References and output labels. The configuration boundary validates source references, prompt variables, expected output types, unique output labels, and any chain dependencies.
3. Submission persists the immutable Job Snapshot and a request to enqueue it as one durable logical action. Job History can now show `Queued`.
4. A worker claims the job through an idempotent lease. The externally visible status becomes `In Progress`; repeated queue delivery cannot run two writers for the same job.
5. The worker executes the Operation Plan for each input row. Independent Configured Operations may run in parallel only within configured local and external-service limits; a chained Configured Operation runs only once its declared dependencies have a result for that row.
6. Every Row-Operation Result contains either a typed value or a Placeholder. An upstream failure blocks its dependent Configured Operation for that row; the dependent output receives its own typed Placeholder and an error that identifies the unavailable prerequisite. The worker continues with unaffected rows and Configured Operations.
7. The worker writes one complete Output Artifact in original-row order. It appends one column per Configured Operation, then `processing_errors` last whenever any Row-Operation Result failed. The output name follows the original name with `_enriched` added.
8. Only after the Output Artifact is durably available does the worker mark the job `Completed` and make its download available. Unrecoverable job-level failures mark it `Failed` with a safe diagnostic; the original input remains retained for investigation or a future rerun feature.

## Chaining and Variable Resolution

- By default, all variables resolve exclusively to original CSV fields. This is the normal, non-chained mode.
- A user explicitly invokes chaining by choosing a specific earlier Configured Operation output as an Input Reference. The UI must distinguish Source Fields from Generated Fields, rather than treating both as plain column names.
- References are stored by stable Source Field and Configured Operation identifiers, not display labels. Renaming an output label cannot silently redirect a chain.
- The validator creates the Operation Plan at submission time. It rejects cycles, self-references, missing producers, and references to a Configured Operation that is not included in the current job.
- The planner allows independent branches and executes only the operation(s) needed to satisfy explicitly selected chains. It does not create a chain automatically.
- Chained values are available only within the same input row. Cross-row dependencies, aggregation, and joins are out of scope.

## Reliability, Limits, and Data Handling

- Jobs, job leases, progress checkpoints, and artifact references are persisted so a worker crash can be recovered without restarting the job from the browser.
- Each Row-Operation Result has a stable idempotency key derived from the Job Snapshot, row identity, and Configured Operation identity. Retried execution replaces or reuses that logical result rather than creating duplicates.
- Transient queue, storage, network, and rate-limit failures use bounded retries with exponential backoff and jitter. Permanent input, prompt-validation, and type-validation failures become Row-Operation Result failures unless they make the entire job impossible to execute.
- Custom Operations use shared concurrency and request-rate budgets per configured OpenAI deployment/model. The worker honors provider retry guidance and reports waiting work as still `In Progress`.
- Custom-operation output is validated and normalized to its declared `Text`, `Number`, or `Boolean` type. An invalid or absent response follows the row-level failure rule: `[Not Found]` for Text/Number and `[Uncertain]` for Boolean.
- Progress is based on persisted completed row-operation units, including completed failures, rather than merely a worker heartbeat. Job History can therefore show honest total, completed, failed, and remaining counts.
- Logs and diagnostics include job/operation identifiers, error categories, retry counts, and timing. They must not expose CSV values, rendered prompts, credentials, or raw provider responses by default.
- Artifact retention, permitted file size, permitted row count, accepted CSV encoding, and download expiry are configurable operational policies. The UI reports policy validation failures before queueing.

## Security and Ownership

- Every Input Artifact, Job Snapshot, and Output Artifact belongs to the authenticated internal user or organization that created it.
- Job History and download authorization are checked server-side from this ownership relation; an artifact-storage location alone is never authorization.
- Prompt templates and CSV content are treated as potentially sensitive. Access follows the same ownership rules, and observability data is redacted.
- OpenAI credentials live only in the server-side Custom-operation adapter and are never delivered to browsers, queues, or job snapshots.

## User Stories

1. As a list operator, I want invalid CSV structures rejected before configuration, so that I do not wait for a job that cannot be processed.
2. As a list operator, I want blank CSV rows ignored, so that enrichment effort is spent only on contacts.
3. As a list operator, I want to map my headers to canonical data types, so that operations receive the intended input.
4. As a list operator, I want to choose Standard Operations, so that I can apply predictable clean-up without AI usage.
5. As a list operator, I want to save and reuse Custom Operations, so that common enrichment logic is consistent across jobs.
6. As a list operator, I want prompt variables selected from a guided list, so that my prompts do not contain broken references.
7. As a list operator, I want Configured Operations to use original CSV columns by default, so that each result is easy to understand.
8. As a list operator, I want to explicitly choose a prior Configured Operation's output when I need a chain, so that I can build deliberate multi-step enrichments.
9. As a list operator, I want cycles and missing chain inputs rejected before submission, so that my job cannot get stuck in an impossible plan.
10. As a list operator, I want my configured job to start in the background, so that I can close the browser without losing work.
11. As a list operator, I want to see accurate queued, active, completed, and failed states, so that I know whether to wait or take action.
12. As a list operator, I want meaningful progress, so that I can estimate when a large enrichment will be ready.
13. As a list operator, I want row-specific problems to leave a clear Placeholder, so that I can distinguish missing enrichment from source data.
14. As a list operator, I want all row-operation errors collected in one final column, so that I can review failures without losing the enriched file.
15. As a list operator, I want a dependency failure to be visible in downstream results, so that chained output never looks accidentally valid.
16. As a list operator, I want the downloaded file to preserve my original columns and row order, so that I can safely reimport it elsewhere.
17. As a list operator, I want one predictable added column per operation, so that I can trace every result to its configured enrichment.
18. As a list operator, I want a completed job's download to remain available from Job History, so that I can return after work is finished.
19. As a Custom Operation author, I want edits to affect future jobs only, so that historical outputs remain reproducible.
20. As a platform operator, I want controlled API concurrency and retries, so that large jobs do not trigger provider rate-limit failures.
21. As a platform operator, I want safe diagnostics and recoverable jobs, so that I can investigate failures without exposing contact data.
22. As a platform operator, I want every job and artifact to be owner-scoped, so that internal users cannot access one another's lists.

## Implementation Decisions

- **Asynchronous execution:** Retain ADR-001. All submitted Enrichment Jobs are processed outside the browser by queue-backed workers.
- **Durable submission:** Persist the Job Snapshot and enqueue intent before notifying the client of successful submission. Use an outbox or equivalent reconciler to recover from partial database/queue failure.
- **Immutable job configuration:** Snapshot Operation Definitions, Configured Operations, prompt templates, expected output types, mappings, labels, and dependencies at submission. Library changes affect only later jobs.
- **Explicit dependency graph:** Default to original-field inputs; represent chains only when a user selects a generated output. Validate and topologically order the graph before queueing.
- **Two-layer state model:** Expose only the four specified Job History states while retaining internal lease/checkpoint/retry details for the worker runtime.
- **Idempotent worker ownership:** Use a job lease plus deterministic row-operation identities. A retry must be indistinguishable from a single successful logical execution in the final artifact.
- **Structured failures:** Store error code, safe message, and operation/row association separately from the printable final error cell. Use the defined type-specific Placeholders.
- **Append-only export:** Never overwrite source cells. Derive one output column per selected operation, disambiguate labels at configuration time, and append `processing_errors` last.
- **Adapter boundary for enrichments:** Isolate deterministic transformations and OpenAI calls behind result-oriented adapters. This keeps orchestration independent of a particular standard rule or AI provider.
- **Centralized provider controls:** Apply concurrency, rate limit, timeout, retry, and response-type validation in the Custom-operation adapter boundary rather than separately in each worker routine.
- **Artifact-backed processing:** Keep CSV bytes in artifact storage and job metadata in durable application storage. Queue payloads contain only references.
- **Observable progress:** Persist progress at a controlled checkpoint cadence and derive Job History totals from the execution plan rather than client reports.

## Testing Decisions

- Tests assert observable behavior and durable state transitions, not worker internals or individual queue-library calls.
- The primary seam is the job execution boundary: submit a persisted Job Snapshot to a controlled worker environment and observe its status, progress, row results, errors, and Output Artifact. This verifies most user-visible behavior without binding tests to internal scheduling.
- A second focused seam is the Custom-operation adapter. Substitute a deterministic provider response/failure source to test variable resolution, rate-limit/retry classification, type normalization, and Placeholder behavior without live OpenAI calls.
- CSV acceptance tests cover inconsistent column rejection, empty-row removal, headers, encoding policy, original ordering, output labels, and final error-column placement.
- Planning tests cover default original-field resolution, explicit chains, independent branches, topological ordering, self-reference, cycles, missing producers, and attempts to chain to operations absent from the job.
- Execution tests cover mixed success/failure rows, upstream chain failure propagation, job-level unrecoverable failure, restart after a lease expires, duplicate delivery, and retry idempotency.
- Job History tests cover the four public states, monotonic progress, owner-scoped visibility, completion only after a downloadable artifact exists, and safe presentation of diagnostics.
- Export tests cover preservation of every accepted source value, one output per configured operation, correct Text/Number/Boolean Placeholders, and the `_enriched` output-name rule.
- Load and resilience tests use representative large artifacts and controlled provider throttling to verify configured concurrency, bounded retries, recovery, and that queue backpressure does not make browser requests slow.

## Out of Scope

- Cross-row enrichment, joins to other datasets, aggregation, and automatic inference of operation chains.
- Automatic retry/rerun UI, job cancellation, partial-file downloads, and manual repair/replay of selected rows.
- Multiple AI providers, user-provided provider credentials, and prompt-template sharing outside the internal ownership model.
- Spreadsheet formats other than CSV, interactive in-place editing of results, and changes to the original uploaded file.
- Detailed retention-period, maximum-size, encoding, and access-expiry values; these are operational policy choices to set before launch.

## Further Notes

### Improvements identified beyond ADR-001

ADR-001 addresses the essential choice of background jobs. The following decisions prevent common failures in a production queue-backed enrichment system:

- Close the persistence-to-queue failure gap so a job cannot be recorded as submitted yet never run.
- Snapshot Custom Operations so Job History remains reproducible after the reusable library changes.
- Require explicit operation-output references to make chains safe, explainable, and cycle-free.
- Separate row-level failures from job-level failures, preventing one bad record from discarding a valuable completed file.
- Make output availability the completion gate, avoiding Job History links to missing or partially written artifacts.
- Add idempotency, leases, and checkpoints before adding worker parallelism, so retries and crashes cannot corrupt results.
- Centralize OpenAI rate limits and redaction, which protects both provider capacity and potentially sensitive contact data.

### Decisions still needed before implementation

1. Set operational limits for CSV size, accepted encoding, maximum rows, artifact retention, and download-link lifetime.
2. Define the initial internal ownership model: individual-only, organization-shared, or role-based access.
3. Choose the exact user-facing form of explicit chain selection and the display convention for generated output labels.
4. Set provider/model choices and budgets for Custom Operations, including whether users see per-job cost estimates.
