-- [AGORALOOM - MEDIA UPGRADE]
-- Supporting Videos and Extended Galleries

ALTER TABLE store_products 
ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Index for better performance if we search by media presence
CREATE INDEX IF NOT EXISTS idx_products_has_video ON store_products (video_url) WHERE video_url IS NOT NULL;
