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

const query = (text, params) => pool.query(text, params);

testConnection();
ensureIndexes();

module.exports = {
  pool,
  query,
  testConnection,
  ensureIndexes,
};
