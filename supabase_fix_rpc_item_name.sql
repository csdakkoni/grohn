-- Fix 'item_name' column in stock_movements for all RPC functions

-- 1. process_purchase
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

    -- Handle Inventory Item (Create or Update)
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
        UPDATE inventory SET 
            cost = p_price, 
            currency = p_currency, 
            payment_term = p_term_days 
        WHERE id = v_inventory_id;
    END IF;

    -- Insert Lot
    INSERT INTO lots (inventory_id, lot_no, qty)
    VALUES (v_inventory_id, p_lot_no, p_qty);

    -- Record Purchase
    INSERT INTO purchases (
        user_id, supplier_id, item_name, qty, price, currency, total, payment_term, lot_no
    ) VALUES (
        p_user_id, p_supplier_id, p_item_name, p_qty, p_price, p_currency, v_total_amount, p_term_days, p_lot_no
    ) RETURNING id INTO v_purchase_id;

    -- Calculate Current Stock
    SELECT COALESCE(SUM(qty), 0) INTO v_current_stock FROM lots WHERE inventory_id = v_inventory_id;

    -- Log Movement (Added item_name)
    INSERT INTO stock_movements (
        user_id, inventory_id, type, item_name, change_amount, current_stock, reason, related_id, notes
    ) VALUES (
        p_user_id, v_inventory_id, 'In', p_item_name, p_qty, v_current_stock, 'Purchase', v_purchase_id, 'Satınalma: ' || p_lot_no
    );

    RETURN json_build_object('success', true, 'purchase_id', v_purchase_id);
END;
$$ LANGUAGE plpgsql;


-- 2. process_production
CREATE OR REPLACE FUNCTION process_production(
    p_user_id UUID,
    p_recipe_id BIGINT,
    p_quantity NUMERIC,
    p_production_date DATE,
    p_packaging_id BIGINT,
    p_shipping_cost NUMERIC,
    p_overhead_cost NUMERIC,
    p_sale_term_days NUMERIC,
    p_profit_margin NUMERIC,
    p_notes TEXT,
    p_currency TEXT
)
RETURNS JSON AS $$
DECLARE
    v_recipe RECORD;
    v_product RECORD;
    v_packaging RECORD;
    v_ingredient RECORD;
    v_lot_number TEXT;
    v_raw_cost NUMERIC := 0;
    v_pkg_cost NUMERIC := 0;
    v_pkg_qty NUMERIC;
    v_total_cost NUMERIC;
    v_unit_cost NUMERIC;
    v_sale_price NUMERIC;
    v_unit_sale_price NUMERIC;
    v_financing_cost NUMERIC;
    v_pay_term_sum NUMERIC := 0;
    v_cost_sum NUMERIC := 0;
    v_avg_term NUMERIC;
    v_fin_days NUMERIC;
    v_production_id BIGINT;
    v_remaining_qty NUMERIC;
    v_lot_qty NUMERIC;
    v_lot_id BIGINT;
    v_current_stock NUMERIC;
    v_item_name TEXT;
BEGIN
    -- Get Recipe
    SELECT * INTO v_recipe FROM recipes WHERE id = p_recipe_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Reçete bulunamadı'; END IF;

    -- Get Product
    SELECT * INTO v_product FROM inventory WHERE id = v_recipe.product_id;
    
    -- Get Packaging
    SELECT * INTO v_packaging FROM inventory WHERE id = p_packaging_id;

    -- Calculate Costs & Check Stock
    FOR v_ingredient IN SELECT * FROM recipe_ingredients WHERE recipe_id = p_recipe_id LOOP
        DECLARE
            v_item_cost NUMERIC;
            v_req_qty NUMERIC;
            v_avail_qty NUMERIC;
            v_item_term NUMERIC;
        BEGIN
            SELECT cost, payment_term INTO v_item_cost, v_item_term 
            FROM inventory WHERE id = v_ingredient.item_id;
            
            v_raw_cost := v_raw_cost + (v_item_cost * v_ingredient.percentage / 100 * p_quantity);
            v_pay_term_sum := v_pay_term_sum + (v_item_cost * v_ingredient.percentage / 100 * p_quantity * COALESCE(v_item_term, 0));
            v_cost_sum := v_cost_sum + (v_item_cost * v_ingredient.percentage / 100 * p_quantity);

            v_req_qty := (p_quantity * v_ingredient.percentage / 100);
            SELECT COALESCE(SUM(qty), 0) INTO v_avail_qty FROM lots WHERE inventory_id = v_ingredient.item_id;
            
            IF v_avail_qty < v_req_qty THEN
                RAISE EXCEPTION 'Yetersiz stok: Item ID %', v_ingredient.item_id;
            END IF;
        END;
    END LOOP;

    -- Calculate Packaging Cost
    v_pkg_qty := CEIL((p_quantity / COALESCE(v_product.density, 1)) / COALESCE(v_packaging.capacity_value, 1000));
    v_pkg_cost := v_pkg_qty * v_packaging.cost;

    -- Calculate Financing Cost
    v_avg_term := CASE WHEN v_cost_sum > 0 THEN v_pay_term_sum / v_cost_sum ELSE 0 END;
    v_fin_days := GREATEST(0, p_sale_term_days - v_avg_term);
    v_financing_cost := (v_raw_cost + v_pkg_cost + p_shipping_cost + p_overhead_cost) * (0.40 / 365) * v_fin_days;

    -- Totals
    v_total_cost := v_raw_cost + v_pkg_cost + p_shipping_cost + p_overhead_cost + v_financing_cost;
    v_unit_cost := v_total_cost / p_quantity;
    v_sale_price := v_total_cost * (1 + p_profit_margin / 100);
    v_unit_sale_price := v_sale_price / p_quantity;

    -- Generate LOT
    v_lot_number := generate_lot_number(p_user_id, p_production_date);

    -- Insert Production
    INSERT INTO productions (
        user_id, recipe_id, lot_number, quantity, production_date, packaging_id, packaging_quantity,
        raw_material_cost, packaging_cost, shipping_cost, overhead_cost, sale_term_days,
        financing_cost, total_cost, unit_cost, profit_margin_percent, profit_amount,
        sale_price, unit_sale_price, currency, notes
    ) VALUES (
        p_user_id, p_recipe_id, v_lot_number, p_quantity, p_production_date, p_packaging_id, v_pkg_qty,
        v_raw_cost, v_pkg_cost, p_shipping_cost, p_overhead_cost, p_sale_term_days,
        v_financing_cost, v_total_cost, v_unit_cost, p_profit_margin, (v_sale_price - v_total_cost),
        v_sale_price, v_unit_sale_price, p_currency, p_notes
    ) RETURNING id INTO v_production_id;

    -- Deduct Raw Materials (FIFO) & Log Movement
    FOR v_ingredient IN SELECT * FROM recipe_ingredients WHERE recipe_id = p_recipe_id LOOP
        v_remaining_qty := (p_quantity * v_ingredient.percentage / 100);
        
        -- Get Item Name
        SELECT name INTO v_item_name FROM inventory WHERE id = v_ingredient.item_id;

        -- Log Usage (Added item_name)
        SELECT COALESCE(SUM(qty), 0) - v_remaining_qty INTO v_current_stock FROM lots WHERE inventory_id = v_ingredient.item_id;
        INSERT INTO stock_movements (
            user_id, inventory_id, type, item_name, change_amount, current_stock, reason, related_id, notes
        ) VALUES (
            p_user_id, v_ingredient.item_id, 'Out', v_item_name, -v_remaining_qty, v_current_stock, 'Production_Usage', v_production_id, 'Üretim: ' || v_lot_number
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
    END LOOP;

    -- Add Finished Product to Stock & Log Movement
    INSERT INTO lots (inventory_id, lot_no, qty)
    VALUES (v_product.id, v_lot_number, p_quantity);

    SELECT COALESCE(SUM(qty), 0) INTO v_current_stock FROM lots WHERE inventory_id = v_product.id;
    
    -- Log Output (Added item_name)
    INSERT INTO stock_movements (
        user_id, inventory_id, type, item_name, change_amount, current_stock, reason, related_id, notes
    ) VALUES (
        p_user_id, v_product.id, 'In', v_product.name, p_quantity, v_current_stock, 'Production_Output', v_production_id, 'Üretim: ' || v_lot_number
    );

    RETURN json_build_object('id', v_production_id, 'lot_number', v_lot_number);
END;
$$ LANGUAGE plpgsql;


-- 3. complete_production (Updated with Interest Rate)
CREATE OR REPLACE FUNCTION complete_production(
    p_production_id BIGINT,
    p_user_id UUID,
    p_packaging_id BIGINT,
    p_shipping_cost NUMERIC,
    p_overhead_cost NUMERIC,
    p_sale_term_days NUMERIC,
    p_profit_margin NUMERIC,
    p_qc_status TEXT,
    p_qc_notes TEXT,
    p_currency TEXT,
    p_monthly_interest_rate NUMERIC DEFAULT 4
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
BEGIN
    -- Get Production Record
    SELECT * INTO v_prod FROM productions WHERE id = p_production_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Üretim kaydı bulunamadı'; END IF;
    IF v_prod.status = 'Completed' THEN RAISE EXCEPTION 'Bu üretim zaten tamamlanmış'; END IF;

    -- Get Recipe & Product
    SELECT * INTO v_recipe FROM recipes WHERE id = v_prod.recipe_id;
    SELECT * INTO v_product FROM inventory WHERE id = v_recipe.product_id;
    SELECT * INTO v_packaging FROM inventory WHERE id = p_packaging_id;

    -- Generate Real LOT Number
    v_lot_number := generate_lot_number(p_user_id, v_prod.production_date);

    -- Calculate Costs & Deduct Stock
    FOR v_ingredient IN SELECT * FROM recipe_ingredients WHERE recipe_id = v_prod.recipe_id LOOP
        DECLARE
            v_item_cost NUMERIC;
            v_item_term NUMERIC;
            v_req_qty NUMERIC;
            v_avail_qty NUMERIC;
        BEGIN
            SELECT cost, payment_term INTO v_item_cost, v_item_term 
            FROM inventory WHERE id = v_ingredient.item_id;
            
            v_req_qty := (v_prod.quantity * v_ingredient.percentage / 100);
            
            -- Check Stock
            SELECT COALESCE(SUM(qty), 0) INTO v_avail_qty FROM lots WHERE inventory_id = v_ingredient.item_id;
            IF v_avail_qty < v_req_qty THEN
                RAISE EXCEPTION 'Yetersiz stok: Item ID %', v_ingredient.item_id;
            END IF;

            -- Cost Calcs
            v_raw_cost := v_raw_cost + (v_item_cost * v_ingredient.percentage / 100 * v_prod.quantity);
            v_pay_term_sum := v_pay_term_sum + (v_item_cost * v_ingredient.percentage / 100 * v_prod.quantity * COALESCE(v_item_term, 0));
            v_cost_sum := v_cost_sum + (v_item_cost * v_ingredient.percentage / 100 * v_prod.quantity);

            -- Deduct Stock (FIFO)
            v_remaining_qty := v_req_qty;
            
            -- Get Item Name
            SELECT name INTO v_item_name FROM inventory WHERE id = v_ingredient.item_id;

            -- Log Usage (Added item_name)
            SELECT COALESCE(SUM(qty), 0) - v_remaining_qty INTO v_current_stock FROM lots WHERE inventory_id = v_ingredient.item_id;
            INSERT INTO stock_movements (
                user_id, inventory_id, type, item_name, change_amount, current_stock, reason, related_id, notes
            ) VALUES (
                p_user_id, v_ingredient.item_id, 'Out', v_item_name, -v_remaining_qty, v_current_stock, 'Production_Usage', p_production_id, 'Üretim Tamamlama: ' || v_lot_number
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
        END;
    END LOOP;

    -- Calculate Packaging Cost
    v_pkg_qty := CEIL((v_prod.quantity / COALESCE(v_product.density, 1)) / COALESCE(v_packaging.capacity_value, 1000));
    v_pkg_cost := v_pkg_qty * v_packaging.cost;

    -- Calculate Financing Cost
    v_avg_term := CASE WHEN v_cost_sum > 0 THEN v_pay_term_sum / v_cost_sum ELSE 0 END;
    v_fin_days := GREATEST(0, p_sale_term_days - v_avg_term);
    
    v_financing_cost := (v_raw_cost + v_pkg_cost + p_shipping_cost + p_overhead_cost) * (p_monthly_interest_rate / 100.0 / 30.0) * v_fin_days;

    -- Totals
    v_total_cost := v_raw_cost + v_pkg_cost + p_shipping_cost + p_overhead_cost + v_financing_cost;
    v_unit_cost := v_total_cost / v_prod.quantity;
    v_sale_price := v_total_cost * (1 + p_profit_margin / 100);
    v_unit_sale_price := v_sale_price / v_prod.quantity;

    -- Update Production Record
    UPDATE productions SET
        lot_number = v_lot_number,
        status = 'Completed',
        packaging_id = p_packaging_id,
        packaging_quantity = v_pkg_qty,
        raw_material_cost = v_raw_cost,
        packaging_cost = v_pkg_cost,
        shipping_cost = p_shipping_cost,
        overhead_cost = p_overhead_cost,
        sale_term_days = p_sale_term_days,
        financing_cost = v_financing_cost,
        total_cost = v_total_cost,
        unit_cost = v_unit_cost,
        profit_margin_percent = p_profit_margin,
        profit_amount = (v_sale_price - v_total_cost),
        sale_price = v_sale_price,
        unit_sale_price = v_unit_sale_price,
        currency = p_currency,
        qc_status = p_qc_status,
        qc_notes = p_qc_notes
    WHERE id = p_production_id;

    -- Add Finished Product to Stock
    INSERT INTO lots (inventory_id, lot_no, qty)
    VALUES (v_product.id, v_lot_number, v_prod.quantity);

    -- Log Output Movement (Added item_name)
    SELECT COALESCE(SUM(qty), 0) INTO v_current_stock FROM lots WHERE inventory_id = v_product.id;
    INSERT INTO stock_movements (
        user_id, inventory_id, type, item_name, change_amount, current_stock, reason, related_id, notes
    ) VALUES (
        p_user_id, v_product.id, 'In', v_product.name, v_prod.quantity, v_current_stock, 'Production_Output', p_production_id, 'Üretim Çıktısı: ' || v_lot_number
    );

    RETURN json_build_object('success', true, 'lot_number', v_lot_number);
END;
$$ LANGUAGE plpgsql;


-- 4. process_sale
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
    -- Get Production Info
    SELECT * INTO v_production FROM productions WHERE id = p_production_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Üretim kaydı bulunamadı'; END IF;

    SELECT * INTO v_recipe FROM recipes WHERE id = v_production.recipe_id;
    v_product_id := v_recipe.product_id;
    SELECT name INTO v_product_name FROM inventory WHERE id = v_product_id;

    -- Check Stock
    SELECT COALESCE(SUM(qty), 0) INTO v_avail_qty FROM lots WHERE inventory_id = v_product_id;
    IF v_avail_qty < p_quantity THEN
        RAISE EXCEPTION 'Yetersiz stok! Mevcut: %, İstenen: %', v_avail_qty, p_quantity;
    END IF;

    -- Insert Sale
    INSERT INTO sales (
        user_id, customer_id, production_id, product_name, lot_number, quantity,
        unit_price, currency, total_amount, sale_date, payment_term, notes
    ) VALUES (
        p_user_id, p_customer_id, p_production_id, v_product_name,
        v_production.lot_number, p_quantity, p_unit_price, p_currency,
        (p_quantity * p_unit_price), p_sale_date, p_payment_term, p_notes
    ) RETURNING id INTO v_sale_id;

    -- Deduct Stock (FIFO)
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

    -- Log Movement (Added item_name)
    SELECT COALESCE(SUM(qty), 0) INTO v_current_stock FROM lots WHERE inventory_id = v_product_id;
    INSERT INTO stock_movements (
        user_id, inventory_id, type, item_name, change_amount, current_stock, reason, related_id, notes
    ) VALUES (
        p_user_id, v_product_id, 'Out', v_product_name, -p_quantity, v_current_stock, 'Sale', v_sale_id, 'Satış: ' || v_production.lot_number
    );

    RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;
