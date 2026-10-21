# Source Layout

The application code is organized around the deep Modules identified in [the implementation path](../docs/IMPLEMENTATION-PATH.md): `job-intake`, `job-execution`, `operation-library`, and `job-history`.

`composition` assembles production adapters; `delivery` contains thin web and worker entry points. Do not place domain rules, CSV logic, queue policy, or provider handling in either location.

Avoid introducing a general `shared` directory. Move a concept only when two Modules need the same stable Interface.

## Runtime assembly

`composition/create-production-runtime.ts` assembles the Postgres Job Store, filesystem Output Artifact Store, BullMQ dispatcher, worker, and HTTP delivery layer. It requires an injected `ownerIdForRequest` resolver. This is deliberate: authentication and the initial ownership model have not been selected, so no production runtime accepts the test-only `x-owner-id` header by default.

Apply [the Postgres migration](../infra/postgres/migrations/0001_enrichment_jobs.sql) before constructing the runtime. Supply a Postgres URL, Redis URL, output-artifact directory, a trusted identity resolver, and explicit `openAi` configuration (server-side API key, model, timeout/retry/concurrency limits) from the deployment entry point. The OpenAI provider keeps responses out of API storage and never writes prompts or credentials to application logs.
