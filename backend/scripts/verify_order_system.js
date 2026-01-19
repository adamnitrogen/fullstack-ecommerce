/**
 * Comprehensive Verification Script for Order Timeline & Invoice System
 * 
 * This script verifies:
 * 1. Database schema for order_items (tax/delivery columns)
 * 2. RLS policies on critical tables
 * 3. Sample order data structure
 * 4. History logging completeness
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
    console.log('='.repeat(80));
    console.log('COMPREHENSIVE ORDER TIMELINE & INVOICE VERIFICATION');
    console.log('='.repeat(80));
    console.log('');

    // 1. Check order_items schema
    console.log('📋 1. CHECKING ORDER_ITEMS SCHEMA');
    console.log('-'.repeat(80));

    try {
        const { data: columns, error } = await supabase
            .rpc('get_table_columns', { table_name: 'order_items' })
            .catch(async () => {
                // Fallback: Query information_schema directly
                const { data, error: schemaError } = await supabase
                    .from('information_schema.columns')
                    .select('column_name, data_type, is_nullable')
                    .eq('table_name', 'order_items')
                    .eq('table_schema', 'public');

                if (schemaError) throw schemaError;
                return { data, error: null };
            });

        if (error) {
            console.error('❌ Error fetching schema:', error.message);
        } else if (!columns || columns.length === 0) {
            console.log('⚠️  Could not fetch schema via RPC or information_schema');
            console.log('   Attempting direct query...');

            // Try fetching a sample order_item to see actual columns
            const { data: sample, error: sampleError } = await supabase
                .from('order_items')
                .select('*')
                .limit(1)
                .single();

            if (sampleError) {
                console.error('❌ Error:', sampleError.message);
            } else if (sample) {
                console.log('✅ Sample order_item columns:');
                Object.keys(sample).forEach(col => {
                    console.log(`   - ${col}: ${typeof sample[col]}`);
                });
            }
        } else {
            console.log('✅ order_items columns:');
            columns.forEach(col => {
                console.log(`   - ${col.column_name} (${col.data_type})`);
            });
        }

        // Check for required columns
        const requiredColumns = [
            'taxable_amount', 'cgst', 'sgst', 'igst', 'gst_rate', 'hsn_code',
            'delivery_charge', 'delivery_gst', 'total_amount',
            'variant_snapshot', 'delivery_calculation_snapshot'
        ];

        console.log('');
        console.log('🔍 Checking for required columns:');
        const { data: sample } = await supabase.from('order_items').select('*').limit(1).single();

        if (sample) {
            const existingColumns = Object.keys(sample);
            requiredColumns.forEach(col => {
                const exists = existingColumns.includes(col);
                console.log(`   ${exists ? '✅' : '❌'} ${col}`);
            });
        }
    } catch (err) {
        console.error('❌ Schema check failed:', err.message);
    }

    console.log('');
    console.log('📋 2. CHECKING RLS POLICIES');
    console.log('-'.repeat(80));

    try {
        // Check order_status_history policies
        const { data: historyPolicies, error: histError } = await supabase
            .rpc('get_table_policies', { table_name: 'order_status_history' })
            .catch(async () => {
                // Fallback: Query pg_policies
                const { data, error } = await supabase
                    .from('pg_policies')
                    .select('*')
                    .eq('tablename', 'order_status_history');
                return { data, error };
            });

        if (histError) {
            console.log('⚠️  Could not fetch RLS policies:', histError.message);
        } else if (historyPolicies && historyPolicies.length > 0) {
            console.log('✅ order_status_history RLS policies:');
            historyPolicies.forEach(policy => {
                console.log(`   - ${policy.policyname}: ${policy.cmd} (${policy.permissive})`);
            });
        } else {
            console.log('ℹ️  No RLS policies found on order_status_history');
        }

        // Check order_items policies
        const { data: itemsPolicies, error: itemsError } = await supabase
            .rpc('get_table_policies', { table_name: 'order_items' })
            .catch(async () => {
                const { data, error } = await supabase
                    .from('pg_policies')
                    .select('*')
                    .eq('tablename', 'order_items');
                return { data, error };
            });

        if (!itemsError && itemsPolicies && itemsPolicies.length > 0) {
            console.log('✅ order_items RLS policies:');
            itemsPolicies.forEach(policy => {
                console.log(`   - ${policy.policyname}: ${policy.cmd}`);
            });
        } else {
            console.log('ℹ️  No RLS policies found on order_items');
        }
    } catch (err) {
        console.error('❌ RLS check failed:', err.message);
    }

    console.log('');
    console.log('📋 3. SAMPLE ORDER DATA STRUCTURE');
    console.log('-'.repeat(80));

    try {
        // Fetch a recent order with all relations
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select(`
                *,
                items:order_items(*),
                history:order_status_history(*)
            `)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (orderError) {
            console.error('❌ Error fetching order:', orderError.message);
        } else if (!order) {
            console.log('ℹ️  No orders found in database');
        } else {
            console.log('✅ Sample Order Structure:');
            console.log(`   Order ID: ${order.id}`);
            console.log(`   Order Number: ${order.order_number}`);
            console.log(`   Status: ${order.status}`);
            console.log(`   Created: ${order.created_at}`);
            console.log('');
            console.log(`   Order Items (${(order.items || []).length}):`);

            if (order.items && order.items.length > 0) {
                const item = order.items[0];
                console.log(`     - Product ID: ${item.product_id}`);
                console.log(`     - Quantity: ${item.quantity}`);
                console.log(`     - Price: ${item.price_per_unit}`);
                console.log(`     - Taxable Amount: ${item.taxable_amount || 'MISSING ❌'}`);
                console.log(`     - CGST: ${item.cgst || 'MISSING ❌'}`);
                console.log(`     - Delivery Charge: ${item.delivery_charge || 'MISSING ❌'}`);
                console.log(`     - Total Amount: ${item.total_amount || 'MISSING ❌'}`);
                console.log(`     - Variant Snapshot: ${item.variant_snapshot ? '✅' : 'MISSING ❌'}`);
                console.log(`     - Delivery Snapshot: ${item.delivery_calculation_snapshot ? '✅' : 'MISSING ❌'}`);
            }

            console.log('');
            console.log(`   Status History (${(order.history || []).length} entries):`);

            if (order.history && order.history.length > 0) {
                order.history.forEach((hist, idx) => {
                    console.log(`     ${idx + 1}. ${hist.event_type || hist.status} - ${hist.notes}`);
                    console.log(`        Actor: ${hist.actor}, Time: ${hist.created_at}`);
                });
            } else {
                console.log('     ❌ NO HISTORY ENTRIES FOUND');
            }
        }
    } catch (err) {
        console.error('❌ Sample data check failed:', err.message);
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('VERIFICATION COMPLETE');
    console.log('='.repeat(80));
    console.log('');
    console.log('📌 NEXT STEPS:');
    console.log('');
    console.log('If columns are MISSING from order_items:');
    console.log('  → Run: backend/migrations/fix_order_items_schema_and_rpc.sql');
    console.log('  → Location: Supabase Dashboard → SQL Editor');
    console.log('');
    console.log('If history is EMPTY or has wrong event types:');
    console.log('  → Backend services updated (history.service.js, checkout.service.js)');
    console.log('  → Create NEW test order to verify');
    console.log('');
}

main().catch(console.error);
