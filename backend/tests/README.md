# Test Layout

Organize tests by the deep Module Interface they exercise: `job-intake`, `job-execution`, `operation-library`, and `job-history`.

Use controlled adapters for dispatch, persistence, artifact storage, the Custom-operation provider, and time. Tests should observe validation outcomes, Job Status, Processing Errors, Placeholders, and Enriched Lists rather than private implementation coordination.
