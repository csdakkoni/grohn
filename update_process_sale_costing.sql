-- Update process_sale RPC to accept more parameters and store cost breakdown
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
    -- New Cost Parameters
    p_raw_material_cost NUMERIC DEFAULT 0,
    p_packaging_cost NUMERIC DEFAULT 0,
    p_shipping_cost NUMERIC DEFAULT 0,
    p_overhead_cost NUMERIC DEFAULT 0,
    p_financing_cost NUMERIC DEFAULT 0,
    p_total_production_cost NUMERIC DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
    v_product_id BIGINT;
    v_product_name TEXT;
    v_lot_number TEXT;
    v_total_amount NUMERIC;
    v_sale_id BIGINT;
    v_recipe_id BIGINT;
    v_current_stock NUMERIC;
    v_prod_quantity NUMERIC;
BEGIN
    -- 1. Get production details
    SELECT lot_number, recipe_id, quantity 
    INTO v_lot_number, v_recipe_id, v_prod_quantity
    FROM productions 
    WHERE id = p_production_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Üretim kaydı bulunamadı: %', p_production_id;
    END IF;

    -- 2. Get product_id from recipe
    SELECT product_id INTO v_product_id FROM recipes WHERE id = v_recipe_id;

    -- 3. Get product name
    SELECT name INTO v_product_name FROM inventory WHERE id = v_product_id;

    -- 3. Check stock (simplified check for MVP)
    -- In a real scenario, we would check specifically against the LOT in stock_movements or lots table
    -- For now, we assume the UI filtered correctly, but let's double check total inventory for this item
    -- But let's stick to the LOT logic if possible.

    v_total_amount := p_quantity * p_unit_price;

    -- 4. Insert into sales table
    INSERT INTO sales (
        user_id,
        customer_id,
        product_name,
        lot_no,
        quantity,
        unit_price,
        total_amount,
        currency,
        sale_date,
        notes,
        payment_term,
        -- Cost breakdown
        raw_material_cost,
        packaging_cost,
        shipping_cost,
        overhead_cost,
        financing_cost,
        total_production_cost
    ) VALUES (
        p_user_id,
        p_customer_id,
        v_product_name,
        v_lot_number,
        p_quantity,
        p_unit_price,
        v_total_amount,
        p_currency,
        p_sale_date,
        p_notes,
        p_payment_term,
        p_raw_material_cost,
        p_packaging_cost,
        p_shipping_cost,
        p_overhead_cost,
        p_financing_cost,
        p_total_production_cost
    ) RETURNING id INTO v_sale_id;

    -- 5. Deduct stock and record movement
    INSERT INTO stock_movements (
        user_id,
        inventory_id,
        type,
        item_name,
        amount,
        reason,
        related_id,
        notes
    ) VALUES (
        p_user_id,
        v_product_id,
        'Out',
        v_product_name,
        -p_quantity,
        'Sale',
        v_sale_id,
        'Satış ID: ' || v_sale_id || ' - Lot: ' || v_lot_number
    );

    -- 6. Also deduct from 'lots' table to maintain real-time lot tracking if lot exists
    UPDATE lots 
    SET qty = qty - p_quantity 
    WHERE inventory_id = v_product_id AND lot_no = v_lot_number;

    RETURN jsonb_build_object(
        'success', true,
        'sale_id', v_sale_id,
        'lot_number', v_lot_number
    );
END;
$$ LANGUAGE plpgsql;
