
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testAuth() {
    console.log("--- Testing Supabase Auth Configuration ---");

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log("SUPABASE_URL present:", !!url);
    console.log("SUPABASE_SERVICE_ROLE_KEY present:", !!key);

    if (!url || !key) {
        console.error("Missing credentials, stopping test.");
        return;
    }

    const supabase = createClient(url, key, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    try {
        console.log("Attempting to list users (requires Service Role)...");
        const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });

        if (error) {
            console.error("Error listing users:", error.message);
            if (error.message.includes("service_role")) {
                console.error("Likely cause: INVALID SERVICE ROLE KEY. You might be using the Anon key.");
            }
        } else {
            console.log("Success! Service Role Key is valid.");
            console.log("Users found:", data.users.length);
        }
    } catch (e) {
        console.error("Exception:", e.message);
    }
}

testAuth();
