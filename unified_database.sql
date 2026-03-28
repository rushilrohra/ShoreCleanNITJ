-- Unified ShoreClean database schema (single source of truth)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'volunteer' CHECK (role IN ('volunteer', 'ngo', 'organizer', 'admin')),
    profile_picture_url TEXT,
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location_name VARCHAR(255),
    location TEXT,
    beach_name TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    event_date TIMESTAMPTZ NOT NULL,
    start_time TIME,
    end_time TIME,
    event_duration_minutes INT DEFAULT 120,
    expected_volunteers INT,
    max_volunteers INT DEFAULT 100,
    check_in_qr_code TEXT UNIQUE,
    check_out_qr_code TEXT UNIQUE,
    poster_url TEXT,
    social_caption TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('scheduled', 'ongoing', 'active', 'completed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    qr_token TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'DONE', 'ABSENT', 'REJECTED', 'CANCELLED')),
    entry_time TIMESTAMPTZ,
    exit_time TIMESTAMPTZ,
    duration_mins INTEGER,
    certificate_url TEXT,
    photo_url TEXT,
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, event_id)
);

CREATE TABLE IF NOT EXISTS scan_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL REFERENCES event_registrations(id) ON DELETE CASCADE,
    scanned_by UUID NOT NULL REFERENCES users(id),
    scan_type TEXT NOT NULL CHECK (scan_type IN ('checkin', 'checkout')),
    scanned_at TIMESTAMPTZ DEFAULT NOW(),
    device_info TEXT
);

CREATE TABLE IF NOT EXISTS event_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    check_in_time TIMESTAMP,
    check_out_time TIMESTAMP,
    check_in_latitude DECIMAL(10, 8),
    check_in_longitude DECIMAL(11, 8),
    check_out_latitude DECIMAL(10, 8),
    check_out_longitude DECIMAL(11, 8),
    total_duration_minutes INT,
    status VARCHAR(20) DEFAULT 'checked_in' CHECK (status IN ('checked_in', 'checked_out', 'abandoned')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(volunteer_id, event_id)
);

CREATE TABLE IF NOT EXISTS waste_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    photo_gps_latitude DECIMAL(10, 8),
    photo_gps_longitude DECIMAL(11, 8),
    photo_timestamp TIMESTAMP,
    waste_type VARCHAR(100),
    estimated_weight_kg DECIMAL(8, 2),
    ai_confidence DECIMAL(3, 2),
    ai_classification TEXT,
    verified BOOLEAN DEFAULT FALSE,
    flagged BOOLEAN DEFAULT FALSE,
    flag_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    certificate_url TEXT,
    badge_tier VARCHAR(20) CHECK (badge_tier IN ('Bronze', 'Silver', 'Gold')),
    total_hours DECIMAL(6, 2),
    total_waste_kg DECIMAL(8, 2),
    verification_hash UUID DEFAULT gen_random_uuid() UNIQUE,
    issue_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP,
    verified_by_third_party BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS volunteer_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    bronze_count INT DEFAULT 0,
    silver_count INT DEFAULT 0,
    gold_count INT DEFAULT 0,
    total_impact_hours DECIMAL(10, 2) DEFAULT 0,
    total_waste_collected_kg DECIMAL(10, 2) DEFAULT 0,
    total_events_attended INT DEFAULT 0,
    impact_score INT DEFAULT 0,
    global_rank INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leaderboard (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    rank INT,
    impact_score INT,
    total_hours DECIMAL(10, 2),
    total_waste_kg DECIMAL(10, 2),
    badge_points INT,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fraud_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    flag_type VARCHAR(50) CHECK (flag_type IN ('gps_mismatch', 'time_fraud', 'location_jump', 'duplicate_scan', 'no_photos')),
    description TEXT,
    severity VARCHAR(10) CHECK (severity IN ('low', 'medium', 'high')),
    resolved BOOLEAN DEFAULT FALSE,
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_qr_token ON event_registrations(qr_token);
CREATE INDEX IF NOT EXISTS idx_registrations_user_id ON event_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_registrations_event_id ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_scan_logs_registration ON scan_logs(registration_id);

CREATE INDEX IF NOT EXISTS idx_event_attendance_volunteer ON event_attendance(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_event_attendance_event ON event_attendance(event_id);
CREATE INDEX IF NOT EXISTS idx_waste_logs_volunteer ON waste_logs(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_waste_logs_event ON waste_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_certificates_volunteer ON certificates(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_volunteer ON fraud_flags(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_rank ON leaderboard(rank);
