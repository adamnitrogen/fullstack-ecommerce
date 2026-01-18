const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const migrationFile = process.argv[2];

if (!migrationFile) {
    console.error('Please provide a migration file path');
    process.exit(1);
}

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    try {
        await client.connect();
        const sql = fs.readFileSync(migrationFile, 'utf8');
        await client.query(sql);
        console.log('Migration executed successfully:', migrationFile);
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

runMigration();
