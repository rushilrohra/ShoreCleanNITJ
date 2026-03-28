const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { query } = require('../src/config/db');

async function resetAll() {
  console.log('--- DB RESET TOOL ---');
  try {
    const res = await query(`
      UPDATE event_registrations 
      SET status = 'PENDING', 
          entry_time = NULL, 
          exit_time = NULL, 
          duration_mins = NULL,
          certificate_url = NULL 
      WHERE status != 'ABSENT'
    `);
    console.log(`Successfully reset ${res.rowCount} registrations to PENDING.`);
    console.log('You can now scan these QRs again for testing!');
    process.exit(0);
  } catch (err) {
    console.error('Reset failed:', err);
    process.exit(1);
  }
}

resetAll();
