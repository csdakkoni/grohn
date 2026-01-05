
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ebynzzrcgpultcsnvsxf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVieW56enJjZ3B1bHRjc252c3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MTY2NjcsImV4cCI6MjA3OTk5MjY2N30.w5gdtpDibXl4t1RbXIfqmK_9YdWPCOtRsbYm35bhUKA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const tables = [
    'inventory',
    'recipes',
    'sales',
    'productions',
    'purchases',
    'lots'
];

async function checkCounts() {
    console.log("📊 Checking Table Row Counts...");

    for (const table of tables) {
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.log(`${table}: ❌ Error: ${error.message}`);
        } else {
            console.log(`${table}: ${count} rows`);
        }
    }
}

checkCounts();
