import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Only initialize if URL is a valid format (prevents crash on placeholder strings)
const isValidUrl = supabaseUrl && (supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://'));

export const supabase = (isValidUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey)
    : null;
