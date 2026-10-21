# Postgres setup

Apply the SQL files in `migrations/` in lexical order before starting the application runtime. The first migration creates the `enrichment_jobs` table, its progress invariants, and indexes used by owner-scoped Job History and the dispatch reconciler.

The opt-in adapter contract test uses `CSV_ENRICHMENT_TEST_DATABASE_URL`. Point it to an isolated test database whose schema has already been migrated:

```powershell
$env:CSV_ENRICHMENT_TEST_DATABASE_URL = "postgres://..."
npm run test -- tests/composition/postgres-job-store.test.ts
```

Do not point the integration test at a production database; it creates and deletes test Job records.
