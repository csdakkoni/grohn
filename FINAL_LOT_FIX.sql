-- FINAL LOT NUMBER GENERATION FIX (CORRECTED)
-- 1. Create the new Lot Generation Function (GRDDMMYY-N format)
CREATE OR REPLACE FUNCTION generate_lot_number(p_user_id UUID, p_date DATE)
RETURNS TEXT AS $$
DECLARE
    date_str TEXT;
    seq INTEGER;
    new_lot TEXT;
    exists_check BOOLEAN;
BEGIN
    date_str := to_char(p_date, 'DDMMYY');
    
    -- Find the highest sequence number for this date prefix
    -- Looking for patterns like 'GR181225-%'
    SELECT COALESCE(MAX(CAST(NULLIF(SPLIT_PART(lot_number, '-', 2), '') AS INTEGER)), 0) + 1
    INTO seq
    FROM productions
    WHERE lot_number LIKE 'GR' || date_str || '-%';

    -- Safety Loop to ensure uniqueness
    LOOP
        new_lot := 'GR' || date_str || '-' || seq::TEXT;
        
        -- Check both Productions and potential Inventory Lots to be safe
        SELECT EXISTS(SELECT 1 FROM productions WHERE lot_number = new_lot) INTO exists_check;
        
        IF NOT exists_check THEN
             -- Also check 'lots' table just in case manually created
             SELECT EXISTS(SELECT 1 FROM lots WHERE lot_no = new_lot) INTO exists_check;
             IF NOT exists_check THEN
                EXIT; -- Unique
             END IF;
        END IF;
        
        -- Collision, try next
        seq := seq + 1;
    END LOOP;

    RETURN new_lot;
END;
$$ LANGUAGE plpgsql;

-- 2. create_production_plan (MATCHING APP CALL SIGNATURE)
-- This is the function called when user clicks "Planla".
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
    v_remaining_qty NUMERIC;
    v_item_name TEXT;
    v_current_stock NUMERIC;
    v_track_stock BOOLEAN;
    v_req_qty NUMERIC;
    v_avail_qty NUMERIC;
    v_lot_id BIGINT;
    v_lot_qty NUMERIC;
BEGIN
    -- Get Recipe
    SELECT * INTO v_recipe FROM recipes WHERE id = p_recipe_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Reçete bulunamadı'; END IF;

    -- Generate LOT (Using the NEW FUNCTION)
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

    -- Deduct Raw Materials (FIFO)
    FOR v_ingredient IN SELECT * FROM recipe_ingredients WHERE recipe_id = p_recipe_id LOOP
        v_req_qty := (p_quantity * v_ingredient.percentage / 100);
        
        SELECT name, track_stock INTO v_item_name, v_track_stock FROM inventory WHERE id = v_ingredient.item_id;

        IF v_track_stock THEN
            -- Check Availability
            SELECT COALESCE(SUM(qty), 0) INTO v_avail_qty FROM lots WHERE inventory_id = v_ingredient.item_id;
            IF v_avail_qty < v_req_qty THEN
                RAISE EXCEPTION 'Yetersiz stok: % (Mevcut: %, Gerekli: %)', v_item_name, v_avail_qty, v_req_qty;
            END IF;

            -- Log Movement
            SELECT COALESCE(SUM(qty), 0) - v_req_qty INTO v_current_stock FROM lots WHERE inventory_id = v_ingredient.item_id;
            INSERT INTO stock_movements (
                user_id, inventory_id, type, item_name, amount, current_stock, reason, related_id, notes
            ) VALUES (
                p_user_id, v_ingredient.item_id, 'Out', v_item_name, -v_req_qty, v_current_stock, 'Production_Plan', v_production_id, 'Üretim Planı: ' || v_lot_number
            );

            -- FIFO Consumption
            v_remaining_qty := v_req_qty;
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
    END LOOP;

    RETURN json_build_object('success', true, 'lot_number', v_lot_number);
END;
$$ LANGUAGE plpgsql;
