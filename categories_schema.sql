-- [AGORALOOM - CATEGORIES SCHEMA]

CREATE TABLE IF NOT EXISTS store_categories (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE store_categories ENABLE ROW LEVEL SECURITY;

-- Public can view categories
CREATE POLICY "Public can view categories" ON store_categories
    FOR SELECT USING (true);

-- Allow public insert/delete for development (Admin only in production)
CREATE POLICY "Allow public manage categories for development" ON store_categories
    FOR ALL USING (true);

-- Insert some initial elite categories
INSERT INTO store_categories (name, slug, display_order) VALUES
('Living', 'living', 1),
('Dining', 'dining', 2),
('Bedroom', 'bedroom', 3),
('Bath', 'bath', 4),
('Artisan Pieces', 'artisan-pieces', 5)
ON CONFLICT (slug) DO NOTHING;
