
const logger = require('../utils/logger');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
    logger.warn('Supabase URL or Service Role Key is missing in backend environment.');
}

const { withQueryLogging } = require('../utils/supabase-client-proxy');

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const supabase = withQueryLogging(supabaseAdmin);

module.exports = { supabase, supabaseAdmin };
