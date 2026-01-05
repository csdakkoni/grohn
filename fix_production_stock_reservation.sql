-- FINAL STOCK RESERVATION FIX
-- 1. create_production_plan: Keep check, REMOVE actual deduction
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

    -- Generate LOT (Using the existing generate_lot_number)
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
    FOR v_ingredient IN SELECT * FROM recipe_ingredients WHERE recipe_id = p_recipe_id LOOP
        v_req_qty := (p_quantity * v_ingredient.percentage / 100);
        
        SELECT name, track_stock INTO v_item_name, v_track_stock FROM inventory WHERE id = v_ingredient.item_id;

        IF v_track_stock THEN
            -- Check Availability
            SELECT COALESCE(SUM(qty), 0) INTO v_avail_qty FROM lots WHERE inventory_id = v_ingredient.item_id;
            IF v_avail_qty < v_req_qty THEN
                RAISE EXCEPTION 'Yetersiz stok: % (Mevcut: %, Gerekli: %)', v_item_name, v_avail_qty, v_req_qty;
            END IF;
            -- No deduction here! Actual deduction happens in complete_production
        END IF;
    END LOOP;

    RETURN json_build_object('success', true, 'lot_number', v_lot_number);
END;
$$ LANGUAGE plpgsql;
