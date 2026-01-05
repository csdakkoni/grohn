-- Add missing unit column to purchases table
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'kg';

-- Refresh the schema cache (PostgREST)
NOTIFY pgrst, 'reload schema';
