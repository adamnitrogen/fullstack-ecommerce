/**
 * Supabase Config Bridge
 * This file redirects all supabase client requests to the consolidated provider in backend/lib/supabase.js
 */
const { supabase } = require('../lib/supabase');

// Export the proxied supabase client as the default
module.exports = supabase;
