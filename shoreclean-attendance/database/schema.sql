-- Run: psql -U postgres -d shoreclean -f schema.sql
-- Or create DB first: createdb shoreclean

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  phone         TEXT,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'volunteer' CHECK (role IN ('volunteer', 'ngo', 'admin')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  description    TEXT,
  location       TEXT NOT NULL,
  latitude       DOUBLE PRECISION,
  longitude      DOUBLE PRECISION,
  beach_name     TEXT NOT NULL,
  event_date     DATE NOT NULL,
  start_time     TIME NOT NULL,
  end_time       TIME NOT NULL,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed')),
  max_volunteers INT DEFAULT 100,
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE event_registrations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id       UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  qr_token       TEXT UNIQUE NOT NULL,
  status         TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'DONE', 'ABSENT')),
  entry_time     TIMESTAMPTZ,
  exit_time      TIMESTAMPTZ,
  duration_mins  INTEGER,
  registered_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, event_id)
);

CREATE TABLE scan_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES event_registrations(id) ON DELETE CASCADE,
  scanned_by      UUID NOT NULL REFERENCES users(id),
  scan_type       TEXT NOT NULL CHECK (scan_type IN ('checkin', 'checkout')),
  scanned_at      TIMESTAMPTZ DEFAULT NOW(),
  device_info     TEXT
);

CREATE UNIQUE INDEX idx_registrations_qr_token ON event_registrations(qr_token);
CREATE INDEX idx_registrations_user_id ON event_registrations(user_id);
CREATE INDEX idx_registrations_event_id ON event_registrations(event_id);
CREATE INDEX idx_scan_logs_registration ON scan_logs(registration_id);

-- Seed users for testing.
-- Plain-text passwords for both test users: password123
INSERT INTO users (name, email, phone, password_hash, role)
VALUES
  (
    'Riya Sharma',
    'volunteer@test.com',
    '+91-9876543210',
    crypt('password123', gen_salt('bf')),
    'volunteer'
  ),
  (
    'Coastal Care NGO',
    'ngo@test.com',
    '+91-9988776655',
    crypt('password123', gen_salt('bf')),
    'ngo'
  );

-- Seed sample events for testing.
INSERT INTO events (
  title,
  description,
  location,
  beach_name,
  event_date,
  start_time,
  end_time,
  max_volunteers,
  created_by
)
VALUES
  (
    'Sunrise Beach Cleanup Drive',
    'Early morning cleanup focused on plastic waste collection and segregation.',
    'Marina Coast, Chennai',
    'Marina Beach',
    '2026-04-05',
    '06:30:00',
    '09:30:00',
    120,
    (SELECT id FROM users WHERE email = 'ngo@test.com')
  ),
  (
    'Weekend Shore Restoration',
    'Community cleanup and awareness activity near the boardwalk stretch.',
    'Juhu, Mumbai',
    'Juhu Beach',
    '2026-04-12',
    '07:00:00',
    '10:00:00',
    150,
    (SELECT id FROM users WHERE email = 'ngo@test.com')
  );
