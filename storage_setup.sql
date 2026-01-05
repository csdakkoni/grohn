-- [AGORALOOM - STORAGE SCHEMA]
-- Run this in Supabase SQL Editor to enable direct media uploads

-- 1. Create a bucket for artisan media
INSERT INTO storage.buckets (id, name, public) 
VALUES ('artisan-media', 'artisan-media', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow public to view media
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'artisan-media' );

-- 3. Allow authenticated uploads (Admin only in production)
-- For development, we allow all for now.
CREATE POLICY "Artisan Upload" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'artisan-media' );

CREATE POLICY "Artisan Update" 
ON storage.objects FOR UPDATE 
USING ( bucket_id = 'artisan-media' );

CREATE POLICY "Artisan Delete" 
ON storage.objects FOR DELETE 
USING ( bucket_id = 'artisan-media' );
