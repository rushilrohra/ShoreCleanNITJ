const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('PostgreSQL connected at:', result.rows[0].now);
  } catch (error) {
    console.error('PostgreSQL connection failed:', error.message);
  }
}

async function ensureIndexes() {
  try {
    await pool.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS event_registrations_qr_token_uq ON event_registrations(qr_token)'
    );
  } catch (error) {
    console.error('Failed to ensure QR token index:', error.message);
  }
}

async function ensureEventColumns() {
  try {
    await pool.query("ALTER TABLE events ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed'))");
    await pool.query('ALTER TABLE events ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION');
    await pool.query('ALTER TABLE events ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION');
    await pool.query('ALTER TABLE events ADD COLUMN IF NOT EXISTS poster_url TEXT');
    await pool.query('ALTER TABLE events ADD COLUMN IF NOT EXISTS social_caption TEXT');
  } catch (error) {
    console.error('Failed to ensure event columns:', error.message);
  }
}

async function ensureRegistrationColumns() {
  try {
    await pool.query('ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS certificate_url TEXT');
    await pool.query('ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS photo_url TEXT');
  } catch (error) {
    console.error('Failed to ensure registration columns:', error.message);
  }
}

async function ensureRegistrationStatusConstraint() {
  try {
    await pool.query('ALTER TABLE event_registrations DROP CONSTRAINT IF EXISTS event_registrations_status_check');
    await pool.query(
      "ALTER TABLE event_registrations ADD CONSTRAINT event_registrations_status_check CHECK (status IN ('PENDING','ACTIVE','DONE','ABSENT','REJECTED','CANCELLED'))"
    );
  } catch (error) {
    console.error('Failed to ensure registration status constraint:', error.message);
  }
}

async function ensureScanLogForeignKeyCascade() {
  try {
    const fkResult = await pool.query(
      `
        SELECT c.conname, pg_get_constraintdef(c.oid) AS condef
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE c.contype = 'f'
          AND n.nspname = 'public'
          AND t.relname = 'scan_logs'
          AND pg_get_constraintdef(c.oid) LIKE 'FOREIGN KEY (registration_id)%event_registrations(id)%'
        LIMIT 1
      `
    );

    const row = fkResult.rows[0];
    if (row && !String(row.condef).includes('ON DELETE CASCADE')) {
      const safeConstraint = String(row.conname).replace(/"/g, '""');
      await pool.query(`ALTER TABLE scan_logs DROP CONSTRAINT "${safeConstraint}"`);
      await pool.query(
        `
          ALTER TABLE scan_logs
          ADD CONSTRAINT scan_logs_registration_id_fkey
          FOREIGN KEY (registration_id)
          REFERENCES event_registrations(id)
          ON DELETE CASCADE
        `
      );
    }
  } catch (error) {
    console.error('Failed to ensure scan_logs foreign key cascade:', error.message);
  }
}

const query = (text, params) => pool.query(text, params);

testConnection();
ensureIndexes();
ensureEventColumns();
ensureRegistrationColumns();
ensureRegistrationStatusConstraint();
ensureScanLogForeignKeyCascade();

module.exports = {
  pool,
  query,
  testConnection,
  ensureIndexes,
  ensureEventColumns,
  ensureRegistrationColumns,
  ensureRegistrationStatusConstraint,
  ensureScanLogForeignKeyCascade,
};
