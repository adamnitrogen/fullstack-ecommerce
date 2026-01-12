const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const logger = require('../utils/logger');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;


if (!supabaseUrl || !supabaseKey) {
  logger.error('Missing Supabase URL or Key in environment variables');
  process.exit(1);
}

const keyType = supabaseKey === process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON/OTHER';
logger.info(`[SupabaseConfig] Initializing Supabase with ${keyType} key`);

const { withQueryLogging } = require('../utils/supabase-client-proxy');

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

module.exports = withQueryLogging(supabase);
