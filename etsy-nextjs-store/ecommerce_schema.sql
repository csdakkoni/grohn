-- [ETSY STOREFRONT - ECOMMERCE SCHEMA]
-- This script will reset and recreate the tables for a clean start.

-- Drop existing tables to avoid conflicts
DROP TABLE IF EXISTS store_order_items;
DROP TABLE IF EXISTS store_orders;
DROP TABLE IF EXISTS store_products;

-- 1. Create Products Table
CREATE TABLE store_products (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    etsy_listing_id BIGINT UNIQUE, -- Link to original Etsy listing
    title TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    stock_quantity INTEGER DEFAULT 0,
    main_image_url TEXT,
    all_images JSONB DEFAULT '[]'::JSONB,
    slug TEXT UNIQUE, -- URL-friendly name
    category TEXT,
    tags TEXT[],
    is_active BOOLEAN DEFAULT true,
    material TEXT,
    care_instructions TEXT,
    size_guide TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Orders Table
CREATE TABLE IF NOT EXISTS store_orders (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    order_number TEXT UNIQUE NOT NULL, -- e.g. ORD-1001
    customer_id UUID REFERENCES auth.users(id), -- Optional: Link to Auth
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'pending', -- pending, paid, processing, shipped, cancelled
    stripe_session_id TEXT, -- For Stripe tracking
    shipping_address JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Order Items Table
CREATE TABLE IF NOT EXISTS store_order_items (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    order_id BIGINT REFERENCES store_orders(id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES store_products(id),
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_store_products_updated_at BEFORE UPDATE ON store_products FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_store_orders_updated_at BEFORE UPDATE ON store_orders FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Enable RLS
ALTER TABLE store_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_order_items ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
-- Public can view active products
CREATE POLICY "Public can view active products" ON store_products
    FOR SELECT USING (is_active = true);

-- Customers can view their own orders
CREATE POLICY "Customers can view own orders" ON store_orders
    FOR SELECT USING (auth.uid() = customer_id);

-- Only admin (you) can manage products
-- For development: allow public insert (Disable this in production!)
CREATE POLICY "Allow public insert for development" ON store_products
    FOR INSERT WITH CHECK (true);

-- Original Admin Policy (Keep for later)
CREATE POLICY "Admin can manage products" ON store_products
    FOR ALL USING (auth.jwt() ->> 'email' = 'your_email@example.com');
-- 7. ANALYTICS VIEWS (Shopify-like reporting)

-- View for overall sales metrics
CREATE OR REPLACE VIEW view_sales_metrics AS
SELECT 
    COALESCE(SUM(total_amount), 0) as total_revenue,
    COUNT(id) as total_orders,
    CASE WHEN COUNT(id) > 0 THEN SUM(total_amount) / COUNT(id) ELSE 0 END as avg_order_value
FROM store_orders
WHERE status = 'paid';

-- View for best selling products
CREATE OR REPLACE VIEW view_best_sellers AS
SELECT 
    p.title,
    p.main_image_url,
    SUM(oi.quantity) as total_sold,
    SUM(oi.quantity * oi.unit_price) as revenue_generated
FROM store_order_items oi
JOIN store_products p ON oi.product_id = p.id
GROUP BY p.id, p.title, p.main_image_url
ORDER BY total_sold DESC;

-- View for daily sales trends (last 30 days)
CREATE OR REPLACE VIEW view_daily_sales AS
SELECT 
    DATE(created_at) as sale_date,
    SUM(total_amount) as daily_revenue,
    COUNT(id) as order_count
FROM store_orders
WHERE status = 'paid' 
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY sale_date DESC;

-- View for inventory health
CREATE OR REPLACE VIEW view_inventory_health AS
SELECT 
    title,
    stock_quantity,
    CASE 
        WHEN stock_quantity = 0 THEN 'Out of Stock'
        WHEN stock_quantity < 10 THEN 'Low Stock'
        ELSE 'Healthy'
    END as health_status
FROM store_products
ORDER BY stock_quantity ASC;

-- Grant access to the views
GRANT SELECT ON view_sales_metrics TO anon, authenticated;
GRANT SELECT ON view_best_sellers TO anon, authenticated;
GRANT SELECT ON view_daily_sales TO anon, authenticated;
GRANT SELECT ON view_inventory_health TO anon, authenticated;
