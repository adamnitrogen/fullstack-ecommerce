const supabase = require('./backend/config/supabase');
async function check() {
    const { data, error } = await supabase.from('orders').select('*').limit(1);
    if (error) {
        console.error(error);
    } else {
        console.log(Object.keys(data[0] || {}));
    }
}
check();
