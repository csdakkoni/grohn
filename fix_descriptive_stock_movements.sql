-- ENHANCED DESCRIPTIVE STOCK MOVEMENTS
-- Adds Product Names to movement notes for better traceability

-- 1. Update complete_production (In simplify_production_and_lot_fix.sql)
CREATE OR REPLACE FUNCTION complete_production(
    p_production_id BIGINT,
    p_user_id UUID,
    p_packaging_id BIGINT DEFAULT NULL,
    p_shipping_cost NUMERIC DEFAULT 0,
    p_overhead_cost NUMERIC DEFAULT 0,
    p_sale_term_days NUMERIC DEFAULT 30,
    p_profit_margin NUMERIC DEFAULT 20,
    p_qc_status TEXT DEFAULT 'Pass',
    p_qc_notes TEXT DEFAULT '',
    p_currency TEXT DEFAULT 'USD',
    p_monthly_interest_rate NUMERIC DEFAULT 4,
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
    v_pkg_qty NUMERIC := 0;
    v_total_cost NUMERIC;
    v_unit_cost NUMERIC;
    v_sale_price NUMERIC;
    v_unit_sale_price NUMERIC;
    v_financing_cost NUMERIC;
    v_pay_term_sum NUMERIC := 0;
    v_cost_sum NUMERIC := 0;
    v_avg_term NUMERIC;
    v_fin_days NUMERIC;
    v_remaining_qty NUMERIC;
    v_lot_id BIGINT;
    v_lot_qty NUMERIC;
    v_current_stock NUMERIC;
    v_item_name TEXT;
    v_ingredient_track_stock BOOLEAN;
BEGIN
    -- 1. Get Production Record
    SELECT * INTO v_prod FROM productions WHERE id = p_production_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Üretim kaydı bulunamadı'; END IF;
    IF v_prod.status = 'Completed' THEN RAISE EXCEPTION 'Bu üretim zaten tamamlanmış'; END IF;

    -- 2. Get Recipe & Product
    SELECT * INTO v_recipe FROM recipes WHERE id = v_prod.recipe_id;
    SELECT * INTO v_product FROM inventory WHERE id = v_recipe.product_id;
    
    -- 3. REUSE existing LOT if it exists
    IF v_prod.lot_number IS NOT NULL AND v_prod.lot_number != '' THEN
        v_lot_number := v_prod.lot_number;
    ELSE
        v_lot_number := generate_lot_number(p_user_id, v_prod.production_date);
    END IF;

    -- 4. Calculate Raw Material Costs & Deduct Stock
    FOR v_ingredient IN SELECT * FROM recipe_ingredients WHERE recipe_id = v_prod.recipe_id LOOP
        DECLARE
            v_item_cost NUMERIC;
            v_item_term NUMERIC;
            v_req_qty NUMERIC;
            v_avail_qty NUMERIC;
            v_track_stock BOOLEAN;
            v_item_currency TEXT;
            v_rate_from NUMERIC;
            v_rate_to NUMERIC;
            v_converted_cost NUMERIC;
        BEGIN
            SELECT cost, payment_term, track_stock, currency INTO v_item_cost, v_item_term, v_track_stock, v_item_currency
            FROM inventory WHERE id = v_ingredient.item_id;
            
            v_rate_from := CASE WHEN v_item_currency = 'USD' THEN p_usd_rate WHEN v_item_currency = 'EUR' THEN p_eur_rate ELSE 1 END;
            v_rate_to := CASE WHEN p_currency = 'USD' THEN p_usd_rate WHEN p_currency = 'EUR' THEN p_eur_rate ELSE 1 END;
            v_converted_cost := (v_item_cost * v_rate_from) / v_rate_to;

            v_req_qty := (v_prod.quantity * v_ingredient.percentage / 100);
            
            IF v_track_stock THEN
                SELECT COALESCE(SUM(qty), 0) INTO v_avail_qty FROM lots WHERE inventory_id = v_ingredient.item_id;
                IF v_avail_qty < v_req_qty THEN
                    RAISE EXCEPTION 'Yetersiz stok: Item ID %', v_ingredient.item_id;
                END IF;
            END IF;

            v_raw_cost := v_raw_cost + (v_converted_cost * v_ingredient.percentage / 100 * v_prod.quantity);
            v_pay_term_sum := v_pay_term_sum + (v_converted_cost * v_ingredient.percentage / 100 * v_prod.quantity * COALESCE(v_item_term, 0));
            v_cost_sum := v_cost_sum + (v_converted_cost * v_ingredient.percentage / 100 * v_prod.quantity);

            -- Deduct Stock (FIFO)
            v_remaining_qty := v_req_qty;
            SELECT name, track_stock INTO v_item_name, v_ingredient_track_stock FROM inventory WHERE id = v_ingredient.item_id;

            IF v_ingredient_track_stock THEN
                -- Log Usage with Product Name
                SELECT COALESCE(SUM(qty), 0) - v_remaining_qty INTO v_current_stock FROM lots WHERE inventory_id = v_ingredient.item_id;
                INSERT INTO stock_movements (
                    user_id, inventory_id, type, item_name, amount, current_stock, reason, related_id, notes
                ) VALUES (
                    p_user_id, v_ingredient.item_id, 'Out', v_item_name, -v_remaining_qty, v_current_stock, 'Production_Usage', p_production_id, 
                    'Üretim Kullanımı (' || v_product.name || '): ' || v_lot_number
                );

                FOR v_lot_id, v_lot_qty IN 
                    SELECT id, qty FROM lots 
                    WHERE inventory_id = v_ingredient.item_id 
                    ORDER BY created_at ASC 
                LOOP
                    IF v_remaining_qty <= 0 THEN EXIT; END IF;

                    IF v_lot_qty <= v_remaining_qty THEN
                        DELETE FROM lots WHERE id = v_lot_id;
                        v_remaining_qty := v_remaining_qty - v_lot_qty;
                    ELSE
                        UPDATE lots SET qty = qty - v_remaining_qty WHERE id = v_lot_id;
                        v_remaining_qty := 0;
                    END IF;
                END LOOP;
            END IF;
        END;
    END LOOP;

    -- 5. Handle Optional Packaging
    IF p_packaging_id IS NOT NULL AND p_packaging_id > 0 THEN
        SELECT * INTO v_packaging FROM inventory WHERE id = p_packaging_id;
        v_pkg_qty := CEIL((v_prod.quantity / COALESCE(v_product.density, 1)) / COALESCE(v_packaging.capacity_value, 1000));
        v_pkg_cost := v_pkg_qty * v_packaging.cost;
    END IF;

    -- 6. Financing Cost
    v_avg_term := CASE WHEN v_cost_sum > 0 THEN v_pay_term_sum / v_cost_sum ELSE 0 END;
    v_fin_days := GREATEST(0, p_sale_term_days - v_avg_term);
    v_financing_cost := (
        (v_raw_cost * (p_monthly_interest_rate / 100.0 / 30.0) * v_fin_days) +
        ((v_pkg_cost + (COALESCE(p_shipping_cost, 0) * v_prod.quantity) + (COALESCE(p_overhead_cost, 0) * v_prod.quantity)) * (p_monthly_interest_rate / 100.0 / 30.0) * p_sale_term_days)
    );

    -- 7. Final Totals
    v_total_cost := v_raw_cost + v_pkg_cost + (COALESCE(p_shipping_cost, 0) * v_prod.quantity) + (COALESCE(p_overhead_cost, 0) * v_prod.quantity) + v_financing_cost;
    v_unit_cost := v_total_cost / v_prod.quantity;
    v_sale_price := v_total_cost * (1 + COALESCE(p_profit_margin, 0) / 100);
    v_unit_sale_price := v_sale_price / v_prod.quantity;

    -- 8. Update Production Record
    UPDATE productions SET
        lot_number = v_lot_number,
        status = 'Completed',
        packaging_id = p_packaging_id,
        packaging_quantity = v_pkg_qty,
        raw_material_cost = v_raw_cost,
        packaging_cost = v_pkg_cost,
        shipping_cost = (COALESCE(p_shipping_cost, 0) * v_prod.quantity),
        overhead_cost = (COALESCE(p_overhead_cost, 0) * v_prod.quantity),
        sale_term_days = p_sale_term_days,
        financing_cost = v_financing_cost,
        total_cost = v_total_cost,
        unit_cost = v_unit_cost,
        profit_margin_percent = COALESCE(p_profit_margin, 0),
        profit_amount = (v_sale_price - v_total_cost),
        sale_price = v_sale_price,
        unit_sale_price = v_unit_sale_price,
        currency = p_currency,
        qc_status = p_qc_status,
        qc_notes = p_qc_notes
    WHERE id = p_production_id;

    -- 9. Add Finished Product to Stock
    INSERT INTO lots (inventory_id, lot_no, qty)
    VALUES (v_product.id, v_lot_number, v_prod.quantity);

    -- 10. Update QC Status
    IF EXISTS (SELECT 1 FROM quality_batches WHERE production_id = p_production_id AND lot_no = v_lot_number) THEN
        UPDATE quality_batches 
        SET notes = notes || ' (Sistem üzerinden tamamlandı)'
        WHERE production_id = p_production_id AND lot_no = v_lot_number;
    END IF;

    -- 11. Log Output Movement with Product Name
    SELECT COALESCE(SUM(qty), 0) INTO v_current_stock FROM lots WHERE inventory_id = v_product.id;
    INSERT INTO stock_movements (
        user_id, inventory_id, type, item_name, amount, current_stock, reason, related_id, notes
    ) VALUES (
        p_user_id, v_product.id, 'In', v_product.name, v_prod.quantity, v_current_stock, 'Production_Output', p_production_id, 
        'Üretim Çıktısı: ' || v_product.name || ' - ' || v_lot_number
    );

    RETURN json_build_object('success', true, 'lot_number', v_lot_number);
END;
$$ LANGUAGE plpgsql;

-- 2. Update process_sale (In supabase_fix_rpc_final.sql)
CREATE OR REPLACE FUNCTION process_sale(
    p_user_id UUID,
    p_customer_id BIGINT,
    p_production_id BIGINT,
    p_quantity NUMERIC,
    p_unit_price NUMERIC,
    p_currency TEXT,
    p_payment_term NUMERIC,
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
    SELECT * INTO v_production FROM productions WHERE id = p_production_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Üretim kaydı bulunamadı'; END IF;

    SELECT * INTO v_recipe FROM recipes WHERE id = v_production.recipe_id;
    v_product_id := v_recipe.product_id;
    SELECT name INTO v_product_name FROM inventory WHERE id = v_product_id;

    SELECT COALESCE(SUM(qty), 0) INTO v_avail_qty FROM lots WHERE inventory_id = v_product_id;
    IF v_avail_qty < p_quantity THEN
        RAISE EXCEPTION 'Yetersiz stok! Mevcut: %, İstenen: %', v_avail_qty, p_quantity;
    END IF;

    INSERT INTO sales (
        user_id, customer_id, production_id, product_name, lot_number, quantity,
        unit_price, currency, total_amount, sale_date, payment_term, notes
    ) VALUES (
        p_user_id, p_customer_id, p_production_id, v_product_name,
        v_production.lot_number, p_quantity, p_unit_price, p_currency,
        (p_quantity * p_unit_price), p_sale_date, p_payment_term, p_notes
    ) RETURNING id INTO v_sale_id;

    v_remaining_qty := p_quantity;
    FOR v_lot_id, v_lot_qty IN 
        SELECT id, qty FROM lots 
        WHERE inventory_id = v_product_id 
        ORDER BY created_at ASC 
    LOOP
        IF v_remaining_qty <= 0 THEN EXIT; END IF;

        IF v_lot_qty <= v_remaining_qty THEN
            DELETE FROM lots WHERE id = v_lot_id;
            v_remaining_qty := v_remaining_qty - v_lot_qty;
        ELSE
            UPDATE lots SET qty = qty - v_remaining_qty WHERE id = v_lot_id;
            v_remaining_qty := 0;
        END IF;
    END LOOP;

    SELECT COALESCE(SUM(qty), 0) INTO v_current_stock FROM lots WHERE inventory_id = v_product_id;
    INSERT INTO stock_movements (
        user_id, inventory_id, type, item_name, amount, current_stock, reason, related_id, notes
    ) VALUES (
        p_user_id, v_product_id, 'Out', v_product_name, -p_quantity, v_current_stock, 'Sale', v_sale_id, 
        'Satış: ' || v_product_name || ' - ' || v_production.lot_number
    );

    RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;

-- 3. Update process_purchase (In supabase_fix_rpc_final.sql)
CREATE OR REPLACE FUNCTION process_purchase(
    p_user_id UUID,
    p_supplier_id BIGINT,
    p_item_name TEXT,
    p_item_type TEXT,
    p_unit TEXT,
    p_qty NUMERIC,
    p_price NUMERIC,
    p_currency TEXT,
    p_term_days NUMERIC,
    p_lot_no TEXT,
    p_is_new_item BOOLEAN,
    p_item_id BIGINT DEFAULT NULL,
    p_capacity_value NUMERIC DEFAULT NULL,
    p_capacity_unit TEXT DEFAULT NULL,
    p_tare_weight NUMERIC DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_inventory_id BIGINT;
    v_purchase_id BIGINT;
    v_total_amount NUMERIC;
    v_current_stock NUMERIC;
BEGIN
    v_total_amount := p_qty * p_price;

    IF p_is_new_item THEN
        INSERT INTO inventory (
            user_id, name, type, unit, cost, currency, payment_term, track_stock,
            capacity_value, capacity_unit, tare_weight
        ) VALUES (
            p_user_id, p_item_name, p_item_type, p_unit, p_price, p_currency, p_term_days, TRUE,
            p_capacity_value, p_capacity_unit, p_tare_weight
        ) RETURNING id INTO v_inventory_id;
        
        UPDATE inventory SET
             product_code = CASE 
                WHEN p_item_type = 'Hammadde' THEN 'HM-' || LPAD(v_inventory_id::text, 3, '0')
                WHEN p_item_type = 'Ambalaj' THEN 'AMB-' || LPAD(v_inventory_id::text, 3, '0')
                ELSE 'ITEM-' || LPAD(v_inventory_id::text, 3, '0')
             END
        WHERE id = v_inventory_id;
    ELSE
        v_inventory_id := p_item_id;
        UPDATE inventory SET 
            cost = p_price, 
            currency = p_currency, 
            payment_term = p_term_days 
        WHERE id = v_inventory_id;
    END IF;

    INSERT INTO lots (inventory_id, lot_no, qty)
    VALUES (v_inventory_id, p_lot_no, p_qty);

    INSERT INTO purchases (
        user_id, supplier_id, item_name, qty, price, currency, total, payment_term, lot_no
    ) VALUES (
        p_user_id, p_supplier_id, p_item_name, p_qty, p_price, p_currency, v_total_amount, p_term_days, p_lot_no
    ) RETURNING id INTO v_purchase_id;

    SELECT COALESCE(SUM(qty), 0) INTO v_current_stock FROM lots WHERE inventory_id = v_inventory_id;

    INSERT INTO stock_movements (
        user_id, inventory_id, type, item_name, amount, current_stock, reason, related_id, notes
    ) VALUES (
        p_user_id, v_inventory_id, 'In', p_item_name, p_qty, v_current_stock, 'Purchase', v_purchase_id, 
        'Satınalma: ' || p_item_name || ' - ' || p_lot_no
    );

    RETURN json_build_object('success', true, 'purchase_id', v_purchase_id);
END;
$$ LANGUAGE plpgsql;
