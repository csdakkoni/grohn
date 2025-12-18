import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://ebynzzrcgpultcsnvsxf.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVieW56enJjZ3B1bHRjc252c3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MTY2NjcsImV4cCI6MjA3OTk5MjY2N30.w5gdtpDibXl4t1RbXIfqmK_9YdWPCOtRsbYm35bhUKA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
