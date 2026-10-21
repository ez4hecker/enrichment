# Implementation Path

This path turns the agreed CSV Enrichment architecture into a repository without committing prematurely to a language, framework, database, queue, or cloud vendor. Those choices belong at the composition root once the first vertical slice needs them.

## Module Shape

The repo should have one cohesive domain context, CSV Enrichment. Keep its code organized around a small set of deep Modules rather than mirroring screens, database tables, or queue messages.

| Module | Interface for callers | Responsibility hidden behind the interface | Primary test seam |
| --- | --- | --- | --- |
| **Job Intake** | Submit a configured Source List and return an Enrichment Job identity or validation outcome. | CSV acceptance, empty-row removal, Column Mapping checks, Configured Operation validation, Operation Chain validation, Generated Field naming, Job Snapshot creation, and durable dispatch intent. | Submit realistic input and observe the accepted Job Snapshot or user-facing validation outcome. |
| **Job Execution** | Execute or resume one Enrichment Job identity and return its terminal or resumable outcome. | Claiming work, checkpointing, plan ordering, row traversal, dependency handling, retries, Placeholder creation, output construction, and guarded Job Status transitions. | Execute a submitted job against controlled dependencies and observe Job Status, Row-Operation Results, and the Enriched List. |
| **Operation Library** | Create, revise, list, and retire Custom Operation Definitions. | Prompt Template and Expected Output Type validation, reusable-library rules, and version selection for future Job Snapshots. | Change a Custom Operation Definition and observe its effect on future submissions only. |
| **Job History** | Read an owner's Enrichment Jobs and request an available Enriched List. | Owner-scoped lookup, public Job Status/progress projection, safe error summaries, and download authorization. | Read history for multiple owners and observe only permitted jobs and completed downloads. |

`Job Intake` and `Job Execution` are deliberately distinct Modules: one has synchronous user-facing validation and durable acceptance; the other owns long-running execution. Do not leak their persistence records or queue messages through either Interface.

## Internal Seams and Adapters

The Modules above should keep their Interfaces small. Their implementations may use the following internal seams where behaviour truly varies in production and tests.

| Internal seam | Dependency category | Production adapter | Test adapter | Why the seam is real |
| --- | --- | --- | --- | --- |
| Job dispatch | Remote but owned | Durable queue adapter | In-memory dispatcher | Production must process after the request ends; tests need deterministic delivery. |
| Job and progress persistence | Local-substitutable | Chosen durable-store adapter | Local isolated store | Execution recovery and Job History require persistent records, while tests need fast independent state. |
| List artifact storage | Local-substitutable | Chosen artifact-store adapter | In-memory or temporary-store adapter | Source Lists and Enriched Lists are large artifacts, not queue payloads. |
| Custom-operation provider | True external | OpenAI adapter | Scripted mock adapter | Provider requests, throttling, malformed output, and outages must be reproducible without a live provider. |
| Time and retry scheduling | In-process | System clock/scheduler | Controlled clock/scheduler | Backoff and lease-expiry behavior need deterministic verification. |

No other port should be introduced until a second adapter exists. Standard Operations are internal implementation detail of Job Execution: they do not require a caller-visible seam merely because they are individually testable.

## Dependency Direction

```text
Web interaction / worker delivery
             │
             ▼
   Job Intake        Job History
             │             │
             ▼             ▼
       Job Execution ──► Enriched List
             │
             ├── Job dispatch adapter
             ├── durable-store adapter
             ├── artifact-store adapter
             └── Custom-operation provider adapter
```

The delivery mechanism invokes `Job Execution`; it does not contain execution policy. `Job Execution` owns the policy for row outcomes, retries, operation ordering, and completion. This gives callers and tests a high-leverage Interface rather than making them coordinate queues, storage, prompt rendering, and CSV writing themselves.

## Proposed Repository Layout

Adopt this layout when implementation begins, adapting only file extensions and framework entry points to the selected stack:

```text
src/
  job-intake/          # deep Module: acceptance and Job Snapshot creation
  job-execution/       # deep Module: durable enrichment execution
  operation-library/   # deep Module: reusable Custom Operations
  job-history/         # deep Module: owner-scoped history/read model
  composition/         # application assembly and production adapters
  delivery/            # web and worker entry points; intentionally thin
tests/
  job-intake/
  job-execution/
  operation-library/
  job-history/
docs/
  adr/
```

Keep CSV parsing, Operation Chain planning, prompt variable resolution, and export construction private to the Module that owns the associated user-visible outcome. Promote shared code only after two Modules genuinely require the same stable concept; otherwise a `shared` directory will become a shallow grab bag.

## Implementation Slices

Each slice should leave a working, externally testable capability. Do not begin with a generic queue abstraction, a database schema, or a set of thin CRUD Modules.

### 1. Establish the executable skeleton

- Select the language, runtime, test runner, and delivery mechanism.
- Create the proposed layout, a composition root, and one thin delivery entry point.
- Add a smoke test proving the application can accept a request and return a structured validation outcome.

**Exit criterion:** the repo runs a test suite and has one convention for assembling production dependencies versus controlled test dependencies.

### 2. Deliver a local Standard Operation vertical slice

- Implement Source List acceptance: consistent column counts, empty-row removal, and preservation of source header/order.
- Implement Column Mapping, selection of a Standard Operation Definition, and one Configured Operation, such as Clean Company Name.
- Route submission to an in-process Job Execution invocation for this slice only.
- Generate an Enriched List with the original columns and one Generated Field.

**Exit criterion:** a user can submit a small valid CSV and obtain an `_enriched` CSV with the required non-destructive output shape.

### 3. Make Job acceptance and execution durable

- Introduce persisted Job Snapshots, Job Status, artifacts, and progress checkpoints.
- Add durable job dispatch and a worker delivery entry point.
- Add recovery for duplicate delivery and interrupted execution.
- Implement Job History for Queued, In Progress, Completed, and Failed jobs.

**Exit criterion:** an accepted job continues after the initiating request ends, and Completed is never visible before its Enriched List is available.

### 4. Complete deterministic enrichment behavior

- Add the remaining Standard Operations.
- Implement structured Processing Errors and the required type-specific Placeholders.
- Append `processing_errors` last and verify original-row order is preserved.
- Add output naming and collision rules for Generated Fields.

**Exit criterion:** mixed successful and failed rows produce one usable Enriched List rather than failing the full Enrichment Job.

### 5. Add Custom Operations behind one provider seam

- Implement the Operation Library and versioned selection into a Job Snapshot.
- Render Prompt Templates from Original-Field Inputs.
- Add expected-type validation, bounded retry, timeouts, concurrency controls, and safe provider diagnostics.

**Exit criterion:** a Custom Operation can be saved, used in a job, and tested fully with a scripted provider adapter.

### 6. Add explicit Operation Chains

- Let users choose a particular Generated Field as a Configured Operation Input Reference.
- Compile and validate the Operation Chain before acceptance; reject cycles, missing producers, and self-reference.
- Execute each row in dependency order and record a dependent Placeholder when its required upstream Row-Operation Result failed.

**Exit criterion:** default operations still use only Source Fields, while an explicitly selected chain has correct values and transparent failure propagation.

### 7. Harden operational behavior

- Establish identity/ownership enforcement across Job Intake, Job History, and artifacts.
- Set file-size, row-count, encoding, retention, and download-expiry policies.
- Add metrics, redacted diagnostics, rate-limit dashboards, load tests, and recovery drills.

**Exit criterion:** the platform has documented limits, safe observability, and demonstrated behaviour under provider throttling and worker interruption.

## Verification Strategy

The Interface is the test surface. Prefer one behaviour-rich test at each deep Module over many tests that know its private coordination details.

- `Job Intake` tests submit realistic CSV/configuration pairs and assert only accepted snapshots or validation outcomes.
- `Job Execution` tests use controlled internal adapters and assert public Job Status, progress, Processing Errors, Placeholders, and final Enriched Lists.
- `Operation Library` tests assert reuse and Job Snapshot isolation after edits.
- `Job History` tests assert ownership, status presentation, and download availability.
- End-to-end tests cross thin web/worker delivery with the real chosen durable adapters only for the workflows whose failure modes depend on those adapters: dispatch recovery, storage availability, and authorization.

Once tests cover a deep Module's Interface, remove lower-level tests that merely restate its internal algorithm. Keep focused in-process tests only where they exercise a stable rule that has many important edge cases, such as CSV acceptance or Operation Chain validation.

## Deferred Decisions

These are necessary before the relevant implementation slice, but are not resolved by the product requirements:

1. Runtime/language and web delivery framework.
2. Durable-store, artifact-store, and queue technologies.
3. Authentication and the initial ownership model.
4. File-size, encoding, retention, and download-expiry limits.
5. OpenAI model choice, cost controls, and provider-level rate budgets.

Record an ADR only when one of these choices is costly to reverse, surprising without context, and selected after a real trade-off. Do not create ADRs for ordinary library choices or local implementation details.
