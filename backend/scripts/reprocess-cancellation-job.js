/**
 * Script to re-process a failed event cancellation job
 * Usage: node scripts/reprocess-cancellation-job.js <event_id_or_registration_number>
 * 
 * Example: node scripts/reprocess-cancellation-job.js EVT-KAT-02CE
 */

require('dotenv').config();
const supabase = require('../config/supabase');
const EventCancellationService = require('../services/event-cancellation.service');
const logger = require('../utils/logger');

async function reprocessJob(eventIdentifier) {
    console.log(`\n🔍 Looking for event: ${eventIdentifier}\n`);

    // Find the event by ID or registration_number pattern
    let event;

    // First try by exact ID
    const { data: eventById } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventIdentifier)
        .single();

    if (eventById) {
        event = eventById;
    } else {
        // Try to find by title containing the identifier
        const { data: eventByTitle } = await supabase
            .from('events')
            .select('*')
            .ilike('title', `%${eventIdentifier}%`)
            .single();

        if (eventByTitle) {
            event = eventByTitle;
        }
    }

    if (!event) {
        console.error(`❌ Event not found: ${eventIdentifier}`);
        process.exit(1);
    }

    console.log(`✅ Found event: "${event.title}" (ID: ${event.id})`);
    console.log(`   Status: ${event.status}`);
    console.log(`   Cancellation Status: ${event.cancellation_status || 'N/A'}`);

    // Find the cancellation job for this event
    const { data: job, error: jobError } = await supabase
        .from('event_cancellation_jobs')
        .select('*')
        .eq('event_id', event.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (jobError || !job) {
        console.error(`❌ No cancellation job found for this event`);
        process.exit(1);
    }

    console.log(`\n📋 Cancellation Job Details:`);
    console.log(`   Job ID: ${job.id}`);
    console.log(`   Status: ${job.status}`);
    console.log(`   Total Registrations: ${job.total_registrations}`);
    console.log(`   Processed: ${job.processed_count || 0}`);
    console.log(`   Failed: ${job.failed_count || 0}`);
    console.log(`   Created: ${job.created_at}`);

    if (job.status === 'PENDING') {
        console.log(`\n⚠️  Job is already PENDING. Processing now...`);
    } else {
        // Reset job to PENDING
        console.log(`\n🔄 Resetting job status from "${job.status}" to "PENDING"...`);

        const { error: resetError } = await supabase
            .from('event_cancellation_jobs')
            .update({
                status: 'PENDING',
                processed_count: 0,
                failed_count: 0,
                error_log: [],
                last_processed_at: null,
                completed_at: null
            })
            .eq('id', job.id);

        if (resetError) {
            console.error(`❌ Failed to reset job:`, resetError.message);
            process.exit(1);
        }

        console.log(`✅ Job reset successfully`);
    }

    // Check how many registrations need processing
    const { count: pendingCount } = await supabase
        .from('event_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .neq('status', 'cancelled');

    console.log(`\n📊 Registrations to process: ${pendingCount || 0}`);

    if (pendingCount === 0) {
        console.log(`\n⚠️  No pending registrations to process. All may already be cancelled.`);

        // Mark job as completed
        await supabase
            .from('event_cancellation_jobs')
            .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
            .eq('id', job.id);

        console.log(`✅ Job marked as COMPLETED (no work to do)`);
        process.exit(0);
    }

    // Update total_registrations to current count
    await supabase
        .from('event_cancellation_jobs')
        .update({ total_registrations: pendingCount })
        .eq('id', job.id);

    console.log(`\n🚀 Starting job processing...`);
    console.log(`   This will update registration statuses and send cancellation emails.\n`);

    try {
        await EventCancellationService.processJob(job.id);
        console.log(`\n✅ Job processing completed!`);

        // Fetch final status
        const { data: finalJob } = await supabase
            .from('event_cancellation_jobs')
            .select('*')
            .eq('id', job.id)
            .single();

        if (finalJob) {
            console.log(`\n📋 Final Job Status:`);
            console.log(`   Status: ${finalJob.status}`);
            console.log(`   Processed: ${finalJob.processed_count || 0}`);
            console.log(`   Failed: ${finalJob.failed_count || 0}`);

            if (finalJob.error_log && finalJob.error_log.length > 0) {
                console.log(`\n⚠️  Errors encountered:`);
                finalJob.error_log.forEach((err, i) => {
                    console.log(`   ${i + 1}. Registration ${err.registrationId}: ${err.error}`);
                });
            }
        }
    } catch (error) {
        console.error(`\n❌ Job processing failed:`, error.message);
        process.exit(1);
    }

    console.log(`\n🎉 Done!\n`);
}

// Get event identifier from command line
const eventIdentifier = process.argv[2];

if (!eventIdentifier) {
    console.log(`
Usage: node scripts/reprocess-cancellation-job.js <event_id_or_search_term>

Examples:
  node scripts/reprocess-cancellation-job.js 6de25a27-1bb0-4cfd-9ec1-66bdab3b6547
  node scripts/reprocess-cancellation-job.js "Katha"
`);
    process.exit(1);
}

reprocessJob(eventIdentifier);
