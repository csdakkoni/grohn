import { createClient } from '@supabase/supabase-js';

// Copy from supabaseClient.js (hardcoded fallback)
const supabaseUrl = 'https://ebynzzrcgpultcsnvsxf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVieW56enJjZ3B1bHRjc252c3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MTY2NjcsImV4cCI6MjA3OTk5MjY2N30.w5gdtpDibXl4t1RbXIfqmK_9YdWPCOtRsbYm35bhUKA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verify() {
    console.log("Verifying Quality Control Tables...");

    // Check quality_specs
    const { data: specs, error: specsError } = await supabase.from('quality_specs').select('id').limit(1);
    if (specsError) {
        console.error("❌ quality_specs table check failed:", specsError.message);
        console.error("Hint: Did you run the 'supabase_quality_control.sql' script in Supabase?");
        process.exit(1);
    }
    console.log("✅ quality_specs table exists.");

    // Check quality_batches
    const { data: batches, error: batchesError } = await supabase.from('quality_batches').select('id').limit(1);
    if (batchesError) {
        console.error("❌ quality_batches table check failed:", batchesError.message);
        process.exit(1);
    }
    console.log("✅ quality_batches table exists.");

    // Check quality_results
    const { data: results, error: resultsError } = await supabase.from('quality_results').select('id').limit(1);
    if (resultsError) {
        console.error("❌ quality_results table check failed:", resultsError.message);
        process.exit(1);
    }
    console.log("✅ quality_results table exists.");

    console.log("All Quality Control tables verified!");
}

verify();
