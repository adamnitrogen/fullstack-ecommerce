const supabase = require('./config/supabase');

async function checkCurrentData() {
    try {
        console.log('Fetching current office hours from database...\n');
        const { data: hours, error } = await supabase
            .from('contact_office_hours')
            .select('*')
            .order('display_order');

        if (error) throw error;

        console.log('Current database contents:');
        console.log('=========================\n');

        hours.forEach(hour => {
            console.log(`${hour.day_of_week}:`);
            console.log(`  open_time: "${hour.open_time}" (type: ${typeof hour.open_time})`);
            console.log(`  close_time: "${hour.close_time}" (type: ${typeof hour.close_time})`);
            console.log(`  is_closed: ${hour.is_closed}`);
            console.log('');
        });

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkCurrentData();
