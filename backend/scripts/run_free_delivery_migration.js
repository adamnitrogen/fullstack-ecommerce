const { supabaseAdmin } = require('../lib/supabase');
const fs = require('fs');
const path = require('path');

const runMigration = async () => {
    console.log('Running migration: Add Free Delivery Coupon Type...');

    const migrationPath = path.join(__dirname, '../migrations/20260121_add_free_delivery_coupon_type.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Attempt to run via RPC
    const { data, error } = await supabaseAdmin.rpc('run_sql_query', {
        sql_query: sql
    });

    if (error) {
        if (error.message.includes('function "run_sql_query" does not exist')) {
            console.error('\nERROR: "run_sql_query" RPC does not exist in your Supabase project.');
            console.error('This script requires a specific RPC to be enabled to execute raw SQL.');
            console.error('\nPLEASE RUN THE FOLLOWING SQL MANUALLY IN SUPABASE SQL EDITOR:\n');
            console.log(sql);
        } else {
            console.error('Migration failed:', error);
        }
        process.exit(1);
    } else {
        console.log('Migration executed successfully.');
        process.exit(0);
    }
};

runMigration().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});
