# Deployment

The production runtime is assembled by `createProductionRuntime` in
`src/composition/create-production-runtime.ts`. It starts the HTTP delivery,
the BullMQ worker, and dispatch reconciliation in one process. A deployment
may split those roles later, but it must retain the same job-store, queue, and
artifact-store configuration. Use
`productionRuntimeOptionsFromEnvironment` from
`src/composition/production-runtime-environment.ts` to parse the documented
environment values before constructing the runtime. The executable bootstrap
is `src/delivery/start-production-runtime.ts`.

## Required environment

Copy `.env.example` to `.env` only for local deployment configuration. Keep
the populated file out of source control and provide its sensitive values from
the deployment platform's secret store.

| Value | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection for Job Snapshots, Job Progress, and Custom Operation definitions. |
| `REDIS_URL` | Redis connection for durable BullMQ delivery. |
| `OUTPUT_ARTIFACT_DIRECTORY` | Writable durable volume for Enriched Lists. It must persist across process restarts. |
| `OPENAI_API_KEY` | Server-side credential for Custom Operations. |
| `OPENAI_MODEL` | The explicitly approved OpenAI model for Custom Operations. |

The optional timing and concurrency values in `.env.example` map directly to
the `ProductionRuntimeOptions` interface.

## Before first start

1. Provision PostgreSQL, Redis, and a persistent artifact volume.
2. Apply `infra/postgres/migrations/0001_enrichment_jobs.sql` to the target
   PostgreSQL database.
3. Configure the deployment's secret manager with the database, Redis, and
   OpenAI values.
4. Apply `infra/postgres/migrations/0002_user_authentication.sql` after the
   first migration. It adds registered users and opaque browser sessions.

## Authentication

The runtime provides simple email/password registration and login. Password
hashes are derived with Node's `scrypt`; browser sessions are opaque, random,
HTTP-only cookies, while only a hash of each session token is stored in
PostgreSQL. A user identifier is the Owner identifier used for Job History and
artifacts.

Deploy the browser over HTTPS and leave `SESSION_COOKIE_SECURE=true`. Set it
to `false` only for local HTTP development.

## Starting the runtime

Run `npm run build` followed by `npm start` when the deployment platform has
injected the required environment values. For local development, copy
`.env.example` to `.env`, fill its values, set
`SESSION_COOKIE_SECURE=false`, and run `npm run start:local`.

## Safe rollout sequence

1. Deploy the migration to an isolated staging database.
2. Run the opt-in Postgres adapter tests against an isolated migrated database,
   never production.
3. Start the runtime with restricted network access to PostgreSQL and Redis.
4. Verify a Standard Operation job, then a Custom Operation job, then a worker
   restart/recovery scenario.
