require('dotenv').config({ path: '../.env' });
const supabase = require('../config/supabase');
const fs = require('fs');
const path = require('path');

const runMigration = async () => {
    console.log('Running migration: Overhaul Return Workflow Statuses...');

    const migrationPath = path.join(__dirname, '../migrations/20260120_overhaul_return_workflow.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    const { data, error } = await supabase.rpc('run_sql_query', {
        sql_query: sql
    });

    if (error) {
        if (error.message.includes('function "run_sql_query" does not exist')) {
            console.error('Error: "run_sql_query" RPC does not exist. Please run the migration manually using the SQL Editor in Supabase Dashboard.');
            console.log('\nSQL to run:\n', sql);
        } else {
            console.error('Migration failed:', error);
        }
    } else {
        console.log('Migration executed successfully.');
    }
};

runMigration();
