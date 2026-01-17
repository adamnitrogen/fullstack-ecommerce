require('dotenv').config({ path: '../.env' });
const supabase = require('../config/supabase');

const runMigration = async () => {
    console.log('Running migration: Migrate Legacy Delivery Charges...');

    const { data, error } = await supabase.rpc('run_sql_query', {
        sql_query: `
        DO $$
        DECLARE
            migrated_count INT;
        BEGIN
            -- Insert into delivery_configs for products having a legacy charge > 0
            -- ONLY if a config doesn't already exist for that product
            WITH inserted AS (
                INSERT INTO delivery_configs (
                    product_id,
                    scope,
                    calculation_type,
                    base_delivery_charge,
                    is_active,
                    gst_percentage,
                    is_taxable,
                    delivery_refund_policy,
                    created_at,
                    updated_at
                )
                SELECT 
                    id, 
                    'PRODUCT', 
                    'FLAT_PER_ORDER', 
                    delivery_charge, 
                    true, 
                    18, -- Defaulting to 18% as per standard requirement
                    true,
                    'NON_REFUNDABLE', -- Legacy policy default
                    now(),
                    now()
                FROM products 
                WHERE delivery_charge > 0 
                AND NOT EXISTS (
                    SELECT 1 FROM delivery_configs WHERE product_id = products.id AND scope = 'PRODUCT'
                )
                RETURNING id
            )
            SELECT COUNT(*) INTO migrated_count FROM inserted;

            RAISE NOTICE 'Migrated % legacy delivery charges to delivery_configs.', migrated_count;
        END $$;
    `
    });

    if (error) {
        if (error.message.includes('function "run_sql_query" does not exist')) {
            console.error('Error: "run_sql_query" RPC does not exist. Please run the migration manually using the SQL Editor in Supabase Dashboard.');
        } else {
            console.error('Migration failed:', error);
        }
    } else {
        console.log('Migration executed successfully.');
    }
};

runMigration();
