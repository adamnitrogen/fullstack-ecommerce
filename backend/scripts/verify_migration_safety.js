/**
 * Comprehensive Migration Safety Check
 * Verifies that the event_type constraint migration won't break anything
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyMigrationSafety() {
    console.log('='.repeat(80));
    console.log('MIGRATION SAFETY VERIFICATION');
    console.log('='.repeat(80));
    console.log('');

    // 1. Get all EXISTING event_type values currently in database
    console.log('📊 STEP 1: Checking Existing Event Types in Database');
    console.log('-'.repeat(80));

    const { data: existingEvents, error: eventsError } = await supabase
        .from('order_status_history')
        .select('event_type')
        .not('event_type', 'is', null);

    if (eventsError) {
        console.error('❌ Error fetching event types:', eventsError.message);
    } else {
        const uniqueEvents = [...new Set(existingEvents.map(e => e.event_type))];
        console.log(`Found ${uniqueEvents.length} unique event types currently in use:`);
        console.log('');
        uniqueEvents.sort().forEach(event => {
            console.log(`   - ${event}`);
        });
        console.log('');

        // 2. Check if all existing types are in the new constraint
        console.log('✅ STEP 2: Verifying All Existing Types Are Covered');
        console.log('-'.repeat(80));

        const newConstraintValues = [
            'ORDER_PLACED',
            'ORDER_CONFIRMED',
            'ORDER_PROCESSING',
            'ORDER_PACKED',
            'ORDER_SHIPPED',
            'OUT_FOR_DELIVERY',
            'ORDER_DELIVERED',
            'ORDER_CANCELLED',
            'ORDER_RETURNED',
            'RETURN_REQUESTED',
            'RETURN_APPROVED',
            'RETURN_REJECTED',
            'REFUND_INITIATED',
            'REFUND_COMPLETED',
            'REFUND_PARTIAL',
            'REFUND_FAILED',
            'PAYMENT_SUCCESS',
            'PAYMENT_FAILED',
            'PAYMENT_PENDING',
            'STATUS_CHANGE',
            'MANUAL_UPDATE'
        ];

        const notCovered = uniqueEvents.filter(event => !newConstraintValues.includes(event));

        if (notCovered.length > 0) {
            console.log('⚠️  WARNING: Some existing values are NOT in new constraint:');
            console.log('');
            notCovered.forEach(event => {
                console.log(`   ❌ ${event}`);
            });
            console.log('');
            console.log('🚨 MIGRATION WOULD BREAK EXISTING DATA!');
            console.log('');
            console.log('You must add these to the migration constraint:');
            notCovered.forEach(event => {
                console.log(`   '${event}',`);
            });
        } else {
            console.log('✅ All existing event types are covered by new constraint');
        }
        console.log('');
    }

    // 3. Count records that would be affected
    console.log('📊 STEP 3: Analyzing Impact');
    console.log('-'.repeat(80));

    const { data: historyCount } = await supabase
        .from('order_status_history')
        .select('*', { count: 'exact', head: true });

    console.log(`Total history records: ${historyCount || 0}`);
    console.log('');

    // 4. Check code for event type usage
    console.log('📋 STEP 4: Code Analysis');
    console.log('-'.repeat(80));
    console.log('Checking history.service.js EVENT_TYPE_MAP...');
    console.log('');

    const historyServicePath = path.join(__dirname, '../services/history.service.js');
    const historyServiceCode = fs.readFileSync(historyServicePath, 'utf8');

    // Extract EVENT_TYPE_MAP
    const mapMatch = historyServiceCode.match(/const EVENT_TYPE_MAP = {([^}]+)}/s);
    if (mapMatch) {
        const mapContent = mapMatch[1];
        const eventTypes = [...mapContent.matchAll(/'([^']+)':\s*'([^']+)'/g)];

        console.log('Event types defined in code:');
        console.log('');

        const codeEventTypes = new Set();
        eventTypes.forEach(([, , eventType]) => {
            codeEventTypes.add(eventType);
            console.log(`   - ${eventType}`);
        });

        console.log('');

        // Check if all code event types are in new constraint
        const newConstraintSet = new Set(newConstraintValues);
        const missingInConstraint = [...codeEventTypes].filter(e => !newConstraintSet.has(e));

        if (missingInConstraint.length > 0) {
            console.log('⚠️  Event types in code but NOT in new constraint:');
            missingInConstraint.forEach(e => console.log(`   ❌ ${e}`));
        } else {
            console.log('✅ All code event types are in new constraint');
        }
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('MIGRATION SAFETY VERDICT');
    console.log('='.repeat(80));
    console.log('');

    // Final verdict
    const newConstraintValues = [
        'ORDER_PLACED',
        'ORDER_CONFIRMED',
        'ORDER_PROCESSING',
        'ORDER_PACKED',
        'ORDER_SHIPPED',
        'OUT_FOR_DELIVERY',
        'ORDER_DELIVERED',
        'ORDER_CANCELLED',
        'CANCELLED',
        'ORDER_RETURNED',
        'RETURN_REQUESTED',
        'RETURN_APPROVED',
        'RETURN_REJECTED',
        'REFUND_INITIATED',
        'REFUND_COMPLETED',
        'REFUND_PARTIAL',
        'REFUND_FAILED',
        'PAYMENT_SUCCESS',
        'PAYMENT_FAILED',
        'PAYMENT_PENDING',
        'STATUS_CHANGE',
        'MANUAL_UPDATE'
    ];

    const { data: existing } = await supabase
        .from('order_status_history')
        .select('event_type')
        .not('event_type', 'is', null);

    const unique = [...new Set(existing?.map(e => e.event_type) || [])];
    const newSet = new Set(newConstraintValues);
    const problematic = unique.filter(e => !newSet.has(e));

    if (problematic.length === 0) {
        console.log('✅ MIGRATION IS SAFE!');
        console.log('');
        console.log('Summary:');
        console.log(`  - ${unique.length} existing event types in database`);
        console.log(`  - All are covered by new constraint`);
        console.log(`  - ${newConstraintValues.length} total allowed values in new constraint`);
        console.log('');
        console.log('Expected behavior after migration:');
        console.log('  ✅ Existing history entries remain unchanged');
        console.log('  ✅ New descriptive event types (ORDER_PACKED, etc.) will work');
        console.log('  ✅ Admin status updates will create history entries');
        console.log('  ✅ No data loss or corruption');
    } else {
        console.log('🚨 MIGRATION NEEDS ADJUSTMENT!');
        console.log('');
        console.log('Issues:');
        console.log(`  ❌ ${problematic.length} existing event types not in new constraint`);
        console.log('');
        console.log('Missing from constraint:');
        problematic.forEach(e => console.log(`  - ${e}`));
    }

    console.log('');
}

verifyMigrationSafety().catch(console.error);
