-- Distinguish explicitly approved chat imports in the existing audit trail.
-- No conversation transcript is stored by this migration.
ALTER TABLE crm_history DROP CONSTRAINT IF EXISTS crm_history_operation_check;
ALTER TABLE crm_history
  ADD CONSTRAINT crm_history_operation_check
  CHECK (operation IN ('change', 'import', 'seed', 'chat_import'));
