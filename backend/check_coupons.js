require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCoupons() {
    console.log('=== Checking Free Delivery Coupons ===\n');

    const { data, error } = await supabase
        .from('coupons')
        .select('code, type, discount_percentage, min_purchase_amount, is_active')
        .eq('type', 'free_delivery')
        .eq('is_active', true);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Free Delivery Coupons:');
    console.table(data);

    if (data && data.length > 0) {
        data.forEach(coupon => {
            console.log(`\nCoupon: ${coupon.code}`);
            console.log(`Type: ${coupon.type}`);
            console.log(`Discount %: ${coupon.discount_percentage}`);
            console.log(`Min Purchase: ${coupon.min_purchase_amount}`);
            console.log(`Active: ${coupon.is_active}`);

            if (coupon.discount_percentage === 0 || coupon.discount_percentage === null) {
                console.log('⚠️  This coupon has 0 or null discount_percentage!');
            }
        });
    }
}

checkCoupons();
