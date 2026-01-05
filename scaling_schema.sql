-- Fulfillment & Tracking
ALTER TABLE store_orders 
ADD COLUMN IF NOT EXISTS tracking_number TEXT,
ADD COLUMN IF NOT EXISTS carrier TEXT,
ADD COLUMN IF NOT EXISTS estimated_delivery TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS fulfillment_status TEXT DEFAULT 'pending' CHECK (fulfillment_status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled'));

-- Message Center (Inbox)
CREATE TABLE IF NOT EXISTS store_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_name TEXT,
    email TEXT,
    subject TEXT,
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    admin_response TEXT,
    responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Store Settings (Announcement Bar, etc)
CREATE TABLE IF NOT EXISTS store_settings (
    key TEXT PRIMARY KEY,
    value JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default Settings
INSERT INTO store_settings (key, value)
VALUES 
    ('announcement_bar', '{"text": "Free global shipping on orders over $150", "is_active": true, "bg_color": "#000000"}'),
    ('i18n_config', '{"default_language": "en", "default_currency": "USD", "active_languages": ["en", "tr"]}')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE store_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public can send messages" ON store_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin can manage messages" ON store_messages FOR ALL USING (auth.jwt() ->> 'email' = 'your_email@example.com');
CREATE POLICY "Public can view settings" ON store_settings FOR SELECT USING (true);
CREATE POLICY "Admin can manage settings" ON store_settings FOR ALL USING (auth.jwt() ->> 'email' = 'your_email@example.com');
