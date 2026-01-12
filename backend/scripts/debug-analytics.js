const supabase = require('../config/supabase');
const LOG_TAG = '[DebugAnalytics]';

async function run() {
    console.log(`${LOG_TAG} Starting diagnostics...`);

    // 1. Check Roles
    console.log(`${LOG_TAG} Fetching Roles...`);
    const { data: roles, error: rolesError } = await supabase.from('roles').select('*');
    if (rolesError) {
        console.error(`${LOG_TAG} Failed to fetch roles:`, rolesError);
    } else {
        console.log(`${LOG_TAG} Found Roles:`, roles);
    }

    // Capture IDs for next steps
    const customerRole = roles?.find(r => r.name.toLowerCase() === 'customer')?.id;
    const managerRole = roles?.find(r => r.name.toLowerCase() === 'manager')?.id;

    if (!customerRole) console.error(`${LOG_TAG} CRITICAL: Customer role not found!`);
    if (!managerRole) console.error(`${LOG_TAG} CRITICAL: Manager role not found!`);

    // 2. Check Profiles Count (Customers)
    if (customerRole) {
        console.log(`${LOG_TAG} Counting Profiles with role_id = ${customerRole}...`);
        const { count, error } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('role_id', customerRole);

        if (error) console.error(`${LOG_TAG} Customer count failed:`, error);
        else console.log(`${LOG_TAG} Total Customers: ${count}`);
    }

    // 3. Check Orders
    console.log(`${LOG_TAG} Counting Orders...`);
    const { count: ordersCount, error: ordersError } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });

    if (ordersError) console.error(`${LOG_TAG} Order count failed:`, ordersError);
    else console.log(`${LOG_TAG} Total Orders: ${ordersCount}`);

    // 4. Check Products
    console.log(`${LOG_TAG} Counting Products...`);
    const { count: productsCount, error: productsError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

    if (productsError) console.error(`${LOG_TAG} Product count failed:`, productsError);
    else console.log(`${LOG_TAG} Total Products: ${productsCount}`);

    process.exit(0);
}

run();
