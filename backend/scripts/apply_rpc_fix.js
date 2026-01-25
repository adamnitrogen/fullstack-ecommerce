const fs = require('fs');
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const migrationFile = path.join(__dirname, '../migrations/20260124_fix_verify_rpc_response.sql');

async function applyMigration() {
    const connectionString = process.env.DATABASE_URL || 'postgres://postgres:Adams%40123@db.wjdncjhlpioohrjkamqw.supabase.co:5432/postgres';
    console.log('Connecting to DB...');

    // Handle potential SSL restriction if using supabase pooling or direct
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected. Reading migration file:', migrationFile);
        const sql = fs.readFileSync(migrationFile, 'utf8');
        console.log('Applying migration...');
        await client.query(sql);
        console.log('Migration applied successfully!');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

applyMigration();
