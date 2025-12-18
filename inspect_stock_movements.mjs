
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ebynzzrcgpultcsnvsxf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVieW56enJjZ3B1bHRjc252c3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MTY2NjcsImV4cCI6MjA3OTk5MjY2N30.w5gdtpDibXl4t1RbXIfqmK_9YdWPCOtRsbYm35bhUKA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
    console.log("Fetching one stock movement...");
    const { data, error } = await supabase
        .from('stock_movements')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Success. Row keys (columns):');
        if (data && data.length > 0) {
            console.log(Object.keys(data[0]));
        } else {
            console.log('No data found, cannot inspect keys via select.');
            // Try to insert a dummy row to see error? No, that's risky.
        }
    }
}

inspect();
