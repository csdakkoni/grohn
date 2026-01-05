-- [RPC CONSOLIDATION - MEGA FIX V2] 
-- This script ensures ALL old versions of production/sales functions are dropped
-- and replaces them with versions that track LOT, Customer, and COST metadata.

-- 1. DROP ALL VARIATIONS
DROP FUNCTION IF EXISTS generate_lot_number(UUID, DATE);
DROP FUNCTION IF EXISTS generate_purchase_lot_number(DATE);
DROP FUNCTION IF EXISTS process_purchase(UUID, BIGINT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, NUMERIC, TEXT, BOOLEAN, BIGINT, NUMERIC, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS process_purchase_update(BIGINT, BIGINT, TEXT, NUMERIC, NUMERIC, TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS create_production_plan(UUID, BIGINT, NUMERIC, DATE, TEXT);
DROP FUNCTION IF EXISTS create_production_plan(UUID, BIGINT, NUMERIC, DATE, TEXT, BIGINT, NUMERIC, BIGINT);
DROP FUNCTION IF EXISTS create_production_plan(UUID, BIGINT, NUMERIC, DATE, TEXT, BIGINT, NUMERIC);
DROP FUNCTION IF EXISTS add_production_adjustment(BIGINT, BIGINT, NUMERIC, UUID);
DROP FUNCTION IF EXISTS complete_production(BIGINT, UUID, BIGINT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS complete_production(BIGINT, UUID, BIGINT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS complete_production(BIGINT, UUID, BIGINT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS complete_production(BIGINT, UUID, BIGINT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS process_sale(UUID, BIGINT, BIGINT, NUMERIC, NUMERIC, TEXT, NUMERIC, DATE, TEXT);
DROP FUNCTION IF EXISTS process_sale(UUID, BIGINT, BIGINT, NUMERIC, NUMERIC, TEXT, NUMERIC, DATE, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC);

-- 2. ENSURE SCHEMA
ALTER TABLE productions ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES accounts(id);
ALTER TABLE productions ADD COLUMN IF NOT EXISTS target_packaging_id BIGINT REFERENCES inventory(id);
ALTER TABLE productions ADD COLUMN IF NOT EXISTS target_package_count NUMERIC;

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS lot_no TEXT;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES accounts(id);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS supplier_id BIGINT REFERENCES accounts(id);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS total_amount NUMERIC;

ALTER TABLE sales ADD COLUMN IF NOT EXISTS lot_no TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS raw_material_cost NUMERIC DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS packaging_cost NUMERIC DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS overhead_cost NUMERIC DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS financing_cost NUMERIC DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS total_production_cost NUMERIC DEFAULT 0;

-- 3. generate_lot_number
CREATE OR REPLACE FUNCTION generate_lot_number(p_user_id UUID, p_date DATE)
RETURNS TEXT AS $$
DECLARE
    date_str TEXT; seq INTEGER; new_lot TEXT; exists_check BOOLEAN;
BEGIN
    date_str := to_char(p_date, 'DDMMYY');
    SELECT COALESCE(MAX(CAST(NULLIF(SPLIT_PART(lot_number, '-', 2), '') AS INTEGER)), 0) + 1
    INTO seq FROM productions WHERE lot_number LIKE 'GR' || date_str || '-%';
    LOOP
        new_lot := 'GR' || date_str || '-' || seq::TEXT;
        SELECT EXISTS(SELECT 1 FROM productions WHERE lot_number = new_lot) INTO exists_check;
        IF NOT exists_check THEN
             SELECT EXISTS(SELECT 1 FROM lots WHERE lot_no = new_lot) INTO exists_check;
             IF NOT exists_check THEN EXIT; END IF;
        END IF;
        seq := seq + 1;
    END LOOP;
    RETURN new_lot;
END;
$$ LANGUAGE plpgsql;

-- 4. generate_purchase_lot_number
CREATE OR REPLACE FUNCTION generate_purchase_lot_number(p_date DATE DEFAULT CURRENT_DATE)
RETURNS TEXT AS $$
DECLARE
    v_date_prefix TEXT; v_count INTEGER;
BEGIN
    v_date_prefix := 'L' || to_char(p_date, 'YYMM');
    SELECT COUNT(*) INTO v_count FROM (
        SELECT lot_no FROM lots WHERE lot_no LIKE v_date_prefix || '-%'
        UNION
        SELECT lot_no FROM purchases WHERE lot_no LIKE v_date_prefix || '-%'
    ) sub;
    RETURN v_date_prefix || '-' || LPAD((v_count + 1)::text, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- 5. process_purchase
CREATE OR REPLACE FUNCTION process_purchase(
    p_user_id UUID, p_supplier_id BIGINT, p_item_name TEXT, p_item_type TEXT, p_unit TEXT,
    p_qty NUMERIC, p_price NUMERIC, p_currency TEXT, p_term_days NUMERIC, p_lot_no TEXT,
    p_is_new_item BOOLEAN, p_item_id BIGINT DEFAULT NULL, 
    p_capacity_value NUMERIC DEFAULT NULL, p_capacity_unit TEXT DEFAULT NULL, p_tare_weight NUMERIC DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_inventory_id BIGINT; v_purchase_id BIGINT; v_total_amount NUMERIC; v_current_stock NUMERIC; v_active_lot TEXT;
BEGIN
    v_total_amount := p_qty * p_price;
    v_active_lot := p_lot_no;
    IF v_active_lot IS NULL OR v_active_lot = '' OR v_active_lot LIKE 'OTO-%' THEN
        v_active_lot := generate_purchase_lot_number(CURRENT_DATE);
    END IF;

    IF p_is_new_item THEN
        INSERT INTO inventory (
            user_id, name, type, unit, cost, currency, payment_term, track_stock,
            capacity_value, capacity_unit, tare_weight
        ) VALUES (
            p_user_id, p_item_name, p_item_type, p_unit, p_price, p_currency, p_term_days, TRUE,
            p_capacity_value, p_capacity_unit, p_tare_weight
        ) RETURNING id INTO v_inventory_id;
    ELSE
        v_inventory_id := p_item_id;
        UPDATE inventory SET cost = p_price, currency = p_currency, payment_term = p_term_days WHERE id = v_inventory_id;
    END IF;

    INSERT INTO lots (inventory_id, lot_no, qty) VALUES (v_inventory_id, v_active_lot, p_qty);
    INSERT INTO purchases (
        user_id, supplier_id, item_name, qty, price, currency, total, payment_term, lot_no
    ) VALUES (
        p_user_id, p_supplier_id, p_item_name, p_qty, p_price, p_currency, v_total_amount, p_term_days, v_active_lot
    ) RETURNING id INTO v_purchase_id;

    SELECT COALESCE(SUM(qty), 0) INTO v_current_stock FROM lots WHERE inventory_id = v_inventory_id;
    INSERT INTO stock_movements (
        user_id, inventory_id, type, item_name, amount, current_stock, reason, related_id, 
        lot_no, supplier_id, price, currency, total_amount, notes
    ) VALUES (
        p_user_id, v_inventory_id, 'In', p_item_name, p_qty, v_current_stock, 'Purchase', v_purchase_id, 
        v_active_lot, p_supplier_id, p_price, p_currency, v_total_amount, 'Satınalma: ' || p_item_name || ' - ' || v_active_lot
    );
    RETURN json_build_object('success', true, 'purchase_id', v_purchase_id, 'lot_no', v_active_lot);
END;
$$ LANGUAGE plpgsql;

-- 6. process_purchase_update
CREATE OR REPLACE FUNCTION process_purchase_update(
    p_purchase_id BIGINT, p_supplier_id BIGINT, p_item_name TEXT,
    p_qty NUMERIC, p_price NUMERIC, p_currency TEXT, p_term_days NUMERIC, p_lot_no TEXT
)
RETURNS JSON AS $$
DECLARE
    v_old_purchase RECORD; v_inv_id BIGINT; v_total_amount NUMERIC; v_active_lot TEXT;
BEGIN
    SELECT * INTO v_old_purchase FROM purchases WHERE id = p_purchase_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Satınalma kaydı bulunamadı'; END IF;
    SELECT id INTO v_inv_id FROM inventory WHERE name = p_item_name;
    IF NOT FOUND THEN RAISE EXCEPTION 'Envanter kaydı bulunamadı'; END IF;

    v_total_amount := p_qty * p_price;
    v_active_lot := COALESCE(NULLIF(p_lot_no, ''), v_old_purchase.lot_no);

    UPDATE inventory SET cost = p_price, currency = p_currency, payment_term = p_term_days WHERE id = v_inv_id;

    IF v_old_purchase.lot_no IS DISTINCT FROM v_active_lot THEN
        UPDATE lots SET lot_no = v_active_lot, qty = p_qty WHERE inventory_id = v_inv_id AND lot_no = v_old_purchase.lot_no;
        IF NOT FOUND THEN INSERT INTO lots (inventory_id, lot_no, qty) VALUES (v_inv_id, v_active_lot, p_qty); END IF;
    ELSE
        UPDATE lots SET qty = p_qty WHERE inventory_id = v_inv_id AND lot_no = v_active_lot;
    END IF;

    UPDATE purchases SET
        supplier_id = p_supplier_id, qty = p_qty, price = p_price, currency = p_currency,
        total = v_total_amount, payment_term = p_term_days, lot_no = v_active_lot
    WHERE id = p_purchase_id;

    UPDATE stock_movements SET
        item_name = p_item_name, amount = p_qty, lot_no = v_active_lot, supplier_id = p_supplier_id,
        price = p_price, currency = p_currency, total_amount = v_total_amount,
        notes = 'Güncellenmiş Satınalma: ' || p_item_name || ' - ' || v_active_lot
    WHERE related_id = p_purchase_id AND reason = 'Purchase';

    RETURN json_build_object('success', true, 'lot_no', v_active_lot);
END;
$$ LANGUAGE plpgsql;

-- 7. create_production_plan
CREATE OR REPLACE FUNCTION create_production_plan(
    p_user_id UUID, p_recipe_id BIGINT, p_quantity NUMERIC, p_production_date DATE, p_notes TEXT,
    p_target_packaging_id BIGINT DEFAULT NULL, p_target_package_count NUMERIC DEFAULT NULL, p_customer_id BIGINT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_recipe RECORD; v_production_id BIGINT; v_lot_number TEXT; v_item_name TEXT; v_track_stock BOOLEAN;
    v_req_qty NUMERIC; v_avail_qty NUMERIC; v_ingredient RECORD; v_current_stock NUMERIC;
    v_remaining_qty NUMERIC; v_lot_id BIGINT; v_lot_qty NUMERIC;
BEGIN
    SELECT * INTO v_recipe FROM recipes WHERE id = p_recipe_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Reçete bulunamadı'; END IF;
    v_lot_number := generate_lot_number(p_user_id, p_production_date);

    INSERT INTO productions (
        user_id, recipe_id, lot_number, quantity, production_date, status, qc_status, notes,
        target_packaging_id, target_package_count, customer_id, created_at
    ) VALUES (
        p_user_id, p_recipe_id, v_lot_number, p_quantity, p_production_date, 'Planned', 'Pending', p_notes,
        p_target_packaging_id, p_target_package_count, p_customer_id, NOW()
    ) RETURNING id INTO v_production_id;

    FOR v_ingredient IN SELECT * FROM recipe_ingredients WHERE recipe_id = p_recipe_id LOOP
        v_req_qty := (p_quantity * v_ingredient.percentage / 100);
        SELECT name, track_stock INTO v_item_name, v_track_stock FROM inventory WHERE id = v_ingredient.item_id;
        IF v_track_stock THEN
            SELECT COALESCE(SUM(qty), 0) INTO v_avail_qty FROM lots WHERE inventory_id = v_ingredient.item_id;
            IF v_avail_qty < v_req_qty THEN RAISE EXCEPTION 'Yetersiz stok: % (Mevcut: %, Gerekli: %)', v_item_name, v_avail_qty, v_req_qty; END IF;
            
            DECLARE v_i_cost NUMERIC; v_i_curr TEXT; BEGIN
                SELECT cost, currency INTO v_i_cost, v_i_curr FROM inventory WHERE id = v_ingredient.item_id;
                v_current_stock := v_avail_qty - v_req_qty;
                INSERT INTO stock_movements (user_id, inventory_id, type, item_name, amount, current_stock, reason, related_id, lot_no, customer_id, price, currency, total_amount, notes)
                VALUES (p_user_id, v_ingredient.item_id, 'Out', v_item_name, -v_req_qty, v_current_stock, 'Production_Plan', v_production_id, v_lot_number, p_customer_id, v_i_cost, v_i_curr, (v_req_qty * v_i_cost), 'Üretim Planı (Hammadde): ' || v_lot_number);
            END;

            v_remaining_qty := v_req_qty;
            FOR v_lot_id, v_lot_qty IN SELECT id, qty FROM lots WHERE inventory_id = v_ingredient.item_id ORDER BY created_at ASC LOOP
                IF v_remaining_qty <= 0 THEN EXIT; END IF;
                IF v_lot_qty <= v_remaining_qty THEN DELETE FROM lots WHERE id = v_lot_id; v_remaining_qty := v_remaining_qty - v_lot_qty;
                ELSE UPDATE lots SET qty = qty - v_remaining_qty WHERE id = v_lot_id; v_remaining_qty := 0; END IF;
            END LOOP;
        END IF;
    END LOOP;
    RETURN json_build_object('success', true, 'lot_number', v_lot_number, 'id', v_production_id);
END;
$$ LANGUAGE plpgsql;

-- 8. add_production_adjustment
CREATE OR REPLACE FUNCTION add_production_adjustment(
    p_production_id BIGINT, p_item_id BIGINT, p_quantity NUMERIC, p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_item RECORD; v_prod RECORD; v_current_stock NUMERIC; v_remaining_qty NUMERIC; v_lot_id BIGINT; v_lot_qty NUMERIC;
BEGIN
    SELECT * INTO v_item FROM inventory WHERE id = p_item_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Stok kartı bulunamadı'; END IF;
    SELECT * INTO v_prod FROM productions WHERE id = p_production_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Üretim kaydı bulunamadı'; END IF;

    INSERT INTO production_adjustments (production_id, inventory_id, quantity, cost, user_id, created_at)
    VALUES (p_production_id, p_item_id, p_quantity, (v_item.cost * p_quantity), p_user_id, NOW());

    IF v_item.track_stock THEN
        SELECT COALESCE(SUM(qty), 0) INTO v_current_stock FROM lots WHERE inventory_id = p_item_id;
        INSERT INTO stock_movements (user_id, inventory_id, type, item_name, amount, current_stock, reason, related_id, lot_no, customer_id, price, currency, total_amount, notes)
        VALUES (p_user_id, p_item_id, 'Out', v_item.name, -p_quantity, (v_current_stock - p_quantity), 'Adjustment_Usage', p_production_id, v_prod.lot_number, v_prod.customer_id, v_item.cost, v_item.currency, (p_quantity * v_item.cost), 'Revizyon/Ek İlave: ' || v_prod.lot_number);
        v_remaining_qty := p_quantity;
        FOR v_lot_id, v_lot_qty IN SELECT id, qty FROM lots WHERE inventory_id = p_item_id ORDER BY created_at ASC LOOP
            IF v_remaining_qty <= 0 THEN EXIT; END IF;
            IF v_lot_qty <= v_remaining_qty THEN DELETE FROM lots WHERE id = v_lot_id; v_remaining_qty := v_remaining_qty - v_lot_qty;
            ELSE UPDATE lots SET qty = qty - v_remaining_qty WHERE id = v_lot_id; v_remaining_qty := 0; END IF;
        END LOOP;
    END IF;
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- 9. complete_production
CREATE OR REPLACE FUNCTION complete_production(
    p_production_id BIGINT, p_user_id UUID, p_packaging_id BIGINT, p_packaging_count NUMERIC,
    p_shipping_cost NUMERIC, p_overhead_cost NUMERIC, p_sale_term_days NUMERIC, p_profit_margin NUMERIC,
    p_qc_status TEXT, p_qc_notes TEXT, p_currency TEXT, p_monthly_interest_rate NUMERIC DEFAULT 4.5,
    p_usd_rate NUMERIC DEFAULT 1, p_eur_rate NUMERIC DEFAULT 1
)
RETURNS JSON AS $$
DECLARE
    v_prod RECORD; v_recipe RECORD; v_product RECORD; v_packaging RECORD; v_ingredient RECORD;
    v_lot_number TEXT; v_raw_cost NUMERIC := 0; v_adj_cost NUMERIC := 0; v_pkg_cost NUMERIC := 0;
    v_pkg_qty NUMERIC; v_total_cost NUMERIC; v_unit_cost NUMERIC; v_sale_price NUMERIC;
    v_unit_sale_price NUMERIC; v_financing_cost NUMERIC; v_pay_term_sum NUMERIC := 0;
    v_cost_sum NUMERIC := 0; v_avg_term NUMERIC; v_fin_days NUMERIC;
    v_current_stock NUMERIC; v_item_name TEXT; v_target_rate NUMERIC; v_item_rate NUMERIC; v_lot_id BIGINT; v_lot_qty NUMERIC;
BEGIN
    v_target_rate := CASE WHEN p_currency = 'TRY' THEN 1.0 WHEN p_currency = 'USD' THEN p_usd_rate WHEN p_currency = 'EUR' THEN p_eur_rate ELSE p_usd_rate END;
    SELECT * INTO v_prod FROM productions WHERE id = p_production_id;
    IF v_prod.status = 'Completed' THEN RAISE EXCEPTION 'Bu üretim zaten tamamlanmış'; END IF;
    SELECT * INTO v_recipe FROM recipes WHERE id = v_prod.recipe_id;
    SELECT * INTO v_product FROM inventory WHERE id = v_recipe.product_id;
    SELECT * INTO v_packaging FROM inventory WHERE id = p_packaging_id;
    v_lot_number := COALESCE(NULLIF(v_prod.lot_number, ''), generate_lot_number(p_user_id, v_prod.production_date));

    FOR v_ingredient IN SELECT * FROM recipe_ingredients WHERE recipe_id = v_prod.recipe_id LOOP
        DECLARE v_i_cost NUMERIC; v_i_curr TEXT; v_i_term NUMERIC; BEGIN
            SELECT cost, currency, payment_term INTO v_i_cost, v_i_curr, v_i_term FROM inventory WHERE id = v_ingredient.item_id;
            v_item_rate := CASE WHEN v_i_curr = 'TRY' THEN 1.0 WHEN v_i_curr = 'USD' THEN p_usd_rate WHEN v_i_curr = 'EUR' THEN p_eur_rate ELSE p_usd_rate END;
            v_raw_cost := v_raw_cost + ((v_i_cost * v_item_rate / v_target_rate) * v_ingredient.percentage / 100 * v_prod.quantity);
            v_pay_term_sum := v_pay_term_sum + ((v_i_cost * v_item_rate / v_target_rate) * v_ingredient.percentage / 100 * v_prod.quantity * COALESCE(v_i_term, 0));
            v_cost_sum := v_cost_sum + ((v_i_cost * v_item_rate / v_target_rate) * v_ingredient.percentage / 100 * v_prod.quantity);
        END;
    END LOOP;

    v_pkg_qty := COALESCE(p_packaging_count, CEIL((v_prod.quantity / COALESCE(v_product.density, 1)) / COALESCE(v_packaging.capacity_value, 1000)));
    IF v_packaging.id IS NOT NULL AND v_packaging.track_stock THEN
        SELECT COALESCE(SUM(qty), 0) INTO v_current_stock FROM lots WHERE inventory_id = v_packaging.id;
        IF v_current_stock < v_pkg_qty THEN RAISE EXCEPTION 'Yetersiz ambalaj stoğu!'; END IF;
        INSERT INTO stock_movements (user_id, inventory_id, type, item_name, amount, current_stock, reason, related_id, lot_no, customer_id, price, currency, total_amount, notes)
        VALUES (p_user_id, v_packaging.id, 'Out', v_packaging.name, -v_pkg_qty, (v_current_stock - v_pkg_qty), 'Production_Usage', p_production_id, v_lot_number, v_prod.customer_id, v_packaging.cost, v_packaging.currency, (v_pkg_qty * v_packaging.cost), 'Ambalaj Kullanımı: ' || v_lot_number);
        DECLARE v_rem NUMERIC := v_pkg_qty; BEGIN
            FOR v_lot_qty, v_lot_id IN SELECT qty, id FROM lots WHERE inventory_id = v_packaging.id ORDER BY created_at ASC LOOP
                IF v_rem <= 0 THEN EXIT; END IF;
                IF v_lot_qty <= v_rem THEN DELETE FROM lots WHERE id = v_lot_id; v_rem := v_rem - v_lot_qty;
                ELSE UPDATE lots SET qty = qty - v_rem WHERE id = v_lot_id; v_rem := 0; END IF;
            END LOOP;
        END;
    END IF;

    v_item_rate := CASE WHEN v_packaging.currency = 'TRY' THEN 1.0 WHEN v_packaging.currency = 'USD' THEN p_usd_rate WHEN v_packaging.currency = 'EUR' THEN p_eur_rate ELSE p_usd_rate END;
    v_pkg_cost := v_pkg_qty * (v_packaging.cost * v_item_rate / v_target_rate);
    SELECT COALESCE(SUM(cost), 0) INTO v_adj_cost FROM production_adjustments WHERE production_id = p_production_id;
    v_avg_term := CASE WHEN v_cost_sum > 0 THEN v_pay_term_sum / v_cost_sum ELSE 0 END;
    v_fin_days := GREATEST(0, p_sale_term_days - v_avg_term);
    v_financing_cost := (v_raw_cost * (p_monthly_interest_rate / 100.0 / 30.0) * v_fin_days)
                      + ((v_adj_cost + v_pkg_cost + p_shipping_cost + (p_overhead_cost * v_prod.quantity)) 
                          * (p_monthly_interest_rate / 100.0 / 30.0) * p_sale_term_days);
    v_total_cost := v_raw_cost + v_adj_cost + v_pkg_cost + p_shipping_cost + (p_overhead_cost * v_prod.quantity) + v_financing_cost;
    v_unit_cost := v_total_cost / v_prod.quantity;
    v_sale_price := CASE WHEN p_profit_margin >= 100 THEN v_total_cost * 2 ELSE v_total_cost / (1 - p_profit_margin / 100.0) END;
    v_unit_sale_price := v_sale_price / v_prod.quantity;

    UPDATE productions SET
        lot_number = v_lot_number, status = 'Completed', packaging_id = p_packaging_id, packaging_quantity = v_pkg_qty,
        raw_material_cost = v_raw_cost + v_adj_cost, packaging_cost = v_pkg_cost, shipping_cost = p_shipping_cost,
        overhead_cost = (p_overhead_cost * v_prod.quantity), sale_term_days = p_sale_term_days, financing_cost = v_financing_cost,
        total_cost = v_total_cost, unit_cost = v_unit_cost, profit_margin_percent = p_profit_margin,
        profit_amount = (v_sale_price - v_total_cost), sale_price = v_sale_price, unit_sale_price = v_unit_sale_price,
        currency = p_currency, qc_status = 'Approved', qc_notes = p_qc_notes
    WHERE id = p_production_id;

    INSERT INTO lots (inventory_id, lot_no, qty) VALUES (v_product.id, v_lot_number, v_prod.quantity);
    SELECT COALESCE(SUM(qty), 0) INTO v_current_stock FROM lots WHERE inventory_id = v_product.id;
    INSERT INTO stock_movements (user_id, inventory_id, type, item_name, amount, current_stock, reason, related_id, lot_no, customer_id, price, currency, total_amount, notes)
    VALUES (p_user_id, v_product.id, 'In', v_product.name, v_prod.quantity, v_current_stock, 'Production_Output', p_production_id, v_lot_number, v_prod.customer_id, v_unit_cost, p_currency, v_total_cost, 'Üretim Çıktısı: ' || v_lot_number);
    RETURN json_build_object('success', true, 'lot_number', v_lot_number);
END;
$$ LANGUAGE plpgsql;

-- 10. process_sale
CREATE OR REPLACE FUNCTION process_sale(
    p_user_id UUID, p_customer_id BIGINT, p_production_id BIGINT, p_quantity NUMERIC,
    p_unit_price NUMERIC, p_currency TEXT, p_payment_term NUMERIC, p_sale_date DATE, p_notes TEXT,
    p_raw_material_cost NUMERIC DEFAULT 0, p_packaging_cost NUMERIC DEFAULT 0,
    p_shipping_cost NUMERIC DEFAULT 0, p_overhead_cost NUMERIC DEFAULT 0,
    p_financing_cost NUMERIC DEFAULT 0, p_total_production_cost NUMERIC DEFAULT 0
)
RETURNS BIGINT AS $$
DECLARE
    v_production RECORD; v_recipe RECORD; v_product_id BIGINT; v_avail_qty NUMERIC;
    v_remaining_qty NUMERIC; v_lot_id BIGINT; v_lot_qty NUMERIC; v_sale_id BIGINT;
    v_current_stock NUMERIC; v_product_name TEXT; v_customer_name TEXT;
BEGIN
    SELECT * INTO v_production FROM productions WHERE id = p_production_id;
    SELECT * INTO v_recipe FROM recipes WHERE id = v_production.recipe_id;
    v_product_id := v_recipe.product_id;
    SELECT name INTO v_product_name FROM inventory WHERE id = v_product_id;
    SELECT name INTO v_customer_name FROM accounts WHERE id = p_customer_id;
    SELECT COALESCE(SUM(qty), 0) INTO v_avail_qty FROM lots WHERE inventory_id = v_product_id;
    IF v_avail_qty < p_quantity THEN RAISE EXCEPTION 'Yetersiz stok!'; END IF;

    INSERT INTO sales (
        user_id, customer_id, customer_name, production_id, product_name, lot_no, quantity,
        unit_price, currency, total_amount, sale_date, payment_term, notes,
        raw_material_cost, packaging_cost, shipping_cost, overhead_cost, financing_cost, total_production_cost
    ) VALUES (
        p_user_id, p_customer_id, v_customer_name, p_production_id, v_product_name, v_production.lot_number, p_quantity,
        p_unit_price, p_currency, (p_quantity * p_unit_price), p_sale_date, p_payment_term, p_notes,
        p_raw_material_cost, p_packaging_cost, p_shipping_cost, p_overhead_cost, p_financing_cost, p_total_production_cost
    ) RETURNING id INTO v_sale_id;

    v_remaining_qty := p_quantity;
    FOR v_lot_qty, v_lot_id IN SELECT qty, id FROM lots WHERE inventory_id = v_product_id ORDER BY created_at ASC LOOP
        IF v_remaining_qty <= 0 THEN EXIT; END IF;
        IF v_lot_qty <= v_remaining_qty THEN DELETE FROM lots WHERE id = v_lot_id; v_remaining_qty := v_remaining_qty - v_lot_qty;
        ELSE UPDATE lots SET qty = qty - v_remaining_qty WHERE id = v_lot_id; v_remaining_qty := 0; END IF;
    END LOOP;

    SELECT COALESCE(SUM(qty), 0) INTO v_current_stock FROM lots WHERE inventory_id = v_product_id;
    INSERT INTO stock_movements (user_id, inventory_id, type, item_name, amount, current_stock, reason, related_id, lot_no, customer_id, price, currency, total_amount, notes)
    VALUES (p_user_id, v_product_id, 'Out', v_product_name, -p_quantity, v_current_stock, 'Sale', v_sale_id, v_production.lot_number, p_customer_id, p_unit_price, p_currency, (p_quantity * p_unit_price), 'Satış: ' || v_product_name || ' - ' || v_production.lot_number);
    RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;
