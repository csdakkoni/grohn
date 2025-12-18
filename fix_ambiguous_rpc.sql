-- ÇAKIŞAN FONKSİYONLARI TEMİZLEME VE DÜZELTME
-- Hata: process_sale fonksiyonunun hem INTEGER hem NUMERIC versiyonları oluşmuş.

-- 1. Önce olası tüm varyasyonları silelim (Drop)
DROP FUNCTION IF EXISTS process_sale(uuid, bigint, bigint, numeric, numeric, text, integer, date, text);
DROP FUNCTION IF EXISTS process_sale(uuid, bigint, bigint, numeric, numeric, text, numeric, date, text);

-- 2. Tek ve Doğru Versiyonu Tekrar Oluşturalım (NUMERIC olarak)
CREATE OR REPLACE FUNCTION process_sale(
    p_user_id UUID,
    p_customer_id BIGINT,
    p_production_id BIGINT,
    p_quantity NUMERIC,
    p_unit_price NUMERIC,
    p_currency TEXT,
    p_payment_term NUMERIC, -- Numeric yaparak esneklik sağlıyoruz
    p_sale_date DATE,
    p_notes TEXT
)
RETURNS BIGINT AS $$
DECLARE
    v_production RECORD;
    v_recipe RECORD;
    v_product_id BIGINT;
    v_avail_qty NUMERIC;
    v_remaining_qty NUMERIC;
    v_lot_id BIGINT;
    v_lot_qty NUMERIC;
    v_sale_id BIGINT;
    v_current_stock NUMERIC;
    v_product_name TEXT;
BEGIN
    -- Get Production Info
    SELECT * INTO v_production FROM productions WHERE id = p_production_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Üretim kaydı bulunamadı (ID: %)', p_production_id; END IF;

    -- Get Product ID from Recipe
    SELECT * INTO v_recipe FROM recipes WHERE id = v_production.recipe_id;
    v_product_id := v_recipe.product_id;
    SELECT name INTO v_product_name FROM inventory WHERE id = v_product_id;

    -- Check Stock
    SELECT COALESCE(SUM(qty), 0) INTO v_avail_qty FROM lots WHERE inventory_id = v_product_id;
    
    -- Stok kontrolünde hata payı (epsilon) yönetimi
    IF v_avail_qty < (p_quantity - 0.001) THEN
        RAISE EXCEPTION 'Yetersiz stok! Mevcut: %, İstenen: %', v_avail_qty, p_quantity;
    END IF;

    -- Insert Sale Record
    INSERT INTO sales (
        user_id, customer_id, production_id, product_name, lot_number, quantity,
        unit_price, currency, total_amount, sale_date, payment_term, notes
    ) VALUES (
        p_user_id, p_customer_id, p_production_id, v_product_name,
        v_production.lot_number, p_quantity, p_unit_price, p_currency,
        (p_quantity * p_unit_price), p_sale_date, p_payment_term, p_notes
    ) RETURNING id INTO v_sale_id;

    -- Deduct Stock (FIFO Logic)
    v_remaining_qty := p_quantity;
    FOR v_lot_id, v_lot_qty IN 
        SELECT id, qty FROM lots 
        WHERE inventory_id = v_product_id 
        ORDER BY created_at ASC 
    LOOP
        IF v_remaining_qty <= 0 THEN EXIT; END IF;

        IF v_lot_qty <= v_remaining_qty THEN
            -- Consume entire lot
            DELETE FROM lots WHERE id = v_lot_id;
            v_remaining_qty := v_remaining_qty - v_lot_qty;
        ELSE
            -- Partial consumption
            UPDATE lots SET qty = qty - v_remaining_qty WHERE id = v_lot_id;
            v_remaining_qty := 0;
        END IF;
    END LOOP;

    -- Log Stock Movement
    SELECT COALESCE(SUM(qty), 0) INTO v_current_stock FROM lots WHERE inventory_id = v_product_id;
    INSERT INTO stock_movements (
        user_id, inventory_id, type, item_name, amount, current_stock, reason, related_id, notes
    ) VALUES (
        p_user_id, v_product_id, 'Out', v_product_name, -p_quantity, v_current_stock, 'Sale', v_sale_id, 'Satış: ' || v_production.lot_number
    );

    RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;
