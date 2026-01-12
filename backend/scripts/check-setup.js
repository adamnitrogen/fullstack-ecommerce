const supabase = require('./config/supabase');

async function checkSetup() {
    console.log('Checking Supabase Setup...');

    // 1. Check Bucket
    try {
        const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
        if (bucketError) {
            console.error('❌ Error listing buckets:', bucketError.message);
        } else {
            const imagesBucket = buckets.find(b => b.name === 'images');
            if (imagesBucket) {
                console.log('✅ Bucket "images" exists');
                console.log('   Public:', imagesBucket.public);
            } else {
                console.error('❌ Bucket "images" NOT found');
            }
        }
    } catch (e) {
        console.error('❌ Exception checking buckets:', e.message);
    }

    // 2. Check Table
    try {
        const { data, error } = await supabase
            .from('photos')
            .select('count', { count: 'exact', head: true });

        if (error) {
            console.error('❌ Error checking "photos" table:', error.message);
        } else {
            console.log('✅ Table "photos" exists');
        }
    } catch (e) {
        console.error('❌ Exception checking table:', e.message);
    }
}

checkSetup();
