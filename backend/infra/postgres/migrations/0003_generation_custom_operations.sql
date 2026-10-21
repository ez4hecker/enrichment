-- A Generation Custom Operation writes from row data with a chosen Generation Model and no
-- web search. NULL keeps existing definitions as Research Custom Operations.
ALTER TABLE custom_operation_definitions
  ADD COLUMN IF NOT EXISTS generation_model TEXT;
