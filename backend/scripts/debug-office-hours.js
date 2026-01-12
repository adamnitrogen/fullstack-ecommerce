const supabase = require('./config/supabase');

async function testUpdate() {
    console.log('Testing connection...');

    // 1. Fetch all office hours
    const { data: hours, error: fetchError } = await supabase
        .from('contact_office_hours')
        .select('*');

    if (fetchError) {
        console.error('Fetch Error:', fetchError);
        return;
    }

    console.log(`Found ${hours.length} office hours entries.`);

    if (hours.length === 0) {
        console.log('No entries to update.');
        return;
    }

    const firstId = hours[0].id;
    console.log(`Attempting to update entry with ID: ${firstId}`);

    // 2. Try to update the first entry
    const { data: updated, error: updateError } = await supabase
        .from('contact_office_hours')
        .update({ updated_at: new Date() })
        .eq('id', firstId)
        .select()
        .single();

    if (updateError) {
        console.error('Update Error:', updateError);
    } else {
        console.log('Update Success:', updated);
    }
}

testUpdate();
