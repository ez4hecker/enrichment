CREATE TABLE IF NOT EXISTS enrichment_jobs (
  id UUID PRIMARY KEY,
  owner_id TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Queued', 'In Progress', 'Completed', 'Failed')),
  lease_id UUID,
  lease_expires_at TIMESTAMPTZ,
  output_artifact_id UUID,
  dispatch_pending BOOLEAN NOT NULL DEFAULT TRUE,
  total_operations INTEGER NOT NULL CHECK (total_operations >= 0),
  completed_operations INTEGER NOT NULL DEFAULT 0 CHECK (completed_operations >= 0),
  failed_operations INTEGER NOT NULL DEFAULT 0 CHECK (failed_operations >= 0),
  remaining_operations INTEGER NOT NULL CHECK (remaining_operations >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (completed_operations + remaining_operations = total_operations),
  CHECK (failed_operations <= completed_operations)
);

CREATE INDEX IF NOT EXISTS enrichment_jobs_owner_created_at_idx
  ON enrichment_jobs (owner_id, created_at);

CREATE INDEX IF NOT EXISTS enrichment_jobs_pending_dispatch_idx
  ON enrichment_jobs (created_at)
  WHERE dispatch_pending = TRUE;

CREATE TABLE IF NOT EXISTS enrichment_job_operation_results (
  job_id UUID NOT NULL REFERENCES enrichment_jobs (id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL CHECK (row_index >= 0),
  operation_index INTEGER NOT NULL CHECK (operation_index >= 0),
  failed BOOLEAN NOT NULL,
  PRIMARY KEY (job_id, row_index, operation_index)
);

CREATE TABLE IF NOT EXISTS custom_operation_definitions (
  id UUID PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  prompt_template TEXT NOT NULL,
  expected_output_type TEXT NOT NULL CHECK (expected_output_type IN ('Text', 'Number', 'Boolean')),
  version INTEGER NOT NULL CHECK (version > 0),
  retired BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS custom_operation_definitions_owner_active_idx
  ON custom_operation_definitions (owner_id, created_at)
  WHERE retired = FALSE;
