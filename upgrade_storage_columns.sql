-- UPGRADE STORAGE FOR PRIVATE ACCESS
-- 1. Add file_path columns to track storage location
ALTER TABLE product_documents ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE product_certifications ADD COLUMN IF NOT EXISTS file_path TEXT;

-- 2. Update existing buckets to private (Supabase SQL)
-- Note: This requires the storage manager to run this if executed via API, 
-- but for the SQL editor it should work.
UPDATE storage.buckets SET public = false WHERE id IN ('product-documents', 'certification-files');

-- 3. Backfill attempt (If file_url contains the path)
-- Typically file_url looks like: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
-- We can't perfectly backfill without regex, but we can try for standard patterns.
-- For now, we assume new uploads will populate file_path.
