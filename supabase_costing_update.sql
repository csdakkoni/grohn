-- Add missing cost columns to productions table
ALTER TABLE productions ADD COLUMN IF NOT EXISTS packaging_id BIGINT REFERENCES inventory(id);
ALTER TABLE productions ADD COLUMN IF NOT EXISTS packaging_quantity NUMERIC;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS raw_material_cost NUMERIC DEFAULT 0;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS packaging_cost NUMERIC DEFAULT 0;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC DEFAULT 0;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS overhead_cost NUMERIC DEFAULT 0;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS financing_cost NUMERIC DEFAULT 0;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS total_cost NUMERIC DEFAULT 0;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS unit_cost NUMERIC DEFAULT 0;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS sale_term_days NUMERIC DEFAULT 0;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS profit_margin_percent NUMERIC DEFAULT 0;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS profit_amount NUMERIC DEFAULT 0;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS sale_price NUMERIC DEFAULT 0;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS unit_sale_price NUMERIC DEFAULT 0;
ALTER TABLE productions ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- Update complete_production RPC to accept interest rate
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
    p_monthly_interest_rate NUMERIC DEFAULT 4 -- Default 4% monthly if not provided
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
            
            -- Log Usage
            SELECT COALESCE(SUM(qty), 0) - v_remaining_qty INTO v_current_stock FROM lots WHERE inventory_id = v_ingredient.item_id;
            INSERT INTO stock_movements (
                user_id, inventory_id, change_amount, current_stock, reason, related_id, notes
            ) VALUES (
                p_user_id, v_ingredient.item_id, -v_remaining_qty, v_current_stock, 'Production_Usage', p_production_id, 'Üretim Tamamlama: ' || v_lot_number
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
    
    -- Formula: (Total Cost) * (Monthly Rate / 100 / 30) * Days
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

    -- Log Output Movement
    SELECT COALESCE(SUM(qty), 0) INTO v_current_stock FROM lots WHERE inventory_id = v_product.id;
    INSERT INTO stock_movements (
        user_id, inventory_id, change_amount, current_stock, reason, related_id, notes
    ) VALUES (
        p_user_id, v_product.id, v_prod.quantity, v_current_stock, 'Production_Output', p_production_id, 'Üretim Çıktısı: ' || v_lot_number
    );

    RETURN json_build_object('success', true, 'lot_number', v_lot_number);
END;
$$ LANGUAGE plpgsql;
