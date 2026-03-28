-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    role VARCHAR(20) DEFAULT 'volunteer' CHECK (role IN ('volunteer', 'organizer', 'admin')),
    profile_picture_url TEXT,
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Events Table
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    organizer_id INT REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location_name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    event_date TIMESTAMP NOT NULL,
    event_duration_minutes INT DEFAULT 120,
    expected_volunteers INT,
    check_in_qr_code TEXT UNIQUE,
    check_out_qr_code TEXT UNIQUE,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Volunteers at Events (Check-in/Check-out tracking)
CREATE TABLE IF NOT EXISTS event_attendance (
    id SERIAL PRIMARY KEY,
    volunteer_id INT REFERENCES users(id) ON DELETE CASCADE,
    event_id INT REFERENCES events(id) ON DELETE CASCADE,
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

-- Waste Logs (AI-verified waste collection data)
CREATE TABLE IF NOT EXISTS waste_logs (
    id SERIAL PRIMARY KEY,
    volunteer_id INT REFERENCES users(id) ON DELETE CASCADE,
    event_id INT REFERENCES events(id) ON DELETE CASCADE,
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

-- Certificates Table
CREATE TABLE IF NOT EXISTS certificates (
    id SERIAL PRIMARY KEY,
    volunteer_id INT REFERENCES users(id) ON DELETE CASCADE,
    event_id INT REFERENCES events(id) ON DELETE CASCADE,
    certificate_url TEXT,
    badge_tier VARCHAR(20) CHECK (badge_tier IN ('Bronze', 'Silver', 'Gold')),
    total_hours DECIMAL(6, 2),
    total_waste_kg DECIMAL(8, 2),
    verification_hash UUID DEFAULT uuid_generate_v4() UNIQUE,
    issue_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP,
    verified_by_third_party BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Volunteer Badges Aggregation Table
CREATE TABLE IF NOT EXISTS volunteer_badges (
    id SERIAL PRIMARY KEY,
    volunteer_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
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

-- Leaderboard Cache (for performance optimization)
CREATE TABLE IF NOT EXISTS leaderboard (
    id SERIAL PRIMARY KEY,
    volunteer_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    rank INT,
    impact_score INT,
    total_hours DECIMAL(10, 2),
    total_waste_kg DECIMAL(10, 2),
    badge_points INT,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fraud Flags Table (Audit & Prevention)
CREATE TABLE IF NOT EXISTS fraud_flags (
    id SERIAL PRIMARY KEY,
    volunteer_id INT REFERENCES users(id) ON DELETE CASCADE,
    event_id INT REFERENCES events(id) ON DELETE CASCADE,
    flag_type VARCHAR(50) CHECK (flag_type IN ('gps_mismatch', 'time_fraud', 'location_jump', 'duplicate_scan', 'no_photos')),
    description TEXT,
    severity VARCHAR(10) CHECK (severity IN ('low', 'medium', 'high')),
    resolved BOOLEAN DEFAULT FALSE,
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

-- Indexes for Performance Optimization
CREATE INDEX idx_event_attendance_volunteer ON event_attendance(volunteer_id);
CREATE INDEX idx_event_attendance_event ON event_attendance(event_id);
CREATE INDEX idx_waste_logs_volunteer ON waste_logs(volunteer_id);
CREATE INDEX idx_waste_logs_event ON waste_logs(event_id);
CREATE INDEX idx_certificates_volunteer ON certificates(volunteer_id);
CREATE INDEX idx_fraud_flags_volunteer ON fraud_flags(volunteer_id);
CREATE INDEX idx_leaderboard_rank ON leaderboard(rank);
