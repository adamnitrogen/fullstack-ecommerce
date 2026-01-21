const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config({ path: 'backend/.env' });

const client = new Client({
    connectionString: 'postgres://postgres:Adams%40123@db.wjdncjhlpioohrjkamqw.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

const migrationFile = 'backend/migrations/20260121_update_rpc_custom_order_number.sql';

async function applyMigration() {
    try {
        await client.connect();
        const sql = fs.readFileSync(migrationFile, 'utf8');
        await client.query(sql);
        console.log('Migration applied successfully!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

applyMigration();
