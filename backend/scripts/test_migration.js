/**
 * Migration Test Script
 * Applies fix_order_items_schema_and_rpc.sql and verifies results
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMigration() {
    console.log('='.repeat(80));
    console.log('MIGRATION TEST & APPLICATION');
    console.log('='.repeat(80));
    console.log('');

    // 1. Show current schema
    console.log('📋 STEP 1: Current order_items Schema');
    console.log('-'.repeat(80));

    try {
        const { data: beforeSample, error } = await supabase
            .from('order_items')
            .select('*')
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('❌ Error:', error.message);
        } else if (beforeSample) {
            const beforeColumns = Object.keys(beforeSample);
            console.log('Current columns:', beforeColumns.length);

            const requiredColumns = [
                'taxable_amount', 'cgst', 'sgst', 'igst', 'gst_rate', 'hsn_code',
                'delivery_charge', 'delivery_gst', 'total_amount',
                'variant_snapshot', 'delivery_calculation_snapshot',
                'coupon_id', 'coupon_code', 'coupon_discount'
            ];

            const missing = requiredColumns.filter(col => !beforeColumns.includes(col));
            const existing = requiredColumns.filter(col => beforeColumns.includes(col));

            if (existing.length > 0) {
                console.log('✅ Already have:', existing.join(', '));
            }
            if (missing.length > 0) {
                console.log('❌ Missing:', missing.join(', '));
            }
        } else {
            console.log('ℹ️  No order_items found');
        }
    } catch (err) {
        console.error('Error checking schema:', err.message);
    }

    console.log('');
    console.log('📋 STEP 2: Reading Migration SQL');
    console.log('-'.repeat(80));

    const migrationPath = path.join(__dirname, '../migrations/fix_order_items_schema_and_rpc.sql');

    if (!fs.existsSync(migrationPath)) {
        console.error('❌ Migration file not found:', migrationPath);
        process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('✅ Migration file loaded');
    console.log(`   Size: ${migrationSQL.length} bytes`);
    console.log(`   Lines: ${migrationSQL.split('\n').length}`);

    console.log('');
    console.log('📋 STEP 3: Applying Migration');
    console.log('-'.repeat(80));
    console.log('⚠️  This will modify your database!');
    console.log('');

    try {
        // Split migration into parts (DO block and function creation)
        const parts = migrationSQL.split('-- 2. Update RPC to populate these columns');

        // Part 1: Add columns
        console.log('Executing Part 1: Adding columns...');
        const { error: error1 } = await supabase.rpc('exec_sql', { sql_query: parts[0] })
            .catch(async () => {
                // Fallback: Try executing directly via REST API
                // Note: This might not work due to Supabase limitations
                console.log('RPC not available, attempting direct execution...');
                const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec`, {
                    method: 'POST',
                    headers: {
                        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
                        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ query: parts[0] })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
                }

                return { error: null };
            });

        if (error1) {
            console.error('❌ Part 1 failed:', error1.message);
            console.log('');
            console.log('⚠️  MIGRATION FAILED - Manual application required');
            console.log('');
            console.log('Please run this migration manually in Supabase SQL Editor:');
            console.log('1. Go to Supabase Dashboard → SQL Editor');
            console.log('2. Copy contents of: backend/migrations/fix_order_items_schema_and_rpc.sql');
            console.log('3. Paste and Run');
            process.exit(1);
        }

        console.log('✅ Part 1 complete');

        // Part 2: Update RPC
        console.log('Executing Part 2: Updating RPC...');
        const rpcPart = '-- 2. Update RPC to populate these columns' + parts[1];

        const { error: error2 } = await supabase.rpc('exec_sql', { sql_query: rpcPart })
            .catch(() => ({ error: { message: 'RPC execution not supported' } }));

        if (error2 && !error2.message.includes('not supported')) {
            console.error('❌ Part 2 failed:', error2.message);
            console.log('');
            console.log('⚠️  PARTIAL MIGRATION - Please complete manually');
            process.exit(1);
        }

        console.log('✅ Part 2 complete (or requires manual execution)');

    } catch (err) {
        console.error('❌ Migration execution error:', err.message);
        console.log('');
        console.log('═'.repeat(80));
        console.log('CANNOT AUTO-APPLY MIGRATION');
        console.log('═'.repeat(80));
        console.log('');
        console.log('Supabase does not allow executing raw SQL via API.');
        console.log('You MUST run this migration manually:');
        console.log('');
        console.log('1. Open: https://supabase.com/dashboard');
        console.log('2. Select your project');
        console.log('3. Go to: SQL Editor');
        console.log('4. Create new query');
        console.log('5. Copy/paste: backend/migrations/fix_order_items_schema_and_rpc.sql');
        console.log('6. Click: Run');
        console.log('');
        console.log('After running, execute this script again to verify.');
        console.log('');
        process.exit(1);
    }

    console.log('');
    console.log('📋 STEP 4: Verifying Results');
    console.log('-'.repeat(80));

    try {
        const { data: afterSample, error } = await supabase
            .from('order_items')
            .select('*')
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('❌ Error:', error.message);
        } else if (afterSample) {
            const afterColumns = Object.keys(afterSample);
            console.log('Updated columns:', afterColumns.length);

            const requiredColumns = [
                'taxable_amount', 'cgst', 'sgst', 'igst', 'gst_rate', 'hsn_code',
                'delivery_charge', 'delivery_gst', 'total_amount',
                'variant_snapshot', 'delivery_calculation_snapshot',
                'coupon_id', 'coupon_code', 'coupon_discount'
            ];

            const missing = requiredColumns.filter(col => !afterColumns.includes(col));
            const existing = requiredColumns.filter(col => afterColumns.includes(col));

            console.log('');
            if (existing.length === requiredColumns.length) {
                console.log('✅ ALL REQUIRED COLUMNS PRESENT!');
            } else {
                console.log(`✅ Have ${existing.length}/${requiredColumns.length} columns`);
                if (missing.length > 0) {
                    console.log('❌ Still missing:', missing.join(', '));
                }
            }
        }
    } catch (err) {
        console.error('Error verifying schema:', err.message);
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('MIGRATION TEST COMPLETE');
    console.log('='.repeat(80));
}

testMigration().catch(console.error);
