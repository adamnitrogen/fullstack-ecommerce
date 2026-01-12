const supabase = require('./config/supabase');

// Convert 12-hour format to 24-hour format
function convertTo24Hour(time12h) {
    if (!time12h || time12h === '') return null;

    // Already in 24-hour format
    if (!time12h.includes('AM') && !time12h.includes('PM')) {
        return time12h;
    }

    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':');

    if (hours === '12') {
        hours = '00';
    }

    if (modifier === 'PM') {
        hours = parseInt(hours, 10) + 12;
    }

    return `${String(hours).padStart(2, '0')}:${minutes}`;
}

async function fixTimeFormats() {
    try {
        console.log('Fetching all office hours...');
        const { data: hours, error } = await supabase
            .from('contact_office_hours')
            .select('*');

        if (error) throw error;

        console.log(`Found ${hours.length} entries`);

        for (const hour of hours) {
            const openTime24 = convertTo24Hour(hour.open_time);
            const closeTime24 = convertTo24Hour(hour.close_time);

            console.log(`${hour.day_of_week}: ${hour.open_time} -> ${openTime24}, ${hour.close_time} -> ${closeTime24}`);

            const { error: updateError } = await supabase
                .from('contact_office_hours')
                .update({
                    open_time: openTime24,
                    close_time: closeTime24,
                    updated_at: new Date()
                })
                .eq('id', hour.id);

            if (updateError) {
                console.error(`Error updating ${hour.day_of_week}:`, updateError);
            } else {
                console.log(`✓ Updated ${hour.day_of_week}`);
            }
        }

        console.log('\n✅ All office hours updated to 24-hour format!');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fixTimeFormats();
