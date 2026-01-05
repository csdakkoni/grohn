-- REDEFINE COSTING LOGIC & PRODUCTION WORKFLOW (CONSOLIDATED V2)
-- Goal: Decouple industrial inventory value from sales financial costing.
-- Ensures stock integrity and robust deletion logic.

-- SCHEMA SYNC (Ensure all needed columns exist in sales)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS lot_number TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS raw_material_cost NUMERIC DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS packaging_cost NUMERIC DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS overhead_cost NUMERIC DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS financing_cost NUMERIC DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS total_production_cost NUMERIC DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS profit_amount NUMERIC DEFAULT 0;

-- 1. create_production_plan (MODIFIED: Remove deduction, only verify availability)
CREATE OR REPLACE FUNCTION create_production_plan(
    p_user_id UUID,
    p_recipe_id BIGINT,
    p_quantity NUMERIC,
    p_production_date DATE,
    p_notes TEXT,
    p_target_packaging_id BIGINT DEFAULT NULL,
    p_target_package_count NUMERIC DEFAULT NULL,
    p_customer_id BIGINT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_recipe RECORD;
    v_production_id BIGINT;
    v_lot_number TEXT;
    v_ingredient RECORD;
    v_item_name TEXT;
    v_track_stock BOOLEAN;
    v_req_qty NUMERIC;
    v_avail_qty NUMERIC;
BEGIN
    -- Get Recipe
    SELECT * INTO v_recipe FROM recipes WHERE id = p_recipe_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Reçete bulunamadı'; END IF;

    -- Generate LOT
    v_lot_number := generate_lot_number(p_user_id, p_production_date);

    -- Insert Production Record (Status: Planned)
    INSERT INTO productions (
        user_id, recipe_id, lot_number, quantity, production_date,
        status, qc_status, notes,
        target_packaging_id, target_package_count, customer_id
    ) VALUES (
        p_user_id, p_recipe_id, v_lot_number, p_quantity, p_production_date,
        'Planned', NULL, p_notes,
        p_target_packaging_id, p_target_package_count, p_customer_id
    ) RETURNING id INTO v_production_id;

    -- ONLY CHECK Availability (DO NOT Deduct)
    -- Deduction will happen in complete_production
    FOR v_ingredient IN SELECT * FROM recipe_ingredients WHERE recipe_id = p_recipe_id LOOP
        v_req_qty := (p_quantity * v_ingredient.percentage / 100);
        SELECT name, track_stock INTO v_item_name, v_track_stock FROM inventory WHERE id = v_ingredient.item_id;

        IF v_track_stock THEN
            SELECT COALESCE(SUM(qty), 0) INTO v_avail_qty FROM lots WHERE inventory_id = v_ingredient.item_id;
            IF v_avail_qty < v_req_qty THEN
                RAISE WARNING 'Stok yetersiz olabilir: % (Mevcut: %, Gerekli: %)', v_item_name, v_avail_qty, v_req_qty;
            END IF;
        END IF;
    END LOOP;

    RETURN json_build_object('success', true, 'lot_number', v_lot_number, 'id', v_production_id);
END;
$$ LANGUAGE plpgsql;

-- 2. complete_production (Industrial Costing + FIFO Deduction)
CREATE OR REPLACE FUNCTION complete_production(
    p_production_id BIGINT,
    p_user_id UUID,
    p_packaging_id BIGINT,
    p_packaging_count NUMERIC,
    p_qc_status TEXT,
    p_qc_notes TEXT,
    p_currency TEXT,
    p_usd_rate NUMERIC DEFAULT 34.5,
    p_eur_rate NUMERIC DEFAULT 37.5
)
RETURNS JSON AS $$
DECLARE
    v_prod RECORD;
    v_recipe RECORD;
    v_product RECORD;
    v_packaging RECORD;
    v_ingredient RECORD;
    v_lot_number TEXT;
    v_raw_cost NUMERIC := 0;
    v_pkg_cost NUMERIC := 0;
    v_pkg_qty NUMERIC;
    v_total_inventory_cost NUMERIC;
    v_unit_inventory_cost NUMERIC;
    v_remaining_qty NUMERIC;
    v_lot_id BIGINT;
    v_lot_qty NUMERIC;
    v_current_stock NUMERIC;
    v_item_name TEXT;
    v_track_stock BOOLEAN;
BEGIN
    SELECT * INTO v_prod FROM productions WHERE id = p_production_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Üretim kaydı bulunamadı'; END IF;
    IF v_prod.status = 'Completed' THEN RAISE EXCEPTION 'Bu üretim zaten tamamlanmış'; END IF;

    SELECT * INTO v_recipe FROM recipes WHERE id = v_prod.recipe_id;
    SELECT * INTO v_product FROM inventory WHERE id = v_recipe.product_id;
    SELECT * INTO v_packaging FROM inventory WHERE id = p_packaging_id;

    v_lot_number := COALESCE(NULLIF(v_prod.lot_number, ''), generate_lot_number(p_user_id, v_prod.production_date));

    -- CALCULATE Raw Material Costs & Deduct Stock
    FOR v_ingredient IN SELECT * FROM recipe_ingredients WHERE recipe_id = v_prod.recipe_id LOOP
        DECLARE
            v_item_cost NUMERIC;
            v_req_qty NUMERIC;
            v_item_currency TEXT;
            v_converted_cost NUMERIC;
            v_rate_from NUMERIC;
            v_rate_to NUMERIC;
        BEGIN
            SELECT cost, track_stock, currency, name INTO v_item_cost, v_track_stock, v_item_currency, v_item_name
            FROM inventory WHERE id = v_ingredient.item_id;
            
            v_rate_from := CASE WHEN v_item_currency = 'USD' THEN p_usd_rate WHEN v_item_currency = 'EUR' THEN p_eur_rate ELSE 1 END;
            v_rate_to := CASE WHEN p_currency = 'USD' THEN p_usd_rate WHEN p_currency = 'EUR' THEN p_eur_rate ELSE 1 END;
            v_converted_cost := (v_item_cost * COALESCE(v_rate_from, 1)) / COALESCE(v_rate_to, 1);

            v_req_qty := (v_prod.quantity * v_ingredient.percentage / 100);
            
            IF v_track_stock THEN
                v_remaining_qty := v_req_qty;
                FOR v_lot_id, v_lot_qty IN SELECT id, qty FROM lots WHERE inventory_id = v_ingredient.item_id ORDER BY created_at ASC LOOP
                    IF v_remaining_qty <= 0 THEN EXIT; END IF;
                    IF v_lot_qty <= v_remaining_qty THEN
                        DELETE FROM lots WHERE id = v_lot_id;
                        v_remaining_qty := v_remaining_qty - v_lot_qty;
                    ELSE
                        UPDATE lots SET qty = qty - v_remaining_qty WHERE id = v_lot_id;
                        v_remaining_qty := 0;
                    END IF;
                END LOOP;

                SELECT COALESCE(SUM(qty), 0) INTO v_current_stock FROM lots WHERE inventory_id = v_ingredient.item_id;
                INSERT INTO stock_movements (
                    user_id, inventory_id, type, item_name, amount, current_stock, reason, related_id, notes, price, currency, total_amount
                ) VALUES (
                    p_user_id, v_ingredient.item_id, 'Out', v_item_name, -v_req_qty, v_current_stock, 'Production_Usage', p_production_id, 
                    'Üretim: ' || v_lot_number, v_converted_cost, p_currency, (v_req_qty * v_converted_cost)
                );
            END IF;

            v_raw_cost := v_raw_cost + (v_converted_cost * v_ingredient.percentage / 100 * v_prod.quantity);
        END;
    END LOOP;

    -- Packaging Cost
    IF p_packaging_count IS NOT NULL AND p_packaging_count > 0 THEN
        v_pkg_qty := p_packaging_count;
    ELSE
        v_pkg_qty := CEIL((v_prod.quantity / COALESCE(v_product.density, 1)) / COALESCE(v_packaging.capacity_value, 1000));
    END IF;
    
    DECLARE
        v_pkg_base_cost NUMERIC;
        v_pkg_currency TEXT;
        v_pkg_rate_from NUMERIC;
        v_pkg_rate_to NUMERIC;
    BEGIN
        SELECT cost, currency INTO v_pkg_base_cost, v_pkg_currency FROM inventory WHERE id = p_packaging_id;
        v_pkg_rate_from := CASE WHEN v_pkg_currency = 'USD' THEN p_usd_rate WHEN v_pkg_currency = 'EUR' THEN p_eur_rate ELSE 1 END;
        v_pkg_rate_to := CASE WHEN p_currency = 'USD' THEN p_usd_rate WHEN p_currency = 'EUR' THEN p_eur_rate ELSE 1 END;
        v_pkg_cost := v_pkg_qty * (v_pkg_base_cost * COALESCE(v_pkg_rate_from, 1)) / COALESCE(v_pkg_rate_to, 1);

        -- Deduct Packaging Stock
        IF p_packaging_id IS NOT NULL AND v_pkg_qty > 0 THEN
            v_remaining_qty := v_pkg_qty;
            FOR v_lot_id, v_lot_qty IN SELECT id, qty FROM lots WHERE inventory_id = p_packaging_id ORDER BY created_at ASC LOOP
                IF v_remaining_qty <= 0 THEN EXIT; END IF;
                IF v_lot_qty <= v_remaining_qty THEN
                    DELETE FROM lots WHERE id = v_lot_id;
                    v_remaining_qty := v_remaining_qty - v_lot_qty;
                ELSE
                    UPDATE lots SET qty = qty - v_remaining_qty WHERE id = v_lot_id;
                    v_remaining_qty := 0;
                END IF;
            END LOOP;
            
            SELECT COALESCE(SUM(qty), 0) INTO v_current_stock FROM lots WHERE inventory_id = p_packaging_id;
            INSERT INTO stock_movements (user_id, inventory_id, type, item_name, amount, current_stock, reason, related_id, notes, price, currency, total_amount)
            VALUES (p_user_id, p_packaging_id, 'Out', (SELECT name FROM inventory WHERE id = p_packaging_id), -v_pkg_qty, v_current_stock, 'Production_Usage', p_production_id, 'Ambalaj: ' || v_lot_number, (v_pkg_base_cost * v_pkg_rate_from / v_pkg_rate_to), p_currency, v_pkg_cost);
        END IF;
    END;

    -- Industrial Totals
    v_total_inventory_cost := v_raw_cost + v_pkg_cost;
    v_unit_inventory_cost := v_total_inventory_cost / NULLIF(v_prod.quantity, 0);

    UPDATE productions SET
        lot_number = v_lot_number, status = 'Completed',
        packaging_id = p_packaging_id, packaging_quantity = v_pkg_qty,
        raw_material_cost = v_raw_cost, packaging_cost = v_pkg_cost,
        total_cost = v_total_inventory_cost, unit_cost = v_unit_inventory_cost,
        currency = p_currency, qc_status = p_qc_status, qc_notes = p_qc_notes
    WHERE id = p_production_id;

    -- Add Finished Product to Stock
    INSERT INTO lots (inventory_id, lot_no, qty) VALUES (v_product.id, v_lot_number, v_prod.quantity);

    SELECT COALESCE(SUM(qty), 0) INTO v_current_stock FROM lots WHERE inventory_id = v_product.id;
    INSERT INTO stock_movements (user_id, inventory_id, type, item_name, amount, current_stock, reason, related_id, notes, price, currency, total_amount)
    VALUES (p_user_id, v_product.id, 'In', v_product.name, v_prod.quantity, v_current_stock, 'Production_Output', p_production_id, 'Üretim Çıktısı: ' || v_lot_number, v_unit_inventory_cost, p_currency, v_total_inventory_cost);

    RETURN json_build_object('success', true, 'lot_number', v_lot_number, 'unit_cost', v_unit_inventory_cost);
END;
$$ LANGUAGE plpgsql;

-- 3. delete_production (ROBUST RESTORATION)
CREATE OR REPLACE FUNCTION delete_production(p_production_id BIGINT)
RETURNS JSON AS $$
DECLARE
    v_prod RECORD;
    v_item_id BIGINT;
    v_move RECORD;
BEGIN
    SELECT * INTO v_prod FROM productions WHERE id = p_production_id;
    IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'Üretim kaydı bulunamadı.'); END IF;

    IF EXISTS (SELECT 1 FROM sales WHERE production_id = p_production_id) THEN
        RETURN json_build_object('success', false, 'error', 'Bu üretimden satış yapılmış! Önce satışı silmelisiniz.');
    END IF;

    -- RESTORE Stock for ANY deduction reason
    FOR v_move IN 
        SELECT inventory_id, amount 
        FROM stock_movements 
        WHERE related_id = p_production_id 
        AND type = 'Out' 
        AND reason IN ('Production_Usage', 'Production_Plan', 'Adjustment_Usage')
    LOOP
        INSERT INTO lots (inventory_id, lot_no, qty)
        VALUES (v_move.inventory_id, 'RE-' || COALESCE(v_prod.lot_number, p_production_id::text), ABS(v_move.amount));
    END LOOP;

    -- REMOVE Finished Goods Stock
    SELECT product_id INTO v_item_id FROM recipes WHERE id = v_prod.recipe_id;
    IF v_item_id IS NOT NULL THEN
        DELETE FROM lots WHERE lot_no = v_prod.lot_number AND inventory_id = v_item_id;
    END IF;

    -- CLEANUP
    DELETE FROM stock_movements WHERE related_id = p_production_id;
    DELETE FROM quality_batches WHERE production_id = p_production_id;
    DELETE FROM production_adjustments WHERE production_id = p_production_id;
    DELETE FROM productions WHERE id = p_production_id;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- 4. process_sale (Financial Costing)
CREATE OR REPLACE FUNCTION process_sale(
    p_user_id UUID,
    p_customer_id BIGINT,
    p_production_id BIGINT,
    p_quantity NUMERIC,
    p_unit_price NUMERIC,
    p_currency TEXT,
    p_payment_term NUMERIC,
    p_sale_date DATE,
    p_notes TEXT,
    p_shipping_cost NUMERIC DEFAULT 0,
    p_overhead_cost NUMERIC DEFAULT 0,
    p_monthly_interest_rate NUMERIC DEFAULT 4.5,
    p_usd_rate NUMERIC DEFAULT 34.5,
    p_eur_rate NUMERIC DEFAULT 37.5
)
RETURNS BIGINT AS $$
DECLARE
    v_prod RECORD; v_product_id BIGINT; v_product_name TEXT; v_remaining_qty NUMERIC;
    v_lot_id BIGINT; v_lot_qty NUMERIC; v_current_stock NUMERIC; v_sale_id BIGINT;
    v_raw_cost_at_sale NUMERIC; v_pkg_cost_at_sale NUMERIC; v_avg_raw_term NUMERIC;
    v_fin_days NUMERIC; v_financing_cost NUMERIC; v_total_sale_cost NUMERIC; v_profit NUMERIC;
BEGIN
    SELECT * INTO v_prod FROM productions WHERE id = p_production_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Üretim bulunamadı'; END IF;

    v_product_id := (SELECT product_id FROM recipes WHERE id = v_prod.recipe_id);
    SELECT name INTO v_product_name FROM inventory WHERE id = v_product_id;

    -- Financing Formula
    SELECT COALESCE(SUM( (inv.cost * (CASE WHEN inv.currency = 'USD' THEN p_usd_rate WHEN inv.currency = 'EUR' THEN p_eur_rate ELSE 1 END)) * (ri.percentage / 100.0) * inv.payment_term ), 0) /
           NULLIF(SUM( (inv.cost * (CASE WHEN inv.currency = 'USD' THEN p_usd_rate WHEN inv.currency = 'EUR' THEN p_eur_rate ELSE 1 END)) * (ri.percentage / 100.0) ), 0)
    INTO v_avg_raw_term FROM recipe_ingredients ri JOIN inventory inv ON ri.item_id = inv.id WHERE ri.recipe_id = v_prod.recipe_id;

    v_fin_days := GREATEST(0, p_payment_term - COALESCE(v_avg_raw_term, 0));
    v_raw_cost_at_sale := (v_prod.raw_material_cost / v_prod.quantity) * p_quantity;
    v_pkg_cost_at_sale := (v_prod.packaging_cost / v_prod.quantity) * p_quantity;
    
    v_financing_cost := (v_raw_cost_at_sale * (p_monthly_interest_rate / 100.0 / 30.0) * v_fin_days) +
                        ((v_pkg_cost_at_sale + p_shipping_cost + p_overhead_cost) * (p_monthly_interest_rate / 100.0 / 30.0) * p_payment_term);

    v_total_sale_cost := v_raw_cost_at_sale + v_pkg_cost_at_sale + p_shipping_cost + p_overhead_cost + v_financing_cost;
    v_profit := (p_unit_price * p_quantity) - v_total_sale_cost;

    INSERT INTO sales (
        user_id, customer_id, production_id, product_name, lot_number, quantity,
        unit_price, currency, total_amount, sale_date, payment_term, notes,
        raw_material_cost, packaging_cost, shipping_cost, overhead_cost, financing_cost,
        total_production_cost, profit_amount
    ) VALUES (
        p_user_id, p_customer_id, p_production_id, v_product_name, v_prod.lot_number, p_quantity,
        p_unit_price, p_currency, (p_quantity * p_unit_price), p_sale_date, p_payment_term, p_notes,
        v_raw_cost_at_sale, v_pkg_cost_at_sale, p_shipping_cost, p_overhead_cost, v_financing_cost,
        v_total_sale_cost, v_profit
    ) RETURNING id INTO v_sale_id;

    -- FIFO Deduction for Finished Goods
    v_remaining_qty := p_quantity;
    FOR v_lot_id, v_lot_qty IN SELECT id, qty FROM lots WHERE inventory_id = v_product_id ORDER BY created_at ASC LOOP
        IF v_remaining_qty <= 0 THEN EXIT; END IF;
        IF v_lot_qty <= v_remaining_qty THEN DELETE FROM lots WHERE id = v_lot_id; v_remaining_qty := v_remaining_qty - v_lot_qty;
        ELSE UPDATE lots SET qty = qty - v_remaining_qty WHERE id = v_lot_id; v_remaining_qty := 0; END IF;
    END LOOP;

    SELECT COALESCE(SUM(qty), 0) INTO v_current_stock FROM lots WHERE inventory_id = v_product_id;
    INSERT INTO stock_movements (user_id, inventory_id, type, item_name, amount, current_stock, reason, related_id, notes, customer_id, price, currency, total_amount, lot_no)
    VALUES (p_user_id, v_product_id, 'Out', v_product_name, -p_quantity, v_current_stock, 'Sale', v_sale_id, 'Satış: ' || v_prod.lot_number, p_customer_id, p_unit_price, p_currency, (p_quantity * p_unit_price), v_prod.lot_number);

    RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;
