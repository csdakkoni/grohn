-- FINAL STORAGE INFRASTRUCTURE SETUP
-- Run this in Supabase SQL Editor to create and secure buckets

-- 1. Create buckets if they don't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-documents', 'product-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('certification-files', 'certification-files', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 2. Storage Policies (RLS)
-- Remove old policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Staff Delete" ON storage.objects;
DROP POLICY IF EXISTS "Private Access" ON storage.objects;

-- NEW POLICIES:
-- a) Authenticated users can read files (Signed URLs will still work)
CREATE POLICY "Private Access" ON storage.objects FOR SELECT USING (
    bucket_id IN ('product-documents', 'certification-files')
    AND auth.role() = 'authenticated'
);

-- b) Authenticated users can upload files
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id IN ('product-documents', 'certification-files') 
    AND auth.role() = 'authenticated'
);

-- c) Authenticated users can delete files
CREATE POLICY "Staff Delete" ON storage.objects FOR DELETE USING (
    bucket_id IN ('product-documents', 'certification-files')
    AND auth.role() = 'authenticated'
);

-- 3. Ensure Table Columns Exist
ALTER TABLE product_documents ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE product_certifications ADD COLUMN IF NOT EXISTS file_path TEXT;
