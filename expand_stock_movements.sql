-- ==========================================
-- STOK HAREKETLERİ ŞEMA VE FONKSİYON GÜNCELLEME
-- ==========================================

-- 1. ADIM: Yeni kolonları ekle
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS supplier_id BIGINT REFERENCES accounts(id);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES accounts(id);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS total_amount NUMERIC;

-- 2. ADIM: process_sale Fonksiyonunu Güncelle (Otomatik Kayıt İçin)
CREATE OR REPLACE FUNCTION process_sale(
    p_user_id UUID, p_customer_id BIGINT, p_production_id BIGINT, p_quantity NUMERIC,
    p_unit_price NUMERIC, p_currency TEXT, p_payment_term NUMERIC, p_sale_date DATE, p_notes TEXT
)
RETURNS BIGINT AS $$
DECLARE
    v_production RECORD; v_recipe RECORD; v_product_id BIGINT; v_avail_qty NUMERIC;
    v_remaining_qty NUMERIC; v_lot_id BIGINT; v_lot_qty NUMERIC; v_sale_id BIGINT;
    v_current_stock NUMERIC; v_product_name TEXT;
BEGIN
    SELECT * INTO v_production FROM productions WHERE id = p_production_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Üretim kaydı bulunamadı'; END IF;
    SELECT * INTO v_recipe FROM recipes WHERE id = v_production.recipe_id;
    v_product_id := v_recipe.product_id;
    SELECT name INTO v_product_name FROM inventory WHERE id = v_product_id;
    SELECT COALESCE(SUM(qty), 0) INTO v_avail_qty FROM lots WHERE inventory_id = v_product_id;
    IF v_avail_qty < p_quantity THEN RAISE EXCEPTION 'Yetersiz stok! Mevcut: %, İstenen: %', v_avail_qty, p_quantity; END IF;
    INSERT INTO sales (user_id, customer_id, production_id, product_name, lot_number, quantity, unit_price, currency, total_amount, sale_date, payment_term, notes)
    VALUES (p_user_id, p_customer_id, p_production_id, v_product_name, v_production.lot_number, p_quantity, p_unit_price, p_currency, (p_quantity * p_unit_price), p_sale_date, p_payment_term, p_notes)
    RETURNING id INTO v_sale_id;
    v_remaining_qty := p_quantity;
    FOR v_lot_id, v_lot_qty IN SELECT id, qty FROM lots WHERE inventory_id = v_product_id ORDER BY created_at ASC LOOP
        IF v_remaining_qty <= 0 THEN EXIT; END IF;
        IF v_lot_qty <= v_remaining_qty THEN DELETE FROM lots WHERE id = v_lot_id; v_remaining_qty := v_remaining_qty - v_lot_qty;
        ELSE UPDATE lots SET qty = qty - v_remaining_qty WHERE id = v_lot_id; v_remaining_qty := 0; END IF;
    END LOOP;
    -- STOK HAREKETİ KAYDI (GELİŞMİŞ - Bakiyeyi Önceki Hareket Üzerinden Hesapla)
    DECLARE
        v_prev_stock NUMERIC;
    BEGIN
        SELECT COALESCE(current_stock, 0) INTO v_prev_stock 
        FROM stock_movements 
        WHERE inventory_id = v_product_id 
        ORDER BY id DESC 
        LIMIT 1;

        v_current_stock := v_prev_stock - p_quantity;
    END;
    
    INSERT INTO stock_movements (user_id, inventory_id, type, item_name, amount, current_stock, reason, related_id, notes, customer_id, price, currency, total_amount)
    VALUES (p_user_id, v_product_id, 'Out', v_product_name, -p_quantity, v_current_stock, 'Sale', v_sale_id, 'Satış: ' || v_production.lot_number, p_customer_id, p_unit_price, p_currency, (p_quantity * p_unit_price));
    
    RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;

-- 3. ADIM: Mevcut verileri geriye dönük eşitle
-- Satınalmalar
UPDATE stock_movements sm
SET 
    supplier_id = p.supplier_id,
    price = p.price,
    currency = p.currency,
    total_amount = p.total
FROM purchases p
WHERE sm.lot_no = p.lot_no 
AND sm.item_name = p.item_name 
AND sm.reason = 'Purchase'
AND sm.supplier_id IS NULL;

-- Satışlar
UPDATE stock_movements sm
SET 
    customer_id = s.customer_id,
    price = s.unit_price,
    currency = s.currency,
    total_amount = s.total_amount
FROM sales s
WHERE sm.related_id = s.id 
AND sm.reason = 'Sale'
AND sm.customer_id IS NULL;
