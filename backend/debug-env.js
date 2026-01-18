const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log('Available Env Keys:', Object.keys(process.env).filter(key => !key.startsWith('npm_') && !key.startsWith('rvm_')));
console.log('Has DATABASE_URL:', !!process.env.DATABASE_URL);
console.log('Has SUPABASE_DB_URL:', !!process.env.SUPABASE_DB_URL);
console.log('Has DIRECT_URL:', !!process.env.DIRECT_URL);
