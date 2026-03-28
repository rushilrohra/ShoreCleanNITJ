-- ─── ShoreClean: Teammate Integration Migration ─────────────────────────────
-- Uses INTEGER (SERIAL) foreign keys to match our existing schema (not UUID).

-- 1. Add missing columns to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS beach_name     TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_time     TIME;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time       TIME;
ALTER TABLE events ADD COLUMN IF NOT EXISTS max_volunteers  INTEGER DEFAULT 100;
ALTER TABLE events ADD COLUMN IF NOT EXISTS created_by     INTEGER REFERENCES users(id);

-- Backfill beach_name from location_name where null
UPDATE events SET beach_name = location_name WHERE beach_name IS NULL;

-- 2. Event registrations (volunteer self-registers for event → gets unique qr_token)
CREATE TABLE IF NOT EXISTS event_registrations (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id      INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    qr_token      TEXT UNIQUE NOT NULL,
    status        TEXT NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING', 'ACTIVE', 'DONE', 'ABSENT')),
    entry_time    TIMESTAMPTZ,
    exit_time     TIMESTAMPTZ,
    duration_mins INTEGER,
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, event_id)
);

-- 3. Scan logs (audit trail of every QR scan)
CREATE TABLE IF NOT EXISTS scan_logs (
    id              SERIAL PRIMARY KEY,
    registration_id INTEGER NOT NULL REFERENCES event_registrations(id) ON DELETE CASCADE,
    scanned_by      INTEGER NOT NULL REFERENCES users(id),
    scan_type       TEXT NOT NULL CHECK (scan_type IN ('checkin', 'checkout')),
    scanned_at      TIMESTAMPTZ DEFAULT NOW(),
    device_info     TEXT
);

-- 4. Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_reg_qr_token      ON event_registrations(qr_token);
CREATE INDEX        IF NOT EXISTS idx_reg_user_id       ON event_registrations(user_id);
CREATE INDEX        IF NOT EXISTS idx_reg_event_id      ON event_registrations(event_id);
CREATE INDEX        IF NOT EXISTS idx_scan_registration  ON scan_logs(registration_id);
