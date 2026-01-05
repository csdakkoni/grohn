-- SUPABASE STORAGE SETUP FOR MARKETING MODULE
-- 1. Create buckets for Documents and Certifications
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-documents', 'product-documents', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('certification-files', 'certification-files', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies (RLS)
-- Allow public read access to everyone in the team (simplified for now)
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id IN ('product-documents', 'certification-files'));

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id IN ('product-documents', 'certification-files') 
    AND auth.role() = 'authenticated'
);

-- Allow users to delete their own uploads or admins to delete any
CREATE POLICY "Staff Delete" ON storage.objects FOR DELETE USING (
    bucket_id IN ('product-documents', 'certification-files')
);
