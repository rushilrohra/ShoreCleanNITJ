-- Apply on existing databases to align with latest event CRUD + map + delete behavior.

-- 1) Ensure event columns used by create/edit flows exist.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_status_check'
      AND conrelid = 'events'::regclass
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_status_check
      CHECK (status IN ('active', 'cancelled', 'completed'));
  END IF;
END $$;

-- 2) Ensure scan_logs does not block event deletion through registrations.
DO $$
DECLARE
  fk_name text;
  fk_def text;
BEGIN
  SELECT c.conname, pg_get_constraintdef(c.oid)
  INTO fk_name, fk_def
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE c.contype = 'f'
    AND n.nspname = 'public'
    AND t.relname = 'scan_logs'
    AND pg_get_constraintdef(c.oid) LIKE 'FOREIGN KEY (registration_id)%event_registrations(id)%'
  LIMIT 1;

  IF fk_name IS NOT NULL AND position('ON DELETE CASCADE' in fk_def) = 0 THEN
    EXECUTE format('ALTER TABLE scan_logs DROP CONSTRAINT %I', fk_name);
    ALTER TABLE scan_logs
      ADD CONSTRAINT scan_logs_registration_id_fkey
      FOREIGN KEY (registration_id)
      REFERENCES event_registrations(id)
      ON DELETE CASCADE;
  END IF;
END $$;
