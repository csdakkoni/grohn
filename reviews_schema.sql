-- Customer Reviews Table
CREATE TABLE IF NOT EXISTS store_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id BIGINT REFERENCES store_products(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_verified_purchase BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE store_reviews ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view reviews" ON store_reviews
    FOR SELECT USING (true);

CREATE POLICY "Anyone can submit a review" ON store_reviews
    FOR INSERT WITH CHECK (true);

-- Add some dummy reviews for the initial look
INSERT INTO store_reviews (product_id, customer_name, rating, comment, is_verified_purchase)
SELECT 
    id, 
    'Avery Jenkins', 
    5, 
    'The quality of this product is beyond my expectations. You can really feel the artisanal touch.', 
    true
FROM store_products LIMIT 1;
