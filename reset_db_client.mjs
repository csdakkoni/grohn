
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ebynzzrcgpultcsnvsxf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVieW56enJjZ3B1bHRjc252c3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MTY2NjcsImV4cCI6MjA3OTk5MjY2N30.w5gdtpDibXl4t1RbXIfqmK_9YdWPCOtRsbYm35bhUKA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const tables = [
    'stock_movements',
    'quality_results',
    'quality_batches',
    'sales',
    'productions',
    'purchases',
    'lots',
    'recipe_ingredients',
    'quality_specs',
    'quality_standards',
    'recipes',
    'inventory',
    'accounts',
    'calculation_history'
];

async function resetDB() {
    console.log("🛠 Starting Database Reset (Data Wipe)...");

    for (const table of tables) {
        process.stdout.write(`Cleaning table: ${table}... `);
        const { error } = await supabase.from(table).delete().neq('id', -1);

        if (error) {
            console.log(`❌ Failed: ${error.message}`);
        } else {
            console.log("✅ Done");
        }
    }

    console.log("🎉 Reset attempt finished.");
}

resetDB();
