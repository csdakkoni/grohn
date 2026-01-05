-- 1. Customer Reviews (If not already created)
CREATE TABLE IF NOT EXISTS store_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id BIGINT REFERENCES store_products(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_verified_purchase BOOLEAN DEFAULT false,
    review_images JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Loyalty System (The Artisan Circle)
CREATE TABLE IF NOT EXISTS store_loyalty_config (
    tier_name TEXT PRIMARY KEY,
    min_points INTEGER NOT NULL,
    discount_percentage NUMERIC(5, 2) DEFAULT 0,
    benefits JSONB DEFAULT '[]'::JSONB
);

INSERT INTO store_loyalty_config (tier_name, min_points, discount_percentage, benefits)
VALUES 
    ('Bronze', 0, 0, '["Points on every purchase", "Standard support"]'),
    ('Silver', 500, 5, '["5% off all orders", "Priority shipping", "Exclusive previews"]'),
    ('Gold', 1500, 10, '["10% off all orders", "Free gift on birthday", "VIP concierge support"]')
ON CONFLICT (tier_name) DO NOTHING;

-- Extend User Profiles for Loyalty (Assuming a public.profiles table exists or creating one)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    loyalty_points INTEGER DEFAULT 0,
    loyalty_tier TEXT DEFAULT 'Bronze' REFERENCES store_loyalty_config(tier_name),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. The Artisan Journal (CMS)
CREATE TABLE IF NOT EXISTS store_journal_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    excerpt TEXT,
    content TEXT NOT NULL,
    cover_image TEXT,
    author_name TEXT DEFAULT 'AgoraLoom Artisan',
    is_published BOOLEAN DEFAULT false,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Advanced Product Metrics (Scarcity & Trends)
ALTER TABLE store_products 
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS trending_score NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_limited_edition BOOLEAN DEFAULT false;

-- 5. Enable RLS
ALTER TABLE store_loyalty_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_journal_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view loyalty tiers" ON store_loyalty_config FOR SELECT USING (true);
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Public can view published journal posts" ON store_journal_posts FOR SELECT USING (is_published = true);
CREATE POLICY "Admin can manage all" ON store_journal_posts FOR ALL USING (auth.jwt() ->> 'email' = 'your_email@example.com');
