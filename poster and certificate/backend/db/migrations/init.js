const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env from root directory (2 levels up from this file)
const envPath = path.resolve(__dirname, '../../.env');
console.log(`📄 Loading .env from: ${envPath}`);
require('dotenv').config({ path: envPath });

// Debug: Check if env vars are loaded
console.log(`✓ DB_HOST: ${process.env.DB_HOST || 'NOT SET'}`);
console.log(`✓ DB_USER: ${process.env.DB_USER || 'NOT SET'}`);
console.log(`✓ DB_NAME: ${process.env.DB_NAME || 'NOT SET'}`);

// Create connection pool
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'shoreclean_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
});

async function runMigrations() {
    try {
        console.log('🔄 Starting database migrations...');
        console.log(`📍 Connecting to: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);

        // Test connection
        await pool.query('SELECT NOW()');
        console.log('✅ Connected to PostgreSQL');

        // Read SQL migration file
        const sqlPath = path.join(__dirname, 'init.sql');
        const sql = fs.readFileSync(sqlPath, 'utf-8');

        // Execute migrations
        console.log('⚙️  Executing migrations...');
        await pool.query(sql);
        console.log('✅ Database migrations completed successfully!');

        // List created tables
        const tables = await pool.query(
            `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`
        );

        console.log('\n📊 Created tables:');
        tables.rows.forEach(row => {
            console.log(`   ✓ ${row.table_name}`);
        });

        await pool.end();
        console.log('\n✨ All done! Ready to start your application.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('\n🔍 Troubleshooting tips:');
        console.error('   1. Check if PostgreSQL is running');
        console.error('   2. Verify database credentials in .env');
        console.error('   3. Ensure database exists: createdb shoreclean_db');
        console.error('   4. Check .env file has correct DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD');

        await pool.end();
        process.exit(1);
    }
}

// Run migrations
runMigrations();
