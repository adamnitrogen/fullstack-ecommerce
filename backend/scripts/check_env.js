require('dotenv').config();

function getJwtRole(token) {
    if (!token) return 'No Token';
    try {
        const payload = token.split('.')[1];
        const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
        return decoded.role;
    } catch (e) {
        return 'Invalid Token';
    }
}

console.log('Checking Environment Variables:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY Role:', getJwtRole(process.env.SUPABASE_SERVICE_ROLE_KEY));
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
console.log('Key has whitespace:', key.trim() !== key);
console.log('SUPABASE_ANON_KEY Role:', getJwtRole(process.env.SUPABASE_ANON_KEY));
